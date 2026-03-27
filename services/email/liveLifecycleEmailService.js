const User = require('../../models/User');
const Series = require('../../models/Series');
const Theme = require('../../models/Theme');
const Episode = require('../../models/Episode');
const Idea = require('../../models/Idea');
const { episodeEditorPath } = require('../../utils/paths');
const { sendTrialEndingEmail } = require('../billing/paymentEmailService');
const { sendAiSuggestionsEmail } = require('./aiSuggestionsEmailService');
const { sendCreatorTipsEmail } = require('./creatorTipsEmailService');
const { sendDraftReminderEmail } = require('./draftReminderEmailService');
const { sendEpisodeReadyEmail } = require('./episodeReadyEmailService');
const { sendFirstEpisodeOnboardingEmail } = require('./onboardingEmailService');
const { sendReEngagementEmail } = require('./reEngagementEmailService');
const { sendUsageLimitUpgradeEmail } = require('./usageLimitUpgradeEmailService');
const { sendWeeklySummaryEmail } = require('./weeklySummaryEmailService');

const ONBOARDING_DELAY_HOURS = 12;
const DRAFT_REMINDER_MIN_HOURS = 24;
const DRAFT_REMINDER_REPEAT_HOURS = 72;
const RE_ENGAGEMENT_DAYS = 14;
const AI_SUGGESTIONS_DAYS = 7;
const CREATOR_TIPS_DAYS = 14;

function normalizeAppUrl(appUrl) {
  const fallbackUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  return String(appUrl || fallbackUrl)
    .trim()
    .replace(/\/+$/, '');
}

function normalizeEmailAddress(value) {
  return String(value || '').trim().toLowerCase();
}

