const Episode = require('../models/Episode');
const Idea = require('../models/Idea');
const Series = require('../models/Series');
const Theme = require('../models/Theme');
const aiService = require('../services/ai/aiService');
const { computeToneConsistencyScore } = require('../services/tone/consistencyScore');
const {
  resolveEffectiveTone,
  ensureSeriesToneDefaults,
} = require('../services/tone/toneService');
const {
  ensureSeriesThemesMigrated,
  getNextThemeEpisodeNumber,
  getNextGlobalEpisodeNumber,
} = require('../services/themeService');
const { AppError } = require('../utils/errors');
const { episodeEditorPath } = require('../utils/paths');

function wantsJson(req) {
  return req.accepts('json') && !req.accepts('html');
}

function parseEpisodeNumber(raw) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

async function getSeriesThemeEpisode(req, { allowCreate = false } = {}) {
  const userId = req.currentUser._id;
  const seriesId = req.body.seriesId || req.params.seriesId;
  let themeId = req.body.themeId || req.params.themeId;
  const episodeId = req.body.episodeId || req.params.episodeId;
  const requestedEpisodeNumber = parseEpisodeNumber(
    req.body.episodeNumberWithinTheme || req.body.episodeNumber || req.params.episodeNumber
  );

  if (!seriesId) {
    throw new AppError('seriesId is required.', 400);
  }

  const series = await Series.findOne({ _id: seriesId, userId });
  if (!series) {
    throw new AppError('Series not found.', 404);
  }
  await ensureSeriesToneDefaults(series);

  await ensureSeriesThemesMigrated({ userId, seriesId: series._id });

  if (!themeId && episodeId) {
    const episodeMatch = await Episode.findOne({ _id: episodeId, userId, seriesId: series._id }).select('themeId');
    if (episodeMatch?.themeId) {
      themeId = episodeMatch.themeId;
    }
  }

  if (!themeId) {
    throw new AppError('themeId is required.', 400);
  }

  const theme = await Theme.findOne({ _id: themeId, userId, seriesId: series._id });
  if (!theme) {
    throw new AppError('Theme not found.', 404);
  }

  let episode = null;

  if (episodeId) {
    episode = await Episode.findOne({
      _id: episodeId,
      userId,
      seriesId: series._id,
      themeId: theme._id,
    });
  } else if (requestedEpisodeNumber) {
    episode = await Episode.findOne({
      userId,
      seriesId: series._id,
      themeId: theme._id,
      episodeNumberWithinTheme: requestedEpisodeNumber,
    });
  }

  if (!episode && allowCreate) {
    const episodeNumberWithinTheme = requestedEpisodeNumber || await getNextThemeEpisodeNumber({
      userId,
      seriesId: series._id,
      themeId: theme._id,
    });

    const alreadyExists = await Episode.findOne({
      userId,
      seriesId: series._id,
      themeId: theme._id,
      episodeNumberWithinTheme,
    });

    if (alreadyExists) {
      episode = alreadyExists;
    } else {
      const globalEpisodeNumber = await getNextGlobalEpisodeNumber({
        userId,
        seriesId: series._id,
      });

      episode = await Episode.create({
        userId,
        seriesId: series._id,
        themeId: theme._id,
        episodeNumberWithinTheme,
        episodeNumber: globalEpisodeNumber,
        globalEpisodeNumber,
        status: 'Draft',
        title: `Episode ${episodeNumberWithinTheme}`,
        episodeType: ['solo', 'interview'].includes(req.body.episodeType) ? req.body.episodeType : 'solo',
        targetLength: ['10-15', '20-30', '45+', ''].includes(req.body.targetLength) ? req.body.targetLength : '',
        includeFunSegment: req.body.includeFunSegment !== 'off',
        isSingle: false,
      });
    }
  }

  if (!episode) {
    throw new AppError('Episode not found.', 404);
  }

  return { series, theme, episode };
}

function editorRedirect(res, { series, theme, episode }) {
  return res.redirect(episodeEditorPath({
    seriesId: series._id,
    themeId: theme._id,
    episodeId: episode._id,
  }));
}

