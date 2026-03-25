const FIXED_REFUSAL_MESSAGE = 'I can only help with VicPods features, workflows, account settings, and platform questions.';

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
};

const SECTION_DEFINITIONS = [
  {
    id: 'about',
    keywords: [
      'what is vicpods', 'about vicpods', 'what does vicpods do', 'what can vicpods do',
      'who is vicpods for', 'acerca de vicpods', 'que es vicpods', 'que hace vicpods',
      'para quien es vicpods', 'sobre o vicpods', 'o que e vicpods', 'o que o vicpods faz',
      'para quem o vicpods e feito',
    ],
    links: [
      { href: '/about', labelKey: 'about' },
      { href: '/help', labelKey: 'helpCenter' },
    ],
  },
  {
    id: 'gettingStarted',
    keywords: [
      'getting started', 'get started', 'start here', 'first steps', 'new user', 'new here',
      'how do i start', 'primeros pasos', 'empezar', 'como empiezo', 'nuevo usuario',
      'primeiros passos', 'como comeco', 'novo usuario',
    ],
    links: [
      { href: '/help#getting-started', labelKey: 'helpCenter' },
      { href: '/studio', labelKey: 'studio' },
      { href: '/kitchen', labelKey: 'workspace' },
    ],
  },
  {
    id: 'single',
    keywords: [
      'single episode', 'single podcast', 'new episode', 'start episode', 'create episode',
      'single wizard', 'episodio unico', 'nuevo episodio', 'crear episodio', 'start single',
      'episodio unico', 'novo episodio', 'criar episodio', 'episodio individual',
    ],
    links: [
      { href: '/create/single', labelKey: 'workspace' },
      { href: '/help#single-episode', labelKey: 'helpCenter' },
    ],
  },
  {
    id: 'series',
    keywords: [
      'series', 'new series', 'create series', 'season', 'themes', 'recurring themes',
      'series workspace', 'crear una serie', 'nueva serie', 'temas recurrentes',
      'criar uma serie', 'nova serie', 'temas recorrentes',
    ],
    links: [
      { href: '/create/series', labelKey: 'workspace' },
      { href: '/help#series-creation', labelKey: 'helpCenter' },
    ],
  },
  {
    id: 'workspace',
    keywords: [
      'workspace', 'kitchen', 'studio and workspace', 'difference between studio and workspace',
      'where do i create', 'where do i edit', 'espacio de trabajo', 'diferencia entre studio y workspace',
      'onde eu crio', 'onde eu edito', 'espaco de trabalho', 'diferenca entre studio e workspace',
    ],
    links: [
      { href: '/kitchen', labelKey: 'workspace' },
      { href: '/help#workspace-help', labelKey: 'helpCenter' },
      { href: '/studio', labelKey: 'studio' },
    ],
  },
  {
    id: 'pantry',
    keywords: [
      'pantry', 'ideas', 'hooks', 'ingredients', 'reuse idea', 'save idea',
      'guardar idea', 'ingredientes', 'ganchos', 'reutilizar idea',
      'salvar ideia', 'ingredientes', 'reutilizar ideia',
    ],
    links: [
      { href: '/pantry', labelKey: 'pantry' },
      { href: '/help#pantry-help', labelKey: 'helpCenter' },
    ],
  },
  {
    id: 'features',
    keywords: [
      'features', 'feature', 'show blueprint', 'episode architect', 'hook generator',
      'script doctor', 'time estimator', 'tone controls', 'series bible', 'season arc planner',
      'continuity checker', 'topic gap finder', 'callback planner', 'funciones', 'funcion',
      'estructura', 'feature set', 'recursos', 'recurso',
    ],
    links: [
      { href: '/help', labelKey: 'helpCenter' },
      { href: '/kitchen', labelKey: 'workspace' },
    ],
  },
  {
    id: 'settings',
    keywords: [
      'language', 'settings', 'appearance', 'profile', 'password', 'theme', 'dark mode',
      'light mode', 'idioma', 'configuracion', 'apariencia', 'perfil', 'contrasena',
      'modo oscuro', 'modo claro', 'idioma', 'configuracoes', 'aparencia', 'senha',
      'modo escuro', 'modo claro',
    ],
    links: [
      { href: '/settings', labelKey: 'settings' },
      { href: '/help#settings-help', labelKey: 'helpCenter' },
    ],
  },
  {
    id: 'pricing',
    keywords: [
      'billing', 'plan', 'plans', 'upgrade', 'price', 'pricing', 'invoice', 'subscription',
      'free', 'pro', 'premium', 'pdf export', 'docx export', 'facturacion', 'precio',
      'suscripcion', 'cobranca', 'preco', 'assinatura', 'plano',
    ],
    links: [
      { href: '/settings?section=billing', labelKey: 'billing' },
      { href: '/help#settings-help', labelKey: 'helpCenter' },
    ],
  },
  {
    id: 'onboarding',
    keywords: [
      'onboarding', 'tour', 'tutorial', 'walkthrough', 'replay onboarding',
      'lighting systems', 'lighting', 'help me learn', 'tour rapido', 'tutoria',
      'recorrido', 'iluminacion', 'tour', 'tutorial', 'iluminacao',
    ],
    links: [
      { href: '/settings?section=appearance', labelKey: 'settings' },
      { href: '/help', labelKey: 'helpCenter' },
    ],
  },
];

