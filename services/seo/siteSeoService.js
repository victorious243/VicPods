const { getIndexableGuidePages } = require('./guideLibraryService');

function normalizeAppUrl() {
  return String(process.env.APP_URL || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '');
}

function buildAbsoluteUrl(pathname = '/') {
  const appUrl = normalizeAppUrl();
  const normalizedPath = String(pathname || '/').trim() || '/';
  return `${appUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

function buildDefaultSocialImageUrl() {
  return buildAbsoluteUrl('/images/logo/vicpods-logo-horizontal-dark.png');
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
    twitterImage: socialImageUrl,
    structuredData,
  };
}

function getIndexablePublicPages() {
  return [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/podcast-idea-generator', changefreq: 'weekly', priority: '0.9' },
    { path: '/examples', changefreq: 'weekly', priority: '0.9' },
    { path: '/guides', changefreq: 'weekly', priority: '0.9' },
    { path: '/about', changefreq: 'monthly', priority: '0.7' },
    { path: '/help', changefreq: 'weekly', priority: '0.8' },
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
