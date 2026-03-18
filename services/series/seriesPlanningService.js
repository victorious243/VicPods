const { resolveShowBlueprint } = require('../structure/structureService');

const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'been', 'being', 'between', 'build', 'because',
  'before', 'below', 'could', 'desde', 'este', 'esta', 'into', 'more', 'most', 'para',
  'podcast', 'podcasts', 'sobre', 'their', 'there', 'these', 'those', 'through', 'with',
  'would', 'your', 'ours', 'ourselves', 'them', 'they', 'then', 'than', 'that', 'this',
  'will', 'just', 'from', 'into', 'onto', 'como', 'mais', 'menos', 'should', 'could',
  'must', 'have', 'has', 'como', 'porque', 'where', 'when', 'what', 'which',
]);

const NEGATION_MARKERS = ['not', 'never', 'avoid', 'stop', 'skip', 'nunca', 'evita', 'nao'];
const ASSERTIVE_MARKERS = ['always', 'must', 'use', 'start', 'do', 'siempre', 'debe', 'usa', 'sempre', 'deve'];

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['en', 'es', 'pt'].includes(normalized) ? normalized : 'en';
}

function getPlanningCopy(language) {
  const locale = normalizeLanguage(language);

  if (locale === 'es') {
    return {
      defaultSeasonGoal: 'Crear una temporada que haga a la audiencia mejor y mas consistente.',
      defaultAudiencePromise: 'Cada episodio deja una accion clara y un siguiente paso util.',
      pendingTheme: '{themeName}: tema creado, pero el primer episodio aun no esta mapeado.',
      arcEntry: 'G{globalNumber} · {themeName} · {title}: {progress}',
      repeatedWarning: 'Angulo repetido: {keyword} aparece demasiado a menudo en esta serie.',
      contradictionWarning: 'Posible contradiccion entre {leftTitle} y {rightTitle} sobre {keyword}.',
      themeCoverageWarning: 'El tema {themeName} aun no tiene una progresion clara de episodios.',
      gapSuggestion: 'Anade un episodio sobre {topic} para sostener la promesa a la audiencia.',
      structureGapSuggestion: 'Falta un episodio puente que conecte dos ideas antes de avanzar.',
      callbackSuggestion: 'En {currentTitle}, recupera G{refNumber} "{refTitle}" cuando hables de {keyword}.',
      fallbackCallback: 'Recupera un aprendizaje temprano para mostrar progreso real de la temporada.',
      seasonPosition: 'Posicion de temporada: {entry}',
      episodeRepeatWarning: 'Este episodio parece repetir un angulo ya cubierto en G{refNumber} "{refTitle}".',
      episodeContradictionWarning: 'Revisa la consistencia con G{refNumber} "{refTitle}" sobre {keyword}.',
    };
  }

  if (locale === 'pt') {
    return {
      defaultSeasonGoal: 'Criar uma temporada que torne o publico melhor e mais consistente.',
      defaultAudiencePromise: 'Cada episodio deixa uma acao clara e um proximo passo util.',
      pendingTheme: '{themeName}: tema criado, mas o primeiro episodio ainda nao foi mapeado.',
      arcEntry: 'G{globalNumber} · {themeName} · {title}: {progress}',
      repeatedWarning: 'Angulo repetido: {keyword} aparece com frequencia demais nesta serie.',
      contradictionWarning: 'Possivel contradicao entre {leftTitle} e {rightTitle} sobre {keyword}.',
      themeCoverageWarning: 'O tema {themeName} ainda nao tem uma progressao clara de episodios.',
      gapSuggestion: 'Adicione um episodio sobre {topic} para sustentar a promessa ao publico.',
      structureGapSuggestion: 'Falta um episodio ponte para conectar duas ideias antes de avancar.',
      callbackSuggestion: 'Em {currentTitle}, retome G{refNumber} "{refTitle}" quando falar de {keyword}.',
      fallbackCallback: 'Retome um aprendizado inicial para mostrar progresso real da temporada.',
      seasonPosition: 'Posicao na temporada: {entry}',
      episodeRepeatWarning: 'Este episodio parece repetir um angulo ja coberto em G{refNumber} "{refTitle}".',
      episodeContradictionWarning: 'Revise a consistencia com G{refNumber} "{refTitle}" sobre {keyword}.',
    };
  }

  return {
    defaultSeasonGoal: 'Build a season that makes the audience better and more consistent.',
    defaultAudiencePromise: 'Every episode leaves listeners with one clear action and next step.',
    pendingTheme: '{themeName}: theme created, but the first episode is not mapped yet.',
    arcEntry: 'G{globalNumber} · {themeName} · {title}: {progress}',
    repeatedWarning: 'Repeated angle: {keyword} shows up too often across this series.',
    contradictionWarning: 'Possible contradiction between {leftTitle} and {rightTitle} around {keyword}.',
    themeCoverageWarning: 'Theme {themeName} still needs a clearer episode progression.',
    gapSuggestion: 'Add an episode around {topic} to keep the audience promise credible.',
    structureGapSuggestion: 'A bridge episode is still missing before the series moves forward.',
    callbackSuggestion: 'In {currentTitle}, call back to G{refNumber} "{refTitle}" when you discuss {keyword}.',
    fallbackCallback: 'Call back to an early lesson to prove real season progress.',
    seasonPosition: 'Season position: {entry}',
    episodeRepeatWarning: 'This episode may repeat an angle already covered in G{refNumber} "{refTitle}".',
    episodeContradictionWarning: 'Check consistency with G{refNumber} "{refTitle}" around {keyword}.',
  };
}

