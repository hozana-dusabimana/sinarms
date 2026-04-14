const express = require('express');
const { getState } = require('../data/store');
const aiClient = require('../services/aiClient');

const router = express.Router();

function isLocal(req) {
  const remote = req.ip || req.connection?.remoteAddress || '';
  return (
    remote === '127.0.0.1' ||
    remote === '::1' ||
    remote === '::ffff:127.0.0.1' ||
    remote.startsWith('127.') ||
    remote === 'localhost'
  );
}

router.use((req, res, next) => {
  if (!isLocal(req)) {
    return res.status(403).json({ message: 'Internal endpoint restricted to localhost.' });
  }
  return next();
});

router.get('/ai-state', async (_req, res) => {
  const state = await getState();
  return res.json({
    maps: state.maps,
    faq: state.faq,
  });
});

router.post('/ai/resync', async (_req, res) => {
  const state = await getState();
  await aiClient.refreshGraph(state.maps);
  await aiClient.refreshFaq(state.faq);
  const health = await aiClient.healthCheck();
  return res.json({ synced: true, health });
});

module.exports = router;
