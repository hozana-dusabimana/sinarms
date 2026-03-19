const { initStore } = require('./data/store');

(async () => {
  try {
    await initStore();
    console.log('MySQL database initialized and migrations applied.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
