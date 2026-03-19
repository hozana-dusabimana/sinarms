const express = require('express');
const { getState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { buildAnalytics } = require('../services/domain');

const router = express.Router();

router.get('/summary', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(
    buildAnalytics(state, {
      organizationId: req.query.organizationId || undefined,
      locationId: req.query.locationId || undefined,
      days: req.query.days || undefined,
    }),
  );
});

module.exports = router;