const COPY = {
  en: {
    starter: 'Ask me about single episodes, series setup, Workspace, Pantry, language settings, billing, or plan access.',
    refusal: FIXED_REFUSAL_MESSAGE,
    helpCenter: 'Help Center',
    about: 'About VicPods',
    studio: 'Studio',
    workspace: 'Workspace',
    pantry: 'Pantry',
    settings: 'Settings',
    billing: 'Billing',
    sections: {
      about: {
        title: 'About VicPods',
        answer: 'VicPods is a ready-to-record podcast planning and launch-prep application for creators and lean podcast teams. It helps users turn rough ideas into clearer episode frameworks, show notes, episode briefs, and more consistent series planning before they record.',
      },
      gettingStarted: {
        title: 'Getting started',
        answer: 'Start in Studio for a high-level overview of recent activity. Open Workspace when you are ready to create a new episode, launch a new series, or continue an existing draft. Then use Settings to choose language and appearance, and use Pantry to save reusable hooks and ideas.',
      },
      single: {
        title: 'Single episode workflow',
        answer: 'To create a single episode, open Workspace and choose New Episode. Add the topic, audience notes, and the result you want listeners to reach. Then choose the tone, format template, hook style, and target length, generate the draft, and refine it in the episode editor.',
      },
      series: {
        title: 'Series workflow',
        answer: 'To create a series, open Workspace and choose New Series. Define the series setup, season goal, audience promise, recurring themes, blueprint defaults, tone, delivery style, and structure rules. After setup, manage themes and episode drafts from the series workspace.',
      },
      workspace: {
        title: 'Workspace',
        answer: 'Workspace is the main production area. Use it to start new episodes, launch new series, open the single-episode collection, and manage series already in progress. Studio is for overview; Workspace is for creation and editing.',
      },
      pantry: {
        title: 'Pantry',
        answer: 'Pantry stores reusable ingredients for future drafts, such as hooks, ideas, tags, and notes. Treat Pantry as your ingredient shelf, not as the place where you fully edit episodes.',
      },
      features: {
        title: 'Feature set',
        answer: 'VicPods currently focuses on planning, writing, and launch prep. Key features include Show Blueprint, Episode Architect, Hook Generator, Script Doctor, Section Rewrite Tools, Time Estimator, Release Readiness Score, Show Notes Pack, Episode Brief exports, tone and delivery controls, Series Bible, Season Arc Planner, Continuity Checker, Topic Gap Finder, and Callback Planner.',
      },
      settings: {
        title: 'Settings',
        answer: 'Settings controls your profile, app language, theme preference, password, and subscription details. Appearance controls language and dark/light mode. Billing shows current access, invoices, and upgrade options.',
      },
      pricing: {
        title: 'Plans and billing',
        answer: 'VicPods currently has three plans. Founding launch pricing runs through March 31, 2026. Free includes core Studio + Workspace + Pantry access, 5 generations per day, Release Readiness Score, Show Notes Pack, and TXT episode brief export. Pro includes 50 generations per day, continuity refresh, tone scoring, and TXT + PDF episode brief exports. Premium includes unlimited generations, tone fix, voice persona controls, and TXT + PDF + DOCX episode brief exports.',
      },
      onboarding: {
        title: 'Onboarding',
        answer: 'The onboarding tour shows the Studio overview, how to start a single episode, how to create a series, where to manage settings, and how the light and dark theme system works. You can replay the tour from Settings.',
      },
    },
  },
  es: {
    starter: 'Preguntame sobre episodios unicos, creacion de series, Workspace, Pantry, idioma, configuracion, facturacion o acceso a planes.',
    refusal: 'Solo puedo ayudar con funciones, flujos de trabajo, configuracion de cuenta y preguntas de la plataforma VicPods.',
    helpCenter: 'Centro de ayuda',
    about: 'Acerca de VicPods',
    studio: 'Studio',
    workspace: 'Workspace',
    pantry: 'Pantry',
    settings: 'Configuracion',
    billing: 'Facturacion',
    sections: {
      about: {
        title: 'Acerca de VicPods',
        answer: 'VicPods es una aplicacion de planificacion de podcasts y preparacion de lanzamiento lista para grabar para creadores y equipos pequenos. Ayuda a convertir ideas iniciales en estructuras mas claras, show notes, briefs de episodio y una planificacion de series mas consistente antes de grabar.',
      },
      gettingStarted: {
        title: 'Primeros pasos',
        answer: 'Empieza en Studio para una vista general de la actividad reciente. Abre Workspace cuando estes listo para crear un nuevo episodio, lanzar una nueva serie o continuar un borrador existente. Luego usa Configuracion para elegir idioma y apariencia, y Pantry para guardar hooks e ideas reutilizables.',
      },
      single: {
        title: 'Flujo de episodio unico',
        answer: 'Para crear un episodio unico, abre Workspace y elige Nuevo episodio. Agrega el tema, notas de audiencia y el resultado que quieres lograr para los oyentes. Luego elige tono, plantilla de formato, estilo de hook y duracion objetivo, genera el borrador y refinelo en el editor del episodio.',
      },
      series: {
        title: 'Flujo de series',
        answer: 'Para crear una serie, abre Workspace y elige Nueva serie. Define la configuracion de la serie, objetivo de temporada, promesa para la audiencia, temas recurrentes, valores por defecto del blueprint, tono, estilo de entrega y reglas de estructura. Despues gestiona temas y borradores desde el espacio de la serie.',
      },
      workspace: {
        title: 'Workspace',
        answer: 'Workspace es el area principal de produccion. Usalo para iniciar nuevos episodios, lanzar nuevas series, abrir la coleccion de episodios unicos y gestionar series ya en progreso. Studio es para vista general; Workspace es para crear y editar.',
      },
      pantry: {
        title: 'Pantry',
        answer: 'Pantry guarda ingredientes reutilizables para borradores futuros, como hooks, ideas, etiquetas y notas. Tratalo como tu estante de ingredientes, no como el lugar donde editas episodios completos.',
      },
      features: {
        title: 'Funciones',
        answer: 'VicPods se enfoca actualmente en planificacion, escritura y preparacion de lanzamiento. Las funciones clave incluyen Show Blueprint, Episode Architect, Hook Generator, Script Doctor, herramientas de reescritura por seccion, Time Estimator, Release Readiness Score, Show Notes Pack, exportaciones de Episode Brief, controles de tono y entrega, Series Bible, Season Arc Planner, Continuity Checker, Topic Gap Finder y Callback Planner.',
      },
      settings: {
        title: 'Configuracion',
        answer: 'Configuracion controla tu perfil, idioma de la app, preferencia de tema, contrasena y detalles de suscripcion. Apariencia controla idioma y modo oscuro o claro. Facturacion muestra acceso actual, facturas y opciones de mejora.',
      },
      pricing: {
        title: 'Planes y facturacion',
        answer: 'VicPods tiene actualmente tres planes. El precio founding de lanzamiento dura hasta el 31 de marzo de 2026. Free incluye acceso base a Studio + Workspace + Pantry, 5 generaciones por dia, Release Readiness Score, Show Notes Pack y exportacion TXT de Episode Brief. Pro incluye 50 generaciones por dia, refresh de continuidad, puntuacion de tono y exportaciones TXT + PDF de Episode Brief. Premium incluye generaciones ilimitadas, tone fix, controles de voice persona y exportaciones TXT + PDF + DOCX de Episode Brief.',
      },
      onboarding: {
        title: 'Onboarding',
        answer: 'El tour de onboarding muestra la vista general de Studio, como iniciar un episodio unico, como crear una serie, donde gestionar configuracion y como funciona el sistema de tema claro y oscuro. Puedes repetir el tour desde Configuracion.',
      },
    },
  },
  pt: {
    starter: 'Pergunte sobre episodios unicos, criacao de series, Workspace, Pantry, idioma, configuracoes, cobranca ou acesso a planos.',
    refusal: 'So posso ajudar com recursos, fluxos de trabalho, configuracoes de conta e perguntas sobre a plataforma VicPods.',
    helpCenter: 'Central de ajuda',
    about: 'Sobre o VicPods',
    studio: 'Studio',
    workspace: 'Workspace',
    pantry: 'Pantry',
    settings: 'Configuracoes',
    billing: 'Cobranca',
    sections: {
      about: {
        title: 'Sobre o VicPods',
        answer: 'VicPods e um aplicativo de planejamento de podcasts e preparacao de lancamento pronto para gravar para criadores e equipes pequenas. Ele ajuda a transformar ideias iniciais em estruturas mais claras, show notes, briefs de episodio e planejamento de series mais consistente antes da gravacao.',
      },
      gettingStarted: {
        title: 'Primeiros passos',
        answer: 'Comece no Studio para uma visao geral da atividade recente. Abra o Workspace quando estiver pronto para criar um novo episodio, lancar uma nova serie ou continuar um rascunho existente. Depois use Configuracoes para escolher idioma e aparencia, e Pantry para salvar hooks e ideias reutilizaveis.',
      },
      single: {
        title: 'Fluxo de episodio unico',
        answer: 'Para criar um episodio unico, abra o Workspace e escolha Novo episodio. Adicione o tema, notas sobre a audiencia e o resultado que voce quer gerar para os ouvintes. Depois escolha tom, modelo de formato, estilo de hook e duracao alvo, gere o rascunho e refine no editor do episodio.',
      },
      series: {
        title: 'Fluxo de series',
        answer: 'Para criar uma serie, abra o Workspace e escolha Nova serie. Defina configuracao da serie, objetivo da temporada, promessa para a audiencia, temas recorrentes, padroes do blueprint, tom, estilo de entrega e regras de estrutura. Depois gerencie temas e rascunhos pela area da serie.',
      },
      workspace: {
        title: 'Workspace',
        answer: 'Workspace e a principal area de producao. Use para iniciar novos episodios, lancar novas series, abrir a colecao de episodios unicos e gerenciar series ja em andamento. Studio e para visao geral; Workspace e para criacao e edicao.',
      },
      pantry: {
        title: 'Pantry',
        answer: 'Pantry guarda ingredientes reutilizaveis para rascunhos futuros, como hooks, ideias, tags e notas. Trate o Pantry como sua prateleira de ingredientes, nao como o lugar onde voce edita episodios completos.',
      },
      features: {
        title: 'Recursos',
        answer: 'O VicPods hoje foca em planejamento, escrita e preparacao de lancamento. Os principais recursos incluem Show Blueprint, Episode Architect, Hook Generator, Script Doctor, ferramentas de reescrita por secao, Time Estimator, Release Readiness Score, Show Notes Pack, exportacoes de Episode Brief, controles de tom e entrega, Series Bible, Season Arc Planner, Continuity Checker, Topic Gap Finder e Callback Planner.',
      },
      settings: {
        title: 'Configuracoes',
        answer: 'Configuracoes controla seu perfil, idioma do app, preferencia de tema, senha e detalhes da assinatura. Aparencia controla idioma e modo claro ou escuro. Cobranca mostra acesso atual, faturas e opcoes de upgrade.',
      },
      pricing: {
        title: 'Planos e cobranca',
        answer: 'O VicPods atualmente tem tres planos. O preco founding de lancamento vai ate 31 de marco de 2026. Free inclui acesso basico a Studio + Workspace + Pantry, 5 geracoes por dia, Release Readiness Score, Show Notes Pack e exportacao TXT de Episode Brief. Pro inclui 50 geracoes por dia, refresh de continuidade, pontuacao de tom e exportacoes TXT + PDF de Episode Brief. Premium inclui geracoes ilimitadas, tone fix, controles de voice persona e exportacoes TXT + PDF + DOCX de Episode Brief.',
      },
      onboarding: {
        title: 'Onboarding',
        answer: 'O tour de onboarding mostra a visao geral do Studio, como iniciar um episodio unico, como criar uma serie, onde gerenciar configuracoes e como funciona o sistema de tema claro e escuro. Voce pode repetir o tour em Configuracoes.',
      },
    },
  },
};

