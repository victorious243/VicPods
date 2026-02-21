const Episode = require('../models/Episode');
const Theme = require('../models/Theme');

function ensureObjectIdString(value) {
  return String(value);
}

async function createGeneralThemeIfMissing({ userId, seriesId }) {
  let generalTheme = await Theme.findOne({
    userId,
    seriesId,
    name: 'General',
  });

  if (!generalTheme) {
    generalTheme = await Theme.create({
      userId,
      seriesId,
      name: 'General',
      description: 'Auto-created theme for legacy episodes.',
      orderIndex: 0,
      themeSummary: '',
    });
  }

  return generalTheme;
}

async function normalizeEpisodeNumbers({ userId, seriesId }) {
  const episodes = await Episode.find({ userId, seriesId }).sort({ createdAt: 1, _id: 1 });
  if (!episodes.length) {
    return;
  }

  const usedByTheme = new Map();
  const usedGlobal = new Set();
  let nextGlobal = 1;
  const updates = [];

  for (const episode of episodes) {
    const themeKey = ensureObjectIdString(episode.themeId);
    if (!usedByTheme.has(themeKey)) {
      usedByTheme.set(themeKey, new Set());
    }
    const themeUsed = usedByTheme.get(themeKey);

    let local = Number(episode.episodeNumberWithinTheme);
    if (!Number.isInteger(local) || local < 1 || themeUsed.has(local)) {
      local = 1;
      while (themeUsed.has(local)) {
        local += 1;
      }
      episode.episodeNumberWithinTheme = local;
    }
    themeUsed.add(local);

    let global = Number(episode.globalEpisodeNumber);
    if (!Number.isInteger(global) || global < 1 || usedGlobal.has(global)) {
      while (usedGlobal.has(nextGlobal)) {
        nextGlobal += 1;
      }
      episode.globalEpisodeNumber = nextGlobal;
      global = nextGlobal;
      nextGlobal += 1;
    }
    usedGlobal.add(global);

    if (episode.episodeNumber !== global) {
      episode.episodeNumber = global;
    }

    if (
      episode.isModified('episodeNumberWithinTheme')
      || episode.isModified('globalEpisodeNumber')
      || episode.isModified('episodeNumber')
    ) {
      updates.push(episode.save());
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }
}

async function ensureSeriesThemesMigrated({ userId, seriesId }) {
  const legacyEpisodes = await Episode.find({
    userId,
    seriesId,
    $or: [
      { themeId: { $exists: false } },
      { themeId: null },
      { episodeNumberWithinTheme: { $exists: false } },
      { episodeNumberWithinTheme: null },
    ],
  }).sort({ createdAt: 1, _id: 1 });

  if (legacyEpisodes.length) {
    const generalTheme = await createGeneralThemeIfMissing({ userId, seriesId });

    let localCounter = 0;
    for (const episode of legacyEpisodes) {
      localCounter += 1;

      if (!episode.themeId) {
        episode.themeId = generalTheme._id;
      }

      if (!episode.episodeNumberWithinTheme) {
        episode.episodeNumberWithinTheme = localCounter;
      }

      await episode.save();
    }
  }

  await normalizeEpisodeNumbers({ userId, seriesId });

  const themes = await Theme.find({ userId, seriesId }).sort({ orderIndex: 1, createdAt: 1 });
  if (!themes.length) {
    const episodeCount = await Episode.countDocuments({ userId, seriesId });
    if (!episodeCount) {
      return [];
    }

    const generalTheme = await createGeneralThemeIfMissing({ userId, seriesId });
    return [generalTheme];
  }

  return themes;
}

async function getNextThemeEpisodeNumber({ userId, seriesId, themeId }) {
  const last = await Episode.findOne({ userId, seriesId, themeId }).sort({ episodeNumberWithinTheme: -1 });
  return (last?.episodeNumberWithinTheme || 0) + 1;
}

async function getNextGlobalEpisodeNumber({ userId, seriesId }) {
  const last = await Episode.findOne({ userId, seriesId }).sort({ globalEpisodeNumber: -1, createdAt: -1 });
  return (last?.globalEpisodeNumber || 0) + 1;
}

module.exports = {
  ensureSeriesThemesMigrated,
  createGeneralThemeIfMissing,
  getNextThemeEpisodeNumber,
  getNextGlobalEpisodeNumber,
};
