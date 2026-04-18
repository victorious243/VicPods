const { renderPage } = require('../utils/render');
const {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildPublicPageSeo,
} = require('../services/seo/siteSeoService');

function showHelp(req, res) {
  const title = req.t('page.help.title', 'Help Center - VicPods');
  const description = 'Official VicPods Help Center for setup, episode creation, series planning, Workspace usage, Pantry usage, billing, and account settings.';
  const seo = buildPublicPageSeo({
    path: '/help',
    title,
    description,
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Help Center', path: '/help' },
      ]),
      buildFaqSchema([
        {
          question: 'What is the difference between Studio and Workspace?',
          answer: 'Studio is the overview area for recent activity and status, while Workspace is where creation and editing happen.',
        },
        {
          question: 'Should I start with a single episode or a series?',
          answer: 'Start with a single episode for speed and one focused draft. Start with a series when you need continuity, recurring themes, and planning across multiple episodes.',
        },
        {
          question: 'Does changing the app language affect AI output?',
          answer: 'Yes. The app language setting is designed to guide interface labels and AI-generated output so they follow the language selected by the user.',
        },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: req.t('page.help.header', 'Help Center'),
    subtitle: req.t('page.help.subtitle', 'Official VicPods guidance for setup, creation flows, launch prep, and account help.'),
    view: 'help/index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
    },
  });
}

module.exports = {
  showHelp,
};
