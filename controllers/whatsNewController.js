const { renderPage } = require('../utils/render');
const { getWhatsNewPageData } = require('../services/marketing/whatsNewService');
const { buildBreadcrumbSchema, buildPublicPageSeo } = require('../services/seo/siteSeoService');

function showWhatsNew(req, res) {
  const pageData = getWhatsNewPageData();
  const title = "What's New in VicPods - Product Updates";
  const description = 'See the latest VicPods updates, product improvements, and new podcast workflow features in one dated changelog.';
  const seo = buildPublicPageSeo({
    path: '/whats-new',
    title,
    description,
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: "What's New", path: '/whats-new' },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: "What's New",
    subtitle: 'Latest product improvements, shipped features, and major workflow updates.',
    view: 'tools/whats-new',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
      ...pageData,
    },
  });
}

module.exports = {
  showWhatsNew,
};
