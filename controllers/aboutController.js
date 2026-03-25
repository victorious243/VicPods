const { renderPage } = require('../utils/render');

function showAbout(req, res) {
  return renderPage(res, {
    title: req.t('page.about.title', 'About VicPods - VicPods'),
    pageTitle: req.t('page.about.header', 'About VicPods'),
    subtitle: req.t('page.about.subtitle', 'What VicPods is, who it serves, and why it starts before recording.'),
    view: 'about/index',
    data: {
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
    },
  });
}

module.exports = {
  showAbout,
};
