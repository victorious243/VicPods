const { refreshContinuityFromEpisodes } = require('../continuityService');
const { getTonePresetOrDefault } = require('../tone/applyTone');
const {
  getCtaStyleOption,
  resolveEffectiveShowBlueprint,
  resolveEffectiveStructure,
} = require('../structure/structureService');
const { getPodcastTemplate } = require('../templates/podcastTemplateService');

function hashSeed(text) {
  return [...String(text || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function pickRotating(list, seed, count) {
  const output = [];
  for (let i = 0; i < count; i += 1) {
    output.push(list[(seed + i) % list.length]);
  }
  return output;
}

function buildToneAccent(tonePreset, intensity) {
  const preset = getTonePresetOrDefault(tonePreset);
  const power = Number.isInteger(intensity) ? intensity : 3;

  const accentByPreset = {
    'Educational & Structured': 'Break it into explicit steps and definitions.',
    'Energetic & Motivational': 'Use urgency and momentum language with short lines.',
    'Analytical & Deep': 'Use frameworks, evidence, and tradeoff language.',
    'Storytelling & Emotional': 'Frame points through scenes, tension, and emotional clarity.',
    'Light & Humorous': 'Use light wit and playful turns while staying clear.',
    'Professional & Corporate': 'Use executive-level precision and outcome language.',
    'Calm & Reflective': 'Use steady pacing and intentional reflective framing.',
    'Conversational & Casual': 'Use natural host voice and plain language.',
    'Bold & Controversial': 'Lead with a respectful high-conviction claim.',
  };

  return `${preset.name} (${power}/5): ${accentByPreset[preset.name] || accentByPreset['Conversational & Casual']}`;
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['en', 'es', 'pt'].includes(normalized) ? normalized : 'en';
}

function getMockCopy(language) {
  const locale = normalizeLanguage(language);

  if (locale === 'es') {
    return {
      defaultGoal: 'Construir un plan de podcast exitoso con estructura clara y progreso medible.',
      noPriorLine: 'Este episodio abre el arco de {theme} con un primer hito claro.',
      priorLine: 'Continuar desde el episodio anterior: {endState}',
      ingredientWithHook: 'Ingrediente: {hook}.',
      ingredientDefault: 'Ingrediente: un ejemplo real de creador.',
      titleTemplate: '{theme}: Episodio {number} - Impulso estructurado{interviewSuffix}{lengthSuffix}',
      interviewSuffix: ' (Entrevista)',
      lengthSuffixTemplate: ' [{targetLength}]',
      funSegment: 'Dilema: elige un experimento audaz o un sistema confiable para la proxima semana.',
      endingStandalone: 'Conclusion: ejecuta una accion concreta antes de tu siguiente grabacion y cierra con confianza.',
      endingSeries: 'Conclusion: ejecuta una accion concreta antes de tu siguiente grabacion. Teaser: el siguiente episodio pone esto a prueba.',
      endStateStandalone: 'El episodio cierra con un resultado completo y una accion clara para la audiencia.',
      endStateSeries: 'El host avanzo {theme} hacia el objetivo: {goal}, con una accion completada y un siguiente checkpoint.',
      seriesSummary: '{seriesName} acompana a creadores para ejecutar un plan de crecimiento hacia: {goal}',
      themeSummary: '{theme} ahora enfatiza ejecucion practica, checkpoints medibles y continuidad en estilo {tonePreset}.',
      spiceHooks: [
        'Este episodio impulsa {theme} con claridad {tonePresetLower} ({toneIntensity}/5).',
        'Si {theme} esta estancado, este es el camino mas rapido para avanzar esta semana.',
        'Vamos a convertir {theme} en acciones concretas para grabar y publicar hoy.',
      ],
      spiceQuestions: [
        'Que decision principal debe forzar este episodio?',
        'Que parte quedaria mas clara en tu propia voz?',
        'Donde puedes ser mas especifico sin alargar el guion?',
        'Que punto debe desafiar la suposicion del oyente?',
        'Que accion practica tomara la audiencia en 24 horas?',
        'Que evidencia fortaleceria esta afirmacion?',
        'Que teaser aumenta la urgencia del siguiente episodio?',
        'Que se puede quitar para mantenerlo conciso?',
      ],
      spiceFunSegment: 'Reto rapido: en 60 segundos, defiende el mejor angulo {tonePreset} para este tema.',
      toneFallbackHook: 'Este episodio va directo al punto.',
      toneAlignment: 'Alineacion de tono',
      toneEndingStandalone: 'Conclusion: ejecuta una accion y cierra el episodio con claridad.',
      toneEndingSeries: 'Conclusion: ejecuta una accion. Teaser: el proximo episodio profundiza este enfoque.',
      outlineTemplate: '{timing} {step}: conecta {pillarLead} con {transformation}.',
      structureTalkingTemplates: [
        'Nombra la friccion real: {audienceProblem}',
        'Conecta la promesa con esta transformacion: {transformation}',
        'Usa {pillarLead} como pilar principal de ensenanza',
        'Muestra un marco repetible que se pueda aplicar esta semana',
        'Define una metrica que la audiencia pueda seguir de inmediato',
        'Mantiene este principio de voz: {voiceRule}',
        'Evita por completo esta frase: {bannedWord}',
      ],
      hookTemplates: {
        problem_first: '{audienceProblem}. Hoy lo convertimos en {transformation}.',
        bold_claim: '{pillarLead} importa mas de lo que la mayoria de podcasters admite, y este episodio explica por que.',
        story_scene: 'Imagina un creador bloqueado en {pillarLead}; este episodio convierte ese momento en progreso.',
        question_led: 'Y si tu proximo episodio solo necesitara {pillarLead} para generar impulso real?',
        myth_break: 'Mito: mas contenido resuelve todo. En realidad, la estructura alrededor de {pillarLead} es lo que mueve el resultado.',
      },
      ctaEndings: {
        direct_action: 'Cierra con una accion concreta antes de la siguiente grabacion.',
        reflection_prompt: 'Cierra con una pregunta para que la audiencia detecte su brecha principal.',
        community_invite: 'Cierra invitando a responder, comentar o compartir su version.',
        soft_pitch: 'Cierra apuntando de forma natural al siguiente recurso u oferta.',
      },
      showNotesSummaryTemplate: '{title} ayuda a la audiencia a pasar de {problem} hacia {transformation} con una estructura mas clara en {theme}.',
      showNotesDescriptionTemplate: '{title} convierte {theme} en una secuencia mas grabable y mas util para la audiencia. En este episodio, el host enfoca el problema central, ordena los puntos mas importantes y deja una accion clara para avanzar.',
      socialTemplates: [
        'Nuevo episodio: {title}. {takeaway}',
        'Si {problem}, este episodio te da una via mas clara hacia {transformation}.',
        'Tema de hoy: {theme}. Punto clave: {takeaway}',
      ],
    };
  }

  if (locale === 'pt') {
    return {
      defaultGoal: 'Construir um plano de podcast bem-sucedido com estrutura clara e progresso mensuravel.',
      noPriorLine: 'Este episodio abre o arco de {theme} com um primeiro marco claro.',
      priorLine: 'Continuar do episodio anterior: {endState}',
      ingredientWithHook: 'Ingrediente: {hook}.',
      ingredientDefault: 'Ingrediente: um exemplo real de criador.',
      titleTemplate: '{theme}: Episodio {number} - Impulso estruturado{interviewSuffix}{lengthSuffix}',
      interviewSuffix: ' (Entrevista)',
      lengthSuffixTemplate: ' [{targetLength}]',
      funSegment: 'Dilema: escolha um experimento ousado ou um sistema confiavel para a proxima semana.',
      endingStandalone: 'Conclusao: execute uma acao concreta antes da proxima gravacao e feche com confianca.',
      endingSeries: 'Conclusao: execute uma acao concreta antes da proxima gravacao. Teaser: o proximo episodio testa isso.',
      endStateStandalone: 'O episodio fecha com resultado completo e uma acao clara para o publico.',
      endStateSeries: 'O host avancou {theme} em direcao ao objetivo: {goal}, com uma acao concluida e proximo checkpoint.',
      seriesSummary: '{seriesName} guia criadores para executar um plano de crescimento em direcao a: {goal}',
      themeSummary: '{theme} agora enfatiza execucao pratica, checkpoints mensuraveis e continuidade no estilo {tonePreset}.',
      spiceHooks: [
        'Este episodio impulsiona {theme} com clareza {tonePresetLower} ({toneIntensity}/5).',
        'Se {theme} estiver travado, este e o caminho mais rapido para avancar nesta semana.',
        'Vamos transformar {theme} em acoes concretas para gravar e publicar hoje.',
      ],
      spiceQuestions: [
        'Qual decisao principal este episodio precisa forcar?',
        'Qual parte ficaria mais clara na sua propria voz?',
        'Onde voce pode ser mais especifico sem alongar o roteiro?',
        'Qual ponto deve desafiar a suposicao do ouvinte?',
        'Qual acao pratica o publico deve executar em 24 horas?',
        'Qual evidencia fortaleceria essa afirmacao?',
        'Qual teaser aumenta a urgencia para o proximo episodio?',
        'O que pode ser removido para manter conciso?',
      ],
      spiceFunSegment: 'Desafio rapido: em 60 segundos, defenda o melhor angulo {tonePreset} para este tema.',
      toneFallbackHook: 'Este episodio vai direto ao ponto.',
      toneAlignment: 'Alinhamento de tom',
      toneEndingStandalone: 'Conclusao: execute uma acao e feche o episodio com clareza.',
      toneEndingSeries: 'Conclusao: execute uma acao. Teaser: o proximo episodio aprofunda este enfoque.',
      outlineTemplate: '{timing} {step}: conecta {pillarLead} com {transformation}.',
      structureTalkingTemplates: [
        'Nomeie a friccao real: {audienceProblem}',
        'Conecte a promessa a esta transformacao: {transformation}',
        'Use {pillarLead} como pilar principal de ensino',
        'Mostre uma estrutura repetivel que possa ser aplicada nesta semana',
        'Defina uma metrica que o publico possa acompanhar de imediato',
        'Mantenha esta regra de voz: {voiceRule}',
        'Evite completamente esta frase: {bannedWord}',
      ],
      hookTemplates: {
        problem_first: '{audienceProblem}. Hoje vamos transformar isso em {transformation}.',
        bold_claim: '{pillarLead} importa mais do que a maioria dos podcasters admite, e este episodio mostra por que.',
        story_scene: 'Imagine um criador travado em {pillarLead}; este episodio transforma esse momento em progresso.',
        question_led: 'E se o seu proximo episodio so precisasse de {pillarLead} para gerar impulso real?',
        myth_break: 'Mito: mais conteudo resolve tudo. Na pratica, a estrutura em torno de {pillarLead} e o que move o resultado.',
      },
      ctaEndings: {
        direct_action: 'Feche com uma acao concreta antes da proxima gravacao.',
        reflection_prompt: 'Feche com uma pergunta para o publico diagnosticar a principal lacuna.',
        community_invite: 'Feche convidando o publico a responder, comentar ou compartilhar a propria versao.',
        soft_pitch: 'Feche apontando de forma natural para o proximo recurso ou oferta.',
      },
      showNotesSummaryTemplate: '{title} ajuda o publico a sair de {problem} em direcao a {transformation} com uma estrutura mais clara em {theme}.',
      showNotesDescriptionTemplate: '{title} transforma {theme} em uma sequencia mais gravavel e mais util para o publico. Neste episodio, o host foca o problema central, organiza os pontos mais importantes e fecha com uma acao clara para seguir em frente.',
      socialTemplates: [
        'Novo episodio: {title}. {takeaway}',
        'Se {problem}, este episodio te entrega um caminho mais claro para {transformation}.',
        'Tema de hoje: {theme}. Ponto-chave: {takeaway}',
      ],
    };
  }

  return {
    defaultGoal: 'Build a successful podcast plan with clear structure and measurable progress.',
    noPriorLine: 'This opens the {theme} arc with a clear first milestone.',
    priorLine: 'Carry forward from prior episode: {endState}',
    ingredientWithHook: 'Ingredient: {hook}.',
    ingredientDefault: 'Ingredient: a relatable creator field example.',
    titleTemplate: '{theme}: Episode {number} - Structured Momentum{interviewSuffix}{lengthSuffix}',
    interviewSuffix: ' (Interview)',
    lengthSuffixTemplate: ' [{targetLength}]',
    funSegment: 'Dilemma: choose one bold experiment vs one reliable system for next week.',
    endingStandalone: 'Takeaway: execute one specific action before your next recording and close with confidence.',
    endingSeries: 'Takeaway: execute one specific action before your next recording. Teaser: next episode pressure-tests this with a tougher scenario.',
    endStateStandalone: 'Episode closed with a complete standalone outcome and one clear next action for listeners.',
    endStateSeries: 'The host advanced {theme} toward goal: {goal}, with one action completed and one measurable next checkpoint set.',
    seriesSummary: '{seriesName} tracks creators executing a consistent podcast growth plan toward: {goal}',
    themeSummary: '{theme} now emphasizes practical execution, measurable checkpoints, and tight continuity in {tonePreset} style.',
    spiceHooks: [
      'This episode pushes {theme} forward with {tonePresetLower} clarity ({toneIntensity}/5).',
      'If {theme} is stuck, this is the fastest path to forward momentum this week.',
      'Let us tighten {theme} into actions you can record and ship today.',
    ],
    spiceQuestions: [
      'What is the one decision this episode must force?',
      'What would make this segment clearer in your own voice?',
      'Where can you be more specific without being longer?',
      'What point should challenge the listener\'s default assumption?',
      'What practical action should listeners take in 24 hours?',
      'What evidence would strengthen this claim?',
      'What teaser line creates urgency for the next episode?',
      'What should be removed to keep this concise?',
    ],
    spiceFunSegment: 'Rapid-fire: in 60 seconds, defend the strongest {tonePreset} angle for this theme.',
    toneFallbackHook: 'This episode gets straight to the point.',
    toneAlignment: 'Tone alignment',
    toneEndingStandalone: 'Takeaway: execute one action and close the episode with clarity.',
    toneEndingSeries: 'Takeaway: execute one action. Teaser: next episode deepens this with a sharper constraint.',
    outlineTemplate: '{timing} {step}: move {pillarLead} toward {transformation}.',
    structureTalkingTemplates: [
      'Name the real friction: {audienceProblem}',
      'Tie the promise directly to this transformation: {transformation}',
      'Use {pillarLead} as the main teaching pillar',
      'Show one repeatable framework listeners can apply this week',
      'Set one metric listeners can track immediately',
      'Keep the phrasing aligned with this rule: {voiceRule}',
      'Avoid this phrase entirely: {bannedWord}',
    ],
    hookTemplates: {
      problem_first: '{audienceProblem}. Today we turn that into {transformation}.',
      bold_claim: '{pillarLead} matters more than most podcasters admit, and this episode proves why.',
      story_scene: 'Picture a creator stuck on {pillarLead}; this episode turns that stuck moment into progress.',
      question_led: 'What if your next episode only needed {pillarLead} to create real momentum?',
      myth_break: 'Myth: more content fixes everything. Better structure around {pillarLead} is what actually moves the needle.',
    },
    ctaEndings: {
      direct_action: 'End with one action listeners should complete before they record again.',
      reflection_prompt: 'End by asking listeners to diagnose their main gap before acting.',
      community_invite: 'End by inviting listeners to reply, comment, or share their version.',
      soft_pitch: 'End by naturally pointing to the next resource or offer.',
    },
    showNotesSummaryTemplate: '{title} helps listeners move from {problem} toward {transformation} with a clearer plan around {theme}.',
    showNotesDescriptionTemplate: '{title} turns {theme} into a more recordable and more useful episode path. This episode sharpens the main problem, organizes the strongest points, and closes with one practical action listeners can take next.',
    socialTemplates: [
      'New episode: {title}. {takeaway}',
      'If {problem}, this episode gives you a clearer path to {transformation}.',
      'Today\'s focus: {theme}. Key takeaway: {takeaway}',
    ],
  };
}

function formatTemplate(template, values) {
  return Object.keys(values || {}).reduce((acc, key) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]), template);
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeIdeaNiche(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

class MockProvider {
  constructor() {
    this.name = 'mock';
  }

  async generateEpisodeDraft(input) {
    const {
      series,
      theme,
      episode,
      episodeNumberWithinTheme,
      previousEpisodeEndState,
      ingredientHooks,
      effectiveTone,
      callbackSuggestions,
      includeFunSegment,
      isStandalone,
      requireTeaser,
      episodeType,
      targetLength,
    } = input;

    const seed = hashSeed(`${series.name}-${theme.name}-${episodeNumberWithinTheme}`);
    const copy = getMockCopy(input.language);
    const goal = series.goal || copy.defaultGoal;
    const tonePreset = effectiveTone?.tonePreset || series.tonePreset;
    const toneIntensity = effectiveTone?.toneIntensity || series.toneIntensity || 3;
    const toneAccent = buildToneAccent(tonePreset, toneIntensity);
    const blueprint = resolveEffectiveShowBlueprint({ series, episode });
    const structure = resolveEffectiveStructure({ series, episode });
    const selectedTemplate = episode?.templateType
      ? getPodcastTemplate(episode.templateType)
      : null;
    const templateMeta = structure.formatTemplateMeta;
    const targetLengthMeta = structure.targetLengthMeta;
    const ctaStyle = getCtaStyleOption(blueprint.ctaStyle);
    const pillarLead = blueprint.contentPillars[seed % Math.max(blueprint.contentPillars.length, 1)] || theme.name;
    const audienceProblem = blueprint.audienceProblem || series.audience || 'listeners are unclear on the next practical step';
    const transformation = blueprint.listenerTransformation || goal;
    const voiceRule = blueprint.brandVoiceRules[0] || 'Keep every line specific and useful.';
    const bannedWord = blueprint.bannedWords[0];

    const outlineSteps = selectedTemplate?.sectionLabels?.length
      ? selectedTemplate.sectionLabels
      : (templateMeta.flow || []);

    const outlinePool = outlineSteps.map((step, index) => {
      const timing = targetLengthMeta.timingPlan[index] || `Part ${index + 1}`;
      return formatTemplate(copy.outlineTemplate, {
        timing,
        step,
        pillarLead,
        transformation: transformation.toLowerCase(),
      });
    });

    const talkingPool = copy.structureTalkingTemplates.map((template) => formatTemplate(template, {
      audienceProblem,
      transformation,
      pillarLead,
      voiceRule,
      bannedWord: bannedWord || voiceRule,
    }));
    if (!bannedWord) {
      talkingPool[talkingPool.length - 1] = voiceRule;
    }
    if (callbackSuggestions?.length) {
      talkingPool.unshift(callbackSuggestions[0]);
    }

    const questionPool = copy.spiceQuestions;

    const forwardLine = previousEpisodeEndState
      ? formatTemplate(copy.priorLine, { endState: previousEpisodeEndState })
      : formatTemplate(copy.noPriorLine, { theme: theme.name });

    const ingredientText = ingredientHooks && ingredientHooks.length
      ? formatTemplate(copy.ingredientWithHook, { hook: ingredientHooks[0] })
      : copy.ingredientDefault;

    const interviewSuffix = episodeType === 'interview' ? copy.interviewSuffix : '';
    const lengthSuffix = targetLength
      ? formatTemplate(copy.lengthSuffixTemplate, { targetLength })
      : '';
    const hookLine = formatTemplate(
      copy.hookTemplates[structure.hookStyle] || copy.hookTemplates.problem_first,
      {
        audienceProblem,
        transformation,
        pillarLead,
      }
    );

    return {
      title: formatTemplate(copy.titleTemplate, {
        theme: theme.name,
        number: String(episodeNumberWithinTheme),
        interviewSuffix,
        lengthSuffix,
      }),
      hook: `${hookLine} ${forwardLine} ${toneAccent} ${ingredientText}`,
      outline: pickRotating(outlinePool, seed, Math.min(outlinePool.length, 7)),
      talkingPoints: pickRotating(talkingPool, seed + 2, 7),
      hostQuestions: pickRotating(questionPool, seed + 4, 8),
      funSegment: includeFunSegment === false
        ? ''
        : copy.funSegment,
      ending: requireTeaser === false
        ? `${copy.endingStandalone} ${copy.ctaEndings[ctaStyle.value] || copy.ctaEndings.direct_action}`
        : `${copy.endingSeries} ${copy.ctaEndings[ctaStyle.value] || copy.ctaEndings.direct_action}`,
      endState: isStandalone
        ? copy.endStateStandalone
        : formatTemplate(copy.endStateSeries, { theme: theme.name, goal }),
      seriesSummary: formatTemplate(copy.seriesSummary, { seriesName: series.name, goal }),
      themeSummary: formatTemplate(copy.themeSummary, { theme: theme.name, tonePreset }),
    };
  }

  async generateSpices(input) {
    const {
      series,
      theme,
      episodeNumberWithinTheme,
      effectiveTone,
      includeFunSegment,
    } = input;

    const seed = hashSeed(`${series.name}-${theme.name}-spice-${episodeNumberWithinTheme}`);
    const tonePreset = effectiveTone?.tonePreset || series.tonePreset;
    const toneIntensity = effectiveTone?.toneIntensity || series.toneIntensity || 3;
    const copy = getMockCopy(input.language);

    const hooks = copy.spiceHooks.map((template) => formatTemplate(template, {
      theme: theme.name,
      tonePresetLower: String(tonePreset || '').toLowerCase(),
      toneIntensity: String(toneIntensity),
    }));
    const questions = copy.spiceQuestions;

    return {
      hook: hooks[seed % hooks.length],
      hostQuestions: pickRotating(questions, seed, 8),
      funSegment: includeFunSegment === false
        ? ''
        : formatTemplate(copy.spiceFunSegment, { tonePreset }),
    };
  }

  async refreshContinuity(input) {
    return refreshContinuityFromEpisodes({
      series: input.series,
      theme: input.theme,
      priorThemeEpisodes: input.priorThemeEpisodes,
      recentSeriesEpisodes: input.recentSeriesEpisodes,
      currentEpisode: input.episode,
      language: input.language,
    });
  }

  async fixTone(input) {
    const tonePreset = input.effectiveTone?.tonePreset || input.series.tonePreset || 'Conversational & Casual';
    const toneIntensity = input.effectiveTone?.toneIntensity || input.series.toneIntensity || 3;
    const copy = getMockCopy(input.language);

    return {
      hook: `${input.episode.hook || copy.toneFallbackHook} ${copy.toneAlignment}: ${tonePreset} (${toneIntensity}/5).`,
      hostQuestions: (input.episode.hostQuestions || []).slice(0, 8).map((question) => `${question}`),
      ending: input.requireTeaser === false
        ? (input.episode.ending || copy.toneEndingStandalone)
        : `${input.episode.ending || copy.toneEndingSeries}`,
    };
  }

  async generateShowNotes(input) {
    const { series, theme, episode, effectiveTone, seasonArcStep } = input;
    const copy = getMockCopy(input.language);
    const blueprint = resolveEffectiveShowBlueprint({ series, episode });
    const structure = resolveEffectiveStructure({ series, episode });
    const ctaStyle = getCtaStyleOption(blueprint.ctaStyle);
    const audienceProblem = blueprint.audienceProblem || series.audience || theme.name;
    const transformation = blueprint.listenerTransformation || series.goal || theme.name;
    const title = episode.title || `${theme.name} Episode`;
    const keyTakeawaysSource = (episode.talkingPoints || []).filter(Boolean).slice(0, 5);
    const fallbackTakeaways = (episode.outline || []).filter(Boolean).slice(0, 5);
    const keyTakeaways = keyTakeawaysSource.length ? keyTakeawaysSource : fallbackTakeaways;
    const normalizedTakeaways = keyTakeaways.length
      ? keyTakeaways
      : [
        `Clarify the main friction around ${theme.name}.`,
        `Use ${structure.formatTemplateMeta.label} to tighten the delivery.`,
        'Close with one action listeners can execute this week.',
      ];

    return {
      summary: formatTemplate(copy.showNotesSummaryTemplate, {
        title,
        problem: audienceProblem,
        transformation,
        theme: theme.name,
      }),
      description: `${formatTemplate(copy.showNotesDescriptionTemplate, {
        title,
        theme: theme.name,
        transformation,
      })} ${seasonArcStep ? `Season position: ${seasonArcStep}` : ''}`.trim(),
      keyTakeaways: normalizedTakeaways,
      listenerCTA: episode.ending || copy.ctaEndings[ctaStyle.value] || copy.ctaEndings.direct_action,
      socialPosts: copy.socialTemplates.map((template) => formatTemplate(template, {
        title,
        theme: theme.name,
        problem: audienceProblem,
        transformation,
        takeaway: normalizedTakeaways[0],
        tonePreset: effectiveTone?.tonePreset || series.tonePreset || 'Conversational & Casual',
      })).slice(0, 3),
    };
  }

  async generateLaunchPack(input) {
    const { series, theme, episode, effectiveTone } = input;
    const blueprint = resolveEffectiveShowBlueprint({ series, episode });
    const structure = resolveEffectiveStructure({ series, episode });
    const title = episode.title || `${theme.name} Episode`;
    const audienceProblem = blueprint.audienceProblem || series.audience || `listeners struggling with ${theme.name}`;
    const transformation = blueprint.listenerTransformation || series.goal || `clearer momentum around ${theme.name}`;
    const outlineLead = (episode.outline || []).filter(Boolean).slice(0, 4);
    const talkingPointLead = (episode.talkingPoints || []).filter(Boolean).slice(0, 3);
    const notesLines = (outlineLead.length ? outlineLead : talkingPointLead).map((item) => `- ${item}`);
    const toneLabel = effectiveTone?.tonePreset || series.tonePreset || 'Conversational & Casual';

    return {
      titles: [
        title,
        `${title}: The Practical Framework`,
        `${theme.name}: A Clearer Recording Plan`,
      ],
      description: `${title} helps creators move from ${audienceProblem} toward ${transformation} with a sharper ${structure.formatTemplateMeta.label.toLowerCase()} episode flow and clearer next action.`,
      showNotes: [
        `Why this episode matters: ${audienceProblem}`,
        '',
        'What listeners will get:',
        ...(notesLines.length ? notesLines : ['- A clearer publishing angle', '- A tighter episode structure', '- One action to test before the next recording']),
        '',
        `Delivery angle: ${toneLabel}.`,
      ].join('\n'),
      socialCaptions: [
        `New episode: ${title}. ${transformation}`,
        `If your audience is stuck on ${theme.name}, this episode gives them a clearer path forward.`,
        `${title} breaks ${theme.name} into a sharper, more publishable structure.`,
      ],
      cta: 'If this episode helped, follow the show and share it with one creator who should hear it next.',
    };
  }

  async generatePodcastIdeas(input) {
    const niche = normalizeIdeaNiche(input?.niche);
    const topic = niche || 'podcast growth';
    const titleTopic = toTitleCase(topic) || 'Podcast Growth';

    const titleTemplates = [
      `Why ${titleTopic} Stalls Before It Turns Into Listener Momentum`,
      `The ${titleTopic} Mistake Most Shows Repeat Without Noticing`,
      `How To Turn ${titleTopic} Into A Stronger Weekly Episode Angle`,
      `${titleTopic}: The Questions Your Audience Actually Wants Answered`,
      `What ${titleTopic} Sounds Like When The Host Finally Gets Specific`,
      `The Story Behind A ${titleTopic} Episode That Actually Lands`,
      `${titleTopic} Myths Worth Breaking On Your Next Recording`,
      `A Better ${titleTopic} Framework For Clearer Podcast Episodes`,
      `The ${titleTopic} Signals That Tell You An Idea Is Worth Recording`,
      `How Great Hosts Build Authority Around ${titleTopic} Without Rambling`,
    ];

    const hookTemplates = [
      `Use a myth-busting angle that replaces weak assumptions with a clearer model your listeners can apply.`,
      `Open with a friction point in ${topic.toLowerCase()} and show why most creators stay too vague too long.`,
      `Frame the episode around one decision your audience needs to make before they record or publish again.`,
      `Lead with a quick story or case-study moment, then turn it into a practical framework.`,
      `Show what most podcasters miss about ${topic.toLowerCase()} and close with one action listeners can test immediately.`,
      `Use a sharp question-led hook that makes the listener reconsider how they approach ${topic.toLowerCase()}.`,
      `Turn one common mistake into a step-by-step breakdown that feels immediately useful on mic.`,
      `Focus on one overlooked signal in ${topic.toLowerCase()} and explain how it changes the episode structure.`,
      `Build the angle around a before-and-after transformation so the listener can picture the result fast.`,
      `Challenge the default advice in ${topic.toLowerCase()} and replace it with a stronger recording plan.`,
    ];

    return {
      ideas: titleTemplates.map((title, index) => ({
        title,
        hookAngle: hookTemplates[index % hookTemplates.length],
      })),
    };
  }
}

module.exports = {
  MockProvider,
};
