require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const compression = require('compression');
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
const { trackAudioDownload } = require('./middleware/podcastAnalyticsTracking');
const { startPodcastPerformanceWorker } = require('./services/analytics/podcastPerformanceWorkerService');
const { startWebhookDeliveryWorker } = require('./services/integrations/webhookDeliveryWorkerService');
const { startPublishScheduler } = require('./services/publish/publishSchedulerService');
const { startMediaJobWorker } = require('./services/media/mediaJobWorkerService');

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
const publishRouter = require('./routes/publish');
const settingsRouter = require('./routes/settings');
const onboardingRouter = require('./routes/onboarding');
const feedbackRouter = require('./routes/feedback');
const adminRouter = require('./routes/admin');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = String(process.env.SESSION_SECRET || '').trim();
const STATIC_CACHE = {
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
};
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
    startPublishScheduler();
    startMediaJobWorker();
    startPodcastPerformanceWorker();
    startWebhookDeliveryWorker();
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
app.use(compression({
  threshold: 1024,
  filter(req, res) {
    if (req.headers['x-no-compression']) {
      return false;
    }

    return compression.filter(req, res);
  },
}));
app.use('/webhooks', webhooksRouter);
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());
app.use('/uploads/audio', trackAudioDownload);
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: isProduction ? STATIC_CACHE.day * 1000 : 0,
  setHeaders(res, filePath) {
    if (!isProduction) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.woff', '.woff2', '.glb', '.gltf'].includes(extension)) {
      res.setHeader('Cache-Control', `public, max-age=${STATIC_CACHE.week}, stale-while-revalidate=${STATIC_CACHE.day}`);
      return;
    }

    if (['.css', '.js'].includes(extension)) {
      res.setHeader('Cache-Control', `public, max-age=${STATIC_CACHE.day}, stale-while-revalidate=${STATIC_CACHE.hour}`);
      return;
    }

    res.setHeader('Cache-Control', `public, max-age=${STATIC_CACHE.hour}, stale-while-revalidate=${STATIC_CACHE.hour}`);
  },
}));

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
app.locals.googleSiteVerification = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
app.locals.bingSiteVerification = String(process.env.BING_SITE_VERIFICATION || '').trim();
app.locals.analyticsScriptSrc = String(process.env.ANALYTICS_SCRIPT_SRC || '').trim();
app.locals.analyticsSiteId = String(process.env.ANALYTICS_SITE_ID || '').trim();

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.use('/studio', requireAuth, studioRouter);
app.use('/create', requireAuth, createRouter);
app.use('/kitchen', requireAuth, kitchenRouter);
app.use('/pantry', requireAuth, pantryRouter);
app.use('/ai', requireAuth, aiRouter);
app.use('/billing', requireAuth, billingRouter);
app.use('/publish', requireAuth, publishRouter);
app.use('/onboarding', requireAuth, onboardingRouter);
app.use('/settings', requireAuth, settingsRouter);
app.use('/feedback', requireAuth, feedbackRouter);
app.use(adminDashboardPath, requireAdminEntryAuth, adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
