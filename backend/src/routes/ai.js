const express = require('express');
const { getState } = require('../data/store');
const { calculateRoute, getLocationMap } = require('../services/engine');
const { queryFaq, resolveDestinationForLocation } = require('../services/domain');

const router = express.Router();

router.post('/classify-intent', async (req, res) => {
  const state = await getState();
  const locationId = req.body.locationId || state.locations[0].id;
  return res.json(resolveDestinationForLocation(state, locationId, req.body.text));
});

router.post('/calculate-route', async (req, res) => {
  const state = await getState();
  const locationId = req.body.locationId || state.locations[0].id;
  const map = getLocationMap(state, locationId);
  return res.json(calculateRoute(map, req.body.fromNode || 'entrance', req.body.toNode));
});

router.post('/chatbot', async (req, res) => {
  const state = await getState();
  return res.json(queryFaq(state, req.body.organizationId || null, req.body.query));
});

module.exports = router;