function normalizeLanguage(language) {
  const normalized = String(language || '').trim().toLowerCase().slice(0, 2);
  return ['en', 'es', 'pt'].includes(normalized) ? normalized : 'en';
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKnowledgeBase(language) {
  const copy = COPY[language] || COPY.en;

  return SECTION_DEFINITIONS.map((section) => ({
    id: section.id,
    title: copy.sections[section.id].title,
    body: copy.sections[section.id].answer,
    keywords: section.keywords,
    links: section.links,
  }));
}

function buildLinks(language, links) {
  const copy = COPY[language] || COPY.en;
  const seen = new Set();

  return (links || []).reduce((result, link) => {
    const key = `${link.href}:${link.labelKey}`;
    if (seen.has(key)) {
      return result;
    }

    seen.add(key);
    result.push({
      href: link.href,
      label: copy[link.labelKey] || link.labelKey,
    });
    return result;
  }, []);
}

function getStarterPrompts(language) {
  if (language === 'es') {
    return [
      'Como empiezo un episodio unico?',
      'Cual es la diferencia entre Studio y Workspace?',
      'Como cambio el idioma de la app?',
      'Que incluye cada plan?',
    ];
  }

  if (language === 'pt') {
    return [
      'Como comeco um episodio unico?',
      'Qual e a diferenca entre Studio e Workspace?',
      'Como mudo o idioma do app?',
      'O que cada plano inclui?',
    ];
  }

  return [
    'How do I start a single episode?',
    'What is the difference between Studio and Workspace?',
    'How do I change the app language?',
    'What does each plan include?',
  ];
}

function scoreSection(message, section) {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) {
    return 0;
  }

  return section.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedKeyword) {
      return score;
    }

    if (normalizedMessage.includes(normalizedKeyword)) {
      return score + (normalizedKeyword.includes(' ') ? 6 : 3);
    }

    const parts = normalizedKeyword.split(' ').filter(Boolean);
    const matchedParts = parts.filter((part) => normalizedMessage.includes(part)).length;

    if (matchedParts >= Math.max(2, Math.ceil(parts.length / 2))) {
      return score + matchedParts;
    }

    return score;
  }, 0);
}

