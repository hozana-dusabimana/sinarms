// Jest setupFiles: runs before each test file is evaluated.
// Keep this file dependency-free so it runs even when MySQL is unavailable.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'sinarms-test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Use a separate database for tests by default.
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.DB_NAME = process.env.DB_NAME || process.env.TEST_DB_NAME || 'sinarms_test';

// Keep the Node.js AI client from reaching a Python service during tests; the
// backend's deterministic fallback path is exercised instead.
process.env.AI_ENGINE_DISABLED = process.env.AI_ENGINE_DISABLED || '1';