function clampText(value, maxLength = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function getDateKeyUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getIsoWeekKey(dateInput) {
  const date = new Date(Date.UTC(
    dateInput.getUTCFullYear(),
    dateInput.getUTCMonth(),
    dateInput.getUTCDate()
  ));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
  const week = Math.ceil((diffDays + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function formatDateRangeLabel(startDate, endDate) {
  const startLabel = startDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const endLabel = endDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  return `${startLabel} to ${endLabel}`;
}

function hoursSince(dateValue, now = new Date()) {
  if (!dateValue) {
    return Infinity;
  }
  return (now.getTime() - new Date(dateValue).getTime()) / (60 * 60 * 1000);
}

function daysSince(dateValue, now = new Date()) {
  if (!dateValue) {
    return Infinity;
  }
  return Math.floor((now.getTime() - new Date(dateValue).getTime()) / (24 * 60 * 60 * 1000));
}

function daysUntil(dateValue, now = new Date()) {
  if (!dateValue) {
    return Infinity;
  }
  return Math.ceil((new Date(dateValue).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function buildEpisodeUrl(episode, appUrl) {
  return `${normalizeAppUrl(appUrl)}${episodeEditorPath({
    seriesId: episode.seriesId,
    themeId: episode.themeId,
    episodeId: episode._id,
  })}`;
}

function getSafeUserActivityDate(user) {
  return user.lastActiveAt || user.updatedAt || user.createdAt || null;
}

function isMeaningfulDraft(episode) {
  if (!episode) {
    return false;
  }

  if (String(episode.status || '').trim() === 'Draft') {
    return true;
  }

  return Boolean(
    String(episode.hook || '').trim()
    || (episode.outline || []).length
    || (episode.talkingPoints || []).length
    || String(episode.transcript || '').trim()
  );
}

async function resolveUser(userInput) {
  if (!userInput) {
    return null;
  }

  if (userInput.email && userInput._id) {
    return userInput;
  }

  return User.findById(userInput);
}

async function loadEpisodeContext(episodeInput) {
  const episode = episodeInput?._id
    ? episodeInput
    : await Episode.findById(episodeInput);

  if (!episode) {
    return {};
  }

  const [user, series, theme] = await Promise.all([
    User.findById(episode.userId),
    Series.findById(episode.seriesId),
    Theme.findById(episode.themeId),
  ]);

  return { user, series, theme, episode };
}

async function getUserWorkspaceCounts(userId) {
  const [seriesCount, themeCount, episodeCount, ideaCount, draftCount, readyCount] = await Promise.all([
    Series.countDocuments({ userId }),
    Theme.countDocuments({ userId }),
    Episode.countDocuments({ userId }),
    Idea.countDocuments({ userId }),
    Episode.countDocuments({ userId, status: 'Draft' }),
    Episode.countDocuments({ userId, status: 'Ready' }),
  ]);

  return {
    seriesCount,
    themeCount,
    episodeCount,
    ideaCount,
    draftCount,
    readyCount,
  };
}

function buildDraftProgressItems(episode) {
  const items = [];

  if (episode.hook || (episode.outline || []).length > 0) {
    items.push('Your structure and angle are already started');
  }

  if ((episode.talkingPoints || []).length > 0) {
    items.push(`${episode.talkingPoints.length} talking point${episode.talkingPoints.length === 1 ? '' : 's'} already outlined`);
  }

  if (episode.showNotesPack?.updatedAt && episode.showNotesPack?.stale !== true) {
    items.push('Your show notes draft is already saved');
  }

  if (episode.scriptDoctor?.updatedAt) {
    items.push('Script feedback is already attached to this draft');
  }

  return items;
}

function buildDraftReminderNote(episode) {
  if (!episode.hook) {
    return 'Your draft already has a place in the workflow. A quick pass on the hook and outline is enough to get momentum back.';
  }

  if ((episode.outline || []).length < 3) {
    return 'The core idea is there. One focused session can turn it into a tighter outline and recording plan.';
  }

  return 'You already have real material in place. A short return session is usually enough to move it closer to Ready.';
}

function buildAiSuggestionsFromLiveData({
  latestIdea,
  latestDraft,
  latestSeries,
  latestTheme,
  counts,
}) {
  const suggestions = [];

  if (latestDraft) {
    const draftTitle = clampText(latestDraft.title || `Episode ${latestDraft.episodeNumberWithinTheme}`, 96);
    let detail = 'Your current draft is ready for a stronger next pass inside Kitchen.';

    if (!latestDraft.hook) {
      detail = 'Start by sharpening the hook so the full draft has a clearer direction.';
    } else if ((latestDraft.outline || []).length < 3) {
      detail = 'The idea is there. Strengthen the outline so the episode flows more clearly from start to finish.';
    } else if (!latestDraft.showNotesPack?.updatedAt || latestDraft.showNotesPack?.stale === true) {
      detail = 'The episode structure is already in place. Refresh show notes so the draft is easier to publish and export.';
    }

    suggestions.push({
      type: 'Draft improvement',
      title: `Tighten ${draftTitle}`,
      detail,
    });
  }

  if (latestIdea) {
    suggestions.push({
      type: 'Episode idea',
      title: clampText(latestIdea.hook, 96),
      detail: 'This Pantry idea is already saved and ready to turn into a structured episode draft.',
    });
  }

  if (latestSeries) {
    const seriesName = clampText(latestSeries.name, 72) || 'your series';
    const themeName = clampText(latestTheme?.name, 72);
    suggestions.push({
      type: 'Series angle',
      title: themeName
        ? `Build the next ${themeName} episode for ${seriesName}`
        : `Add the next episode to ${seriesName}`,
      detail: 'Use Studio for the bigger picture, then move into Kitchen to shape the next angle before recording.',
    });
  }

  if (suggestions.length === 0) {
    return [
      {
        type: 'Next step',
        title: 'Save one rough hook in Pantry',
        detail: 'The fastest way to start is to capture one real idea, then let VicPods help you structure it into an episode.',
      },
      {
        type: 'Studio',
        title: 'Create your first episode from a simple working title',
        detail: 'You do not need a polished concept yet. A clear starting title is enough to begin the workflow.',
      },
      {
        type: 'Workflow',
        title: 'Use Kitchen to shape the first outline before you record',
        detail: 'A small amount of structure up front usually makes the episode easier to finish.',
      },
    ];
  }

  return suggestions.slice(0, 3);
}

function buildAiSuggestionsNote(counts) {
  if (counts.draftCount > 0 || counts.ideaCount > 0) {
    return 'Based on what is already in your workspace, here are a few smart next moves to keep your podcast workflow moving.';
  }

  if (counts.seriesCount > 0) {
    return 'Here are a few useful ways to turn what is already in your Studio into the next structured episode.';
  }

  return 'Here are a few useful ways to start your VicPods workflow without overthinking the first step.';
}

function pushTip(tips, title, detail) {
  if (!title || tips.some((item) => item.title === title)) {
    return;
  }

  tips.push({ title, detail });
}

function buildCreatorTipsFromLiveData(counts) {
  const tips = [];

  if (counts.episodeCount === 0) {
    pushTip(
      tips,
      'Start with the listener outcome before you build the first outline',
      'You do not have an episode in the workspace yet, so the clearest first step is deciding what the listener should leave with.'
    );
  } else if (counts.draftCount > 0) {
    pushTip(
      tips,
      'Finish the structure before polishing the wording',
      `You already have ${counts.draftCount} draft${counts.draftCount === 1 ? '' : 's'} in progress, so the biggest win is tightening the flow before line edits.`
    );
  }

  if (counts.ideaCount > 0) {
    pushTip(
      tips,
      'Use Pantry as your ingredient shelf, not just a notes list',
      `${counts.ideaCount} saved idea${counts.ideaCount === 1 ? '' : 's'} can become stronger episode openings when you group and reuse them intentionally.`
    );
  } else {
    pushTip(
      tips,
      'Save rough hooks in Pantry the moment they appear',
      'A small backlog of real hooks makes it much easier to start the next episode without staring at a blank page.'
    );
  }

  if (counts.readyCount > 0) {
    pushTip(
      tips,
      'Use Ready as the handoff point, not the brainstorm stage',
      `${counts.readyCount} episode${counts.readyCount === 1 ? '' : 's'} already marked Ready can guide the quality bar for new drafts.`
    );
  } else if (counts.seriesCount > 0) {
    pushTip(
      tips,
      'Use Studio to spot the next gap across your series',
      'When you already have series in motion, the fastest progress usually comes from seeing what topic or theme should come next.'
    );
  }

  pushTip(
    tips,
    'Move a draft forward when the opening, body, and close point in the same direction',
    'That simple check usually improves recording clarity more than adding another section.'
  );

  return tips.slice(0, 3);
}

function buildSuggestedReEngagementAction({ latestDraft, latestSeries, ideaCount, appUrl }) {
  if (latestDraft) {
    const title = clampText(latestDraft.title || `Episode ${latestDraft.episodeNumberWithinTheme}`, 72);
    return {
      suggestedActionLabel: `Continue ${title}`,
      suggestedActionUrl: buildEpisodeUrl(latestDraft, appUrl),
      suggestedActionBody: 'Your most recent draft is already waiting with structure in place, so this is the cleanest way back into the workflow.',
    };
  }

  if (ideaCount > 0) {
    return {
      suggestedActionLabel: 'Open Pantry',
      suggestedActionUrl: `${normalizeAppUrl(appUrl)}/pantry`,
      suggestedActionBody: 'Your saved ideas are still there. Reopening Pantry is a simple way to pick a direction and turn it into the next episode.',
    };
  }

  if (latestSeries) {
    return {
      suggestedActionLabel: `Open ${clampText(latestSeries.name, 60)}`,
      suggestedActionUrl: `${normalizeAppUrl(appUrl)}/kitchen/${latestSeries._id}`,
      suggestedActionBody: 'Step back into your main series workspace and choose the next episode move from there.',
    };
  }

  return {
    suggestedActionLabel: 'Create your next episode',
    suggestedActionUrl: `${normalizeAppUrl(appUrl)}/create/single`,
    suggestedActionBody: 'The easiest way back in is to start one focused episode and rebuild momentum from a real topic.',
  };
}

function buildTrialEmailKey(user, daysRemaining) {
  return `${getDateKeyUtc(new Date(user.currentPeriodEnd))}:${daysRemaining}`;
}

async function sendFirstEpisodeOnboardingEmailForUser(userInput, { now = new Date(), dryRun = false, force = false } = {}) {
  const user = await resolveUser(userInput);
  if (!user || !user.emailVerified) {
    return { sent: false, reason: 'missing_or_unverified_user' };
  }

  if (!force) {
    if (user.firstEpisodeOnboardingEmailSentAt) {
      return { sent: false, reason: 'already_sent' };
    }
    if (hoursSince(user.createdAt, now) < ONBOARDING_DELAY_HOURS) {
      return { sent: false, reason: 'too_early' };
    }
  }

  const episodeCount = await Episode.countDocuments({ userId: user._id });
  if (!force && episodeCount > 0) {
    return { sent: false, reason: 'already_started' };
  }

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendFirstEpisodeOnboardingEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
  });

  if (result.delivered) {
    user.firstEpisodeOnboardingEmailSentAt = now;
    await user.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function sendEpisodeReadyEmailForEpisode(episodeInput, { dryRun = false, force = false } = {}) {
  const { user, series, theme, episode } = await loadEpisodeContext(episodeInput);
  if (!user || !series || !theme || !episode || !user.emailVerified) {
    return { sent: false, reason: 'missing_context' };
  }

  if (!isMeaningfulDraft(episode)) {
    return { sent: false, reason: 'episode_not_ready' };
  }

  if (!force && episode.readyEmailSentAt) {
    return { sent: false, reason: 'already_sent' };
  }

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendEpisodeReadyEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
    episodeUrl: buildEpisodeUrl(episode, normalizeAppUrl()),
    title: episode.title,
    seriesName: series.name,
    themeName: theme.name,
    hook: episode.hook,
    outlineCount: (episode.outline || []).length,
    talkingPointsCount: (episode.talkingPoints || []).length,
    transcriptReady: Boolean(String(episode.transcript || '').trim()),
    showNotesReady: Boolean(episode.showNotesPack?.updatedAt && episode.showNotesPack?.stale !== true),
    scriptDoctorReady: Boolean(episode.scriptDoctor?.updatedAt),
  });

  if (result.delivered) {
    episode.readyEmailSentAt = new Date();
    await episode.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function sendDraftReminderEmailForEpisode(episodeInput, { now = new Date(), dryRun = false, force = false } = {}) {
  const { user, series, theme, episode } = await loadEpisodeContext(episodeInput);
  if (!user || !series || !theme || !episode || !user.emailVerified) {
    return { sent: false, reason: 'missing_context' };
  }

  if (!isMeaningfulDraft(episode)) {
    return { sent: false, reason: 'not_meaningful_draft' };
  }

  if (!force) {
    if (hoursSince(episode.updatedAt, now) < DRAFT_REMINDER_MIN_HOURS) {
      return { sent: false, reason: 'not_due' };
    }
    if (hoursSince(episode.lastDraftReminderEmailSentAt, now) < DRAFT_REMINDER_REPEAT_HOURS) {
      return { sent: false, reason: 'recently_sent' };
    }
  }

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendDraftReminderEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
    episodeUrl: buildEpisodeUrl(episode, normalizeAppUrl()),
    title: episode.title,
    seriesName: series.name,
    themeName: theme.name,
    lastUpdatedAt: episode.updatedAt,
    reminderNote: buildDraftReminderNote(episode),
    progressItems: buildDraftProgressItems(episode),
    hook: episode.hook,
    outlineCount: (episode.outline || []).length,
    talkingPointsCount: (episode.talkingPoints || []).length,
    showNotesReady: Boolean(episode.showNotesPack?.updatedAt && episode.showNotesPack?.stale !== true),
  });

  if (result.delivered) {
    episode.lastDraftReminderEmailSentAt = now;
    await episode.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function sendUsageLimitUpgradeEmailForUser(userInput, {
  now = new Date(),
  dryRun = false,
  force = false,
  limitLabel = 'AI generations today',
  usedCount = null,
} = {}) {
  const user = await resolveUser(userInput);
  if (!user || !user.emailVerified) {
    return { sent: false, reason: 'missing_or_unverified_user' };
  }

  if (!['free', 'pro'].includes(String(user.plan || 'free'))) {
    return { sent: false, reason: 'unsupported_plan' };
  }

  const dateKey = getDateKeyUtc(now);
  if (!force && user.lastUsageLimitUpgradeEmailDateKey === dateKey) {
    return { sent: false, reason: 'already_sent_today' };
  }

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendUsageLimitUpgradeEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
    currentPlan: user.plan,
    limitLabel,
    usedCount,
    resetNote: 'Your work is still there. If you want more room to keep creating today, upgrading gives you more headroom immediately.',
  });

  if (result.delivered) {
    user.lastUsageLimitUpgradeEmailSentAt = now;
    user.lastUsageLimitUpgradeEmailDateKey = dateKey;
    await user.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function sendReEngagementEmailForUser(userInput, { now = new Date(), dryRun = false, force = false } = {}) {
  const user = await resolveUser(userInput);
  if (!user || !user.emailVerified) {
    return { sent: false, reason: 'missing_or_unverified_user' };
  }

  const activityDate = getSafeUserActivityDate(user);
  const inactivityDays = daysSince(activityDate, now);
  if (!force && inactivityDays < RE_ENGAGEMENT_DAYS) {
    return { sent: false, reason: 'not_inactive_enough' };
  }

  if (!force && user.lastReEngagementEmailSentAt && new Date(user.lastReEngagementEmailSentAt) >= new Date(activityDate)) {
    return { sent: false, reason: 'already_sent_for_current_inactivity' };
  }

  const [counts, latestDraft, latestSeries] = await Promise.all([
    getUserWorkspaceCounts(user._id),
    Episode.findOne({ userId: user._id, status: 'Draft' }).sort({ updatedAt: -1 }),
    Series.findOne({ userId: user._id }).sort({ updatedAt: -1 }),
  ]);

  if (!force && counts.seriesCount === 0 && counts.ideaCount === 0 && counts.episodeCount === 0) {
    return { sent: false, reason: 'no_workspace_data' };
  }

  const action = buildSuggestedReEngagementAction({
    latestDraft,
    latestSeries,
    ideaCount: counts.ideaCount,
    appUrl: normalizeAppUrl(),
  });

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendReEngagementEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
    daysInactive: inactivityDays,
    hasDrafts: counts.draftCount > 0,
    hasSeries: counts.seriesCount > 0,
    hasPantryItems: counts.ideaCount > 0,
    ...action,
  });

  if (result.delivered) {
    user.lastReEngagementEmailSentAt = now;
    await user.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function buildWeeklySummaryContext(user, { now = new Date() } = {}) {
  const end = new Date(now);
  const start = new Date(end.getTime() - (7 * 24 * 60 * 60 * 1000));

  const [
    counts,
    weeklyEpisodes,
    weeklyIdeas,
    weeklyReady,
    recentEpisodes,
    recentIdeas,
  ] = await Promise.all([
    getUserWorkspaceCounts(user._id),
    Episode.countDocuments({ userId: user._id, createdAt: { $gte: start, $lt: end } }),
    Idea.countDocuments({ userId: user._id, createdAt: { $gte: start, $lt: end } }),
    Episode.countDocuments({
      userId: user._id,
      status: 'Ready',
      updatedAt: { $gte: start, $lt: end },
    }),
    Episode.find({ userId: user._id, updatedAt: { $gte: start, $lt: end } })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('title status'),
    Idea.find({ userId: user._id, updatedAt: { $gte: start, $lt: end } })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('hook tag'),
  ]);

  return {
    counts,
    weeklyEpisodes,
    weeklyIdeas,
    weeklyReady,
    recentEpisodes,
    recentIdeas,
    weekLabel: formatDateRangeLabel(start, end),
    weekKey: getIsoWeekKey(end),
  };
}

async function sendWeeklySummaryEmailForUser(userInput, { now = new Date(), dryRun = false, force = false } = {}) {
  const user = await resolveUser(userInput);
  if (!user || !user.emailVerified) {
    return { sent: false, reason: 'missing_or_unverified_user' };
  }

  const context = await buildWeeklySummaryContext(user, { now });

  if (!force && user.lastWeeklySummaryEmailWeekKey === context.weekKey) {
    return { sent: false, reason: 'already_sent_this_week' };
  }

  if (!force) {
    const inactivityDays = daysSince(getSafeUserActivityDate(user), now);
    const hasRecentActivity = context.weeklyEpisodes > 0 || context.weeklyIdeas > 0 || context.weeklyReady > 0;
    if (!hasRecentActivity && inactivityDays >= RE_ENGAGEMENT_DAYS) {
      return { sent: false, reason: 'prefer_reengagement' };
    }
    if (context.counts.seriesCount === 0 && context.counts.ideaCount === 0 && context.counts.episodeCount === 0) {
      return { sent: false, reason: 'no_workspace_data' };
    }
  }

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendWeeklySummaryEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
    weeklyEpisodes: context.weeklyEpisodes,
    weeklyIdeas: context.weeklyIdeas,
    weeklyReady: context.weeklyReady,
    totalSeries: context.counts.seriesCount,
    totalEpisodes: context.counts.episodeCount,
    totalIdeas: context.counts.ideaCount,
    recentEpisodes: context.recentEpisodes,
    recentIdeas: context.recentIdeas,
    weekLabel: context.weekLabel,
  });

  if (result.delivered) {
    user.lastWeeklySummaryEmailSentAt = now;
    user.lastWeeklySummaryEmailWeekKey = context.weekKey;
    await user.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function sendAiSuggestionsEmailForUser(userInput, { now = new Date(), dryRun = false, force = false } = {}) {
  const user = await resolveUser(userInput);
  if (!user || !user.emailVerified) {
    return { sent: false, reason: 'missing_or_unverified_user' };
  }

  const weekKey = getIsoWeekKey(now);
  if (!force && user.lastAiSuggestionsEmailWeekKey === weekKey) {
    return { sent: false, reason: 'already_sent_this_week' };
  }

  const inactivityDays = daysSince(getSafeUserActivityDate(user), now);
  if (!force && inactivityDays < AI_SUGGESTIONS_DAYS) {
    return { sent: false, reason: 'user_recently_active' };
  }

  const [counts, latestIdea, latestDraft, latestSeries, latestTheme] = await Promise.all([
    getUserWorkspaceCounts(user._id),
    Idea.findOne({ userId: user._id }).sort({ updatedAt: -1 }),
    Episode.findOne({ userId: user._id, status: 'Draft' }).sort({ updatedAt: -1 }),
    Series.findOne({ userId: user._id }).sort({ updatedAt: -1 }),
    Theme.findOne({ userId: user._id }).sort({ updatedAt: -1 }),
  ]);

  const suggestions = buildAiSuggestionsFromLiveData({
    latestIdea,
    latestDraft,
    latestSeries,
    latestTheme,
    counts,
  });

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendAiSuggestionsEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
    suggestions,
    introNote: buildAiSuggestionsNote(counts),
  });

  if (result.delivered) {
    user.lastAiSuggestionsEmailSentAt = now;
    user.lastAiSuggestionsEmailWeekKey = weekKey;
    await user.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function sendCreatorTipsEmailForUser(userInput, { now = new Date(), dryRun = false, force = false } = {}) {
  const user = await resolveUser(userInput);
  if (!user || !user.emailVerified) {
    return { sent: false, reason: 'missing_or_unverified_user' };
  }

  const weekKey = getIsoWeekKey(now);
  if (!force && user.lastCreatorTipsEmailWeekKey === weekKey) {
    return { sent: false, reason: 'already_sent_this_week' };
  }

  if (!force && daysSince(user.lastCreatorTipsEmailSentAt, now) < CREATOR_TIPS_DAYS) {
    return { sent: false, reason: 'recently_sent' };
  }

  const counts = await getUserWorkspaceCounts(user._id);
  if (!force && counts.seriesCount === 0 && counts.ideaCount === 0 && counts.episodeCount === 0) {
    return { sent: false, reason: 'no_workspace_data' };
  }

  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendCreatorTipsEmail({
    to: user.email,
    name: user.name,
    appUrl: normalizeAppUrl(),
    tips: buildCreatorTipsFromLiveData(counts),
    introNote: 'A few short workflow tips based on how your VicPods workspace is taking shape.',
  });

  if (result.delivered) {
    user.lastCreatorTipsEmailSentAt = now;
    user.lastCreatorTipsEmailWeekKey = weekKey;
    await user.save();
    return { sent: true, reason: 'delivered' };
  }

  return { sent: false, reason: result.devFallback ? 'dev_fallback' : 'not_delivered' };
}

async function sendTrialEndingEmailForUser(userInput, { now = new Date(), dryRun = false, force = false } = {}) {
  const user = await resolveUser(userInput);
  if (!user || !user.emailVerified) {
    return { sent: false, reason: 'missing_or_unverified_user' };
  }

  if (String(user.planStatus || '').trim() !== 'trialing' || !user.currentPeriodEnd) {
    return { sent: false, reason: 'not_trialing' };
  }

  const daysRemaining = daysUntil(user.currentPeriodEnd, now);
  if (!force && ![3, 2, 1].includes(daysRemaining)) {
    return { sent: false, reason: 'not_due' };
  }

  const emailKey = buildTrialEmailKey(user, daysRemaining);
  if (!force && user.lastTrialEndingEmailKey === emailKey) {
    return { sent: false, reason: 'already_sent' };
  }

  const counts = await getUserWorkspaceCounts(user._id);
  if (dryRun) {
    return { sent: false, reason: 'dry_run', wouldSend: true };
  }

  const result = await sendTrialEndingEmail({
    user,
    plan: user.plan,
    daysRemaining,
    trialEndsAt: user.currentPeriodEnd,
    usage: counts,
  });

  if (result.sent) {
    user.lastTrialEndingEmailSentAt = now;
    user.lastTrialEndingEmailKey = emailKey;
    await user.save();
    return { sent: true, reason: 'delivered' };
  }

  return result;
}

async function findDueDraftReminderEpisodeForUser(userId, now = new Date()) {
  const candidates = await Episode.find({
    userId,
    status: 'Draft',
    updatedAt: { $lte: new Date(now.getTime() - (DRAFT_REMINDER_MIN_HOURS * 60 * 60 * 1000)) },
  }).sort({ updatedAt: -1 }).limit(5);

  return candidates.find((episode) => (
    isMeaningfulDraft(episode)
    && hoursSince(episode.lastDraftReminderEmailSentAt, now) >= DRAFT_REMINDER_REPEAT_HOURS
  )) || null;
}

function normalizeCampaignList(campaigns) {
  const values = Array.isArray(campaigns) ? campaigns : [campaigns || 'all'];
  const normalized = values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : ['all'];
}

function campaignEnabled(campaigns, name) {
  return campaigns.includes('all') || campaigns.includes(name);
}

async function runLifecycleEmailCampaigns({
  campaigns = ['all'],
  userEmail = '',
  dryRun = false,
  now = new Date(),
} = {}) {
  const normalizedCampaigns = normalizeCampaignList(campaigns);
  const query = { emailVerified: true };
  const normalizedEmail = normalizeEmailAddress(userEmail);

  if (normalizedEmail) {
    query.email = normalizedEmail;
  }

  const users = await User.find(query).sort({ createdAt: 1 });
  const results = [];

  for (const user of users) {
    if (campaignEnabled(normalizedCampaigns, 'onboarding')) {
      results.push({
        email: user.email,
        campaign: 'onboarding',
        ...await sendFirstEpisodeOnboardingEmailForUser(user, { now, dryRun }),
      });
    }

    if (campaignEnabled(normalizedCampaigns, 'drafts')) {
      const draftEpisode = await findDueDraftReminderEpisodeForUser(user._id, now);
      results.push({
        email: user.email,
        campaign: 'drafts',
        ...(
          draftEpisode
            ? await sendDraftReminderEmailForEpisode(draftEpisode, { now, dryRun })
            : { sent: false, reason: 'no_due_draft' }
        ),
      });
    }

    if (campaignEnabled(normalizedCampaigns, 'reengagement')) {
      results.push({
        email: user.email,
        campaign: 'reengagement',
        ...await sendReEngagementEmailForUser(user, { now, dryRun }),
      });
    }

    if (campaignEnabled(normalizedCampaigns, 'weekly')) {
      results.push({
        email: user.email,
        campaign: 'weekly',
        ...await sendWeeklySummaryEmailForUser(user, { now, dryRun }),
      });
    }

    if (campaignEnabled(normalizedCampaigns, 'ai-suggestions')) {
      results.push({
        email: user.email,
        campaign: 'ai-suggestions',
        ...await sendAiSuggestionsEmailForUser(user, { now, dryRun }),
      });
    }

    if (campaignEnabled(normalizedCampaigns, 'creator-tips')) {
      results.push({
        email: user.email,
        campaign: 'creator-tips',
        ...await sendCreatorTipsEmailForUser(user, { now, dryRun }),
      });
    }

    if (campaignEnabled(normalizedCampaigns, 'trial-ending')) {
      results.push({
        email: user.email,
        campaign: 'trial-ending',
        ...await sendTrialEndingEmailForUser(user, { now, dryRun }),
      });
    }
  }

  const summary = results.reduce((accumulator, item) => {
    accumulator.total += 1;
    if (item.sent) {
      accumulator.sent += 1;
    } else {
      accumulator.skipped += 1;
    }
    return accumulator;
  }, {
    total: 0,
    sent: 0,
    skipped: 0,
  });

  return {
    usersProcessed: users.length,
    results,
    summary,
  };
}

module.exports = {
  sendFirstEpisodeOnboardingEmailForUser,
  sendEpisodeReadyEmailForEpisode,
  sendDraftReminderEmailForEpisode,
  sendUsageLimitUpgradeEmailForUser,
  sendReEngagementEmailForUser,
  sendWeeklySummaryEmailForUser,
  sendAiSuggestionsEmailForUser,
  sendCreatorTipsEmailForUser,
  sendTrialEndingEmailForUser,
  runLifecycleEmailCampaigns,
};
