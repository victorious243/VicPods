const { renderPage } = require('../utils/render');

function showHelp(req, res) {
  return renderPage(res, {
    title: req.t('page.help.title', 'Help Center - VicPods'),
    pageTitle: req.t('page.help.header', 'Help Center'),
    subtitle: req.t('page.help.subtitle', 'Official VicPods guidance for setup, creation flows, launch prep, and account help.'),
    view: 'help/index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
    },
  });
}

module.exports = {
  showHelp,
};
