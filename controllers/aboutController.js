const { renderPage } = require('../utils/render');
const {
  buildBreadcrumbSchema,
  buildOrganizationSchema,
  buildPublicPageSeo,
} = require('../services/seo/siteSeoService');

function showAbout(req, res) {
  const title = req.t('page.about.title', 'About VicPods - VicPods');
  const description = 'Learn what VicPods is, who it helps, and how it turns podcast ideas into structured, ready-to-record episodes before recording starts.';
  const seo = buildPublicPageSeo({
    path: '/about',
    title,
    description,
    structuredData: [
      buildOrganizationSchema(),
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'About', path: '/about' },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: req.t('page.about.header', 'About VicPods'),
    subtitle: req.t('page.about.subtitle', 'What VicPods is, who it serves, and why it starts before recording.'),
    view: 'about/index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
    },
  });
}

module.exports = {
  showAbout,
};
