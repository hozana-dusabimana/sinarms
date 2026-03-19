const fs = require('fs');
const path = require('path');
const { migrationsDir } = require('../config');
const { query, withTransaction } = require('./mysql');

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    )
  `);
}

async function runMigrations() {
  await ensureMigrationsTable();

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  const appliedRows = await query('SELECT name FROM schema_migrations');
  const applied = new Set(appliedRows.map((row) => row.name));

  for (const fileName of files) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8').trim();
    if (!sql) {
      continue;
    }

    await withTransaction(async (connection) => {
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [fileName]);
    });
  }
}

module.exports = {
  runMigrations,
};
