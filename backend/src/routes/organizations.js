const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry, createId } = require('../services/engine');
const { generateLocationQr } = require('../services/domain');

const router = express.Router();

const ORGANIZATION_UPDATABLE = ['name', 'description', 'contactEmail', 'contactPhone', 'address', 'logoUrl', 'status'];
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
    draft.maps[locationId] = {
      floorplanImage: null,
      nodes: [
        { id: 'entrance', label: 'Entrance', aliases: ['entrance'], type: 'checkpoint', zone: 'public', x: 10, y: 55, floor: 1 },
        { id: 'reception', label: 'Reception', aliases: ['reception'], type: 'office', zone: 'public', x: 30, y: 55, floor: 1 },
        { id: 'corridor', label: 'Main Corridor', aliases: ['corridor'], type: 'corridor', zone: 'public', x: 52, y: 55, floor: 1 },
        { id: 'office', label: 'Main Office', aliases: ['office'], type: 'office', zone: 'public', x: 78, y: 55, floor: 1 },
        { id: 'exit', label: 'Exit', aliases: ['exit'], type: 'exit', zone: 'emergency', x: 92, y: 55, floor: 1 },
      ],
      edges: [
        { id: createId('edge'), from: 'entrance', to: 'reception', distanceM: 10, direction: 'straight', directionHint: 'Walk to reception.', isAccessible: true },
        { id: createId('edge'), from: 'reception', to: 'corridor', distanceM: 10, direction: 'straight', directionHint: 'Follow the corridor.', isAccessible: true },
        { id: createId('edge'), from: 'corridor', to: 'office', distanceM: 16, direction: 'straight', directionHint: 'Continue to the main office.', isAccessible: true },
        { id: createId('edge'), from: 'office', to: 'exit', distanceM: 12, direction: 'straight', directionHint: 'Continue to the exit.', isAccessible: true },
      ],
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
    const svg = await generateLocationQr(location);
    res.type('image/svg+xml');
    return res.send(svg);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
