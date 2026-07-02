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
      weekday: req.query.weekday ?? undefined,
      date: req.query.date || undefined,
    }),
  );
});

// Reports drill-down: same aggregates as /summary plus the individual visitor
// rows that make up the focused set (a specific day, or every occurrence of a
// weekday within the range), for a filterable/exportable table.
router.get('/report', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(
    buildAnalytics(state, {
      organizationId: req.query.organizationId || undefined,
      locationId: req.query.locationId || undefined,
      days: req.query.days || undefined,
      weekday: req.query.weekday ?? undefined,
      date: req.query.date || undefined,
      includeVisitors: true,
    }),
  );
});

module.exports = router;
