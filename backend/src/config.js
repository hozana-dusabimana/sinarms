require('dotenv').config();
const path = require('path');

function buildDbConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent((parsed.pathname || '/sinarms').replace(/^\//, '') || 'sinarms'),
    };
  }

  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sinarms',
  };
}

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

if (!process.env.JWT_SECRET) {
  console.warn('[config] JWT_SECRET not set — using development fallback.');
}

module.exports = {
  isProduction,
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'sinarms-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Used by the QR generator to build a scannable URL pointing at the
  // visitor portal. Falls back to corsOrigin so dev setups Just Work.
  frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  dbConfig: buildDbConfig(),
  migrationsDir: path.join(__dirname, 'data', 'migrations'),
};
