const express = require('express');
const { getState } = require('../data/store');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { acknowledgeAlert, resolveAlert, scopeAlerts } = require('../services/domain');

const router = express.Router();

router.get('/', requireAuth, requirePermission('viewAlerts'), async (req, res) => {
  const state = await getState();
  return res.json(scopeAlerts(state, req.user));
});

router.post('/:id/acknowledge', requireAuth, requirePermission('viewAlerts'), async (req, res) => {
  const alert = await acknowledgeAlert({ actorUser: req.user, alertId: req.params.id });
  if (!alert) {
    return res.status(404).json({ message: 'Alert not found.' });
  }

  return res.json(alert);
});

router.post('/:id/resolve', requireAuth, requirePermission('viewAlerts'), async (req, res) => {
  const alert = await resolveAlert({ actorUser: req.user, alertId: req.params.id });
  if (!alert) {
    return res.status(404).json({ message: 'Alert not found.' });
  }

  return res.json(alert);
});

module.exports = router;
