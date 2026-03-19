const express = require('express');
const { getState } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { buildAnalytics, publicUser, scopeAlerts, scopeVisitors } = require('../services/domain');

const router = express.Router();

function buildBaseState(state) {
  return {
    organizations: state.organizations,
    locations: state.locations,
    maps: state.maps,
  };
}

router.get('/public', async (_req, res) => {
  const state = await getState();

  return res.json({
    state: {
      ...buildBaseState(state),
      organizations: state.organizations.filter((organization) => organization.status === 'active'),
      locations: state.locations.filter((location) => location.status === 'active'),
      users: [],
      visitors: [],
      alerts: [],
      faq: [],
      auditLog: [],
      notifications: [],
    },
    analytics: buildAnalytics(state),
  });
});

router.get('/staff', requireAuth, async (req, res) => {
  const state = await getState();
  const isAdmin = req.user.role === 'admin';

  return res.json({
    user: publicUser(req.user),
    state: {
      ...buildBaseState(state),
      users: isAdmin ? state.users.map(publicUser) : [],
      visitors: scopeVisitors(state, req.user, { includeHistory: isAdmin }),
      alerts: scopeAlerts(state, req.user),
      faq: isAdmin ? state.faq : [],
      auditLog: isAdmin ? state.auditLog : [],
      notifications: state.notifications || [],
    },
    analytics: isAdmin
      ? buildAnalytics(state)
      : buildAnalytics(state, {
          organizationId: req.user.organizationId || undefined,
          locationId: req.user.locationId || undefined,
        }),
  });
});

module.exports = router;
