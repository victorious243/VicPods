function renderPage(res, options) {
  const {
    title,
    pageTitle,
    subtitle = '',
    view,
    authPage = false,
    data = {},
  } = options;

  return res.render('layout/base', {
    title,
    pageTitle,
    subtitle,
    view,
    authPage,
    ...data,
  });
}

module.exports = {
  renderPage,
};
