const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry } = require('../services/engine');
const { publicUser, upsertUser } = require('../services/domain');

const router = express.Router();

router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(state.users.map(publicUser));
});

router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  return res.status(201).json(await upsertUser({ actorUser: req.user, payload: req.body }));
});

router.put('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  return res.json(await upsertUser({ actorUser: req.user, payload: req.body, userId: req.params.id }));
});

router.put('/:id/permissions', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const user = draft.users.find((entry) => entry.id === req.params.id);
    if (!user) {
      return draft;
    }

    user.permissions = { ...(user.permissions || {}), ...(req.body || {}) };
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: '127.0.0.1',
      actionType: 'UPDATE_PERMISSIONS',
      targetType: 'user',
      targetId: user.id,
      details: `Updated permissions for ${user.name}.`,
    });
  });

  const user = nextState.users.find((entry) => entry.id === req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json(publicUser(user));
});

router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const user = draft.users.find((entry) => entry.id === req.params.id);
    if (!user) {
      return draft;
    }

    user.status = user.status === 'active' ? 'inactive' : 'active';
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: '127.0.0.1',
      actionType: 'TOGGLE_USER',
      targetType: 'user',
      targetId: user.id,
      details: `${user.name} set to ${user.status}.`,
    });
  });

  const user = nextState.users.find((entry) => entry.id === req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json(publicUser(user));
});

module.exports = router;
