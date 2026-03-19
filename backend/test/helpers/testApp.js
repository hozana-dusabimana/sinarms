const { initStore, setState } = require('../../src/data/store');
const { createSeedState } = require('../../src/data/seed');
const { createApp } = require('../../src/app');

let appInstance = null;

async function ensureApp() {
  if (appInstance) {
    return appInstance;
  }

  await initStore();
  appInstance = createApp();
  return appInstance;
}

async function resetToSeed() {
  await setState(createSeedState());
}

module.exports = {
  ensureApp,
  resetToSeed,
};

