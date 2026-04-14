const express = require('express');
const { authenticate, logout } = require('../services/domain');
const { requireAuth } = require('../middleware/auth');
const { isProduction } = require('../config');

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  maxAge: 8 * 60 * 60 * 1000,
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const session = await authenticate(email, password);

  if (!session) {
    return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
  }

  res.cookie('token', session.token, cookieOptions);

  return res.json(session);
});

router.post('/logout', requireAuth, async (req, res) => {
  await logout(req.user);
  res.clearCookie('token', { ...cookieOptions, maxAge: undefined });
  return res.json({ success: true });
});

module.exports = router;
