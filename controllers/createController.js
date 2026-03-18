const Episode = require('../models/Episode');
const Series = require('../models/Series');
const Theme = require('../models/Theme');
const aiService = require('../services/ai/aiService');
const { getOrCreateSingleCollection } = require('../services/systemSeries/getOrCreateSingleCollection');
const {
  getNextThemeEpisodeNumber,
  getNextGlobalEpisodeNumber,
} = require('../services/themeService');
const { TONE_PRESETS } = require('../services/tone/tonePresets');
const {
  INTENT_OPTIONS,
  AUDIENCE_TYPES,
  getMaxIntensityForPlan,
  normalizeSeriesToneInput,
  resolveEffectiveTone,
} = require('../services/tone/toneService');
const {
  CTA_STYLE_OPTIONS,
  EPISODE_TYPE_OPTIONS,
  FORMAT_TEMPLATE_OPTIONS,
  HOOK_STYLE_OPTIONS,
  TARGET_LENGTH_OPTIONS,
  normalizeEpisodeStructureInput,
  normalizeSeriesStructureInput,
  normalizeShowBlueprintInput,
} = require('../services/structure/structureService');
const {
  DELIVERY_STYLE_OPTIONS,
  normalizeEpisodeWritingSettings,
  normalizeSeriesWritingSettings,
  refreshEpisodeWritingIntelligence,
} = require('../services/writing/writingIntelligenceService');
const {
  normalizeSeriesBibleInput,
} = require('../services/series/seriesPlanningService');
const { computeToneConsistencyScore } = require('../services/tone/consistencyScore');
const { AppError } = require('../utils/errors');
const { episodeEditorPath } = require('../utils/paths');
const { renderPage } = require('../utils/render');

