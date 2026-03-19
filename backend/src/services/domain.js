const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { jwtExpiresIn, jwtSecret } = require('../config');
const { adminPermissions, receptionistPermissions } = require('../data/seed');
const { getState, mutateState } = require('../data/store');
const {
  appendAuditEntry,
  calculateRoute,
  classifyDestination,
  createId,
  getLocationMap,
  getNode,
  minutesBetween,
  queryFaq,
} = require('./engine');
const { emit } = require('./realtime');

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    locationId: user.locationId,
    permissions: user.permissions,
    status: user.status,
    lastLogin: user.lastLogin,
  };
}

function getActor(sessionUser) {
  return {
    userId: sessionUser ? sessionUser.id : 'system',
    actorName: sessionUser ? sessionUser.name : 'System',
    ipAddress: '127.0.0.1',
  };
}

function addAudit(state, user, payload) {
  return appendAuditEntry(state, {
    ...getActor(user),
    ...payload,
  });
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    },
    jwtSecret,
    {
      expiresIn: jwtExpiresIn,
    },
  );
}

function scopeVisitors(state, user, options = {}) {
  const includeHistory = options.includeHistory !== false;
  return state.visitors.filter((visitor) => {
    if (!includeHistory && visitor.status !== 'active') {
      return false;
    }

    if (options.locationId && visitor.locationId !== options.locationId) {
      return false;
    }

    if (options.organizationId && visitor.organizationId !== options.organizationId) {
      return false;
    }

    if (!user || user.role === 'admin') {
      return true;
    }

    const sameOrg = visitor.organizationId === user.organizationId;
    const sameLocation = visitor.locationId === user.locationId;
    const sameDay = new Date(visitor.checkinTime).toDateString() === new Date().toDateString();
    return sameOrg && sameLocation && sameDay;
  });
}

function scopeAlerts(state, user) {
  return state.alerts.filter((alert) => {
    if (alert.resolvedAt) {
      return false;
    }

    const visitor = state.visitors.find((entry) => entry.id === alert.visitorId);
    if (!visitor) {
      return false;
    }

    if (!user || user.role === 'admin') {
      return true;
    }

    return visitor.organizationId === user.organizationId && visitor.locationId === user.locationId;
  });
}

function buildAnalytics(state, filters = {}) {
  const visitors = state.visitors.filter((visitor) => {
    if (filters.organizationId && visitor.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.locationId && visitor.locationId !== filters.locationId) {
      return false;
    }

    return true;
  });

  const completedVisitors = visitors.filter((visitor) => visitor.status === 'exited');
  const averageDuration = Math.round(
    completedVisitors.reduce((sum, visitor) => sum + Number(visitor.durationMin || 0), 0) /
      (completedVisitors.length || 1),
  );

  const destinationCounts = {};
  visitors.forEach((visitor) => {
    const map = getLocationMap(state, visitor.locationId);
    const node = getNode(map, visitor.destinationNodeId);
    const label = node ? node.label : visitor.destinationText;
    destinationCounts[label] = (destinationCounts[label] || 0) + 1;
  });

  const topDestinations = Object.entries(destinationCounts)
    .map(([label, total]) => ({ label, total }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 5);

  const days = Number.isFinite(Number(filters.days)) ? Math.max(1, Math.min(90, Number(filters.days))) : 30;
  const todayUtc = new Date();
  const dayKeys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - offset);
    dayKeys.push(date.toISOString().slice(0, 10));
  }

  const dailyCounts = new Map(dayKeys.map((key) => [key, 0]));
  visitors.forEach((visitor) => {
    if (!visitor.checkinTime) {
      return;
    }

    const dayKey = new Date(visitor.checkinTime).toISOString().slice(0, 10);
    if (!dailyCounts.has(dayKey)) {
      return;
    }

    dailyCounts.set(dayKey, dailyCounts.get(dayKey) + 1);
  });

  const arrivalsByDay = dayKeys.map((date) => ({
    date,
    totalVisitors: dailyCounts.get(date) || 0,
  }));

  return {
    totalVisitors: visitors.length,
    activeVisitors: visitors.filter((visitor) => visitor.status === 'active').length,
    averageDuration,
    alertsToday: state.alerts.filter(
      (alert) => new Date(alert.triggeredAt).toDateString() === new Date().toDateString(),
    ).length,
    topDestinations,
    arrivalsByDay,
  };
}

