const { renderPage } = require('../utils/render');
const { getLegalProfile } = require('../services/legal/legalProfileService');

function getSharedData(req) {
  return {
    publicShell: true,
    effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
    legalProfile: getLegalProfile(),
  };
}

function showTerms(req, res) {
  return renderPage(res, {
    title: 'Terms and Conditions - VicPods',
    pageTitle: 'VicPods Terms and Conditions',
    subtitle: 'Plain-language rules for using VicPods, paying for plans, and managing your account.',
    view: 'legal/terms',
    data: getSharedData(req),
  });
}

function showPrivacyPolicy(req, res) {
  return renderPage(res, {
    title: 'Privacy Policy - VicPods',
    pageTitle: 'VicPods Privacy Policy',
    subtitle: 'How VicPods handles data, what users control themselves, and how privacy is built into the product.',
    view: 'legal/privacy-policy',
    data: getSharedData(req),
  });
}

function showCookiePolicy(req, res) {
  return renderPage(res, {
    title: 'Cookie Policy - VicPods',
    pageTitle: 'VicPods Cookie Policy',
    subtitle: 'How VicPods uses cookies and similar technologies, and how users can control consent preferences.',
    view: 'legal/cookie-policy',
    data: getSharedData(req),
  });
}

function showDataRights(req, res) {
  return renderPage(res, {
    title: 'Data Rights - VicPods',
    pageTitle: 'VicPods Data Rights',
    subtitle: 'How to access, correct, delete, or challenge personal data processing in VicPods.',
    view: 'legal/data-rights',
    data: getSharedData(req),
  });
}

module.exports = {
  showTerms,
  showPrivacyPolicy,
  showCookiePolicy,
  showDataRights,
};