async function generateEpisode(req, res, next) {
  try {
    const { series, theme, episode } = await getSeriesThemeEpisode(req, { allowCreate: true });
    const effectivePlan = req.effectivePlan || 'free';
    const isStandalone = Boolean(episode.isSingle);
    const requireTeaser = !isStandalone;

    const [themeEpisodes, ideas, previousThemeEpisode] = await Promise.all([
      Episode.find({
        userId: req.currentUser._id,
        seriesId: series._id,
        themeId: theme._id,
      }).sort({ episodeNumberWithinTheme: 1 }),
      Idea.find({
        userId: req.currentUser._id,
        _id: { $in: episode.ideaIds || [] },
      }),
      isStandalone
        ? Promise.resolve(null)
        : Episode.findOne({
          userId: req.currentUser._id,
          seriesId: series._id,
          themeId: theme._id,
          episodeNumberWithinTheme: { $lt: episode.episodeNumberWithinTheme },
        }).sort({ episodeNumberWithinTheme: -1 }),
    ]);

    const generated = await aiService.generateEpisodeDraft({
      series,
      theme,
      episodeNumberWithinTheme: episode.episodeNumberWithinTheme,
      globalEpisodeNumber: episode.globalEpisodeNumber,
      previousEpisodeEndState: isStandalone ? null : previousThemeEpisode?.endState,
      existingEpisodeTitles: isStandalone ? [] : themeEpisodes
        .filter((item) => String(item._id) !== String(episode._id))
        .map((item) => item.title)
        .filter(Boolean),
      ingredientHooks: ideas.map((idea) => idea.hook),
      existingTitle: episode.title,
      effectiveTone: resolveEffectiveTone({
        series,
        episode,
        plan: effectivePlan,
      }),
      episodeType: episode.episodeType || 'solo',
      targetLength: episode.targetLength || '',
      includeFunSegment: episode.includeFunSegment !== false,
      isStandalone,
      requireTeaser,
    });

    episode.title = generated.title || episode.title;
    episode.status = 'Draft';
    episode.hook = generated.hook;
    episode.outline = generated.outline;
    episode.talkingPoints = generated.talkingPoints;
    episode.hostQuestions = generated.hostQuestions;
    episode.funSegment = episode.includeFunSegment === false ? '' : generated.funSegment;
    episode.ending = generated.ending;
    episode.endState = generated.endState;

    if (generated.seriesSummary) {
      series.seriesSummary = generated.seriesSummary;
    }

    if (generated.themeSummary) {
      theme.themeSummary = generated.themeSummary;
    }

    const toneState = resolveEffectiveTone({
      series,
      episode,
      plan: effectivePlan,
    });
    const toneCheck = computeToneConsistencyScore({
      episode,
      tonePreset: toneState.tonePreset,
      toneIntensity: toneState.toneIntensity,
    });
    episode.toneScore = toneCheck.toneScore;
    episode.toneWarnings = toneCheck.warnings;

    await Promise.all([episode.save(), series.save(), theme.save()]);

    if (wantsJson(req)) {
      return res.json({
        provider: process.env.AI_PROVIDER || 'mock',
        episode,
        seriesSummary: series.seriesSummary,
        themeSummary: theme.themeSummary,
      });
    }

    req.flash('success', `Chef AI generated Episode ${episode.episodeNumberWithinTheme} in ${theme.name}.`);
    return editorRedirect(res, { series, theme, episode });
  } catch (error) {
    if (error.statusCode) {
      if (wantsJson(req)) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      req.flash('error', error.message);
      const fallbackSeries = req.body.seriesId || req.params.seriesId;
      if (fallbackSeries) {
        return res.redirect(`/kitchen/${fallbackSeries}`);
      }
      return res.redirect('/kitchen');
    }

    return next(error);
  }
}

async function generateSpices(req, res, next) {
  try {
    const { series, theme, episode } = await getSeriesThemeEpisode(req, { allowCreate: false });
    const effectivePlan = req.effectivePlan || 'free';
    const isStandalone = Boolean(episode.isSingle);

    const previousThemeEpisode = isStandalone
      ? null
      : await Episode.findOne({
        userId: req.currentUser._id,
        seriesId: series._id,
        themeId: theme._id,
        episodeNumberWithinTheme: { $lt: episode.episodeNumberWithinTheme },
      }).sort({ episodeNumberWithinTheme: -1 });

    const generated = await aiService.generateSpices({
      series,
      theme,
      episodeNumberWithinTheme: episode.episodeNumberWithinTheme,
      currentHook: episode.hook,
      existingTalkingPoints: episode.talkingPoints,
      previousEpisodeEndState: previousThemeEpisode?.endState,
      effectiveTone: resolveEffectiveTone({
        series,
        episode,
        plan: effectivePlan,
      }),
      episodeType: episode.episodeType || 'solo',
      targetLength: episode.targetLength || '',
      includeFunSegment: episode.includeFunSegment !== false,
      isStandalone,
      requireTeaser: !isStandalone,
    });

    episode.hook = generated.hook;
    episode.hostQuestions = generated.hostQuestions;
    episode.funSegment = episode.includeFunSegment === false ? '' : generated.funSegment;

    const toneState = resolveEffectiveTone({
      series,
      episode,
      plan: effectivePlan,
    });
    const toneCheck = computeToneConsistencyScore({
      episode,
      tonePreset: toneState.tonePreset,
      toneIntensity: toneState.toneIntensity,
    });
    episode.toneScore = toneCheck.toneScore;
    episode.toneWarnings = toneCheck.warnings;

    await episode.save();

    if (wantsJson(req)) {
      return res.json({
        provider: process.env.AI_PROVIDER || 'mock',
        episode,
      });
    }

    req.flash('success', 'Spices regenerated for this theme episode.');
    return editorRedirect(res, { series, theme, episode });
  } catch (error) {
    if (error.statusCode) {
      if (wantsJson(req)) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      req.flash('error', error.message);
      return res.redirect('/kitchen');
    }

    return next(error);
  }
}

