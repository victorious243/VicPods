const { renderPage } = require('../utils/render');
const { getLegalProfile } = require('../services/legal/legalProfileService');
const {
  buildBreadcrumbSchema,
  buildPublicPageSeo,
} = require('../services/seo/siteSeoService');

function getSharedData(req) {
  return {
    publicShell: true,
    effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
    legalProfile: getLegalProfile(),
  };
}

function showTerms(req, res) {
  const title = 'Terms and Conditions - VicPods';
  const seo = buildPublicPageSeo({
    path: '/terms',
    title,
    description: 'Read the VicPods terms and conditions for account use, subscriptions, billing, and user responsibilities.',
    robots: 'noindex,follow',
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Terms and Conditions', path: '/terms' },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: 'VicPods Terms and Conditions',
    subtitle: 'Plain-language rules for using VicPods, paying for plans, and managing your account.',
    view: 'legal/terms',
    data: {
      ...getSharedData(req),
      ...seo,
    },
  });
}

function showPrivacyPolicy(req, res) {
  const title = 'Privacy Policy - VicPods';
  const seo = buildPublicPageSeo({
    path: '/privacy-policy',
    title,
    description: 'Read how VicPods handles data, privacy controls, deletion, and user rights.',
    robots: 'noindex,follow',
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Privacy Policy', path: '/privacy-policy' },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: 'VicPods Privacy Policy',
    subtitle: 'How VicPods handles data, what users control themselves, and how privacy is built into the product.',
    view: 'legal/privacy-policy',
    data: {
      ...getSharedData(req),
      ...seo,
    },
  });
}

function showCookiePolicy(req, res) {
  const title = 'Cookie Policy - VicPods';
  const seo = buildPublicPageSeo({
    path: '/cookie-policy',
    title,
    description: 'Read how VicPods uses cookies, consent preferences, and related technologies.',
    robots: 'noindex,follow',
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Cookie Policy', path: '/cookie-policy' },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: 'VicPods Cookie Policy',
    subtitle: 'How VicPods uses cookies and similar technologies, and how users can control consent preferences.',
    view: 'legal/cookie-policy',
    data: {
      ...getSharedData(req),
      ...seo,
    },
  });
}

function showDataRights(req, res) {
  const title = 'Data Rights - VicPods';
  const seo = buildPublicPageSeo({
    path: '/data-rights',
    title,
    description: 'Read how to access, correct, delete, export, or challenge personal data processing in VicPods.',
    robots: 'noindex,follow',
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Data Rights', path: '/data-rights' },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: 'VicPods Data Rights',
    subtitle: 'How to access, correct, delete, or challenge personal data processing in VicPods.',
    view: 'legal/data-rights',
    data: {
      ...getSharedData(req),
      ...seo,
    },
  });
}

module.exports = {
  showTerms,
  showPrivacyPolicy,
  showCookiePolicy,
  showDataRights,
};