function resolveDestinationForLocation(state, locationId, destinationText) {
  const map = getLocationMap(state, locationId);
  return classifyDestination(map, destinationText);
}

function buildVisitorResponse(state, visitorId) {
  const visitor = state.visitors.find((entry) => entry.id === visitorId);
  if (!visitor) {
    return null;
  }

  const map = getLocationMap(state, visitor.locationId);
  const currentNode = getNode(map, visitor.currentNodeId);
  const destinationNode = getNode(map, visitor.destinationNodeId);

  return {
    ...visitor,
    currentNode,
    destinationNode,
  };
}

async function registerVisitor({ actorUser, payload, source }) {
  const state = await getState();
  const routeDecision = resolveDestinationForLocation(state, payload.locationId, payload.destinationText);

  if (routeDecision.status !== 'resolved' && !payload.destinationNodeId) {
    return {
      classification: routeDecision,
      visitor: null,
    };
  }

  const destinationNodeId = payload.destinationNodeId || routeDecision.destinationNodeId;
  let responseVisitorId = null;

  const nextState = await mutateState((draft) => {
    const map = getLocationMap(draft, payload.locationId);
    const route = calculateRoute(map, 'entrance', destinationNodeId);
    const nowIso = new Date().toISOString();
    const visitorId = createId('visitor');
    responseVisitorId = visitorId;

    draft.visitors.unshift({
      id: visitorId,
      name: payload.name,
      idNumber: payload.idNumber || payload.idOrPhone || '',
      phone: payload.phone || payload.idOrPhone || '',
      organizationId: payload.organizationId,
      locationId: payload.locationId,
      checkinTime: nowIso,
      checkoutTime: null,
      status: 'active',
      destinationText: payload.destinationText,
      destinationNodeId,
      routeNodeIds: route.pathNodeIds,
      routeSteps: route.steps,
      currentNodeId: route.pathNodeIds[0] || 'entrance',
      lastPositionUpdateAt: nowIso,
      source,
      hostName: payload.hostName || '',
      language: payload.language || 'en',
      durationMin: null,
      arrivedAt: null,
      departmentNotifiedAt: null,
      departmentNotificationBy: null,
      survey: null,
    });

    const startNode = getNode(map, 'entrance');
    draft.visitorPositions.unshift({
      id: createId('pos'),
      visitorId,
      zoneId: 'entrance',
      nodeId: 'entrance',
      x: startNode ? startNode.x : 8,
      y: startNode ? startNode.y : 58,
      timestamp: nowIso,
      source: source === 'manual' ? 'manual' : 'qr',
    });

    const withAudit = addAudit(draft, actorUser, {
      actionType: source === 'manual' ? 'MANUAL_REGISTER' : 'VISITOR_CHECKIN',
      targetType: 'visitor',
      targetId: visitorId,
      details: `${payload.name} registered for ${payload.destinationText}.`,
    });

    return withAudit;
  });

  const visitor = buildVisitorResponse(nextState, responseVisitorId);
  emit('visitor:checkin', visitor);

  return {
    classification: routeDecision,
    visitor,
  };
}

async function updateVisitorPosition({ actorUser, visitorId, nodeId, source }) {
  let targetVisitorId = null;
  let nextNode = null;

  const nextState = await mutateState((draft) => {
    const visitor = draft.visitors.find((entry) => entry.id === visitorId);
    if (!visitor || visitor.status !== 'active') {
      return draft;
    }

    const map = getLocationMap(draft, visitor.locationId);
    const currentIndex = visitor.routeNodeIds.indexOf(visitor.currentNodeId);
    const targetNodeId = nodeId || visitor.routeNodeIds[Math.min(currentIndex + 1, visitor.routeNodeIds.length - 1)];
    targetVisitorId = visitorId;
    nextNode = getNode(map, targetNodeId);
    const nowIso = new Date().toISOString();

    visitor.currentNodeId = targetNodeId;
    visitor.lastPositionUpdateAt = nowIso;
    if (targetNodeId === visitor.destinationNodeId) {
      visitor.arrivedAt = visitor.arrivedAt || nowIso;
    }

    draft.visitorPositions.unshift({
      id: createId('pos'),
      visitorId,
      zoneId: targetNodeId,
      nodeId: targetNodeId,
      x: nextNode ? nextNode.x : 50,
      y: nextNode ? nextNode.y : 50,
      timestamp: nowIso,
      source,
    });

    return addAudit(draft, actorUser, {
      actionType: source === 'qr' ? 'CHECKPOINT_SCAN' : 'POSITION_UPDATE',
      targetType: 'visitor',
      targetId: visitorId,
      details: `${visitor.name} moved to ${nextNode ? nextNode.label : targetNodeId}.`,
    });
  });

  const visitor = targetVisitorId ? buildVisitorResponse(nextState, targetVisitorId) : null;
  if (visitor) {
    emit('visitor:position', visitor);
    if (visitor.arrivedAt) {
      emit('visitor:arrived', visitor);
    }
  }

  return visitor;
}

