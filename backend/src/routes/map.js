const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry } = require('../services/engine');
const aiClient = require('../services/aiClient');

const router = express.Router();

function pushMapsToAiEngine(maps) {
  Promise.resolve()
    .then(() => aiClient.refreshGraph(maps))
    .catch(() => null);
}

router.get('/graph', async (req, res) => {
  const state = await getState();
  const locationId = req.query.locationId || state.locations[0].id;
  return res.json(state.maps[locationId] || { nodes: [], edges: [], floorplanImage: null });
});

router.put('/graph', requireAuth, requireRole(['admin']), async (req, res) => {
  const locationId = req.body.locationId || req.query.locationId;
  const nextState = await mutateState((draft) => {
    draft.maps[locationId] = req.body.map;
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'UPDATE_MAP',
      targetType: 'location',
      targetId: locationId,
      details: `Saved map changes for ${locationId}.`,
    });
  });
  pushMapsToAiEngine(nextState.maps);
  return res.json(nextState.maps[locationId]);
});

router.get('/locations/:id/map', async (req, res) => {
  const state = await getState();
  return res.json(state.maps[req.params.id] || { nodes: [], edges: [], floorplanImage: null });
});

router.put('/locations/:id/map', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    draft.maps[req.params.id] = req.body;
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'UPDATE_MAP',
      targetType: 'location',
      targetId: req.params.id,
      details: `Saved map changes for ${req.params.id}.`,
    });
  });
  pushMapsToAiEngine(nextState.maps);
  return res.json(nextState.maps[req.params.id]);
});

module.exports = router;
