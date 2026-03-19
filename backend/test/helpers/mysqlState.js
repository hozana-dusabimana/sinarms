const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', '.mysql-state.json');

function readState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      available: Boolean(parsed && parsed.available),
      error: parsed && parsed.error ? String(parsed.error) : null,
    };
  } catch (_err) {
    return { available: false, error: 'MySQL state not found (jest.globalSetup did not run).' };
  }
}

function mysqlAvailable() {
  return readState().available;
}

function mysqlSkipReason() {
  const state = readState();
  if (state.available) {
    return null;
  }
  return state.error || 'MySQL not available.';
}

module.exports = {
  mysqlAvailable,
  mysqlSkipReason,
};

