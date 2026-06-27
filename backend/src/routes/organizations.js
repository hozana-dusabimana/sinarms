const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry, createId } = require('../services/engine');
const { generateLocationQr } = require('../services/domain');

const router = express.Router();

const ORGANIZATION_UPDATABLE = ['name', 'description', 'contactEmail', 'contactPhone', 'address', 'logoUrl', 'status', 'distanceCheckEnabled'];
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

router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(state.organizations);
});

router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const organization = {
      id: createId('org'),
      name: req.body.name,
      description: req.body.description || '',
      contactEmail: req.body.contactEmail || '',
      contactPhone: req.body.contactPhone || '',
      address: req.body.address || '',
      logoUrl: req.body.logoUrl || null,
      status: 'active',
      // New organizations enforce the geofence by default; admins opt out later.
      distanceCheckEnabled: req.body.distanceCheckEnabled !== false,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
    };
    draft.organizations.unshift(organization);
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'CREATE_ORGANIZATION',
      targetType: 'organization',
      targetId: organization.id,
      details: `Registered organization ${organization.name}.`,
    });
  });
  return res.status(201).json(nextState.organizations[0]);
});

router.put('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const organization = draft.organizations.find((entry) => entry.id === req.params.id);
    if (!organization) {
      return draft;
    }
    Object.assign(organization, pick(req.body, ORGANIZATION_UPDATABLE));
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'UPDATE_ORGANIZATION',
      targetType: 'organization',
      targetId: organization.id,
      details: `Updated organization ${organization.name}.`,
    });
  });
  const organization = nextState.organizations.find((entry) => entry.id === req.params.id);
  if (!organization) {
    return res.status(404).json({ message: 'Organization not found.' });
  }
  return res.json(organization);
});

router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const organization = draft.organizations.find((entry) => entry.id === req.params.id);
    if (!organization) {
      return draft;
    }
    organization.status = organization.status === 'active' ? 'inactive' : 'active';
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'TOGGLE_ORGANIZATION',
      targetType: 'organization',
      targetId: organization.id,
      details: `${organization.name} set to ${organization.status}.`,
    });
  });
  const organization = nextState.organizations.find((entry) => entry.id === req.params.id);
  if (!organization) {
    return res.status(404).json({ message: 'Organization not found.' });
  }
  return res.json(organization);
});

router.get('/:id/locations', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(state.locations.filter((location) => location.organizationId === req.params.id));
});

router.post('/:id/locations', requireAuth, requireRole(['admin']), async (req, res) => {
  const locationId = createId('loc');
  const nextState = await mutateState((draft) => {
    const location = {
      id: locationId,
      organizationId: req.params.id,
      name: req.body.name,
      address: req.body.address || '',
      floorCount: Number(req.body.floorCount || 1),
      description: req.body.description || '',
      status: 'active',
      qrCodeToken: req.body.qrCodeToken || `SINARMS-${locationId.toUpperCase()}`,
      receptionistIds: [],
      createdAt: new Date().toISOString(),
    };
    draft.locations.unshift(location);
    // Start new locations with a blank map so admins build their own nodes
    // instead of inheriting placeholder default places.
    draft.maps[locationId] = {
      floorplanImage: null,
      nodes: [],
      edges: [],
    };
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'CREATE_LOCATION',
      targetType: 'location',
      targetId: location.id,
      details: `Added location ${location.name}.`,
    });
  });
  return res.status(201).json(nextState.locations.find((entry) => entry.id === locationId));
});

router.put('/locations/:id', requireAuth, requireRole(['admin']), async (req, res) => {
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

router.delete('/locations/:id', requireAuth, requireRole(['admin']), async (req, res) => {
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

router.get('/locations/:id/qr-code', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const state = await getState();
    const location = state.locations.find((entry) => entry.id === req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found.' });
    }
    const svg = await generateLocationQr(location, req.query.dest);
    res.type('image/svg+xml');
    return res.send(svg);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