function parseThemeNames(rawValue) {
  return String(rawValue || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildThemeSuggestions({ seriesName, goal, intent }) {
  const topic = String(seriesName || 'Podcast').trim();
  const mainGoal = String(goal || 'consistent audience growth').trim();
  const focus = String(intent || 'educate').trim();

  return [
    `${topic}: Foundations`,
    `${focus.charAt(0).toUpperCase() + focus.slice(1)} Frameworks`,
    `Audience Wins & Experiments`,
    `From Insight to Action (${mainGoal})`,
  ];
}

function buildSingleSeriesContext({ systemSeries, body, toneInput }) {
  return {
    ...systemSeries.toObject(),
    name: body.title || 'Single Episode',
    description: String(body.description || '').trim(),
    audience: String(body.audienceNotes || '').trim(),
    audienceType: toneInput.audienceType || 'Mixed',
    intent: toneInput.intent,
    voicePersona: toneInput.voicePersona,
    goal: String(body.goal || `Deliver a standalone episode with clear value on ${body.title || 'this topic'}.`).trim(),
    tonePreset: toneInput.tonePreset,
    toneIntensity: toneInput.toneIntensity,
  };
}

async function showCreateHub(req, res, next) {
  try {
    return res.redirect('/kitchen');
  } catch (error) {
    return next(error);
  }
}

async function showSingleWizard(req, res, next) {
  try {
    const effectivePlan = req.effectivePlan || 'free';

    return renderPage(res, {
      title: req.t('page.create.single.title', 'Create Single Episode - VicPods'),
      pageTitle: req.t('page.create.single.header', 'Create: Single Episode'),
      subtitle: req.t('page.create.single.subtitle', 'Fast path for standalone, high-quality episodes.'),
      view: 'create/single',
      data: {
        tonePresets: TONE_PRESETS,
        intentOptions: INTENT_OPTIONS,
        audienceTypes: AUDIENCE_TYPES,
        ctaStyleOptions: CTA_STYLE_OPTIONS,
        episodeTypeOptions: EPISODE_TYPE_OPTIONS,
        formatTemplateOptions: FORMAT_TEMPLATE_OPTIONS,
        hookStyleOptions: HOOK_STYLE_OPTIONS,
        targetLengthOptions: TARGET_LENGTH_OPTIONS,
        deliveryStyleOptions: DELIVERY_STYLE_OPTIONS,
        maxToneIntensity: getMaxIntensityForPlan(effectivePlan),
        effectivePlan,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function createSingleEpisode(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const effectivePlan = req.effectivePlan || req.currentUser?.plan || 'free';
    const title = String(req.body.title || '').trim();

    if (!title) {
      throw new AppError('Topic title is required.', 400);
    }

    const toneInput = normalizeSeriesToneInput(req.body, effectivePlan);
    const showBlueprint = normalizeShowBlueprintInput(req.body);
    const episodeStructure = normalizeEpisodeStructureInput(req.body);
    const writingSettings = normalizeEpisodeWritingSettings(req.body);
    const includeFunSegment = episodeStructure.includeFunSegment;
    const episodeType = episodeStructure.episodeType;
    const targetLength = episodeStructure.targetLength;

    const { series, theme } = await getOrCreateSingleCollection(userId);

    const [episodeNumberWithinTheme, globalEpisodeNumber] = await Promise.all([
      getNextThemeEpisodeNumber({ userId, seriesId: series._id, themeId: theme._id }),
      getNextGlobalEpisodeNumber({ userId, seriesId: series._id }),
    ]);

    const episode = await Episode.create({
      userId,
      seriesId: series._id,
      themeId: theme._id,
      episodeNumberWithinTheme,
      episodeNumber: globalEpisodeNumber,
      globalEpisodeNumber,
      title,
      status: 'Draft',
      isSingle: true,
      episodeType,
      targetLength,
      includeFunSegment,
      toneOverridePreset: toneInput.tonePreset,
      toneOverrideIntensity: toneInput.toneIntensity,
      formatTemplate: episodeStructure.formatTemplate,
      hookStyle: episodeStructure.hookStyle,
      deliveryStyle: writingSettings.deliveryStyle,
      showBlueprint,
    });

    const seriesContext = buildSingleSeriesContext({
      systemSeries: series,
      body: req.body,
      toneInput,
    });
    seriesContext.showBlueprint = showBlueprint;
    seriesContext.defaultEpisodeType = episodeStructure.episodeType;
    seriesContext.defaultTargetLength = episodeStructure.targetLength;
    seriesContext.defaultIncludeFunSegment = episodeStructure.includeFunSegment;
    seriesContext.defaultFormatTemplate = episodeStructure.formatTemplate;
    seriesContext.defaultHookStyle = episodeStructure.hookStyle;
    seriesContext.defaultDeliveryStyle = writingSettings.deliveryStyle;

    const effectiveTone = resolveEffectiveTone({
      series: seriesContext,
      episode,
      plan: effectivePlan,
    });

    const generated = await aiService.generateEpisodeDraft({
      language: req.language,
      series: seriesContext,
      theme,
      episode,
      episodeNumberWithinTheme,
      globalEpisodeNumber,
      previousEpisodeEndState: null,
      existingEpisodeTitles: [],
      ingredientHooks: [],
      existingTitle: title,
      effectiveTone,
      episodeType,
      targetLength,
      includeFunSegment,
      isStandalone: true,
      requireTeaser: false,
    });

    episode.title = generated.title || episode.title;
    episode.hook = generated.hook;
    episode.outline = generated.outline;
    episode.talkingPoints = generated.talkingPoints;
    episode.hostQuestions = generated.hostQuestions;
    episode.funSegment = includeFunSegment ? generated.funSegment : '';
    episode.ending = generated.ending;
    episode.endState = generated.endState;

    const toneCheck = computeToneConsistencyScore({
      episode,
      tonePreset: effectiveTone.tonePreset,
      toneIntensity: effectiveTone.toneIntensity,
    });
    episode.toneScore = toneCheck.toneScore;
    episode.toneWarnings = toneCheck.warnings;
    refreshEpisodeWritingIntelligence(episode, req.language);

    await episode.save();

    req.flash('success', 'Single episode draft generated. Now refine and set to Ready.');
    return res.redirect(episodeEditorPath({
      seriesId: series._id,
      themeId: theme._id,
      episodeId: episode._id,
    }));
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/create/single');
    }

    return next(error);
  }
}

async function showSeriesWizard(req, res, next) {
  try {
    const effectivePlan = req.effectivePlan || 'free';

    return renderPage(res, {
      title: req.t('page.create.series.title', 'Create Series - VicPods'),
      pageTitle: req.t('page.create.series.header', 'Create: Series'),
      subtitle: req.t('page.create.series.subtitle', 'Set up a continuity-driven multi-episode arc in minutes.'),
      view: 'create/series',
      data: {
        tonePresets: TONE_PRESETS,
        intentOptions: INTENT_OPTIONS,
        audienceTypes: AUDIENCE_TYPES,
        ctaStyleOptions: CTA_STYLE_OPTIONS,
        episodeTypeOptions: EPISODE_TYPE_OPTIONS,
        formatTemplateOptions: FORMAT_TEMPLATE_OPTIONS,
        hookStyleOptions: HOOK_STYLE_OPTIONS,
        targetLengthOptions: TARGET_LENGTH_OPTIONS,
        deliveryStyleOptions: DELIVERY_STYLE_OPTIONS,
        maxToneIntensity: getMaxIntensityForPlan(effectivePlan),
        effectivePlan,
        canSuggestThemes: effectivePlan === 'pro' || effectivePlan === 'premium',
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function createSeriesFlow(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const effectivePlan = req.effectivePlan || req.currentUser?.plan || 'free';
    const name = String(req.body.name || '').trim();

    if (!name) {
      throw new AppError('Series name is required.', 400);
    }

    const toneInput = normalizeSeriesToneInput(req.body, effectivePlan);
    const showBlueprint = normalizeShowBlueprintInput(req.body);
    const seriesBible = normalizeSeriesBibleInput(req.body, {
      goal: req.body.goal,
      showBlueprint,
    });
    const structureDefaults = normalizeSeriesStructureInput(req.body);
    const writingSettings = normalizeSeriesWritingSettings(req.body);
    const themeNames = parseThemeNames(req.body.themeNames);
    const episodesPerTheme = Number.parseInt(req.body.episodesPerTheme, 10);
    const includeFunSegment = structureDefaults.defaultIncludeFunSegment;
    const episodeType = structureDefaults.defaultEpisodeType;
    const targetLength = structureDefaults.defaultTargetLength;

    const series = await Series.create({
      userId,
      name,
      description: String(req.body.description || '').trim(),
      audience: String(req.body.audienceNotes || '').trim(),
      audienceType: toneInput.audienceType,
      intent: toneInput.intent,
      goal: String(req.body.goal || '').trim(),
      tonePreset: toneInput.tonePreset,
      toneIntensity: toneInput.toneIntensity,
      voicePersona: toneInput.voicePersona,
      showBlueprint,
      seriesBible,
      defaultEpisodeType: structureDefaults.defaultEpisodeType,
      defaultTargetLength: structureDefaults.defaultTargetLength,
      defaultIncludeFunSegment: structureDefaults.defaultIncludeFunSegment,
      defaultFormatTemplate: structureDefaults.defaultFormatTemplate,
      defaultHookStyle: structureDefaults.defaultHookStyle,
      defaultDeliveryStyle: writingSettings.defaultDeliveryStyle,
      creationMode: 'series',
      isSystem: false,
      plannedEpisodeCount: Number.isInteger(episodesPerTheme) && episodesPerTheme > 0
        ? episodesPerTheme * Math.max(themeNames.length, 1)
        : 0,
      tone: 'fun',
      seriesSummary: '',
    });

    const namesToCreate = themeNames.length ? themeNames : ['General'];
    const themes = await Promise.all(namesToCreate.map((themeName, index) => Theme.create({
      userId,
      seriesId: series._id,
      name: themeName,
      description: '',
      orderIndex: index,
      isSystem: false,
      themeSummary: '',
    })));

    const toCreatePerTheme = Number.isInteger(episodesPerTheme) && episodesPerTheme > 0
      ? Math.min(episodesPerTheme, 30)
      : 0;

    let globalCounter = await getNextGlobalEpisodeNumber({ userId, seriesId: series._id });
    const createdEpisodes = [];

    for (let themeIndex = 0; themeIndex < themes.length; themeIndex += 1) {
      const theme = themes[themeIndex];
      const localCount = toCreatePerTheme > 0 ? toCreatePerTheme : (themeIndex === 0 ? 1 : 0);

      for (let i = 1; i <= localCount; i += 1) {
        const episode = await Episode.create({
          userId,
          seriesId: series._id,
          themeId: theme._id,
          episodeNumberWithinTheme: i,
          episodeNumber: globalCounter,
          globalEpisodeNumber: globalCounter,
          title: `Episode ${i}`,
          status: 'Planned',
          isSingle: false,
          episodeType,
          targetLength,
          includeFunSegment,
          formatTemplate: structureDefaults.defaultFormatTemplate,
          hookStyle: structureDefaults.defaultHookStyle,
          deliveryStyle: writingSettings.defaultDeliveryStyle,
        });

        globalCounter += 1;
        createdEpisodes.push({ episode, theme });
      }
    }

    const first = createdEpisodes[0];
    const shouldGenerateFirstDraft = req.body.generateFirstDraft === 'on';

    if (first && shouldGenerateFirstDraft) {
      const effectiveTone = resolveEffectiveTone({
        series,
        episode: first.episode,
        plan: effectivePlan,
      });

      const generated = await aiService.generateEpisodeDraft({
        language: req.language,
        series,
        theme: first.theme,
        episode: first.episode,
        episodeNumberWithinTheme: first.episode.episodeNumberWithinTheme,
        globalEpisodeNumber: first.episode.globalEpisodeNumber,
        previousEpisodeEndState: null,
        existingEpisodeTitles: [],
        ingredientHooks: [],
        existingTitle: first.episode.title,
        effectiveTone,
        episodeType,
        targetLength,
        includeFunSegment,
        isStandalone: false,
        requireTeaser: true,
      });

      first.episode.status = 'Draft';
      first.episode.title = generated.title || first.episode.title;
      first.episode.hook = generated.hook;
      first.episode.outline = generated.outline;
      first.episode.talkingPoints = generated.talkingPoints;
      first.episode.hostQuestions = generated.hostQuestions;
      first.episode.funSegment = includeFunSegment ? generated.funSegment : '';
      first.episode.ending = generated.ending;
      first.episode.endState = generated.endState;

      const toneCheck = computeToneConsistencyScore({
        episode: first.episode,
        tonePreset: effectiveTone.tonePreset,
        toneIntensity: effectiveTone.toneIntensity,
      });
      first.episode.toneScore = toneCheck.toneScore;
      first.episode.toneWarnings = toneCheck.warnings;
      refreshEpisodeWritingIntelligence(first.episode, req.language);

      if (generated.seriesSummary) {
        series.seriesSummary = generated.seriesSummary;
      }
      if (generated.themeSummary) {
        first.theme.themeSummary = generated.themeSummary;
      }

      await Promise.all([first.episode.save(), first.theme.save(), series.save()]);

      req.flash('success', 'Series created and Episode 1 draft generated.');
      return res.redirect(episodeEditorPath({
        seriesId: series._id,
        themeId: first.theme._id,
        episodeId: first.episode._id,
      }));
    }

    req.flash('success', 'Series created successfully.');
    return res.redirect(`/kitchen/${series._id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/create/series');
    }

    return next(error);
  }
}

async function suggestSeriesThemes(req, res, next) {
  try {
    const suggestions = buildThemeSuggestions({
      seriesName: req.body.name,
      goal: req.body.goal,
      intent: req.body.intent,
    });

    return res.json({ suggestions });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showCreateHub,
  showSingleWizard,
  createSingleEpisode,
  showSeriesWizard,
  createSeriesFlow,
  suggestSeriesThemes,
};
