(function i18nUi() {
  var lang = String(document.documentElement.getAttribute('lang') || 'en').toLowerCase().slice(0, 2);
  if (lang === 'en') {
    return;
  }

  var TRANSLATIONS = {
    es: {
      'Verify your email': 'Verifica tu correo',
      'Verify and Continue': 'Verificar y continuar',
      'Resend PIN': 'Reenviar PIN',
      'Already verified?': 'Ya verificado?',
      'Sign in': 'Iniciar sesion',
      'Chef AI is cooking your draft': 'Chef AI esta cocinando tu borrador',
      'Analyzing your episode context and goals.': 'Analizando el contexto y objetivos de tu episodio.',
      Context: 'Contexto',
      Tone: 'Tono',
      Draft: 'Borrador',
      'Single Episode Wizard': 'Wizard de episodio unico',
      'Back to Create': 'Volver a Crear',
      'Back to Workspace': 'Volver al espacio de trabajo',
      'Step 1 - Topic': 'Paso 1 - Tema',
      'Step 2 - Tone': 'Paso 2 - Tono',
      'Step 3 - Format': 'Paso 3 - Formato',
      'Step 4 - Generate': 'Paso 4 - Generar',
      'Generate Episode Draft': 'Generar borrador de episodio',
      Solo: 'Solo',
      Interview: 'Entrevista',
      Flexible: 'Flexible',
      'Start Creating': 'Comenzar a crear',
      'Open Settings': 'Abrir configuracion',
      Workspace: 'Espacio de trabajo',
      'Open Workspace': 'Abrir espacio de trabajo',
      'Start Single Podcast': 'Iniciar podcast unico',
      'Start Series': 'Iniciar serie',
      'Open Billing': 'Abrir facturacion',
      'Recent Episodes': 'Episodios recientes',
      'Open Kitchen': 'Abrir cocina',
      'Open list': 'Abrir lista',
      'Usage details': 'Detalles de uso',
      'Need more AI generations? Upgrade your plan for higher limits.': 'Necesitas mas generaciones IA? Mejora tu plan para limites mas altos.',
      'No items found in this category yet.': 'Aun no hay elementos en esta categoria.',
      'No episodes yet. Use Create to start your first episode.': 'Aun no hay episodios. Usa Crear para iniciar el primero.',
      'No episodes yet. Open Workspace to start your first episode.': 'Aun no hay episodios. Abre el espacio de trabajo para iniciar el primero.',
      All: 'Todos',
      Single: 'Unico',
      Series: 'Series',
      Ready: 'Listo',
      Served: 'Servido',
      Ideas: 'Ideas',
      'Create account': 'Crear cuenta',
      'Build your podcast workflow from one clean dashboard.': 'Construye tu flujo de podcast desde un solo panel limpio.',
      'Create Workspace': 'Crear espacio',
      Login: 'Iniciar sesion',
      'Step into your Studio. New accounts require a quick email security code at sign-in.': 'Entra a tu Estudio. Las cuentas nuevas requieren un codigo de seguridad por correo.',
      'Sign In': 'Entrar',
      'Continue with Google': 'Continuar con Google',
      'Google Auth Not Configured': 'Autenticacion Google no configurada',
      'Google Sign Up Unavailable': 'Registro con Google no disponible',
      'or sign up with email': 'o registrate con correo',
      'By continuing, you agree to the': 'Al continuar, aceptas los',
      'No account yet?': 'Sin cuenta aun?',
      'Create one': 'Crear una',
      'Terms and Conditions': 'Terminos y condiciones',
      'Back to registration': 'Volver al registro',
      'Sign-in Security Check': 'Verificacion de seguridad',
      'Resend Code': 'Reenviar codigo',
      'Back to sign in': 'Volver a iniciar sesion',
      Pantry: 'Despensa',
      'Add Ingredient': 'Agregar ingrediente',
      'Idea Bank': 'Banco de ideas',
      'Add to Pantry': 'Agregar a despensa',
      'Pantry Shelf': 'Estante de despensa',
      Update: 'Actualizar',
      Delete: 'Eliminar',
      'Create Episode': 'Crear episodio',
      'New Episode': 'Nuevo episodio',
      'Create Single Episode': 'Crear episodio unico',
      'New Single Episode': 'Nuevo episodio unico',
      'Start Single Episode': 'Iniciar episodio unico',
      'Start Series Setup': 'Iniciar configuracion de serie',
      'New Series': 'Nueva serie',
      'Choose Your Creation Mode': 'Elige tu modo de creacion',
      'Single Episode': 'Episodio unico',
      Recommended: 'Recomendado',
      'Series Mode': 'Modo serie',
      'Pro Studio': 'Estudio Pro',
      'Series Wizard': 'Wizard de serie',
      'Step 1 - Series Setup': 'Paso 1 - Configuracion de serie',
      'Step 2 - Themes': 'Paso 2 - Temas',
      'Step 3 - Episodes': 'Paso 3 - Episodios',
      'Create Series Workspace': 'Crear espacio de serie',
      Upgrade: 'Mejorar',
      'Premium only.': 'Solo Premium.',
      'Auto-generate theme suggestions': 'Auto-generar sugerencias de temas',
      'Auto-generate themes (Pro+)': 'Auto-generar temas (Pro+)',
      'Include fun segment': 'Incluir segmento divertido',
      'Include fun segment by default': 'Incluir segmento divertido por defecto',
      'Kitchen Library': 'Biblioteca de cocina',
      'No series yet. Start a new series from Workspace.': 'Aun no hay series. Inicia una nueva serie desde el espacio de trabajo.',
      'No standalone episodes yet. Start one from Workspace.': 'Aun no hay episodios independientes. Inicia uno desde el espacio de trabajo.',
      'Single Episodes': 'Episodios unicos',
      'Open Collection': 'Abrir coleccion',
      'Your Series': 'Tus series',
      Settings: 'Configuracion',
      Profile: 'Perfil',
      Appearance: 'Apariencia',
      Security: 'Seguridad',
      Billing: 'Facturacion',
      'Name, email, avatar': 'Nombre, correo, avatar',
      'Dark and light mode': 'Modo oscuro y claro',
      'Password and account safety': 'Contrasena y seguridad de cuenta',
      'Plan, invoices, upgrades': 'Plan, facturas y mejoras',
      'Profile Details': 'Detalles de perfil',
      'Full Name': 'Nombre completo',
      Email: 'Correo',
      'Avatar URL (optional)': 'URL del avatar (opcional)',
      'Save Profile': 'Guardar perfil',
      'Avatar Preview': 'Vista previa del avatar',
      'Replay onboarding tour': 'Repetir tour de onboarding',
      'Theme Preferences': 'Preferencias de tema',
      'Dark + Light': 'Oscuro + Claro',
      'Default Theme': 'Tema por defecto',
      'App Language': 'Idioma de la app',
      'Save Appearance': 'Guardar apariencia',
      'Change Password': 'Cambiar contrasena',
      'Update Password': 'Actualizar contrasena',
      'Current Password': 'Contrasena actual',
      'New Password': 'Nueva contrasena',
      'Confirm New Password': 'Confirmar nueva contrasena',
      'Subscription Status': 'Estado de suscripcion',
      'Manage Billing': 'Gestionar facturacion',
      'Current Access': 'Acceso actual',
      'Current Access:': 'Acceso actual:',
      'Current period started:': 'Periodo actual iniciado:',
      'Current period ends:': 'Periodo actual termina:',
      'Payment is past due. Update billing details to reactivate paid access.': 'El pago esta atrasado. Actualiza la facturacion para reactivar el acceso.',
      Free: 'Gratis',
      Pro: 'Pro',
      Premium: 'Premium',
      'Current Access': 'Acceso actual',
      'Upgrade to Pro': 'Mejorar a Pro',
      'Upgrade to Premium': 'Mejorar a Premium',
      'Checkout Canceled': 'Checkout cancelado',
      'Return to Billing': 'Volver a facturacion',
      'Checkout Completed': 'Checkout completado',
      'Back to Billing': 'Volver a facturacion',
      'Go to Studio': 'Ir a Estudio',
      'Welcome to VicPods': 'Bienvenido a VicPods',
      'Skip tour': 'Saltar tour',
      Back: 'Atras',
      Finish: 'Finalizar',
      'Back to Studio': 'Volver a Estudio',
      Next: 'Siguiente',
      'Welcome to your AI podcast cockpit': 'Bienvenido a tu cabina de podcast con IA',
      'VicPods is an AI-powered podcast structuring application that helps you plan, draft, and refine stronger episodes.': 'VicPods es una aplicacion de estructuracion de podcasts con IA que te ayuda a planificar, crear y refinar episodios mas fuertes.',
      'Launch a single podcast': 'Lanzar un podcast unico',
      'Pick Single Episode to produce one focused episode with a complete start-to-finish script workflow.': 'Elige Episodio unico para producir un episodio enfocado con flujo completo.',
      'Build a podcast series': 'Construir una serie de podcast',
      'Use Series to set up themes, continuity rules, and automated production for multiple episodes.': 'Usa Serie para configurar temas, continuidad y produccion automatizada.',
      'Configure your workspace': 'Configura tu espacio de trabajo',
      'Open Settings to manage profile, security, and account-level preferences.': 'Abre Configuracion para gestionar perfil, seguridad y preferencias.',
      'Control lighting systems': 'Controlar sistema de iluminacion',
      'Your lighting is the theme system. Use quick toggle or appearance settings.': 'La iluminacion es el sistema de tema. Usa cambio rapido o apariencia.',
      'You are onboarded': 'Onboarding completado',
      'Tour complete. Your workflow is ready. Start creating and shipping episodes.': 'Tour completado. Tu flujo esta listo. Empieza a crear y publicar.',
      'Open Single Wizard': 'Abrir wizard de episodio unico',
      'Open Series Wizard': 'Abrir wizard de serie',
      'Open Appearance': 'Abrir apariencia',
      'Back to Studio Tour': 'Volver al tour de Estudio',
      'Quick tour: Single podcast': 'Tour rapido: podcast unico',
      'This wizard builds one complete standalone episode fast.': 'Este wizard crea rapidamente un episodio unico completo.',
      'Start with topic and audience': 'Empieza con tema y audiencia',
      'Define topic, audience, and intent first. This drives structure and hook quality.': 'Define tema, audiencia e intencion. Esto mejora estructura y hook.',
      'Generate when ready': 'Genera cuando estes listo',
      'Use Generate to create your draft, then return to Studio to continue the main tour.': 'Usa Generar para crear el borrador y vuelve a Estudio para seguir el tour.',
      'Quick tour: Series mode': 'Tour rapido: modo serie',
      'Series mode sets up continuity across themes and episodes.': 'El modo serie configura continuidad entre temas y episodios.',
      'Set the series foundation': 'Define la base de la serie',
      'Name, goal, audience, and tone become defaults for every generated episode.': 'Nombre, objetivo, audiencia y tono seran base para cada episodio.',
      'Define themes and launch': 'Define temas y lanza',
      'Add themes, set episode defaults, and create your workspace.': 'Agrega temas, define valores base y crea tu espacio.',
      'Quick tour: Settings': 'Tour rapido: configuracion',
      'Use settings tabs to control profile, appearance, security, and billing.': 'Usa las pestanas para perfil, apariencia, seguridad y facturacion.',
      'Profile configuration': 'Configuracion de perfil',
      'Update name, email, and avatar so your workspace is personalized.': 'Actualiza nombre, correo y avatar para personalizar tu espacio.',
      'Return to Studio': 'Volver a Estudio',
      'Profile setup is clear. Go back to continue the main onboarding flow.': 'Perfil listo. Regresa para continuar el onboarding principal.',
      'Quick tour: Lighting controls': 'Tour rapido: controles de iluminacion',
      'Lighting in VicPods means dark and light visual modes.': 'La iluminacion en VicPods significa modos oscuro y claro.',
      'Save default lighting': 'Guardar iluminacion por defecto',
      'Set your default mode in Appearance for every future session.': 'Define tu modo por defecto en Apariencia para futuras sesiones.',
      'Quick switch from topbar': 'Cambio rapido desde topbar',
      'The topbar toggle changes theme instantly from any page.': 'El boton del topbar cambia tema al instante desde cualquier pagina.',
    },
    pt: {
      'Verify your email': 'Verifique seu email',
      'Verify and Continue': 'Verificar e continuar',
      'Resend PIN': 'Reenviar PIN',
      'Already verified?': 'Ja verificado?',
      'Sign in': 'Entrar',
      'Chef AI is cooking your draft': 'Chef AI esta preparando seu rascunho',
      'Analyzing your episode context and goals.': 'Analisando o contexto e objetivos do episodio.',
      Context: 'Contexto',
      Tone: 'Tom',
      Draft: 'Rascunho',
      'Single Episode Wizard': 'Wizard de episodio unico',
      'Back to Create': 'Voltar para Criar',
      'Back to Workspace': 'Voltar para o espaco de trabalho',
      'Step 1 - Topic': 'Passo 1 - Tema',
      'Step 2 - Tone': 'Passo 2 - Tom',
      'Step 3 - Format': 'Passo 3 - Formato',
      'Step 4 - Generate': 'Passo 4 - Gerar',
      'Generate Episode Draft': 'Gerar rascunho de episodio',
      Solo: 'Solo',
      Interview: 'Entrevista',
      Flexible: 'Flexivel',
      'Start Creating': 'Comecar a criar',
      'Open Settings': 'Abrir configuracoes',
      Workspace: 'Espaco de trabalho',
      'Open Workspace': 'Abrir espaco de trabalho',
      'Start Single Podcast': 'Iniciar podcast unico',
      'Start Series': 'Iniciar serie',
      'Open Billing': 'Abrir cobranca',
      'Recent Episodes': 'Episodios recentes',
      'Open Kitchen': 'Abrir cozinha',
      'Open list': 'Abrir lista',
      'Usage details': 'Detalhes de uso',
      'Need more AI generations? Upgrade your plan for higher limits.': 'Precisa de mais geracoes IA? Faca upgrade do plano para limites maiores.',
      'No items found in this category yet.': 'Ainda nao ha itens nesta categoria.',
      'No episodes yet. Use Create to start your first episode.': 'Ainda nao ha episodios. Use Criar para iniciar o primeiro.',
      'No episodes yet. Open Workspace to start your first episode.': 'Ainda nao ha episodios. Abra o espaco de trabalho para iniciar o primeiro.',
      All: 'Todos',
      Single: 'Unico',
      Series: 'Series',
      Ready: 'Pronto',
      Served: 'Servido',
      Ideas: 'Ideias',
      'Create account': 'Criar conta',
      'Build your podcast workflow from one clean dashboard.': 'Construa seu fluxo de podcast em um painel unico e limpo.',
      'Create Workspace': 'Criar workspace',
      Login: 'Entrar',
      'Step into your Studio. New accounts require a quick email security code at sign-in.': 'Entre no seu Estudio. Novas contas exigem um codigo de seguranca por email.',
      'Sign In': 'Entrar',
      'Continue with Google': 'Continuar com Google',
      'Google Auth Not Configured': 'Autenticacao Google nao configurada',
      'Google Sign Up Unavailable': 'Cadastro com Google indisponivel',
      'or sign up with email': 'ou cadastre-se com email',
      'By continuing, you agree to the': 'Ao continuar, voce concorda com os',
      'No account yet?': 'Ainda sem conta?',
      'Create one': 'Criar uma',
      'Terms and Conditions': 'Termos e condicoes',
      'Back to registration': 'Voltar ao cadastro',
      'Sign-in Security Check': 'Verificacao de seguranca',
      'Resend Code': 'Reenviar codigo',
      'Back to sign in': 'Voltar para entrar',
      Pantry: 'Despensa',
      'Add Ingredient': 'Adicionar ingrediente',
      'Idea Bank': 'Banco de ideias',
      'Add to Pantry': 'Adicionar na despensa',
      'Pantry Shelf': 'Prateleira da despensa',
      Update: 'Atualizar',
      Delete: 'Excluir',
      'Create Episode': 'Criar episodio',
      'New Episode': 'Novo episodio',
      'Create Single Episode': 'Criar episodio unico',
      'New Single Episode': 'Novo episodio unico',
      'Start Single Episode': 'Iniciar episodio unico',
      'Start Series Setup': 'Iniciar configuracao de serie',
      'New Series': 'Nova serie',
      'Choose Your Creation Mode': 'Escolha seu modo de criacao',
      'Single Episode': 'Episodio unico',
      Recommended: 'Recomendado',
      'Series Mode': 'Modo serie',
      'Pro Studio': 'Estudio Pro',
      'Series Wizard': 'Wizard de serie',
      'Step 1 - Series Setup': 'Passo 1 - Configuracao da serie',
      'Step 2 - Themes': 'Passo 2 - Temas',
      'Step 3 - Episodes': 'Passo 3 - Episodios',
      'Create Series Workspace': 'Criar workspace de serie',
      Upgrade: 'Upgrade',
      'Premium only.': 'Somente Premium.',
      'Auto-generate theme suggestions': 'Auto-gerar sugestoes de temas',
      'Auto-generate themes (Pro+)': 'Auto-gerar temas (Pro+)',
      'Include fun segment': 'Incluir segmento divertido',
      'Include fun segment by default': 'Incluir segmento divertido por padrao',
      'Kitchen Library': 'Biblioteca da cozinha',
      'No series yet. Start a new series from Workspace.': 'Ainda nao ha series. Inicie uma nova serie pelo espaco de trabalho.',
      'No standalone episodes yet. Start one from Workspace.': 'Ainda nao ha episodios independentes. Inicie um pelo espaco de trabalho.',
      'Single Episodes': 'Episodios unicos',
      'Open Collection': 'Abrir colecao',
      'Your Series': 'Suas series',
      Settings: 'Configuracoes',
      Profile: 'Perfil',
      Appearance: 'Aparencia',
      Security: 'Seguranca',
      Billing: 'Cobranca',
      'Name, email, avatar': 'Nome, email, avatar',
      'Dark and light mode': 'Modo escuro e claro',
      'Password and account safety': 'Senha e seguranca da conta',
      'Plan, invoices, upgrades': 'Plano, faturas e upgrades',
      'Profile Details': 'Detalhes do perfil',
      'Full Name': 'Nome completo',
      Email: 'Email',
      'Avatar URL (optional)': 'URL do avatar (opcional)',
      'Save Profile': 'Salvar perfil',
      'Avatar Preview': 'Preview do avatar',
      'Replay onboarding tour': 'Repetir tour de onboarding',
      'Theme Preferences': 'Preferencias de tema',
      'Dark + Light': 'Escuro + Claro',
      'Default Theme': 'Tema padrao',
      'App Language': 'Idioma do app',
      'Save Appearance': 'Salvar aparencia',
      'Change Password': 'Alterar senha',
      'Update Password': 'Atualizar senha',
      'Current Password': 'Senha atual',
      'New Password': 'Nova senha',
      'Confirm New Password': 'Confirmar nova senha',
      'Subscription Status': 'Status da assinatura',
      'Manage Billing': 'Gerenciar cobranca',
      'Current Access': 'Acesso atual',
      'Current Access:': 'Acesso atual:',
      'Current period started:': 'Periodo atual iniciado:',
      'Current period ends:': 'Periodo atual termina:',
      'Payment is past due. Update billing details to reactivate paid access.': 'O pagamento esta atrasado. Atualize a cobranca para reativar o acesso.',
      Free: 'Gratis',
      Pro: 'Pro',
      Premium: 'Premium',
      'Upgrade to Pro': 'Fazer upgrade para Pro',
      'Upgrade to Premium': 'Fazer upgrade para Premium',
      'Checkout Canceled': 'Checkout cancelado',
      'Return to Billing': 'Voltar para cobranca',
      'Checkout Completed': 'Checkout concluido',
      'Back to Billing': 'Voltar para cobranca',
      'Go to Studio': 'Ir para Estudio',
      'Welcome to VicPods': 'Bem-vindo ao VicPods',
      'Skip tour': 'Pular tour',
      Back: 'Voltar',
      Finish: 'Finalizar',
      'Back to Studio': 'Voltar ao Estudio',
      Next: 'Proximo',
      'Welcome to your AI podcast cockpit': 'Bem-vindo ao seu cockpit de podcast com IA',
      'VicPods is an AI-powered podcast structuring application that helps you plan, draft, and refine stronger episodes.': 'VicPods e um aplicativo de estruturacao de podcasts com IA que ajuda voce a planejar, criar e refinar episodios mais fortes.',
      'Launch a single podcast': 'Lancar um podcast unico',
      'Pick Single Episode to produce one focused episode with a complete start-to-finish script workflow.': 'Escolha Episodio unico para produzir um episodio focado com fluxo completo.',
      'Build a podcast series': 'Construir uma serie de podcast',
      'Use Series to set up themes, continuity rules, and automated production for multiple episodes.': 'Use Serie para configurar temas, continuidade e producao automatizada.',
      'Configure your workspace': 'Configure seu workspace',
      'Open Settings to manage profile, security, and account-level preferences.': 'Abra Configuracoes para gerir perfil, seguranca e preferencias da conta.',
      'Control lighting systems': 'Controlar sistema de iluminacao',
      'Your lighting is the theme system. Use quick toggle or appearance settings.': 'A iluminacao e o sistema de tema. Use alternancia rapida ou aparencia.',
      'You are onboarded': 'Onboarding concluido',
      'Tour complete. Your workflow is ready. Start creating and shipping episodes.': 'Tour concluido. Seu fluxo esta pronto. Comece a criar e publicar.',
      'Open Single Wizard': 'Abrir wizard de episodio unico',
      'Open Series Wizard': 'Abrir wizard de serie',
      'Open Appearance': 'Abrir aparencia',
      'Back to Studio Tour': 'Voltar ao tour do Estudio',
      'Quick tour: Single podcast': 'Tour rapido: podcast unico',
      'This wizard builds one complete standalone episode fast.': 'Este wizard cria rapidamente um episodio unico completo.',
      'Start with topic and audience': 'Comece com tema e publico',
      'Define topic, audience, and intent first. This drives structure and hook quality.': 'Defina tema, publico e intencao. Isso melhora estrutura e hook.',
      'Generate when ready': 'Gerar quando estiver pronto',
      'Use Generate to create your draft, then return to Studio to continue the main tour.': 'Use Gerar para criar o rascunho e volte ao Estudio para continuar o tour.',
      'Quick tour: Series mode': 'Tour rapido: modo serie',
      'Series mode sets up continuity across themes and episodes.': 'O modo serie configura continuidade entre temas e episodios.',
      'Set the series foundation': 'Defina a base da serie',
      'Name, goal, audience, and tone become defaults for every generated episode.': 'Nome, objetivo, publico e tom viram padrao para cada episodio.',
      'Define themes and launch': 'Defina temas e lance',
      'Add themes, set episode defaults, and create your workspace.': 'Adicione temas, defina padroes e crie seu workspace.',
      'Quick tour: Settings': 'Tour rapido: configuracoes',
      'Use settings tabs to control profile, appearance, security, and billing.': 'Use abas para perfil, aparencia, seguranca e cobranca.',
      'Profile configuration': 'Configuracao de perfil',
      'Update name, email, and avatar so your workspace is personalized.': 'Atualize nome, email e avatar para personalizar seu workspace.',
      'Return to Studio': 'Voltar ao Estudio',
      'Profile setup is clear. Go back to continue the main onboarding flow.': 'Perfil pronto. Volte para continuar o onboarding principal.',
      'Quick tour: Lighting controls': 'Tour rapido: controles de iluminacao',
      'Lighting in VicPods means dark and light visual modes.': 'Iluminacao no VicPods significa modos escuro e claro.',
      'Save default lighting': 'Salvar iluminacao padrao',
      'Set your default mode in Appearance for every future session.': 'Defina o modo padrao em Aparencia para futuras sessoes.',
      'Quick switch from topbar': 'Troca rapida no topbar',
      'The topbar toggle changes theme instantly from any page.': 'O botao do topbar muda o tema instantaneamente em qualquer pagina.',
    },
  };

  var dictionary = TRANSLATIONS[lang];
  if (!dictionary) {
    return;
  }

  function translateExact(input) {
    var key = String(input || '').trim();
    if (!key || !Object.prototype.hasOwnProperty.call(dictionary, key)) {
      return null;
    }
    return dictionary[key];
  }

  function replaceTextNode(node) {
    var original = node.nodeValue;
    var translated = translateExact(original);
    if (!translated) {
      return;
    }

    var leading = original.match(/^\s*/);
    var trailing = original.match(/\s*$/);
    node.nodeValue = (leading ? leading[0] : '') + translated + (trailing ? trailing[0] : '');
  }

  function walkTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        var parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        var tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var node = walker.nextNode();
    while (node) {
      replaceTextNode(node);
      node = walker.nextNode();
    }
  }

  function translateAttribute(element, attr) {
    var value = element.getAttribute(attr);
    var translated = translateExact(value);
    if (!translated) {
      return;
    }
    element.setAttribute(attr, translated);
  }

  function translateAttributes(root) {
    var attrs = ['placeholder', 'title', 'aria-label'];
    attrs.forEach(function (attr) {
      var selector = '[' + attr + ']';
      var elements = root.matches && root.matches(selector)
        ? [root].concat(Array.from(root.querySelectorAll(selector)))
        : Array.from(root.querySelectorAll(selector));
      elements.forEach(function (element) {
        translateAttribute(element, attr);
      });
    });
  }

  function translateElementTree(root) {
    if (!root) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      replaceTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    walkTextNodes(root);
    translateAttributes(root);
  }

  function startObserver() {
    if (!window.MutationObserver || !document.body) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'characterData' && mutation.target) {
          replaceTextNode(mutation.target);
          return;
        }

        if (mutation.type === 'attributes' && mutation.target) {
          translateAttribute(mutation.target, mutation.attributeName);
          return;
        }

        Array.from(mutation.addedNodes || []).forEach(function (node) {
          translateElementTree(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    translateElementTree(document.body);
    startObserver();
  });
}());
