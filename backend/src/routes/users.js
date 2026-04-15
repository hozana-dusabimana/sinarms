const express = require('express');
const bcrypt = require('bcryptjs');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry } = require('../services/engine');
const { publicUser, upsertUser } = require('../services/domain');

const router = express.Router();

router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(state.users.map(publicUser));
});

// Self-service: any authenticated user can update their own name, email, or password.
// Role/permissions/organization/location are never mutated here.
router.put('/me', requireAuth, async (req, res) => {
  const payload = req.body || {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : undefined;
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : undefined;
  const password = typeof payload.password === 'string' && payload.password.length > 0 ? payload.password : undefined;
  const currentPassword = typeof payload.currentPassword === 'string' ? payload.currentPassword : undefined;

  if (name === undefined && email === undefined && password === undefined) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }

  // Changing password requires the current password.
  if (password) {
    const state = await getState();
    const existing = state.users.find((u) => u.id === req.user.id);
    if (!existing) return res.status(404).json({ message: 'User not found.' });
    if (!currentPassword || !bcrypt.compareSync(currentPassword, existing.passwordHash || '')) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
  }

  // Email uniqueness check.
  if (email) {
    const state = await getState();
    const clash = state.users.find((u) => u.id !== req.user.id && (u.email || '').toLowerCase() === email);
    if (clash) return res.status(409).json({ message: 'That email is already in use.' });
  }

  const nextState = await mutateState((draft) => {
    const user = draft.users.find((entry) => entry.id === req.user.id);
    if (!user) return draft;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (password) user.passwordHash = bcrypt.hashSync(password, 10);
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: user.name,
      ipAddress: req.ip,
      actionType: 'UPDATE_PROFILE',
      targetType: 'user',
      targetId: user.id,
      details: `Self-updated profile${password ? ' (password changed)' : ''}.`,
    });
  });

  const user = nextState.users.find((entry) => entry.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  return res.json(publicUser(user));
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
      ipAddress: req.ip,
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
      ipAddress: req.ip,
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
