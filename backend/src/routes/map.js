const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry } = require('../services/engine');

const router = express.Router();

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
      ipAddress: '127.0.0.1',
      actionType: 'UPDATE_MAP',
      targetType: 'location',
      targetId: locationId,
      details: `Saved map changes for ${locationId}.`,
    });
  });
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
      ipAddress: '127.0.0.1',
      actionType: 'UPDATE_MAP',
      targetType: 'location',
      targetId: req.params.id,
      details: `Saved map changes for ${req.params.id}.`,
    });
  });
  return res.json(nextState.maps[req.params.id]);
});

module.exports = router;
