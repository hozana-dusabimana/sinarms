const mysql = require('mysql2/promise');
const { dbConfig } = require('../config');

let poolPromise = null;

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      await ensureDatabaseExists();
      return mysql.createPool({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        dateStrings: true,
        multipleStatements: true,
      });
    })();
  }

  return poolPromise;
}

async function query(sql, params = [], connection = null) {
  const executor = connection || (await getPool());
  const [rows] = await executor.query(sql, params);
  return rows;
}

async function withTransaction(work) {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Close the shared pool and reset the cached promise. Used by the Jest global
// teardown so the process can exit cleanly (mysql2 pools hold keepalive sockets
// that otherwise keep the event loop alive). Safe to call when no pool exists.
async function closePool() {
  if (!poolPromise) {
    return;
  }
  const pending = poolPromise;
  poolPromise = null;
  try {
    const pool = await pending;
    await pool.end();
  } catch (_err) {
    // Pool failed to initialize (e.g. DB unreachable) — nothing to close.
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  closePool,
};
