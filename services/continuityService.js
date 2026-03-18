function cleanSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['en', 'es', 'pt'].includes(normalized) ? normalized : 'en';
}

function getContinuityCopy(language) {
  const locale = normalizeLanguage(language);

  if (locale === 'es') {
    return {
      defaultTitle: 'Episodio',
      progressedArc: 'Avanzo el arco.',
      focusedArc: 'un arco de podcast enfocado',
      defaultGoal: 'Construir un plan de podcast exitoso que mejore el valor para la audiencia y la consistencia.',
      defaultAudience: 'oyentes curiosos',
      defaultTone: 'Conversational & Casual',
      defaultIntent: 'educate',
      defaultEnding: 'cierra con una conclusion clara y sin teaser.',
      defaultCarryForward: 'desarrollar el siguiente angulo sin repetir puntos.',
      themeTemplate: '{themeName} se enfoca en {themeFocus}. {episodes}',
      seriesTemplate: '{seriesName} para {audience}. Objetivo principal: {goal}. Tono: {tone} ({intensity}/5). Intencion: {intent}. {episodes}',
      endStateTemplate: 'Episodio {episodeNumber} en {themeName} avanza el objetivo: {goal}. Deja a la audiencia con {ending} Siguiente paso: {carryForward}',
    };
  }

  if (locale === 'pt') {
    return {
      defaultTitle: 'Episodio',
      progressedArc: 'Avancou o arco.',
      focusedArc: 'um arco de podcast focado',
      defaultGoal: 'Construir um plano de podcast bem-sucedido que melhore valor para o publico e consistencia.',
      defaultAudience: 'ouvintes curiosos',
      defaultTone: 'Conversational & Casual',
      defaultIntent: 'educate',
      defaultEnding: 'fecha com uma conclusao clara e sem teaser.',
      defaultCarryForward: 'desenvolver o proximo angulo sem repetir pontos.',
      themeTemplate: '{themeName} foca em {themeFocus}. {episodes}',
      seriesTemplate: '{seriesName} para {audience}. Objetivo principal: {goal}. Tom: {tone} ({intensity}/5). Intencao: {intent}. {episodes}',
      endStateTemplate: 'Episodio {episodeNumber} em {themeName} avanca o objetivo: {goal}. Deixa o publico com {ending} Proximo passo: {carryForward}',
    };
  }

  return {
    defaultTitle: 'Episode',
    progressedArc: 'Progressed the arc.',
    focusedArc: 'a focused podcast arc',
    defaultGoal: 'Build a successful podcast plan that improves listener value and consistency.',
    defaultAudience: 'curious listeners',
    defaultTone: 'Conversational & Casual',
    defaultIntent: 'educate',
    defaultEnding: 'closes with a clear takeaway and teaser.',
    defaultCarryForward: 'build the next angle without repeating points.',
    themeTemplate: '{themeName} focuses on {themeFocus}. {episodes}',
    seriesTemplate: '{seriesName} for {audience}. Primary goal: {goal}. Tone: {tone} ({intensity}/5). Intent: {intent}. {episodes}',
    endStateTemplate: 'Episode {episodeNumber} in {themeName} advances goal: {goal}. It leaves listeners with {ending} Next carry-forward: {carryForward}',
  };
}

function formatTemplate(template, values) {
  return Object.keys(values || {}).reduce((acc, key) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]), template);
}

function truncateWords(text, maxWords) {
  const words = cleanSentence(text).split(' ').filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function summarizeEpisodes(episodes, label = 'E', language = 'en') {
  const copy = getContinuityCopy(language);
  return episodes.map((episode) => {
    const number = episode.episodeNumberWithinTheme || episode.globalEpisodeNumber || '?';
    const title = cleanSentence(episode.title || `${copy.defaultTitle} ${number}`);
    const endState = cleanSentence(episode.endState || episode.ending || copy.progressedArc);
    return `${label}${number} ${title}: ${endState}`;
  });
}

function refreshContinuityFromEpisodes({
  series,
  theme,
  priorThemeEpisodes,
  recentSeriesEpisodes,
  currentEpisode,
  language = 'en',
}) {
  const copy = getContinuityCopy(language);
  const latestTheme = (priorThemeEpisodes || [])
    .slice()
    .sort((a, b) => a.episodeNumberWithinTheme - b.episodeNumberWithinTheme)
    .slice(-3);

  const latestSeries = (recentSeriesEpisodes || [])
    .slice()
    .sort((a, b) => (a.globalEpisodeNumber || 0) - (b.globalEpisodeNumber || 0))
    .slice(-4);

  const themeSummary = truncateWords(
    formatTemplate(copy.themeTemplate, {
      themeName: cleanSentence(theme.name),
      themeFocus: cleanSentence(theme.description || copy.focusedArc),
      episodes: summarizeEpisodes(latestTheme, 'E', language).join(' '),
    }),
    120
  );

  const goalLine = cleanSentence(
    series.seriesBible?.seasonGoal || series.goal || copy.defaultGoal
  );

  const seriesSummary = truncateWords(
    formatTemplate(copy.seriesTemplate, {
      seriesName: cleanSentence(series.name),
      audience: cleanSentence(series.seriesBible?.audiencePromise || series.audience || copy.defaultAudience),
      goal: goalLine,
      tone: cleanSentence(series.tonePreset || copy.defaultTone),
      intensity: String(series.toneIntensity || 3),
      intent: cleanSentence(series.intent || copy.defaultIntent),
      episodes: summarizeEpisodes(latestSeries, 'G', language).join(' '),
    }),
    120
  );

  const currentPoints = (currentEpisode.talkingPoints || []).slice(0, 2).map(cleanSentence).join(' | ');
  const ending = cleanSentence(currentEpisode.ending || copy.defaultEnding);
  const endState = truncateWords(
    formatTemplate(copy.endStateTemplate, {
      episodeNumber: String(currentEpisode.episodeNumberWithinTheme || '?'),
      themeName: cleanSentence(theme.name),
      goal: goalLine,
      ending,
      carryForward: currentPoints || copy.defaultCarryForward,
    }),
    80
  );

  return {
    seriesSummary,
    themeSummary,
    endState,
  };
}

module.exports = {
  refreshContinuityFromEpisodes,
};