function formatTemplate(template, values) {
  return Object.keys(values || {}).reduce((acc, key) => (
    acc.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key])
  ), template);
}

function cleanText(value, maxLength = 240) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function readSubmittedValue(body, key, fallback) {
  return Object.prototype.hasOwnProperty.call(body || {}, key) ? body[key] : fallback;
}

function normalizeList(value, { maxItems = 8, maxLength = 80 } = {}) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/\n|,/);

  return [...new Set(source
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function resolveSeriesBible(source = {}) {
  const blueprint = resolveShowBlueprint(source);
  const bible = source.seriesBible || source || {};

  return {
    seasonGoal: cleanText(bible.seasonGoal || source.goal, 320),
    audiencePromise: cleanText(bible.audiencePromise || blueprint.listenerTransformation, 240),
    recurringThemes: normalizeList(bible.recurringThemes, { maxItems: 8, maxLength: 80 }),
  };
}

function normalizeSeriesBibleInput(body = {}, fallback = {}) {
  const current = resolveSeriesBible(fallback);

  return {
    seasonGoal: cleanText(readSubmittedValue(body, 'seasonGoal', current.seasonGoal), 320),
    audiencePromise: cleanText(readSubmittedValue(body, 'audiencePromise', current.audiencePromise), 240),
    recurringThemes: normalizeList(readSubmittedValue(body, 'recurringThemes', current.recurringThemes), {
      maxItems: 8,
      maxLength: 80,
    }),
  };
}

function tokenize(text) {
  return cleanText(text, 1000)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(' ')
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));
}

function keywordFrequencyMap(items) {
  const frequency = new Map();

  items.forEach((text) => {
    tokenize(text).forEach((token) => {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    });
  });

  return frequency;
}

function topKeywords(text, limit = 4) {
  const frequency = keywordFrequencyMap([text]);
  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map((entry) => entry[0]);
}

function hasMarker(text, markers) {
  const normalized = cleanText(text, 800).toLowerCase();
  return markers.some((marker) => normalized.includes(marker));
}

function orderedEpisodes(episodes = []) {
  return episodes
    .slice()
    .sort((left, right) => {
      const leftNumber = Number.isFinite(left.globalEpisodeNumber) ? left.globalEpisodeNumber : Number.MAX_SAFE_INTEGER;
      const rightNumber = Number.isFinite(right.globalEpisodeNumber) ? right.globalEpisodeNumber : Number.MAX_SAFE_INTEGER;
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
    });
}

