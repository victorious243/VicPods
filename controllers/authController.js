const { authenticateUser, registerUser } = require('../services/authService');
const { renderPage } = require('../utils/render');

function showRegister(req, res) {
  return renderPage(res, {
    title: 'Create Account - VicPods',
    pageTitle: 'Create your VicPods account',
    subtitle: 'Start building premium podcast workflows in minutes.',
    view: 'auth/register',
    authPage: true,
  });
}

function showLogin(req, res) {
  return renderPage(res, {
    title: 'Login - VicPods',
    pageTitle: 'Welcome back to VicPods',
    subtitle: 'Sign in to enter your Studio.',
    view: 'auth/login',
    authPage: true,
  });
}

async function register(req, res, next) {
  try {
    const user = await registerUser(req.body);
    req.session.userId = user._id.toString();
    req.flash('success', 'Welcome to VicPods. Your workspace is ready.');
    return res.redirect('/studio');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/auth/register');
    }
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await authenticateUser(req.body);
    req.session.userId = user._id.toString();
    req.flash('success', `Welcome back, ${user.name}.`);
    return res.redirect('/studio');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/auth/login');
    }
    return next(error);
  }
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie('vicpods.sid');
    return res.redirect('/auth/login');
  });
}

module.exports = {
  showRegister,
  showLogin,
  register,
  login,
  logout,
};
