const { getIndexableGuidePages } = require('./guideLibraryService');

function normalizeAppUrl(input = process.env.SITE_URL || process.env.APP_URL || 'https://vicpods.com') {
  return String(input || 'https://vicpods.com')
    .trim()
    .replace(/\/+$/, '');
}

function buildAbsoluteUrl(
  pathname = '/',
  baseUrl = process.env.SITE_URL || process.env.APP_URL || 'https://vicpods.com'
) {
  const appUrl = normalizeAppUrl(baseUrl);
  const normalizedPath = String(pathname || '/').trim() || '/';
  return `${appUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

function buildDefaultSocialImageUrl(
  baseUrl = process.env.SITE_URL || process.env.APP_URL || 'https://vicpods.com'
) {
  return buildAbsoluteUrl('/images/logo/vicpods-logo-horizontal-dark.png', baseUrl);
}

function buildOrganizationSchema() {
  const appUrl = normalizeAppUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VicPods',
    url: appUrl,
    logo: buildAbsoluteUrl('/images/logo/vicpods-icon-circle-dark.svg'),
  };
}

function buildWebsiteSchema() {
  const appUrl = normalizeAppUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'VicPods',
    url: appUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${appUrl}/podcast-idea-generator?niche={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'VicPods',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: normalizeAppUrl(),
    description: 'VicPods helps podcasters turn rough ideas into structured, ready-to-record episodes with launch-ready prep.',
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        category: 'Free',
      },
    ],
  };
}

function buildBreadcrumbSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: buildAbsoluteUrl(item.path),
    })),
  };
}

function buildFaqSchema(questions = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function buildPublicPageSeo({
  path = '/',
  title,
  description,
  robots,
  type = 'website',
  structuredData = [],
} = {}) {
  const canonicalUrl = buildAbsoluteUrl(path);
  const socialImageUrl = buildDefaultSocialImageUrl();

  return {
    metaDescription: description,
    canonicalUrl,
    metaRobots: robots,
    ogTitle: title,
    ogDescription: description,
    ogType: type,
    ogImage: socialImageUrl,
    twitterCard: 'summary_large_image',
    twitterImage: socialImageUrl,
    structuredData,
  };
}

function getIndexablePublicPages() {
  return [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/generate-episode', changefreq: 'weekly', priority: '0.8' },
    { path: '/podcast-idea-generator', changefreq: 'weekly', priority: '0.9' },
    { path: '/examples', changefreq: 'weekly', priority: '0.9' },
    { path: '/whats-new', changefreq: 'weekly', priority: '0.8' },
    { path: '/guides', changefreq: 'weekly', priority: '0.9' },
    { path: '/about', changefreq: 'monthly', priority: '0.7' },
    { path: '/help', changefreq: 'weekly', priority: '0.8' },
    { path: '/terms', changefreq: 'yearly', priority: '0.3' },
    { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
    { path: '/cookie-policy', changefreq: 'yearly', priority: '0.2' },
    { path: '/data-rights', changefreq: 'yearly', priority: '0.2' },
    ...getIndexableGuidePages(),
  ];
}

module.exports = {
  buildAbsoluteUrl,
  buildBreadcrumbSchema,
  buildDefaultSocialImageUrl,
  buildFaqSchema,
  buildOrganizationSchema,
  buildPublicPageSeo,
  buildSoftwareApplicationSchema,
  buildWebsiteSchema,
  getIndexablePublicPages,
  normalizeAppUrl,
};
