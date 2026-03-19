const express = require('express');
const { authenticate, logout } = require('../services/domain');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const session = await authenticate(email, password);

  if (!session) {
    return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
  }

  res.cookie('token', session.token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  return res.json(session);
});

router.post('/logout', requireAuth, async (req, res) => {
  await logout(req.user);
  res.clearCookie('token');
  return res.json({ success: true });
});

module.exports = router;