async function checkoutVisitor({ actorUser, visitorId, manual, survey }) {
  let responseVisitorId = null;

  const nextState = await mutateState((draft) => {
    const visitor = draft.visitors.find((entry) => entry.id === visitorId);
    if (!visitor || visitor.status !== 'active') {
      return draft;
    }

    responseVisitorId = visitor.id;
    const nowIso = new Date().toISOString();
    visitor.status = 'exited';
    visitor.checkoutTime = nowIso;
    visitor.durationMin = minutesBetween(visitor.checkinTime, nowIso);
    visitor.currentNodeId = 'exit';
    visitor.lastPositionUpdateAt = nowIso;
    visitor.survey = survey || visitor.survey;

    return addAudit(draft, actorUser, {
      actionType: manual ? 'MANUAL_CHECKOUT' : 'VISITOR_CHECKOUT',
      targetType: 'visitor',
      targetId: visitor.id,
      details: `${visitor.name} checked out after ${visitor.durationMin} minutes.`,
    });
  });

  const visitor = responseVisitorId ? buildVisitorResponse(nextState, responseVisitorId) : null;
  if (visitor) {
    emit('visitor:checkout', visitor);
  }

  return visitor;
}

async function notifyDepartment({ actorUser, visitorId }) {
  let responseVisitorId = null;

  const nextState = await mutateState((draft) => {
    const visitor = draft.visitors.find((entry) => entry.id === visitorId);
    if (!visitor) {
      return draft;
    }

    responseVisitorId = visitor.id;
    const nowIso = new Date().toISOString();
    visitor.departmentNotifiedAt = nowIso;
    visitor.departmentNotificationBy = actorUser ? actorUser.id : 'system';
    draft.notifications.unshift({
      id: createId('notify'),
      type: 'department',
      visitorId,
      message: `Department notified for ${visitor.name}.`,
      createdAt: nowIso,
      createdBy: actorUser ? actorUser.id : 'system',
    });

    return addAudit(draft, actorUser, {
      actionType: 'NOTIFY_DEPARTMENT',
      targetType: 'visitor',
      targetId: visitor.id,
      details: `Department notification sent for ${visitor.name}.`,
    });
  });

  const visitor = responseVisitorId ? buildVisitorResponse(nextState, responseVisitorId) : null;
  if (visitor) {
    emit('notification:dept', visitor);
  }

  return visitor;
}

async function generateLocationQr(location) {
  return QRCode.toString(`sinarms://checkin?location=${location.id}&token=${location.qrCodeToken}`, {
    type: 'svg',
    margin: 1,
  });
}

async function acknowledgeAlert({ actorUser, alertId }) {
  let acknowledgedAlert = null;

  const nextState = await mutateState((draft) => {
    const alert = draft.alerts.find((entry) => entry.id === alertId);
    if (!alert) {
      return draft;
    }

    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = actorUser ? actorUser.id : 'system';
    acknowledgedAlert = alert;

    return addAudit(draft, actorUser, {
      actionType: 'ACKNOWLEDGE_ALERT',
      targetType: 'alert',
      targetId: alert.id,
      details: `Acknowledged ${alert.type} alert.`,
    });
  });

  if (acknowledgedAlert) {
    emit('alert:acknowledged', acknowledgedAlert);
  }

  return nextState.alerts.find((entry) => entry.id === alertId) || null;
}

async function authenticate(email, password) {
  const state = await getState();
  const user = state.users.find((entry) => entry.email.toLowerCase() === String(email).toLowerCase() && entry.status === 'active');

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return null;
  }

  const nextState = await mutateState((draft) => {
    const mutableUser = draft.users.find((entry) => entry.id === user.id);
    mutableUser.lastLogin = new Date().toISOString();
    return addAudit(draft, mutableUser, {
      actionType: 'LOGIN',
      targetType: 'user',
      targetId: mutableUser.id,
      details: `Successful ${mutableUser.role} login for ${mutableUser.email}.`,
    });
  });

  const authenticatedUser = nextState.users.find((entry) => entry.id === user.id);
  return {
    token: createToken(authenticatedUser),
    user: publicUser(authenticatedUser),
  };
}

