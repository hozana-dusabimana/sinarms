const express = require('express');
const { getState } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { scopeFeedback, submitFeedback } = require('../services/domain');

const router = express.Router();

// Public: anyone using the visitor portal can leave feedback, with or without an
// active visit. The institution is resolved server-side from the location/visitor.
router.post('/', async (req, res, next) => {
  try {
    const entry = await submitFeedback({ payload: req.body || {} });
    return res.status(201).json(entry);
  } catch (err) {
    if (err && err.status === 422) {
      return res.status(422).json({ message: err.message, code: err.code });
    }
    return next(err);
  }
});

// Staff: list feedback scoped to the caller's institution (admins see all).
router.get('/', requireAuth, async (req, res) => {
  const state = await getState();
  return res.json(scopeFeedback(state, req.user));
});

module.exports = router;