function buildDeterministicAnswer({ message, language }) {
  const copy = COPY[language] || COPY.en;
  const sections = buildKnowledgeBase(language);
  const ranked = sections
    .map((section) => ({ ...section, score: scoreSection(message, section) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top || top.score < 4) {
    return {
      refused: true,
      answer: copy.refusal,
      sectionIds: [],
    };
  }

  const selected = [top];
  const second = ranked[1];
  if (second && second.score >= 6 && second.score >= top.score - 1) {
    selected.push(second);
  }

  return {
    refused: false,
    answer: selected.map((section) => section.body).join('\n\n'),
    sectionIds: selected.map((section) => section.id),
  };
}

function extractJson(content) {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (_error) {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (_secondError) {
      return null;
    }
  }
}

async function callOpenAiHelpAnswer({ message, language, knowledgeBase }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }

  const copy = COPY[language] || COPY.en;
  const model = String(process.env.OPENAI_HELP_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  const sectionIds = knowledgeBase.map((section) => section.id).join(', ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'You are VicPods Help AI.',
            'You ONLY answer questions about the VicPods application.',
            'Use ONLY the provided knowledge base.',
            `Answer in ${LANGUAGE_NAMES[language] || 'English'}.`,
            `If the question is outside VicPods, unsupported by the provided knowledge base, or requests general knowledge, set refused to true and answer EXACTLY: ${copy.refusal}`,
            `Return valid JSON only with keys: refused, answer, sectionIds.`,
            `sectionIds must be an array containing zero to three items chosen only from: ${sectionIds}.`,
            'Keep the answer concise, direct, and product-specific.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            userQuestion: message,
            knowledgeBase: knowledgeBase.map((section) => ({
              id: section.id,
              title: section.title,
              body: section.body,
            })),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI help chat failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const parsed = extractJson(data.choices?.[0]?.message?.content);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const validIds = new Set(knowledgeBase.map((section) => section.id));
  const parsedSectionIds = Array.isArray(parsed.sectionIds)
    ? parsed.sectionIds.filter((id) => validIds.has(id)).slice(0, 3)
    : [];

  return {
    refused: Boolean(parsed.refused),
    answer: String(parsed.answer || '').trim(),
    sectionIds: parsedSectionIds,
  };
}

function finalizeResponse({ result, language, knowledgeBase }) {
  const copy = COPY[language] || COPY.en;

  if (!result || !result.answer) {
    return {
      refused: true,
      answer: copy.refusal,
      links: buildLinks(language, [
        { href: '/help', labelKey: 'helpCenter' },
        { href: '/about', labelKey: 'about' },
      ]),
      sources: [copy.helpCenter, copy.about],
      suggestions: getStarterPrompts(language),
    };
  }

  if (result.refused) {
    return {
      refused: true,
      answer: copy.refusal,
      links: buildLinks(language, [
        { href: '/help', labelKey: 'helpCenter' },
        { href: '/about', labelKey: 'about' },
      ]),
      sources: [copy.helpCenter, copy.about],
      suggestions: getStarterPrompts(language),
    };
  }

  const sectionsById = new Map(knowledgeBase.map((section) => [section.id, section]));
  const referencedSections = (result.sectionIds || [])
    .map((id) => sectionsById.get(id))
    .filter(Boolean);

  return {
    refused: false,
    answer: result.answer,
    links: buildLinks(language, referencedSections.flatMap((section) => section.links || [])),
    sources: referencedSections.map((section) => section.title),
    suggestions: getStarterPrompts(language),
  };
}

async function answerHelpQuestion({ message, language }) {
  const locale = normalizeLanguage(language);
  const copy = COPY[locale] || COPY.en;
  const input = String(message || '').trim();
  const knowledgeBase = buildKnowledgeBase(locale);

  if (!input) {
    return {
      refused: false,
      answer: copy.starter,
      links: buildLinks(locale, [
        { href: '/help', labelKey: 'helpCenter' },
        { href: '/about', labelKey: 'about' },
      ]),
      sources: [copy.helpCenter, copy.about],
      suggestions: getStarterPrompts(locale),
    };
  }

  const deterministic = buildDeterministicAnswer({
    message: input,
    language: locale,
  });

  try {
    const aiResult = await callOpenAiHelpAnswer({
      message: input,
      language: locale,
      knowledgeBase,
    });

    if (aiResult && aiResult.answer) {
      const merged = {
        ...aiResult,
        sectionIds: aiResult.sectionIds && aiResult.sectionIds.length
          ? aiResult.sectionIds
          : deterministic.sectionIds,
      };
      return finalizeResponse({
        result: merged,
        language: locale,
        knowledgeBase,
      });
    }
  } catch (error) {
    console.warn(`[VicPods Help AI] Falling back to deterministic help answers: ${error.message}`);
  }

  return finalizeResponse({
    result: deterministic,
    language: locale,
    knowledgeBase,
  });
}

module.exports = {
  FIXED_REFUSAL_MESSAGE,
  answerHelpQuestion,
  getStarterPrompts,
};
