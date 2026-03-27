const PublicPreviewLead = require('../../models/PublicPreviewLead');
const { normalizeEmail } = require('../authService');
const { sendSavedPublicPreviewEmail } = require('../email/previewCaptureEmailService');
const { AppError } = require('../../utils/errors');

function cleanText(value, maxLength = 600) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanList(value, maxItems = 8, maxLength = 180) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeSource(value) {
  return value === 'podcast_ideas' ? 'podcast_ideas' : 'episode_preview';
}

function normalizeEpisodePreviewPayload(payload = {}) {
  return {
    sourceInput: cleanText(payload.idea, 900),
    title: cleanText(payload.title, 160),
    hook: cleanText(payload.hook, 640),
    outline: cleanList(payload.outline, 6, 180),
    cta: cleanText(payload.cta, 400),
    launchPackTitles: cleanList(payload.launchPackTitles, 3, 160),
    launchPackDescription: cleanText(payload.launchPackDescription, 1200),
  };
}

function normalizePodcastIdeasPayload(payload = {}) {
  const ideas = (Array.isArray(payload.ideas) ? payload.ideas : [])
    .map((idea) => ({
      title: cleanText(idea?.title, 140),
      hookAngle: cleanText(idea?.hookAngle, 320),
    }))
    .filter((idea) => idea.title && idea.hookAngle)
    .slice(0, 10);

  return {
    sourceInput: cleanText(payload.niche, 120),
    niche: cleanText(payload.niche, 120),
    ideas,
  };
}

function assertPayload(source, payload) {
  if (source === 'podcast_ideas') {
    if (!payload.ideas.length) {
      throw new AppError('Generate podcast ideas before saving them.', 400);
    }
    return;
  }

  if (!payload.title || !payload.outline.length) {
    throw new AppError('Generate an episode preview before saving it.', 400);
  }
}

function buildLeadUpdate(source, payload, now) {
  if (source === 'podcast_ideas') {
    return {
      $set: {
        sourceInput: payload.sourceInput,
        podcastIdeas: {
          niche: payload.niche,
          ideas: payload.ideas,
        },
        lastSavedAt: now,
      },
      $unset: {
        episodePreview: 1,
      },
      $inc: {
        captureCount: 1,
      },
    };
  }

  return {
    $set: {
      sourceInput: payload.sourceInput,
      episodePreview: {
        title: payload.title,
        hook: payload.hook,
        outline: payload.outline,
        cta: payload.cta,
        launchPackTitles: payload.launchPackTitles,
        launchPackDescription: payload.launchPackDescription,
      },
      lastSavedAt: now,
    },
    $unset: {
      podcastIdeas: 1,
    },
    $inc: {
      captureCount: 1,
    },
  };
}

async function savePublicPreviewLead({ email, source, payload }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new AppError('Enter an email address to save this preview.', 400);
  }

  const normalizedSource = normalizeSource(source);
  const normalizedPayload = normalizedSource === 'podcast_ideas'
    ? normalizePodcastIdeasPayload(payload)
    : normalizeEpisodePreviewPayload(payload);

  assertPayload(normalizedSource, normalizedPayload);

  const now = new Date();
  const lead = await PublicPreviewLead.findOneAndUpdate(
    {
      email: normalizedEmail,
      source: normalizedSource,
    },
    {
      $setOnInsert: {
        email: normalizedEmail,
        source: normalizedSource,
      },
      ...buildLeadUpdate(normalizedSource, normalizedPayload, now),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  let emailResult = {
    delivered: false,
    devFallback: false,
    error: null,
  };

  try {
    emailResult = await sendSavedPublicPreviewEmail({
      email: normalizedEmail,
      source: normalizedSource,
      payload: normalizedSource === 'podcast_ideas'
        ? {
          niche: normalizedPayload.niche,
          ideas: normalizedPayload.ideas,
        }
        : normalizedPayload,
    });

    if (emailResult.delivered) {
      lead.lastSentAt = new Date();
      await lead.save();
    }
  } catch (error) {
    emailResult.error = error;
  }

  return {
    lead,
    source: normalizedSource,
    payload: normalizedPayload,
    emailDelivered: Boolean(emailResult.delivered),
    emailFallback: Boolean(emailResult.devFallback),
  };
}

module.exports = {
  normalizeEpisodePreviewPayload,
  normalizePodcastIdeasPayload,
  normalizeSource,
  savePublicPreviewLead,
};
