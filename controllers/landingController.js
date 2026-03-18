const { renderPage } = require('../utils/render');

function showLanding(req, res) {
  if (req.currentUser?.emailVerified === false) {
    return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
  }

  return renderPage(res, {
    title: req.t('page.landing.title', 'VicPods Lab - VicPods'),
    pageTitle: req.t('page.landing.header', 'VicPods Lab'),
    subtitle: req.t('page.landing.subtitle', 'Build better podcasts before you hit record.'),
    view: 'landing/index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
    },
  });
}

module.exports = {
  showLanding,
};
