const Episode = require('../models/Episode');
const Idea = require('../models/Idea');
const Series = require('../models/Series');
const Theme = require('../models/Theme');
const {
  ensureSeriesThemesMigrated,
  getNextThemeEpisodeNumber,
  getNextGlobalEpisodeNumber,
} = require('../services/themeService');
const { TONE_PRESETS } = require('../services/tone/tonePresets');
const { computeToneConsistencyScore } = require('../services/tone/consistencyScore');
const {
  INTENT_OPTIONS,
  AUDIENCE_TYPES,
  getMaxIntensityForPlan,
  normalizeSeriesToneInput,
  normalizeEpisodeToneOverride,
  resolveEffectiveTone,
  ensureSeriesToneDefaults,
} = require('../services/tone/toneService');
const { AppError } = require('../utils/errors');
const { episodeEditorPath } = require('../utils/paths');
const { renderPage } = require('../utils/render');

const VALID_STATUSES = ['Planned', 'Draft', 'Ready', 'Served'];
const TRANSCRIPT_FORMATS_BY_PLAN = {
  free: ['txt'],
  pro: ['txt', 'pdf'],
  premium: ['txt', 'pdf', 'docx'],
};
const INTENSITY_LABELS = {
  1: 'Subtle',
  2: 'Light',
  3: 'Balanced',
  4: 'Strong',
  5: 'Bold',
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampWords(value, maxWords) {
  const words = normalizeText(value).split(' ').filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function toLines(value, max = 16) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

function toObjectIdList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

async function getOwnedSeries({ userId, seriesId }) {
  const series = await Series.findOne({ _id: seriesId, userId });
  if (!series) {
    throw new AppError('Series not found.', 404);
  }
  await ensureSeriesToneDefaults(series);
  return series;
}

async function getOwnedTheme({ userId, seriesId, themeId }) {
  const theme = await Theme.findOne({ _id: themeId, userId, seriesId });
  if (!theme) {
    throw new AppError('Theme not found.', 404);
  }
  return theme;
}

async function listSeries(req, res, next) {
  try {
    const seriesList = await Series.find({ userId: req.currentUser._id }).sort({ updatedAt: -1 });
    await Promise.all(seriesList.map((series) => ensureSeriesToneDefaults(series)));

    const effectivePlan = req.effectivePlan || 'free';
    const singleCollectionSeries = seriesList.find((series) => (
      series.creationMode === 'single_collection' || series.isSystem
    ));
    const regularSeries = seriesList.filter((series) => String(series._id) !== String(singleCollectionSeries?._id));

    return renderPage(res, {
      title: 'Kitchen - VicPods',
      pageTitle: 'Kitchen',
      subtitle: 'Series library and advanced management workspace.',
      view: 'kitchen/index',
      data: {
        regularSeries,
        singleCollectionSeries,
        tonePresets: TONE_PRESETS,
        intentOptions: INTENT_OPTIONS,
        audienceTypes: AUDIENCE_TYPES,
        maxToneIntensity: getMaxIntensityForPlan(effectivePlan),
        intensityLabels: INTENSITY_LABELS,
        effectivePlan,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function createSeries(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const plannedEpisodeCount = Number.parseInt(req.body.plannedEpisodeCount, 10);
    const effectivePlan = req.effectivePlan || req.currentUser?.plan || 'free';

    if (!name) {
      throw new AppError('Series name is required.', 400);
    }

    const toneInput = normalizeSeriesToneInput(req.body, effectivePlan);

    await Series.create({
      userId: req.currentUser._id,
      name,
      description: String(req.body.description || '').trim(),
      tone: ['fun', 'calm', 'serious'].includes(req.body.tone) ? req.body.tone : 'fun',
      audience: String(req.body.audience || '').trim(),
      tonePreset: toneInput.tonePreset,
      toneIntensity: toneInput.toneIntensity,
      audienceType: toneInput.audienceType,
      intent: toneInput.intent,
      voicePersona: toneInput.voicePersona,
      creationMode: 'series',
      isSystem: false,
      goal: String(req.body.goal || '').trim(),
      plannedEpisodeCount: Number.isInteger(plannedEpisodeCount) && plannedEpisodeCount > 0
        ? plannedEpisodeCount
        : 0,
    });

    req.flash('success', 'Series created.');
    return res.redirect('/kitchen');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/kitchen');
    }

    return next(error);
  }
}

async function showSeries(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const series = await getOwnedSeries({ userId, seriesId: req.params.seriesId });
    const effectivePlan = req.effectivePlan || 'free';

    await ensureSeriesThemesMigrated({ userId, seriesId: series._id });

    const [themes, episodes, ideas] = await Promise.all([
      Theme.find({ userId, seriesId: series._id }).sort({ orderIndex: 1, createdAt: 1 }),
      Episode.find({ seriesId: series._id, userId }).sort({ themeId: 1, episodeNumberWithinTheme: 1, createdAt: 1 }),
      Idea.find({ userId }).sort({ updatedAt: -1 }).limit(20),
    ]);
    const isSystemSingleCollection = series.creationMode === 'single_collection' || series.isSystem;

    const episodesByTheme = new Map();
    episodes.forEach((episode) => {
      const key = String(episode.themeId);
      if (!episodesByTheme.has(key)) {
        episodesByTheme.set(key, []);
      }
      episodesByTheme.get(key).push(episode);
    });

    const themesWithEpisodes = themes.map((theme) => {
      const themeEpisodes = episodesByTheme.get(String(theme._id)) || [];
      const servedCount = themeEpisodes.filter((episode) => episode.status === 'Served').length;
      return {
        theme,
        episodes: themeEpisodes,
        progress: {
          servedCount,
          totalCount: themeEpisodes.length,
        },
      };
    });

    return renderPage(res, {
      title: `${series.name} - Kitchen - VicPods`,
      pageTitle: series.name,
      subtitle: 'Series workspace with nested themes and episodes.',
      view: 'kitchen/series',
      data: {
        series,
        themesWithEpisodes,
        ideas,
        isSystemSingleCollection,
        flatEpisodes: episodes,
        tonePresets: TONE_PRESETS,
        intentOptions: INTENT_OPTIONS,
        audienceTypes: AUDIENCE_TYPES,
        maxToneIntensity: getMaxIntensityForPlan(effectivePlan),
        intensityLabels: INTENSITY_LABELS,
        isPremiumPlan: effectivePlan === 'premium',
        effectivePlan,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSeriesSettings(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const series = await getOwnedSeries({ userId, seriesId: req.params.seriesId });
    const effectivePlan = req.effectivePlan || req.currentUser?.plan || 'free';
    const plannedEpisodeCount = Number.parseInt(req.body.plannedEpisodeCount, 10);
    const toneInput = normalizeSeriesToneInput(req.body, effectivePlan);

    series.name = String(req.body.name || series.name || '').trim() || series.name;
    series.description = String(req.body.description || '').trim();
    series.audience = String(req.body.audience || '').trim();
    series.goal = String(req.body.goal || '').trim();
    series.plannedEpisodeCount = Number.isInteger(plannedEpisodeCount) && plannedEpisodeCount > 0
      ? plannedEpisodeCount
      : 0;

    series.tonePreset = toneInput.tonePreset;
    series.toneIntensity = toneInput.toneIntensity;
    series.audienceType = toneInput.audienceType;
    series.intent = toneInput.intent;
    series.voicePersona = toneInput.voicePersona;

    await series.save();

    if (effectivePlan !== 'premium' && String(req.body.voicePersona || '').trim()) {
      req.flash('success', 'Series settings updated. Voice Persona requires Premium.');
    } else {
      req.flash('success', 'Series settings updated.');
    }

    return res.redirect(`/kitchen/${series._id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(`/kitchen/${req.params.seriesId}`);
    }

    return next(error);
  }
}

async function createTheme(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const series = await getOwnedSeries({ userId, seriesId: req.params.seriesId });
    if (series.creationMode === 'single_collection' || series.isSystem) {
      throw new AppError('Themes cannot be added to the Single Episodes system collection.', 400);
    }
    const name = String(req.body.name || '').trim();

    if (!name) {
      throw new AppError('Theme name is required.', 400);
    }

    const existing = await Theme.findOne({ userId, seriesId: series._id, name });
    if (existing) {
      throw new AppError('Theme name already exists in this series.', 409);
    }

    const highestOrder = await Theme.findOne({ userId, seriesId: series._id }).sort({ orderIndex: -1 });

    await Theme.create({
      userId,
      seriesId: series._id,
      name,
      description: String(req.body.description || '').trim(),
      orderIndex: highestOrder ? highestOrder.orderIndex + 1 : 0,
    });

    req.flash('success', 'Theme created.');
    return res.redirect(`/kitchen/${series._id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(`/kitchen/${req.params.seriesId}`);
    }

    return next(error);
  }
}

async function createEpisodeInTheme(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const series = await getOwnedSeries({ userId, seriesId: req.params.seriesId });

    await ensureSeriesThemesMigrated({ userId, seriesId: series._id });

    const theme = await getOwnedTheme({
      userId,
      seriesId: series._id,
      themeId: req.params.themeId,
    });

    const requestedNumber = Number.parseInt(req.body.episodeNumberWithinTheme, 10);
    let episodeNumberWithinTheme;

    if (Number.isInteger(requestedNumber) && requestedNumber > 0) {
      const taken = await Episode.findOne({
        userId,
        seriesId: series._id,
        themeId: theme._id,
        episodeNumberWithinTheme: requestedNumber,
      });

      if (taken) {
        throw new AppError(`Episode ${requestedNumber} already exists in this theme.`, 409);
      }

      episodeNumberWithinTheme = requestedNumber;
    } else {
      episodeNumberWithinTheme = await getNextThemeEpisodeNumber({
        userId,
        seriesId: series._id,
        themeId: theme._id,
      });
    }

    const globalEpisodeNumber = await getNextGlobalEpisodeNumber({
      userId,
      seriesId: series._id,
    });

    const createdEpisode = await Episode.create({
      userId,
      seriesId: series._id,
      themeId: theme._id,
      episodeNumberWithinTheme,
      episodeNumber: globalEpisodeNumber,
      globalEpisodeNumber,
      status: 'Planned',
      title: String(req.body.title || `Episode ${episodeNumberWithinTheme}`).trim(),
    });

    req.flash('success', `Episode ${episodeNumberWithinTheme} created in ${theme.name}.`);
    return res.redirect(episodeEditorPath({
      seriesId: series._id,
      themeId: theme._id,
      episodeId: createdEpisode._id,
    }));
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(`/kitchen/${req.params.seriesId}`);
    }

    return next(error);
  }
}

async function showEpisodeEditor(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const series = await getOwnedSeries({ userId, seriesId: req.params.seriesId });
    const theme = await getOwnedTheme({ userId, seriesId: series._id, themeId: req.params.themeId });
    const effectivePlan = req.effectivePlan || 'free';

    const [episode, allIdeas] = await Promise.all([
      Episode.findOne({
        _id: req.params.episodeId,
        userId,
        seriesId: series._id,
        themeId: theme._id,
      }).populate('ideaIds'),
      Idea.find({ userId }).sort({ updatedAt: -1 }),
    ]);

    if (!episode) {
      throw new AppError('Episode not found.', 404);
    }

    const previousEpisode = await Episode.findOne({
      userId,
      seriesId: series._id,
      themeId: theme._id,
      episodeNumberWithinTheme: { $lt: episode.episodeNumberWithinTheme },
    }).sort({ episodeNumberWithinTheme: -1 });

    const effectiveTone = resolveEffectiveTone({
      series,
      episode,
      plan: effectivePlan,
    });

    return renderPage(res, {
      title: `${series.name} ${theme.name} Ep ${episode.episodeNumberWithinTheme} - VicPods`,
      pageTitle: `Kitchen: ${series.name} / ${theme.name} / Episode ${episode.episodeNumberWithinTheme}`,
      subtitle: 'Edit structure, continuity, and recording readiness.',
      view: 'kitchen/episode',
      data: {
        series,
        theme,
        episode,
        allIdeas,
        previousEpisode,
        validStatuses: VALID_STATUSES,
        allowedTranscriptFormats: TRANSCRIPT_FORMATS_BY_PLAN[req.effectivePlan || 'free'] || ['txt'],
        tonePresets: TONE_PRESETS,
        intensityLabels: INTENSITY_LABELS,
        maxToneIntensity: getMaxIntensityForPlan(effectivePlan),
        effectiveTone,
        showToneScore: effectivePlan === 'pro' || effectivePlan === 'premium',
        toneFixAvailable: effectivePlan === 'premium',
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function saveEpisode(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const series = await getOwnedSeries({ userId, seriesId: req.params.seriesId });
    const theme = await getOwnedTheme({ userId, seriesId: series._id, themeId: req.params.themeId });
    const effectivePlan = req.effectivePlan || req.currentUser?.plan || 'free';

    const episode = await Episode.findOne({
      _id: req.params.episodeId,
      userId,
      seriesId: series._id,
      themeId: theme._id,
    });

    if (!episode) {
      throw new AppError('Episode not found.', 404);
    }

    episode.title = String(req.body.title || '').trim();
    episode.status = VALID_STATUSES.includes(req.body.status) ? req.body.status : 'Draft';
    episode.episodeType = ['solo', 'interview'].includes(req.body.episodeType) ? req.body.episodeType : 'solo';
    episode.targetLength = ['10-15', '20-30', '45+', ''].includes(req.body.targetLength) ? req.body.targetLength : '';
    episode.includeFunSegment = req.body.includeFunSegment === 'on';
    episode.hook = clampWords(req.body.hook, 42);
    episode.outline = toLines(req.body.outline, 7).map((line) => clampWords(line, 24));
    episode.talkingPoints = toLines(req.body.talkingPoints, 7).map((line) => clampWords(line, 24));
    episode.hostQuestions = toLines(req.body.hostQuestions, 8).map((line) => clampWords(line, 24));
    episode.funSegment = episode.includeFunSegment ? String(req.body.funSegment || '').trim() : '';
    episode.funSegment = clampWords(episode.funSegment, 120);
    episode.ending = clampWords(req.body.ending, 45);
    episode.endState = clampWords(req.body.endState, 80);

    if (episode.isSingle) {
      episode.ending = normalizeText(episode.ending).replace(/\s+Teaser:.*$/i, '').trim();
    } else if (episode.ending && !/(teaser|next episode|next time)/i.test(episode.ending)) {
      episode.ending = `${episode.ending} Teaser: next episode builds on this with a sharper angle.`.trim();
    }

    const toneOverride = normalizeEpisodeToneOverride(req.body, {
      series,
      plan: effectivePlan,
    });
    episode.toneOverridePreset = toneOverride.toneOverridePreset;
    episode.toneOverrideIntensity = toneOverride.toneOverrideIntensity;

    const submittedIdeaIds = toObjectIdList(req.body.ideaIds);
    const validIdeas = await Idea.find({
      _id: { $in: submittedIdeaIds },
      userId,
    }).select('_id');

    episode.ideaIds = validIdeas.map((idea) => idea._id);

    const effectiveTone = resolveEffectiveTone({
      series,
      episode,
      plan: effectivePlan,
    });
    const toneCheck = computeToneConsistencyScore({
      episode,
      tonePreset: effectiveTone.tonePreset,
      toneIntensity: effectiveTone.toneIntensity,
    });
    episode.toneScore = toneCheck.toneScore;
    episode.toneWarnings = toneCheck.warnings;

    await episode.save();

    req.flash('success', `Episode ${episode.episodeNumberWithinTheme} saved.`);
    return res.redirect(episodeEditorPath({
      seriesId: series._id,
      themeId: theme._id,
      episodeId: episode._id,
    }));
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(`/kitchen/${req.params.seriesId}`);
    }

    return next(error);
  }
}

async function deleteEpisode(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const series = await getOwnedSeries({ userId, seriesId: req.params.seriesId });
    const theme = await getOwnedTheme({ userId, seriesId: series._id, themeId: req.params.themeId });

    const deleted = await Episode.findOneAndDelete({
      _id: req.params.episodeId,
      userId,
      seriesId: series._id,
      themeId: theme._id,
    });

    if (!deleted) {
      throw new AppError('Episode not found.', 404);
    }

    req.flash('success', `Episode ${deleted.episodeNumberWithinTheme} deleted.`);
    return res.redirect(`/kitchen/${series._id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(`/kitchen/${req.params.seriesId}`);
    }

    return next(error);
  }
}

module.exports = {
  listSeries,
  createSeries,
  showSeries,
  updateSeriesSettings,
  createTheme,
  createEpisodeInTheme,
  showEpisodeEditor,
  saveEpisode,
  deleteEpisode,
};
