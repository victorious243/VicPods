function flashMiddleware(req, res, next) {
  req.flash = (type, message) => {
    if (!req.session.flash) {
      req.session.flash = [];
    }

    req.session.flash.push({
      type,
      message,
    });
  };

  res.locals.flashMessages = req.session.flash || [];
  delete req.session.flash;

  next();
}

module.exports = {
  flashMiddleware,
};
