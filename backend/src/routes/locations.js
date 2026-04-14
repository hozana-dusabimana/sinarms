const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry } = require('../services/engine');
const { generateLocationQr } = require('../services/domain');

const router = express.Router();

const LOCATION_UPDATABLE = ['name', 'address', 'floorCount', 'description', 'status', 'qrCodeToken', 'receptionistIds'];

function pick(source, allowed) {
  const result = {};
  if (!source) return result;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }
  return result;
}

router.put('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const location = draft.locations.find((entry) => entry.id === req.params.id);
    if (!location) {
      return draft;
    }

    Object.assign(location, pick(req.body, LOCATION_UPDATABLE));
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'UPDATE_LOCATION',
      targetType: 'location',
      targetId: location.id,
      details: `Updated location ${location.name}.`,
    });
  });

  const location = nextState.locations.find((entry) => entry.id === req.params.id);
  if (!location) {
    return res.status(404).json({ message: 'Location not found.' });
  }

  return res.json(location);
});

router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const location = draft.locations.find((entry) => entry.id === req.params.id);
    if (!location) {
      return draft;
    }

    location.status = location.status === 'active' ? 'inactive' : 'active';
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'TOGGLE_LOCATION',
      targetType: 'location',
      targetId: location.id,
      details: `${location.name} set to ${location.status}.`,
    });
  });

  const location = nextState.locations.find((entry) => entry.id === req.params.id);
  if (!location) {
    return res.status(404).json({ message: 'Location not found.' });
  }

  return res.json(location);
});

router.get('/:id/map', async (req, res) => {
  const state = await getState();
  return res.json(state.maps[req.params.id] || { nodes: [], edges: [], floorplanImage: null });
});

router.put('/:id/map', requireAuth, requireRole(['admin']), async (req, res) => {
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

  return res.json(nextState.maps[req.params.id]);
});

router.get('/:id/qr-code', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const state = await getState();
    const location = state.locations.find((entry) => entry.id === req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found.' });
    }

    const svg = await generateLocationQr(location);
    res.type('image/svg+xml');
    return res.send(svg);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
