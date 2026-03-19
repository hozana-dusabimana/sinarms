const express = require('express');
const { getState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(state.auditLog);
});

module.exports = router;
