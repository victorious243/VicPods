require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');

const { connectDatabase } = require('./config/database');
const { loadCurrentUser, requireAuth } = require('./middleware/auth');
const { syncPlanStatus } = require('./middleware/requirePlan');
const { flashMiddleware } = require('./middleware/flash');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const webhooksRouter = require('./routes/webhooks');
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const studioRouter = require('./routes/studio');
const createRouter = require('./routes/create');
const kitchenRouter = require('./routes/kitchen');
const pantryRouter = require('./routes/pantry');
const aiRouter = require('./routes/ai');
const billingRouter = require('./routes/billing');
const settingsRouter = require('./routes/settings');

const app = express();

connectDatabase(process.env.MONGO_URI)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', error.message);
  });

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use('/webhooks', webhooksRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  name: 'vicpods.sid',
  secret: process.env.SESSION_SECRET || 'replace-me-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  },
}));

app.use(loadCurrentUser);
app.use(syncPlanStatus);
app.use(flashMiddleware);
app.use((req, res, next) => {
  res.locals.currentPath = req.originalUrl || req.path;
  next();
});

app.locals.appName = 'VicPods';
app.locals.navItems = [
  { label: 'Studio', icon: '🎙', href: '/studio' },
  { label: 'Create', icon: '✨', href: '/create' },
  { label: 'Kitchen', icon: '🍳', href: '/kitchen' },
  { label: 'Pantry', icon: '🧺', href: '/pantry' },
  { label: 'Settings', icon: '⚙️', href: '/settings' },
];

app.use('/', indexRouter);
app.use('/auth', authRouter);

app.use('/studio', requireAuth, studioRouter);
app.use('/create', requireAuth, createRouter);
app.use('/kitchen', requireAuth, kitchenRouter);
app.use('/pantry', requireAuth, pantryRouter);
app.use('/ai', requireAuth, aiRouter);
app.use('/billing', requireAuth, billingRouter);
app.use('/settings', requireAuth, settingsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
