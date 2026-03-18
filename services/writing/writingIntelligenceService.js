const {
  getCtaStyleOption,
  resolveEffectiveShowBlueprint,
} = require('../structure/structureService');

const DELIVERY_STYLE_OPTIONS = [
  {
    value: 'authoritative',
    label: 'Authoritative',
    description: 'Clear, decisive, high-conviction delivery.',
    promptHint: 'Sound decisive, specific, and high-confidence without sounding arrogant.',
  },
  {
    value: 'friendly',
    label: 'Friendly',
    description: 'Warm, clear, approachable host energy.',
    promptHint: 'Sound warm, encouraging, and easy to follow.',
  },
  {
    value: 'storytelling',
    label: 'Storytelling',
    description: 'Narrative-led delivery with scenes and tension.',
    promptHint: 'Use story rhythm, scenes, and emotionally resonant framing.',
  },
  {
    value: 'expert',
    label: 'Expert',
    description: 'High-credibility, evidence-backed explanation.',
    promptHint: 'Sound precise, grounded, and expert-led with practical reasoning.',
  },
  {
    value: 'casual',
    label: 'Casual',
    description: 'Natural, simple, low-friction host voice.',
    promptHint: 'Use plain language, relaxed rhythm, and everyday phrasing.',
  },
];

const REWRITE_SECTION_OPTIONS = [
  { value: 'intro', label: 'Improve Intro' },
  { value: 'body', label: 'Tighten Body' },
  { value: 'cta', label: 'Stronger CTA' },
];

const DELIVERY_STYLE_VALUES = DELIVERY_STYLE_OPTIONS.map((option) => option.value);
const REWRITE_SECTION_VALUES = REWRITE_SECTION_OPTIONS.map((option) => option.value);
const DEFAULT_DELIVERY_STYLE = 'friendly';
const DEFAULT_WORDS_PER_MINUTE = 150;

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['en', 'es', 'pt'].includes(normalized) ? normalized : 'en';
}

function readSubmittedValue(body, key, fallback) {
  return Object.prototype.hasOwnProperty.call(body || {}, key) ? body[key] : fallback;
}

function toStringSafe(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampWords(text, maxWords) {
  const words = toStringSafe(text).split(' ').filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }

  return `${words.slice(0, maxWords).join(' ')}...`;
}

