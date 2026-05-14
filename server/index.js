require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDb } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust Render's proxy so express-rate-limit can identify real client IPs
app.set('trust proxy', 1);

// Security headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    imgSrc:     ["'self'", "data:", "https:"],
    scriptSrc:  ["'self'"],
    styleSrc:   ["'self'", "'unsafe-inline'"],
  }
}));

// Rate limiting — auth routes (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again in 15 minutes.' }
});
app.use('/api/auth', authLimiter);

// Rate limiting — general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please slow down.' }
});
app.use('/api', apiLimiter);

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173']
  : ['http://localhost:5173']

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true)
    else callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}));

// Stripe webhook needs raw body BEFORE express.json() parses it
const billingRoute = require('./routes/billing');
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingRoute.webhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',           require('./routes/auth'));
app.use('/api/groups',         require('./routes/groups'));
app.use('/api/recipes',        require('./routes/recipes'));
app.use('/api/korner',         require('./routes/korner'));
app.use('/api/kuzine',         require('./routes/kuzine'));
app.use('/api/kultivate',      require('./routes/kultivate'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/equipment',      require('./routes/equipment'));
app.use('/api/calendar',       require('./routes/calendar'));
app.use('/api/products',       require('./routes/products'));
app.use('/api/shopping-lists', require('./routes/shopping-lists'));
app.use('/api/photos',         require('./routes/photos'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/swaps',          require('./routes/swaps'));
app.use('/api/digest',         require('./routes/digest'));
app.use('/api/plant-guides',   require('./routes/plant-guides'));
app.use('/api/orders',         require('./routes/orders'));
app.use('/api/chat',           require('./routes/chat'));
app.use('/api/billing',        billingRoute.router);
app.use('/api/export',         require('./routes/export'));

const { suggestionsRouter, featureRouter } = require('./routes/suggestions');
app.use('/api/suggestions',      suggestionsRouter);
app.use('/api/feature-requests', featureRouter);

app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: "Krystle\'s Cottage" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

function startCron() {
  const digestRoute = require('./routes/digest');
  const { buildDigestData, buildDigestHtml, weekLabel, makeTransport } = digestRoute;

  cron.schedule('0 8 * * 0', async () => {
    console.log('[cron] Running weekly digest');
    try {
      const db = await getDb();
      const groups = await db.all('SELECT id, name FROM groups');
      for (const group of groups) {
        try {
          const data = await buildDigestData(group.id);
          const html = buildDigestHtml(data);
          const subject = group.name + ' Weekly Digest - Week of ' + weekLabel();
          if (!process.env.EMAIL_USER) { console.log('[cron] EMAIL_USER not set'); continue; }
          const transport = makeTransport();
          for (const m of data.members) {
            try {
              await transport.sendMail({ from: group.name + ' <' + process.env.EMAIL_USER + '>', to: m.email, subject, html });
            } catch (e) { console.error('[cron] Failed to send to', m.email, e.message); }
          }
          console.log('[cron] Digest sent for group:', group.name);
        } catch (e) { console.error('[cron] Digest error for group', group.id, e.message); }
      }
    } catch (e) { console.error('[cron] Fatal:', e); }
  }, { timezone: 'America/Chicago' });
  console.log('Weekly digest cron scheduled (Sunday 8am CT)');
}

async function start() {
  try {
    await getDb();
    app.listen(PORT, () => {
      console.log('Server running on http://localhost:' + PORT);
      startCron();
    });
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

start();
