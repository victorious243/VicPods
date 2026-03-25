const { renderPage } = require('../utils/render');

function showLanding(req, res) {
  if (req.currentUser?.emailVerified === false) {
    return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
  }

  return renderPage(res, {
    title: req.t('page.landing.title', 'VicPods - Podcast Planning + Launch Prep'),
    pageTitle: req.t('page.landing.header', 'VicPods'),
    subtitle: req.t('page.landing.subtitle', 'Go from podcast idea to ready-to-record episode.'),
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