async function logout(user) {
  if (!user) {
    return null;
  }

  await mutateState((draft) =>
    addAudit(draft, user, {
      actionType: 'LOGOUT',
      targetType: 'user',
      targetId: user.id,
      details: `${user.email} signed out.`,
    }),
  );
  return true;
}

async function upsertUser({ actorUser, payload, userId }) {
  let responseUser = null;

  const nextState = await mutateState((draft) => {
    function syncReceptionistAssignments(user) {
      draft.locations.forEach((location) => {
        location.receptionistIds = (location.receptionistIds || []).filter((entry) => entry !== user.id);
      });

      if (user.role !== 'receptionist' || !user.locationId) {
        if (user.role !== 'receptionist') {
          user.locationId = null;
        }
        return;
      }

      const location = draft.locations.find((entry) => entry.id === user.locationId);
      if (!location) {
        user.locationId = null;
        return;
      }

      user.organizationId = location.organizationId;
      location.receptionistIds = location.receptionistIds || [];
      if (!location.receptionistIds.includes(user.id)) {
        location.receptionistIds.push(user.id);
      }
    }

    if (userId) {
      const user = draft.users.find((entry) => entry.id === userId);
      if (!user) {
        return draft;
      }

      Object.assign(user, payload);
      if (payload.password) {
        user.passwordHash = bcrypt.hashSync(payload.password, 10);
        delete user.password;
      }
      syncReceptionistAssignments(user);
      responseUser = user;
      return addAudit(draft, actorUser, {
        actionType: 'UPDATE_USER',
        targetType: 'user',
        targetId: user.id,
        details: `Updated ${user.name}.`,
      });
    }

    const createdUser = {
      id: createId('user'),
      name: payload.name,
      email: payload.email,
      passwordHash: bcrypt.hashSync(payload.password || 'Reception123!', 10),
      role: payload.role,
      organizationId: payload.organizationId || null,
      locationId: payload.role === 'admin' ? null : payload.locationId || null,
      permissions:
        payload.role === 'admin'
          ? adminPermissions
          : { ...receptionistPermissions, ...(payload.permissions || {}) },
      status: 'active',
      lastLogin: null,
      createdBy: actorUser ? actorUser.id : 'system',
    };

    syncReceptionistAssignments(createdUser);
    draft.users.unshift(createdUser);
    responseUser = createdUser;

    return addAudit(draft, actorUser, {
      actionType: 'CREATE_USER',
      targetType: 'user',
      targetId: createdUser.id,
      details: `Created ${createdUser.role} account for ${createdUser.name}.`,
    });
  });

  return publicUser(nextState.users.find((entry) => entry.id === responseUser.id));
}

async function resolveAlert({ actorUser, alertId }) {
  let resolvedAlertId = null;

  const nextState = await mutateState((draft) => {
    const alert = draft.alerts.find((entry) => entry.id === alertId);
    if (!alert || alert.resolvedAt) {
      return draft;
    }

    resolvedAlertId = alert.id;
    alert.resolvedAt = new Date().toISOString();
    if (!alert.acknowledgedAt) {
      alert.acknowledgedAt = alert.resolvedAt;
      alert.acknowledgedBy = actorUser ? actorUser.id : 'system';
    }

    return addAudit(draft, actorUser, {
      actionType: 'RESOLVE_ALERT',
      targetType: 'alert',
      targetId: alert.id,
      details: `Resolved ${alert.type} alert.`,
    });
  });

  return resolvedAlertId
    ? nextState.alerts.find((entry) => entry.id === resolvedAlertId) || null
    : null;
}

module.exports = {
  acknowledgeAlert,
  authenticate,
  buildAnalytics,
  buildVisitorResponse,
  checkoutVisitor,
  generateLocationQr,
  logout,
  notifyDepartment,
  publicUser,
  queryFaq,
  registerVisitor,
  resolveAlert,
  resolveDestinationForLocation,
  scopeAlerts,
  scopeVisitors,
  updateVisitorPosition,
  upsertUser,
};
