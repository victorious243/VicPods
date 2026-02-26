function renderPage(res, options) {
  const {
    title,
    pageTitle,
    subtitle = '',
    view,
    authPage = false,
    authShellClass = '',
    data = {},
  } = options;

  return res.render('layout/base', {
    title,
    pageTitle,
    subtitle,
    view,
    authPage,
    authShellClass,
    ...data,
  });
}

module.exports = {
  renderPage,
};
