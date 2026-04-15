const express = require('express');
const { getState } = require('../data/store');
const { requireAuth, requirePermission, requireRole } = require('../middleware/auth');
const {
  buildVisitorResponse,
  checkoutVisitor,
  notifyDepartment,
  registerVisitor,
  rerouteVisitor,
  scopeVisitors,
  updateVisitorPosition,
} = require('../services/domain');

const router = express.Router();

router.post('/checkin', async (req, res) => {
  const result = await registerVisitor({
    actorUser: null,
    payload: req.body,
    source: 'self',
  });
  return res.json(result);
});

router.post('/checkout', async (req, res) => {
  const visitor = await checkoutVisitor({
    actorUser: req.user || null,
    visitorId: req.body && req.body.id,
    manual: false,
    survey: req.body && req.body.survey,
  });

  if (!visitor) {
    return res.status(404).json({ message: 'Visitor not found or already exited.' });
  }

  return res.json(visitor);
});

router.post('/manual-register', requireAuth, requirePermission('manualRegister'), async (req, res) => {
  const result = await registerVisitor({
    actorUser: req.user,
    payload: req.body,
    source: 'manual',
  });
  return res.json(result);
});

router.post('/:id/checkout-manual', requireAuth, requirePermission('manualCheckout'), async (req, res) => {
  const visitor = await checkoutVisitor({
    actorUser: req.user,
    visitorId: req.params.id,
    manual: true,
  });

  if (!visitor) {
    return res.status(404).json({ message: 'Visitor not found or already exited.' });
  }

  return res.json(visitor);
});

router.post('/:id/position', async (req, res) => {
  const visitor = await updateVisitorPosition({
    actorUser: req.user || null,
    visitorId: req.params.id,
    nodeId: req.body && req.body.nodeId ? req.body.nodeId : null,
    source: req.body && req.body.source ? req.body.source : 'wifi',
  });

  if (!visitor) {
    return res.status(404).json({ message: 'Visitor not found or not active.' });
  }

  return res.json(visitor);
});

router.post('/:id/reroute', async (req, res) => {
  const destinationNodeId = req.body && req.body.destinationNodeId;
  if (!destinationNodeId) {
    return res.status(400).json({ message: 'destinationNodeId is required.' });
  }

  const visitor = await rerouteVisitor({
    actorUser: req.user || null,
    visitorId: req.params.id,
    destinationNodeId,
    locationId: req.body && req.body.locationId,
  });

  if (!visitor) {
    return res.status(404).json({ message: 'Visitor not found or destination unavailable.' });
  }

  return res.json(visitor);
});

router.post('/:id/notify-dept', requireAuth, requirePermission('notifyDepartment'), async (req, res) => {
  const visitor = await notifyDepartment({
    actorUser: req.user,
    visitorId: req.params.id,
  });

  if (!visitor) {
    return res.status(404).json({ message: 'Visitor not found.' });
  }

  return res.json(visitor);
});

router.get('/active', requireAuth, requirePermission('viewLiveMap'), async (req, res) => {
  const state = await getState();
  return res.json(scopeVisitors(state, req.user, { includeHistory: false }));
});

router.get('/history', requireAuth, requireRole(['admin', 'receptionist']), async (req, res) => {
  const state = await getState();
  return res.json(
    scopeVisitors(state, req.user, {
      includeHistory: true,
      allDays: true,
      organizationId: req.query.organizationId || undefined,
      locationId: req.query.locationId || undefined,
    }),
  );
});

router.get('/:id', async (req, res) => {
  const state = await getState();
  const visitor = buildVisitorResponse(state, req.params.id);
  if (!visitor) {
    return res.status(404).json({ message: 'Visitor not found.' });
  }

  return res.json(visitor);
});

module.exports = router;
