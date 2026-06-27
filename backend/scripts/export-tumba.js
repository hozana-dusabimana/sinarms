// One-off: export the RP Tumba campus (location + map nodes + map edges)
// from MySQL to a JSON file in exports/. Run with: node scripts/export-tumba.js
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/data/mysql');

const LOCATION_ID = 'loc-rp-tumba-main';

async function main() {
  const locations = await query(
    "SELECT * FROM locations WHERE id = ? OR name LIKE '%Tumba%'",
    [LOCATION_ID],
  );

  const locationIds = locations.map((row) => row.id);
  if (locationIds.length === 0) {
    console.error('No Tumba locations found.');
    return;
  }

  const placeholders = locationIds.map(() => '?').join(', ');
  const [nodes, edges] = await Promise.all([
    query(`SELECT * FROM map_nodes WHERE location_id IN (${placeholders}) ORDER BY id ASC`, locationIds),
    query(`SELECT * FROM map_edges WHERE location_id IN (${placeholders}) ORDER BY id ASC`, locationIds),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    database: process.env.DB_NAME || 'sinarms_v2',
    locations,
    map_nodes: nodes,
    map_edges: edges,
  };

  const outDir = path.join(__dirname, '..', 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'tumba-locations.json');
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));

  console.log(`Exported ${locations.length} location(s), ${nodes.length} node(s), ${edges.length} edge(s).`);
  console.log(`Wrote ${outFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
