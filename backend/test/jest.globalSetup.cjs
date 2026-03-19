const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

module.exports = async () => {
  const statePath = path.join(__dirname, '.mysql-state.json');

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || process.env.TEST_DB_NAME || 'sinarms_test';

  let available = false;
  let error = null;

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${database}\``);
    await connection.query('SELECT 1');
    await connection.end();
    available = true;
  } catch (err) {
    error = err && err.message ? err.message : String(err);
  }

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ available, error }, null, 2));
};

