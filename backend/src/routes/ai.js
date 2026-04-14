const express = require('express');
const { getState } = require('../data/store');
const { calculateRoute, getLocationMap } = require('../services/engine');
const { resolveDestinationWithAi } = require('../services/domain');
const aiClient = require('../services/aiClient');

const router = express.Router();

function pickLocationId(state, requested) {
  if (requested) {
    return requested;
  }
  return state.locations[0] ? state.locations[0].id : null;
}

router.post('/classify-intent', async (req, res) => {
  const state = await getState();
  const locationId = pickLocationId(state, req.body.locationId);
  if (!locationId) {
    return res.status(400).json({ message: 'No location available.' });
  }

  const result = await resolveDestinationWithAi(
    state,
    locationId,
    req.body.text,
    req.body.language,
  );
  return res.json(result);
});

router.post('/calculate-route', async (req, res) => {
  const state = await getState();
  const locationId = pickLocationId(state, req.body.locationId);
  if (!locationId) {
    return res.status(400).json({ message: 'No location available.' });
  }

  const aiRoute = await aiClient.calculateRoute({
    fromNode: req.body.fromNode || 'entrance',
    toNode: req.body.toNode,
    locationId,
  });

  if (aiRoute && Array.isArray(aiRoute.pathNodeIds) && aiRoute.pathNodeIds.length > 0) {
    return res.json({ ...aiRoute, source: 'ai-engine' });
  }

  const map = getLocationMap(state, locationId);
  const fallback = calculateRoute(map, req.body.fromNode || 'entrance', req.body.toNode);
  return res.json({ ...fallback, source: 'fallback' });
});

router.get('/health', async (_req, res) => {
  const healthz = await aiClient.healthCheck();
  return res.json({
    engineUrl: aiClient.url,
    online: Boolean(healthz),
    details: healthz,
  });
});

module.exports = router;
