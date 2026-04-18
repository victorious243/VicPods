const { renderPage } = require('../utils/render');
const {
  buildAbsoluteUrl,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildPublicPageSeo,
} = require('../services/seo/siteSeoService');
const {
  getSeoGuideBySlug,
  getSeoGuideIndexPage,
  getSeoGuides,
} = require('../services/seo/guideLibraryService');

function showGuidesIndex(req, res) {
  const page = getSeoGuideIndexPage();
  const seo = buildPublicPageSeo({
    path: '/guides',
    title: `${page.title} - VicPods`,
    description: page.description,
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Podcast Guides', path: '/guides' },
      ]),
    ],
  });

  return renderPage(res, {
    title: `${page.title} - VicPods`,
    pageTitle: page.title,
    subtitle: page.subtitle,
    view: 'tools/guides-index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
      guides: page.guides,
    },
  });
}

function showGuide(req, res, next) {
  const guide = getSeoGuideBySlug(req.params.slug);
  if (!guide) {
    const error = new Error('Guide not found');
    error.statusCode = 404;
    return next(error);
  }

  const relatedGuides = getSeoGuides()
    .filter((item) => item.slug !== guide.slug)
    .slice(0, 3);

  const seo = buildPublicPageSeo({
    path: guide.path,
    title: `${guide.metaTitle} - VicPods`,
    description: guide.description,
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Podcast Guides', path: '/guides' },
        { name: guide.title, path: guide.path },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.metaTitle,
        description: guide.description,
        mainEntityOfPage: buildAbsoluteUrl(guide.path),
        author: {
          '@type': 'Organization',
          name: 'VicPods',
        },
        publisher: {
          '@type': 'Organization',
          name: 'VicPods',
        },
      },
      ...(guide.faq?.length ? [buildFaqSchema(guide.faq)] : []),
    ],
  });

  return renderPage(res, {
    title: `${guide.metaTitle} - VicPods`,
    pageTitle: guide.title,
    subtitle: guide.subtitle,
    view: 'tools/guide-article',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
      guide,
      relatedGuides,
    },
  });
}

module.exports = {
  showGuide,
  showGuidesIndex,
};
