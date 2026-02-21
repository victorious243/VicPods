const { renderPage } = require('../utils/render');

function showBilling(req, res) {
  return renderPage(res, {
    title: 'Billing - VicPods',
    pageTitle: 'Billing & Plans',
    subtitle: 'Upgrade when you are ready to scale your studio.',
    view: 'billing/index',
  });
}

module.exports = {
  showBilling,
};
