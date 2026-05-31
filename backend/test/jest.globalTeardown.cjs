// Close the shared MySQL connection pool after the whole test run so Jest can
// exit cleanly. Without this the mysql2 pool keeps live sockets/keepalive timers
// open, the Node event loop never drains, and Jest prints "did not exit one
// second after the test run" before eventually being force-killed.
module.exports = async function globalTeardown() {
  try {
    const { closePool } = require('../src/data/mysql');
    if (typeof closePool === 'function') {
      await closePool();
    }
  } catch (_err) {
    // Nothing to close (e.g. MySQL was unavailable and no pool was created).
  }
};
