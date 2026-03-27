require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const helmet = require('helmet');

const { connectDatabase } = require('./config/database');
const { validateEnvironment } = require('./config/envValidation');
const { loadCurrentUser, requireAuth } = require('./middleware/auth');
const { requireAdminEntryAuth } = require('./middleware/adminAccess');
const { ensureVisitorId, trackPageViews } = require('./middleware/activityTracking');
const { captureReferralContext } = require('./middleware/referralContext');
const { applyLanguageContext } = require('./middleware/i18n');
const { syncPlanStatus } = require('./middleware/requirePlan');
const { ensureCsrfToken, verifyCsrfToken } = require('./middleware/csrfProtection');
const { flashMiddleware } = require('./middleware/flash');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const webhooksRouter = require('./routes/webhooks');
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const studioRouter = require('./routes/studio');
const createRouter = require('./routes/create');
const kitchenRouter = require('./routes/kitchen');
const pantryRouter = require('./routes/pantry');
const aiRouter = require('./routes/ai');
const billingRouter = require('./routes/billing');
const settingsRouter = require('./routes/settings');
const onboardingRouter = require('./routes/onboarding');
const adminRouter = require('./routes/admin');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = String(process.env.SESSION_SECRET || '').trim();
const adminDashboardPath = (() => {
  const configuredPath = String(process.env.ADMIN_DASHBOARD_PATH || '/control-room-ops').trim();
  return configuredPath.startsWith('/') ? configuredPath : '/control-room-ops';
})();
const envValidation = validateEnvironment({ isProduction });

if (envValidation.warnings.length) {
  envValidation.warnings.forEach((warning) => {
    // eslint-disable-next-line no-console
    console.warn(`[Config Warning] ${warning}`);
  });
}

if (envValidation.errors.length) {
  throw new Error(`Configuration error:\n- ${envValidation.errors.join('\n- ')}`);
}

if (isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

connectDatabase(process.env.MONGO_URI)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', error.message);
    if (isProduction) {
      process.exit(1);
    }
  });

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use('/webhooks', webhooksRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const sessionConfig = {
  name: 'vicpods.sid',
  secret: sessionSecret || 'dev-insecure-secret',
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  },
};

if (process.env.MONGO_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 14,
    autoRemove: 'native',
  });
}

app.use(session({
  ...sessionConfig,
}));

app.use(ensureVisitorId);
app.use(loadCurrentUser);
app.use(captureReferralContext);
app.use(applyLanguageContext);
app.use(syncPlanStatus);
app.use(flashMiddleware);
app.use(ensureCsrfToken);
app.use(verifyCsrfToken);
app.use((req, res, next) => {
  res.locals.currentPath = req.originalUrl || req.path;
  next();
});
app.use(trackPageViews);

app.locals.appName = 'VicPods';

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.use('/studio', requireAuth, studioRouter);
app.use('/create', requireAuth, createRouter);
app.use('/kitchen', requireAuth, kitchenRouter);
app.use('/pantry', requireAuth, pantryRouter);
app.use('/ai', requireAuth, aiRouter);
app.use('/billing', requireAuth, billingRouter);
app.use('/onboarding', requireAuth, onboardingRouter);
app.use('/settings', requireAuth, settingsRouter);
app.use(adminDashboardPath, requireAdminEntryAuth, adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
