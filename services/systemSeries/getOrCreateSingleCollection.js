const Series = require('../../models/Series');
const Theme = require('../../models/Theme');

async function getOrCreateSingleCollection(userId) {
  let series = await Series.findOne({
    userId,
    creationMode: 'single_collection',
    isSystem: true,
  });

  if (!series) {
    series = await Series.create({
      userId,
      name: 'Single Episodes',
      description: 'System collection for one-off standalone episodes.',
      audience: '',
      audienceType: 'Mixed',
      intent: 'educate',
      goal: 'Create standalone episodes that are clear, valuable, and recording-ready.',
      tone: 'fun',
      tonePreset: 'Conversational & Casual',
      toneIntensity: 3,
      creationMode: 'single_collection',
      isSystem: true,
      plannedEpisodeCount: 0,
      seriesSummary: '',
    });
  }

  let theme = await Theme.findOne({
    userId,
    seriesId: series._id,
    isSystem: true,
  });

  if (!theme) {
    theme = await Theme.create({
      userId,
      seriesId: series._id,
      name: 'General',
      description: 'System theme for standalone episodes.',
      orderIndex: 0,
      isSystem: true,
      themeSummary: '',
    });
  }

  return { series, theme };
}

module.exports = {
  getOrCreateSingleCollection,
};
