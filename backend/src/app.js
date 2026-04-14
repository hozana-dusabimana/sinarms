const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { corsOrigin } = require('./config');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const visitorRoutes = require('./routes/visitors');
const alertRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const auditLogRoutes = require('./routes/auditLog');
const organizationRoutes = require('./routes/organizations');
const locationRoutes = require('./routes/locations');
const mapRoutes = require('./routes/map');
const faqRoutes = require('./routes/faq');
const aiRoutes = require('./routes/ai');
const chatbotRoutes = require('./routes/chatbot');
const bootstrapRoutes = require('./routes/bootstrap');
const internalRoutes = require('./routes/internal');
const { getState } = require('./data/store');

function createApp() {
  const app = express();

  app.set('trust proxy', true);

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  app.get('/health', async (_req, res) => {
    const state = await getState();
    res.json({
      status: 'ok',
      organizations: state.organizations.length,
      users: state.users.length,
      visitors: state.visitors.length,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/visitors', visitorRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/audit-log', auditLogRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/map', mapRoutes);
  app.use('/api/faq', faqRoutes);
  app.use('/api/chatbot', chatbotRoutes);
  app.use('/api/bootstrap', bootstrapRoutes);
  app.use('/api/internal', internalRoutes);
  app.use('/ai', aiRoutes);

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({
      message: 'Internal server error.',
      detail: error.message,
    });
  });

  return app;
}

module.exports = {
  createApp,
};