async function refreshContinuity(req, res, next) {
  try {
    const { series, theme, episode } = await getSeriesThemeEpisode(req, { allowCreate: false });
    const effectivePlan = req.effectivePlan || 'free';

    const [priorThemeEpisodes, recentSeriesEpisodes] = await Promise.all([
      Episode.find({
        userId: req.currentUser._id,
        seriesId: series._id,
        themeId: theme._id,
        episodeNumberWithinTheme: { $lt: episode.episodeNumberWithinTheme },
      }).sort({ episodeNumberWithinTheme: 1 }),
      Episode.find({
        userId: req.currentUser._id,
        seriesId: series._id,
      }).sort({ globalEpisodeNumber: -1, createdAt: -1 }).limit(6),
    ]);

    const refreshed = await aiService.refreshContinuity({
      series,
      theme,
      episode,
      priorThemeEpisodes,
      recentSeriesEpisodes,
      effectiveTone: resolveEffectiveTone({
        series,
        episode,
        plan: effectivePlan,
      }),
    });

    episode.endState = refreshed.endState;
    series.seriesSummary = refreshed.seriesSummary || series.seriesSummary;
    theme.themeSummary = refreshed.themeSummary || theme.themeSummary;

    await Promise.all([episode.save(), series.save(), theme.save()]);

    if (wantsJson(req)) {
      return res.json({
        provider: process.env.AI_PROVIDER || 'mock',
        endState: episode.endState,
        seriesSummary: series.seriesSummary,
        themeSummary: theme.themeSummary,
      });
    }

    req.flash('success', 'Continuity refreshed for episode, theme, and series.');
    return editorRedirect(res, { series, theme, episode });
  } catch (error) {
    if (error.statusCode) {
      if (wantsJson(req)) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      req.flash('error', error.message);
      return res.redirect('/kitchen');
    }

    return next(error);
  }
}

async function fixTone(req, res, next) {
  try {
    const { series, theme, episode } = await getSeriesThemeEpisode(req, { allowCreate: false });
    const effectivePlan = req.effectivePlan || 'free';
    const effectiveTone = resolveEffectiveTone({
      series,
      episode,
      plan: effectivePlan,
    });

    const fixed = await aiService.fixTone({
      series,
      theme,
      episode,
      effectiveTone,
      requireTeaser: !episode.isSingle,
    });

    episode.hook = fixed.hook || episode.hook;
    episode.hostQuestions = fixed.hostQuestions?.length ? fixed.hostQuestions : episode.hostQuestions;
    episode.ending = fixed.ending || episode.ending;

    const toneCheck = computeToneConsistencyScore({
      episode,
      tonePreset: effectiveTone.tonePreset,
      toneIntensity: effectiveTone.toneIntensity,
    });
    episode.toneScore = toneCheck.toneScore;
    episode.toneWarnings = toneCheck.warnings;

    await episode.save();

    if (wantsJson(req)) {
      return res.json({
        provider: process.env.AI_PROVIDER || 'mock',
        episode,
        toneScore: episode.toneScore,
        toneWarnings: episode.toneWarnings,
      });
    }

    req.flash('success', 'Tone auto-fix applied to hook, questions, and ending.');
    return editorRedirect(res, { series, theme, episode });
  } catch (error) {
    if (error.statusCode) {
      if (wantsJson(req)) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      req.flash('error', error.message);
      return res.redirect('/kitchen');
    }

    return next(error);
  }
}

module.exports = {
  generateEpisode,
  generateSpices,
  refreshContinuity,
  fixTone,
};
