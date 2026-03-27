const { AppError } = require('../utils/errors');
const {
  IDEA_MAX_LENGTH,
  IDEA_MIN_LENGTH,
  generatePublicEpisodePreview,
} = require('../services/public/publicEpisodePreviewService');
const {
  generatePublicPodcastIdeas,
  normalizeNiche,
} = require('../services/public/publicPodcastIdeaService');
const { buildLaunchPackView } = require('../services/launch/launchPackService');
const { sendTxtExport } = require('../services/export/txtExport');
const { buildPublicPreviewExport } = require('../services/export/watermarkedPreviewExportService');
const {
  normalizeEpisodePreviewPayload,
  normalizePodcastIdeasPayload,
  normalizeSource,
  savePublicPreviewLead,
} = require('../services/public/publicLeadCaptureService');

function asErrorMessage(error, fallback = 'Unable to generate preview right now.') {
  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function readIdea(req) {
  return String(req.body?.idea || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readNiche(req) {
  return normalizeNiche(req.body?.niche || '');
}

async function generateEpisodePreview(req, res, next) {
  try {
    const idea = readIdea(req);

    if (!idea || idea.length < IDEA_MIN_LENGTH) {
      throw new AppError('Add a clearer podcast idea before generating a preview.', 400);
    }

    if (idea.length > IDEA_MAX_LENGTH) {
      throw new AppError(`Keep your idea under ${IDEA_MAX_LENGTH} characters for the instant preview.`, 400);
    }

    const preview = await generatePublicEpisodePreview({
      idea,
      language: req.body?.language || req.language || 'en',
    });
    const fullLaunchPackAccess = req.currentUser && (req.effectivePlan === 'pro' || req.effectivePlan === 'premium');

    return res.json({
      title: preview.title,
      hook: preview.hook,
      outline: preview.outline,
      cta: preview.cta,
      launchPack: buildLaunchPackView(preview.launchPack, {
        fullAccess: Boolean(fullLaunchPackAccess),
      }),
      launchPackAccess: fullLaunchPackAccess ? 'full' : 'preview',
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: asErrorMessage(error),
      });
    }

    return next(error);
  }
}

async function generatePodcastIdeas(req, res, next) {
  try {
    const niche = readNiche(req);
    const result = await generatePublicPodcastIdeas({
      niche,
      language: req.body?.language || req.language || 'en',
    });

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: asErrorMessage(error, 'Unable to generate podcast ideas right now.'),
      });
    }

    return next(error);
  }
}

async function savePreviewLead(req, res, next) {
  try {
    const source = normalizeSource(req.body?.source);
    const payload = source === 'podcast_ideas'
      ? normalizePodcastIdeasPayload(req.body?.payload || {})
      : normalizeEpisodePreviewPayload(req.body?.payload || {});

    const result = await savePublicPreviewLead({
      email: req.body?.email,
      source,
      payload,
    });

    return res.json({
      saved: true,
      emailDelivered: result.emailDelivered,
      emailFallback: result.emailFallback,
      message: result.emailDelivered
        ? 'Preview saved. Check your inbox.'
        : 'Preview saved. Email delivery is still pending.',
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: asErrorMessage(error, 'Unable to save preview right now.'),
      });
    }

    return next(error);
  }
}

async function exportPreview(req, res, next) {
  try {
    const source = normalizeSource(req.body?.source);
    if (source !== 'episode_preview') {
      throw new AppError('Only episode previews can be exported right now.', 400);
    }

    const payload = normalizeEpisodePreviewPayload(req.body?.payload || {});
    if (!payload.title || !payload.outline.length) {
      throw new AppError('Generate an episode preview before exporting it.', 400);
    }
    const exportFile = buildPublicPreviewExport(payload, {
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    });

    return sendTxtExport({
      res,
      filename: exportFile.filename,
      transcript: exportFile.content,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: asErrorMessage(error, 'Unable to export preview right now.'),
      });
    }

    return next(error);
  }
}

module.exports = {
  generateEpisodePreview,
  generatePodcastIdeas,
  savePreviewLead,
  exportPreview,
};
