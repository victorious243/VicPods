const Episode = require('../models/Episode');
const Series = require('../models/Series');
const Theme = require('../models/Theme');
const { sendDocxExport } = require('../services/export/docxExport');
const { buildTranscriptFilename } = require('../services/export/filename');
const { sendPdfExport } = require('../services/export/pdfExport');
const { sendTxtExport } = require('../services/export/txtExport');
const { consumeAiCredit } = require('../services/limitService');
const { ensureTranscript, refreshTranscript } = require('../services/transcript/transcriptService');
const { AppError } = require('../utils/errors');
const { episodeEditorPath } = require('../utils/paths');

const ALLOWED_FORMATS = new Set(['pdf', 'docx', 'txt']);

function wantsJson(req) {
  return req.accepts('json') && !req.accepts('html');
}

async function getOwnedEpisodeContext(req) {
  const userId = req.currentUser._id;
  const { seriesId, themeId, episodeId } = req.params;

  const series = await Series.findOne({ _id: seriesId, userId });
  if (!series) {
    throw new AppError('Series not found.', 404);
  }

  const theme = await Theme.findOne({ _id: themeId, seriesId: series._id, userId });
  if (!theme) {
    throw new AppError('Theme not found.', 404);
  }

  const episode = await Episode.findOne({
    _id: episodeId,
    seriesId: series._id,
    themeId: theme._id,
    userId,
  });

  if (!episode) {
    throw new AppError('Episode not found.', 404);
  }

  return { series, theme, episode };
}

function getEditorPath({ series, theme, episode }) {
  return episodeEditorPath({
    seriesId: series._id,
    themeId: theme._id,
    episodeId: episode._id,
  });
}

async function generateTranscript(req, res, next) {
  try {
    const context = await getOwnedEpisodeContext(req);
    await consumeAiCredit(req.currentUser);
    await refreshTranscript(context);

    if (wantsJson(req)) {
      return res.json({
        episodeId: context.episode._id,
        transcriptUpdatedAt: context.episode.transcriptUpdatedAt,
      });
    }

    req.flash('success', 'Transcript generated and ready for export.');
    return res.redirect(getEditorPath(context));
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

async function downloadTranscript(req, res, next) {
  try {
    const context = await getOwnedEpisodeContext(req);
    if (!context.episode.transcript || !String(context.episode.transcript).trim()) {
      await consumeAiCredit(req.currentUser);
      await refreshTranscript(context);
    } else {
      await ensureTranscript(context);
    }

    const format = String(req.query.format || 'pdf').toLowerCase();
    if (!ALLOWED_FORMATS.has(format)) {
      throw new AppError('Invalid transcript format. Use pdf, docx, or txt.', 400);
    }

    const filename = buildTranscriptFilename({
      seriesName: context.series.name,
      themeName: context.theme.name,
      episodeNumberWithinTheme: context.episode.episodeNumberWithinTheme,
      extension: format,
    });

    if (format === 'txt') {
      return sendTxtExport({
        res,
        filename,
        transcript: context.episode.transcript,
      });
    }

    if (format === 'docx') {
      return sendDocxExport({
        res,
        filename,
        series: context.series,
        theme: context.theme,
        episode: context.episode,
      });
    }

    return sendPdfExport({
      res,
      filename,
      series: context.series,
      theme: context.theme,
      episode: context.episode,
    });
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
  generateTranscript,
  downloadTranscript,
};