function clampWords(text, maxWords) {
  const words = cleanText(text, 1200).split(' ').filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function buildSeasonArc({ series, themes, episodes, language = 'en' }) {
  const copy = getPlanningCopy(language);
  const themeMap = new Map((themes || []).map((theme) => [String(theme._id), theme]));
  const byOrder = orderedEpisodes(episodes);

  if (!byOrder.length) {
    return (themes || []).slice(0, 8).map((theme) => (
      formatTemplate(copy.pendingTheme, { themeName: theme.name })
    ));
  }

  return byOrder.slice(0, 18).map((episode) => {
    const theme = themeMap.get(String(episode.themeId));
    const progress = clampWords(
      episode.endState
        || episode.ending
        || episode.hook
        || series.goal
        || resolveSeriesBible(series).seasonGoal
        || getPlanningCopy(language).defaultSeasonGoal,
      14
    );

    return formatTemplate(copy.arcEntry, {
      globalNumber: String(episode.globalEpisodeNumber || '?'),
      themeName: theme?.name || 'Theme',
      title: cleanText(episode.title || 'Untitled', 120),
      progress,
    });
  });
}

function buildCoverageTopics({ series, themes, episodes }) {
  const rawCoverage = [
    ...((themes || []).map((theme) => theme.name)),
    ...((episodes || []).map((episode) => episode.title)),
  ].join(' ');

  return new Set(topKeywords(rawCoverage, 24));
}

function buildTopicGapSuggestions({ series, themes, episodes, language = 'en' }) {
  const copy = getPlanningCopy(language);
  const blueprint = resolveShowBlueprint(series);
  const bible = resolveSeriesBible(series);
  const coverage = buildCoverageTopics({ series, themes, episodes });

  const plannedTopics = [
    ...bible.recurringThemes,
    ...blueprint.contentPillars,
  ].filter(Boolean);

  const suggestions = plannedTopics
    .filter((topic) => {
      const topicKeywords = topKeywords(topic, 3);
      return topicKeywords.every((keyword) => !coverage.has(keyword));
    })
    .map((topic) => formatTemplate(copy.gapSuggestion, { topic }));

  if (!suggestions.length && (themes || []).length && (episodes || []).length < Math.max((series.plannedEpisodeCount || 0), 4)) {
    suggestions.push(copy.structureGapSuggestion);
  }

  return suggestions.slice(0, 5);
}

function buildContinuityWarnings({ series, themes, episodes, language = 'en' }) {
  const copy = getPlanningCopy(language);
  const warnings = [];
  const ordered = orderedEpisodes(episodes);
  const titleFrequency = keywordFrequencyMap(ordered.map((episode) => episode.title));

  [...titleFrequency.entries()]
    .filter((entry) => entry[1] >= 3)
    .slice(0, 3)
    .forEach(([keyword]) => {
      warnings.push(formatTemplate(copy.repeatedWarning, { keyword }));
    });

  const themeMap = new Map((themes || []).map((theme) => [String(theme._id), theme]));
  (themes || []).forEach((theme) => {
    const themeEpisodes = ordered.filter((episode) => String(episode.themeId) === String(theme._id));
    if (!themeEpisodes.length) {
      warnings.push(formatTemplate(copy.themeCoverageWarning, { themeName: theme.name }));
    }
  });

  for (let index = 0; index < ordered.length; index += 1) {
    const left = ordered[index];
    const leftText = `${left.title} ${(left.talkingPoints || []).join(' ')} ${left.endState || ''}`;
    const leftKeywords = topKeywords(leftText, 4);

    for (let cursor = index + 1; cursor < ordered.length; cursor += 1) {
      const right = ordered[cursor];
      const rightText = `${right.title} ${(right.talkingPoints || []).join(' ')} ${right.endState || ''}`;
      const rightKeywords = topKeywords(rightText, 4);
      const overlap = leftKeywords.find((keyword) => rightKeywords.includes(keyword));

      if (
        overlap
        && (
          (hasMarker(leftText, NEGATION_MARKERS) && hasMarker(rightText, ASSERTIVE_MARKERS))
          || (hasMarker(leftText, ASSERTIVE_MARKERS) && hasMarker(rightText, NEGATION_MARKERS))
        )
      ) {
        warnings.push(formatTemplate(copy.contradictionWarning, {
          leftTitle: cleanText(left.title || `G${left.globalEpisodeNumber || '?'}`, 80),
          rightTitle: cleanText(right.title || `G${right.globalEpisodeNumber || '?'}`, 80),
          keyword: overlap,
        }));
      }
    }
  }

  return [...new Set(warnings)].slice(0, 5);
}

function buildCallbackPlan({ series, episodes, language = 'en' }) {
  const copy = getPlanningCopy(language);
  const ordered = orderedEpisodes(episodes);
  const callbacks = [];

  for (let index = 2; index < ordered.length; index += 1) {
    const current = ordered[index];
    const currentKeywords = topKeywords(`${current.title} ${(current.talkingPoints || []).join(' ')}`, 4);
    const priorCandidates = ordered
      .slice(0, index - 1)
      .map((candidate) => ({
        candidate,
        overlap: currentKeywords.find((keyword) => topKeywords(`${candidate.title} ${(candidate.talkingPoints || []).join(' ')}`, 4).includes(keyword)),
      }))
      .filter((entry) => entry.overlap);

    if (priorCandidates.length) {
      const selected = priorCandidates[0];
      callbacks.push(formatTemplate(copy.callbackSuggestion, {
        currentTitle: cleanText(current.title || `G${current.globalEpisodeNumber || '?'}`, 80),
        refNumber: String(selected.candidate.globalEpisodeNumber || '?'),
        refTitle: cleanText(selected.candidate.title || 'Untitled', 80),
        keyword: selected.overlap,
      }));
    }
  }

  if (!callbacks.length && ordered.length >= 2) {
    callbacks.push(copy.fallbackCallback);
  }

  return callbacks.slice(0, 5);
}

function buildSeriesPlanningSnapshot({ series, themes, episodes, language = 'en' }) {
  const continuityWarnings = buildContinuityWarnings({ series, themes, episodes, language });
  const topicGapSuggestions = buildTopicGapSuggestions({ series, themes, episodes, language });
  const callbackPlan = buildCallbackPlan({ series, episodes, language });
  const seasonArc = buildSeasonArc({ series, themes, episodes, language });
  const continuityHealthScore = Math.max(
    48,
    100 - (continuityWarnings.length * 10) - (topicGapSuggestions.length * 5)
  );

  return {
    continuityHealthScore,
    seasonArc,
    continuityWarnings,
    topicGapSuggestions,
    callbackPlan,
  };
}

function buildEpisodeContinuityContext({ series, theme, episode, episodes, themes = [], language = 'en' }) {
  const copy = getPlanningCopy(language);
  const ordered = orderedEpisodes(episodes);
  const currentIndex = ordered.findIndex((item) => String(item._id) === String(episode._id));
  const priorEpisodes = currentIndex >= 0 ? ordered.slice(0, currentIndex) : ordered.filter((item) => (
    (item.globalEpisodeNumber || 0) < (episode.globalEpisodeNumber || Number.MAX_SAFE_INTEGER)
  ));
  const currentKeywords = topKeywords(`${episode.title} ${episode.hook} ${(episode.talkingPoints || []).join(' ')}`, 4);
  const warnings = [];
  const callbackSuggestions = [];

  priorEpisodes.slice().reverse().forEach((prior) => {
    const priorKeywords = topKeywords(`${prior.title} ${prior.hook} ${(prior.talkingPoints || []).join(' ')}`, 4);
    const overlap = currentKeywords.find((keyword) => priorKeywords.includes(keyword));

    if (overlap && warnings.length < 2) {
      warnings.push(formatTemplate(copy.episodeRepeatWarning, {
        refNumber: String(prior.globalEpisodeNumber || '?'),
        refTitle: cleanText(prior.title || 'Untitled', 80),
      }));
    }

    if (
      overlap
      && (
        (hasMarker(`${episode.title} ${episode.ending}`, NEGATION_MARKERS) && hasMarker(`${prior.title} ${prior.ending}`, ASSERTIVE_MARKERS))
        || (hasMarker(`${episode.title} ${episode.ending}`, ASSERTIVE_MARKERS) && hasMarker(`${prior.title} ${prior.ending}`, NEGATION_MARKERS))
      )
      && warnings.length < 3
    ) {
      warnings.push(formatTemplate(copy.episodeContradictionWarning, {
        refNumber: String(prior.globalEpisodeNumber || '?'),
        refTitle: cleanText(prior.title || 'Untitled', 80),
        keyword: overlap,
      }));
    }

    if (overlap && callbackSuggestions.length < 3) {
      callbackSuggestions.push(formatTemplate(copy.callbackSuggestion, {
        currentTitle: cleanText(episode.title || `G${episode.globalEpisodeNumber || '?'}`, 80),
        refNumber: String(prior.globalEpisodeNumber || '?'),
        refTitle: cleanText(prior.title || 'Untitled', 80),
        keyword: overlap,
      }));
    }
  });

  const snapshot = buildSeriesPlanningSnapshot({
    series,
    themes: themes.length ? themes : [{ _id: theme._id, name: theme.name }],
    episodes,
    language,
  });
  const seasonArcStep = snapshot.seasonArc.find((entry) => entry.includes(`G${episode.globalEpisodeNumber || '?'}`))
    || formatTemplate(copy.seasonPosition, {
      entry: buildSeasonArc({
        series,
        themes: [{ _id: theme._id, name: theme.name }],
        episodes: [episode],
        language,
      })[0] || theme.name,
    });

  return {
    seasonArcStep,
    warnings: [...new Set(warnings)].slice(0, 3),
    callbackSuggestions: [...new Set(callbackSuggestions)].slice(0, 3),
    gapSuggestion: snapshot.topicGapSuggestions[0] || '',
  };
}

module.exports = {
  buildEpisodeContinuityContext,
  buildSeriesPlanningSnapshot,
  normalizeSeriesBibleInput,
  resolveSeriesBible,
};