function clampChars(text, maxChars) {
  const normalized = toStringSafe(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function sanitizeBulletArray(value, maxItems) {
  const input = Array.isArray(value) ? value : [];

  return input
    .map((item) => clampWords(item, 24))
    .filter(Boolean)
    .slice(0, maxItems);
}

function getWritingCopy(language) {
  const locale = normalizeLanguage(language);

  if (locale === 'es') {
    return {
      introLabel: 'Inicio y hook',
      bodyLabel: 'Cuerpo principal',
      promptsLabel: 'Preguntas del host',
      outroLabel: 'Cierre y CTA',
      totalLabel: 'Tiempo total estimado',
      issueClarity: 'La claridad baja porque algunas secciones siguen demasiado amplias o abstractas.',
      issuePacing: 'El ritmo puede sentirse irregular para la duracion elegida.',
      issueRepetition: 'Hay repeticion visible en varias frases clave.',
      issueTransitions: 'Las transiciones entre ideas necesitan mas puente.',
      strengthClarity: 'La estructura general ya apunta a un resultado claro.',
      strengthPacing: 'El reparto de secciones se siente equilibrado.',
      strengthRepetition: 'La repeticion esta bajo control y la escritura se siente fresca.',
      strengthTransitions: 'Las ideas progresan con una secuencia facil de seguir.',
      recommendationIntro: 'Haz el hook mas especifico y conectado al resultado del oyente.',
      recommendationBody: 'Compacta los puntos del cuerpo y elimina cualquier idea duplicada.',
      recommendationCta: 'Cierra con una accion mas concreta y facil de ejecutar esta semana.',
      hookTemplates: {
        problem_first: '{problem} Hoy vamos a convertir eso en {transformation}.',
        bold_claim: 'La mayoria falla en {pillar} no por talento, sino por estructura. Este episodio corrige eso.',
        story_scene: 'Imagina a un creador atrapado en {pillar}; este episodio convierte ese bloqueo en avance.',
        question_led: 'Y si el verdadero avance en {pillar} dependiera de una estructura mejor y no de trabajar mas?',
        myth_break: 'Mito: mas contenido arregla el podcast. En realidad, una mejor estructura en {pillar} es lo que mueve el resultado.',
      },
      introRewrite: '{problem} Hoy vamos directo a la parte que realmente mueve {transformation}.',
      bodyPrefix: 'Primero',
      bodyBridge: 'Despues',
      bodyFinal: 'Por ultimo',
      ctaEndings: {
        direct_action: 'Accion de esta semana: ejecuta un paso concreto antes de tu siguiente grabacion.',
        reflection_prompt: 'Antes de cerrar, preguntate donde esta hoy tu mayor bloqueo y que decision debes tomar.',
        community_invite: 'Comparte tu avance o tu duda principal con tu audiencia o comunidad antes de grabar otra vez.',
        soft_pitch: 'Si quieres seguir este trabajo, el siguiente recurso o episodio debe ser tu paso natural.',
      },
    };
  }

  if (locale === 'pt') {
    return {
      introLabel: 'Abertura e hook',
      bodyLabel: 'Corpo principal',
      promptsLabel: 'Perguntas do host',
      outroLabel: 'Fecho e CTA',
      totalLabel: 'Tempo total estimado',
      issueClarity: 'A clareza cai porque algumas secoes ainda estao amplas ou abstratas.',
      issuePacing: 'O ritmo pode parecer irregular para a duracao escolhida.',
      issueRepetition: 'Existe repeticao perceptivel em frases-chave.',
      issueTransitions: 'As transicoes entre ideias precisam de mais ponte.',
      strengthClarity: 'A estrutura geral ja aponta para um resultado claro.',
      strengthPacing: 'A distribuicao das secoes parece equilibrada.',
      strengthRepetition: 'A repeticao esta controlada e a escrita soa mais fresca.',
      strengthTransitions: 'As ideias avancam em uma sequencia facil de acompanhar.',
      recommendationIntro: 'Deixe o hook mais especifico e mais ligado ao resultado do ouvinte.',
      recommendationBody: 'Enxugue os pontos do corpo e remova ideias duplicadas.',
      recommendationCta: 'Feche com uma acao mais concreta e facil de executar nesta semana.',
      hookTemplates: {
        problem_first: '{problem} Hoje vamos transformar isso em {transformation}.',
        bold_claim: 'A maioria falha em {pillar} nao por talento, mas por estrutura. Este episodio corrige isso.',
        story_scene: 'Imagine um criador travado em {pillar}; este episodio transforma esse bloqueio em progresso.',
        question_led: 'E se o verdadeiro avancao em {pillar} dependesse de uma estrutura melhor e nao de trabalhar mais?',
        myth_break: 'Mito: mais conteudo conserta o podcast. Na pratica, uma estrutura melhor em {pillar} e o que move o resultado.',
      },
      introRewrite: '{problem} Hoje vamos direto ao que realmente move {transformation}.',
      bodyPrefix: 'Primeiro',
      bodyBridge: 'Depois',
      bodyFinal: 'Por fim',
      ctaEndings: {
        direct_action: 'Acao desta semana: execute um passo concreto antes da proxima gravacao.',
        reflection_prompt: 'Antes de fechar, pergunte a si mesmo onde esta hoje a sua maior lacuna e qual decisao precisa tomar.',
        community_invite: 'Compartilhe o seu avancao ou a sua principal duvida com a audiencia ou comunidade antes de gravar de novo.',
        soft_pitch: 'Se quiser continuar este trabalho, o proximo recurso ou episodio deve ser o seu proximo passo natural.',
      },
    };
  }

  return {
    introLabel: 'Intro & hook',
    bodyLabel: 'Main body',
    promptsLabel: 'Host prompts',
    outroLabel: 'Close & CTA',
    totalLabel: 'Estimated total',
    issueClarity: 'Clarity drops because some sections are still too broad or abstract.',
    issuePacing: 'Pacing may feel uneven for the selected duration.',
    issueRepetition: 'There is visible repetition across key phrases.',
    issueTransitions: 'Transitions between ideas need a stronger bridge.',
    strengthClarity: 'The structure already points toward a clear listener result.',
    strengthPacing: 'The section distribution feels balanced.',
    strengthRepetition: 'Repetition is under control and the writing feels fresh.',
    strengthTransitions: 'The ideas move in an easy-to-follow sequence.',
    recommendationIntro: 'Make the hook more specific and more closely tied to the listener outcome.',
    recommendationBody: 'Tighten the body points and remove any duplicate ideas.',
    recommendationCta: 'Close with a more concrete action listeners can complete this week.',
    hookTemplates: {
      problem_first: '{problem} Today we turn that into {transformation}.',
      bold_claim: 'Most creators fail at {pillar} because their structure is weak, not because their ideas are bad.',
      story_scene: 'Picture a creator stuck on {pillar}; this episode turns that stuck moment into forward motion.',
      question_led: 'What if the real breakthrough in {pillar} came from better structure, not more effort?',
      myth_break: 'Myth: more content fixes the podcast. Better structure around {pillar} is what actually moves the result.',
    },
    introRewrite: '{problem} Today we focus on the part that actually creates {transformation}.',
    bodyPrefix: 'First',
    bodyBridge: 'Next',
    bodyFinal: 'Finally',
    ctaEndings: {
      direct_action: 'Action this week: complete one concrete step before your next recording.',
      reflection_prompt: 'Before you close, ask yourself where the biggest gap is right now and what decision it demands.',
      community_invite: 'Share your progress or your biggest obstacle with your audience or community before you record again.',
      soft_pitch: 'If listeners want to keep moving, point them naturally toward the next resource or episode.',
    },
  };
}

function normalizeDeliveryStyle(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return DELIVERY_STYLE_VALUES.includes(normalized) ? normalized : DEFAULT_DELIVERY_STYLE;
}

function getDeliveryStyleOption(value) {
  return DELIVERY_STYLE_OPTIONS.find((option) => option.value === normalizeDeliveryStyle(value)) || DELIVERY_STYLE_OPTIONS[1];
}

function normalizeSeriesWritingSettings(body = {}, fallback = {}) {
  return {
    defaultDeliveryStyle: normalizeDeliveryStyle(
      readSubmittedValue(body, 'defaultDeliveryStyle', fallback.defaultDeliveryStyle)
    ),
  };
}

function normalizeEpisodeWritingSettings(body = {}, fallback = {}) {
  return {
    deliveryStyle: normalizeDeliveryStyle(readSubmittedValue(body, 'deliveryStyle', fallback.deliveryStyle)),
  };
}

function resolveEffectiveDeliveryStyle({ series, episode }) {
  return normalizeDeliveryStyle(episode?.deliveryStyle || series?.defaultDeliveryStyle || DEFAULT_DELIVERY_STYLE);
}

function countWords(value) {
  return toStringSafe(value).split(' ').filter(Boolean).length;
}

function countWordsInList(values) {
  return (values || []).reduce((total, item) => total + countWords(item), 0);
}

function secondsToMinutesText(seconds) {
  return `~${Math.max(0.3, seconds / 60).toFixed(1)} min`;
}

function getTargetRange(targetLength) {
  if (targetLength === '10-15') {
    return { min: 10, max: 15, midpoint: 12.5 };
  }
  if (targetLength === '20-30') {
    return { min: 20, max: 30, midpoint: 25 };
  }
  if (targetLength === '45+') {
    return { min: 45, max: 55, midpoint: 50 };
  }

  return null;
}

function estimateEpisodeTiming(episode, language = 'en') {
  const copy = getWritingCopy(language);
  const outline = episode.outline || [];
  const talkingPoints = episode.talkingPoints || [];
  const hostQuestions = episode.hostQuestions || [];
  const wordsPerMinute = episode.episodeType === 'interview' ? 135 : DEFAULT_WORDS_PER_MINUTE;

  let introSeconds = Math.max(35, Math.round(((countWords(episode.hook) + countWords(outline[0])) / wordsPerMinute) * 60) + 20);
  let bodySeconds = Math.max(120, Math.round(((countWordsInList(outline.slice(1)) + countWordsInList(talkingPoints)) / wordsPerMinute) * 60) + 60);
  let promptsSeconds = hostQuestions.length
    ? Math.max(40, Math.round((countWordsInList(hostQuestions) / wordsPerMinute) * 60))
    : Math.round(bodySeconds * 0.18);
  let outroSeconds = Math.max(25, Math.round((countWords(episode.ending) / wordsPerMinute) * 60) + 15);

  let totalSeconds = introSeconds + bodySeconds + promptsSeconds + outroSeconds;
  const targetRange = getTargetRange(episode.targetLength);

  if (targetRange) {
    const midpointSeconds = targetRange.midpoint * 60;
    const ratio = totalSeconds > 0 ? midpointSeconds / totalSeconds : 1;

    if (ratio > 1.25 || ratio < 0.75) {
      introSeconds = Math.max(35, Math.round(introSeconds * ratio));
      bodySeconds = Math.max(120, Math.round(bodySeconds * ratio));
      promptsSeconds = Math.max(40, Math.round(promptsSeconds * ratio));
      outroSeconds = Math.max(25, Math.round(outroSeconds * ratio));
      totalSeconds = introSeconds + bodySeconds + promptsSeconds + outroSeconds;
    }
  }

  return {
    totalMinutes: Number((totalSeconds / 60).toFixed(1)),
    spokenWords: countWords(episode.hook)
      + countWords(episode.ending)
      + countWordsInList(outline)
      + countWordsInList(talkingPoints)
      + countWordsInList(hostQuestions),
    sectionBreakdown: [
      `${copy.introLabel}: ${secondsToMinutesText(introSeconds)}`,
      `${copy.bodyLabel}: ${secondsToMinutesText(bodySeconds)}`,
      `${copy.promptsLabel}: ${secondsToMinutesText(promptsSeconds)}`,
      `${copy.outroLabel}: ${secondsToMinutesText(outroSeconds)}`,
    ],
    summary: `${copy.totalLabel}: ${secondsToMinutesText(totalSeconds)}`,
  };
}

function tokenize(text) {
  return toStringSafe(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(' ')
    .filter((token) => token.length > 3);
}

function computeTransitionScore(outline = []) {
  const transitionHits = (outline || []).filter((line) => /^(first|next|then|finally|before|after|from|so|now|meanwhile|because|step|phase)/i.test(String(line || '').trim())).length;
  return Math.min(100, 58 + transitionHits * 11 + Math.min(outline.length, 6) * 3);
}

function buildScriptDoctor(episode, language = 'en') {
  const copy = getWritingCopy(language);
  const combinedText = [
    episode.hook,
    ...(episode.outline || []),
    ...(episode.talkingPoints || []),
    ...(episode.hostQuestions || []),
    episode.ending,
  ].join(' ');
  const tokens = tokenize(combinedText);
  const uniqueTokens = new Set(tokens);
  const repeatedCount = tokens.length - uniqueTokens.size;
  const repetitionRatio = tokens.length ? repeatedCount / tokens.length : 0;
  const avgOutlineWords = episode.outline?.length
    ? countWordsInList(episode.outline) / episode.outline.length
    : 0;
  const timing = estimateEpisodeTiming(episode, language);
  const targetRange = getTargetRange(episode.targetLength);
  const timingPenalty = targetRange
    ? Math.max(0, Math.abs(timing.totalMinutes - targetRange.midpoint) * 3)
    : 0;

  const clarityScore = Math.max(
    45,
    Math.round(
      92
      - (episode.hook ? 0 : 14)
      - (episode.ending ? 0 : 10)
      - (avgOutlineWords > 18 ? (avgOutlineWords - 18) * 1.7 : 0)
      - ((episode.talkingPoints || []).length < 4 ? 8 : 0)
    )
  );
  const pacingScore = Math.max(
    45,
    Math.round(
      90
      - timingPenalty
      - ((episode.outline || []).length < 4 ? 10 : 0)
      - ((episode.hostQuestions || []).length > 7 ? 6 : 0)
    )
  );
  const repetitionScore = Math.max(42, Math.round(94 - repetitionRatio * 180));
  const transitionScore = Math.max(45, computeTransitionScore(episode.outline || []));
  const overallScore = Math.round((clarityScore + pacingScore + repetitionScore + transitionScore) / 4);

  const issues = [];
  const strengths = [];
  const recommendations = [];

  if (clarityScore < 78) {
    issues.push(copy.issueClarity);
    recommendations.push(copy.recommendationIntro);
  } else {
    strengths.push(copy.strengthClarity);
  }

  if (pacingScore < 78) {
    issues.push(copy.issuePacing);
    recommendations.push(copy.recommendationBody);
  } else {
    strengths.push(copy.strengthPacing);
  }

  if (repetitionScore < 80) {
    issues.push(copy.issueRepetition);
    recommendations.push(copy.recommendationBody);
  } else {
    strengths.push(copy.strengthRepetition);
  }

  if (transitionScore < 78) {
    issues.push(copy.issueTransitions);
    recommendations.push(copy.recommendationCta);
  } else {
    strengths.push(copy.strengthTransitions);
  }

  return {
    overallScore,
    clarityScore,
    pacingScore,
    repetitionScore,
    transitionScore,
    strengths: [...new Set(strengths)].slice(0, 4),
    issues: [...new Set(issues)].slice(0, 4),
    recommendations: [...new Set(recommendations)].slice(0, 4),
    updatedAt: new Date(),
  };
}

function refreshEpisodeWritingIntelligence(episode, language = 'en') {
  if (!episode) {
    return episode;
  }

  episode.timeEstimate = estimateEpisodeTiming(episode, language);
  episode.scriptDoctor = buildScriptDoctor(episode, language);
  return episode;
}

function formatTemplate(template, values) {
  return Object.keys(values || {}).reduce((acc, key) => (
    acc.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key])
  ), template);
}

function buildHookOptions({ language = 'en', series, theme, episode }) {
  const copy = getWritingCopy(language);
  const blueprint = resolveEffectiveShowBlueprint({ series, episode });
  const problem = blueprint.audienceProblem || series.audience || episode.title || theme.name;
  const transformation = blueprint.listenerTransformation || series.goal || `better progress in ${theme.name}`;
  const pillar = blueprint.contentPillars[0] || theme.name || episode.title || 'your next episode';

  const hooks = Object.values(copy.hookTemplates).map((template) => formatTemplate(template, {
    problem,
    transformation,
    pillar,
  }));

  return [...new Set(hooks
    .map((hook) => clampWords(hook, 42))
    .filter(Boolean))]
    .slice(0, 5);
}

function rewriteEpisodeSection({ language = 'en', series, theme, episode, section }) {
  const normalizedSection = REWRITE_SECTION_VALUES.includes(section) ? section : 'intro';
  const copy = getWritingCopy(language);
  const blueprint = resolveEffectiveShowBlueprint({ series, episode });
  const ctaStyle = getCtaStyleOption(blueprint.ctaStyle);
  const audienceProblem = blueprint.audienceProblem || series.audience || theme.name;
  const transformation = blueprint.listenerTransformation || series.goal || theme.name;

  if (normalizedSection === 'intro') {
    return {
      section: normalizedSection,
      hook: clampWords(
        formatTemplate(copy.introRewrite, {
          problem: audienceProblem,
          transformation,
        }),
        42
      ),
    };
  }

  if (normalizedSection === 'body') {
    const basePoints = (episode.talkingPoints || []).slice(0, 5);
    const tightened = basePoints.map((point, index) => {
      const prefix = index === 0
        ? copy.bodyPrefix
        : (index === basePoints.length - 1 ? copy.bodyFinal : copy.bodyBridge);
      return clampWords(`${prefix}: ${point}`, 20);
    });

    const fallbackPoints = [
      `${copy.bodyPrefix}: ${theme.name} matters because it drives ${transformation}.`,
      `${copy.bodyBridge}: use one repeatable system, not scattered advice.`,
      `${copy.bodyFinal}: finish with one measurable action listeners can execute this week.`,
    ].map((point) => clampWords(point, 20));

    return {
      section: normalizedSection,
      talkingPoints: tightened.length ? tightened : fallbackPoints,
    };
  }

  return {
    section: normalizedSection,
    ending: clampWords(copy.ctaEndings[ctaStyle.value] || copy.ctaEndings.direct_action, episode.isSingle ? 42 : 45),
  };
}

module.exports = {
  DEFAULT_DELIVERY_STYLE,
  DELIVERY_STYLE_OPTIONS,
  DELIVERY_STYLE_VALUES,
  REWRITE_SECTION_OPTIONS,
  REWRITE_SECTION_VALUES,
  buildHookOptions,
  buildScriptDoctor,
  estimateEpisodeTiming,
  getDeliveryStyleOption,
  normalizeDeliveryStyle,
  normalizeEpisodeWritingSettings,
  normalizeSeriesWritingSettings,
  refreshEpisodeWritingIntelligence,
  resolveEffectiveDeliveryStyle,
  rewriteEpisodeSection,
};
