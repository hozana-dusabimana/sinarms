const { createSeedState } = require('./seed');
const { runMigrations } = require('./migrator');
const { query, withTransaction } = require('./mysql');
const { calculateRoute, getLocationMap, refreshAlerts } = require('../services/engine');

let stateCache = null;
let initPromise = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function toSqlDateTime(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 23).replace('T', ' ');
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' && value.includes('T')) {
    return value;
  }

  return `${String(value).replace(' ', 'T')}Z`;
}

function ensureHydrated(state) {
  const nextState = clone(state);

  nextState.visitors = nextState.visitors.map((visitor) => {
    if (visitor.routeSteps && visitor.routeSteps.length) {
      return visitor;
    }

    const map = getLocationMap(nextState, visitor.locationId);
    const route = calculateRoute(
      map,
      visitor.routeNodeIds && visitor.routeNodeIds[0] ? visitor.routeNodeIds[0] : 'entrance',
      visitor.destinationNodeId,
    );

    return {
      ...visitor,
      routeNodeIds: visitor.routeNodeIds && visitor.routeNodeIds.length ? visitor.routeNodeIds : route.pathNodeIds,
      routeSteps: route.steps,
    };
  });

  nextState.notifications = nextState.notifications || [];
  return refreshAlerts(nextState);
}

function removeLegacyPartnerDefaults(state) {
  const nextState = clone(state);
  let changed = false;

  const legacyOrgId = 'org-kigali-industries';
  const legacyLocationIds = new Set(
    (nextState.locations || [])
      .filter((location) => location.organizationId === legacyOrgId || location.id === 'loc-kigali-industries')
      .map((location) => location.id),
  );

  if ((nextState.organizations || []).some((organization) => organization.id === legacyOrgId)) {
    nextState.organizations = nextState.organizations.filter((organization) => organization.id !== legacyOrgId);
    changed = true;
  }

  if (legacyLocationIds.size > 0) {
    nextState.locations = (nextState.locations || []).filter((location) => !legacyLocationIds.has(location.id));
    changed = true;
  }

  const removedVisitorIds = new Set(
    (nextState.visitors || [])
      .filter(
        (visitor) =>
          visitor.organizationId === legacyOrgId ||
          (visitor.locationId && legacyLocationIds.has(visitor.locationId)),
      )
      .map((visitor) => visitor.id),
  );

  if (removedVisitorIds.size > 0) {
    nextState.visitors = nextState.visitors.filter((visitor) => !removedVisitorIds.has(visitor.id));
    nextState.visitorPositions = (nextState.visitorPositions || []).filter(
      (position) => !removedVisitorIds.has(position.visitorId),
    );
    nextState.alerts = (nextState.alerts || []).filter((alert) => !removedVisitorIds.has(alert.visitorId));
    nextState.notifications = (nextState.notifications || []).filter(
      (notification) => !notification.visitorId || !removedVisitorIds.has(notification.visitorId),
    );
    changed = true;
  }

  const originalUsersLength = (nextState.users || []).length;
  nextState.users = (nextState.users || []).filter(
    (user) => user.organizationId !== legacyOrgId && (!user.locationId || !legacyLocationIds.has(user.locationId)),
  );
  if (nextState.users.length !== originalUsersLength) {
    changed = true;
  }

  const originalFaqLength = (nextState.faq || []).length;
  nextState.faq = (nextState.faq || []).filter((entry) => entry.organizationId !== legacyOrgId);
  if (nextState.faq.length !== originalFaqLength) {
    changed = true;
  }

  if (nextState.maps) {
    legacyLocationIds.forEach((locationId) => {
      if (nextState.maps[locationId]) {
        delete nextState.maps[locationId];
        changed = true;
      }
    });
  }

  return { state: nextState, changed };
}

function mergeMissingSeedEntities(state) {
  const nextState = clone(state);
  const seedState = createSeedState();
  let changed = false;

  nextState.organizations = nextState.organizations || [];
  nextState.locations = nextState.locations || [];
  nextState.maps = nextState.maps || {};

  const orgIds = new Set(nextState.organizations.map((organization) => organization.id));
  seedState.organizations.forEach((organization) => {
    if (!orgIds.has(organization.id)) {
      nextState.organizations.push(clone(organization));
      orgIds.add(organization.id);
      changed = true;
    }
  });

  const locationIds = new Set(nextState.locations.map((location) => location.id));
  seedState.locations.forEach((location) => {
    if (!locationIds.has(location.id)) {
      nextState.locations.push(clone(location));
      locationIds.add(location.id);
      changed = true;
    }
  });

  Object.entries(seedState.maps || {}).forEach(([locationId, seedMap]) => {
    const existingMap = nextState.maps[locationId];

    if (!existingMap) {
      nextState.maps[locationId] = clone(seedMap);
      changed = true;
      return;
    }

    existingMap.nodes = existingMap.nodes || [];
    existingMap.edges = existingMap.edges || [];

    const existingNodeIds = new Set(existingMap.nodes.map((node) => node.id));
    (seedMap.nodes || []).forEach((node) => {
      if (!existingNodeIds.has(node.id)) {
        existingMap.nodes.push(clone(node));
        existingNodeIds.add(node.id);
        changed = true;
      }
    });

    const existingEdgeIds = new Set(existingMap.edges.map((edge) => edge.id));
    (seedMap.edges || []).forEach((edge) => {
      if (!existingEdgeIds.has(edge.id)) {
        existingMap.edges.push(clone(edge));
        existingEdgeIds.add(edge.id);
        changed = true;
      }
    });

    if (!existingMap.floorplanImage && seedMap.floorplanImage) {
      existingMap.floorplanImage = seedMap.floorplanImage;
      changed = true;
    }
  });

  return { state: nextState, changed };
}

function buildAnalyticsRows(state) {
  const buckets = new Map();

  state.visitors.forEach((visitor) => {
    const date = String(visitor.checkinTime || '').slice(0, 10);
    if (!date) {
      return;
    }

    const key = `${date}:${visitor.organizationId}:${visitor.locationId}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        date,
        organizationId: visitor.organizationId,
        locationId: visitor.locationId,
        visitors: [],
      });
    }

    buckets.get(key).visitors.push(visitor);
  });

  const rows = [];

  buckets.forEach((bucket) => {
    const completedVisitors = bucket.visitors.filter((visitor) => Number.isFinite(visitor.durationMin));
    const hourlyCounts = {};
    const destinationCounts = {};

    bucket.visitors.forEach((visitor) => {
      const hour = new Date(visitor.checkinTime).getUTCHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;

      const destinationKey = visitor.destinationNodeId || visitor.destinationText || 'unknown';
      destinationCounts[destinationKey] = (destinationCounts[destinationKey] || 0) + 1;
    });

    const peakHour = Object.entries(hourlyCounts).sort((left, right) => right[1] - left[1])[0];
    const topDestination = Object.entries(destinationCounts).sort((left, right) => right[1] - left[1])[0];
    const alertsCount = state.alerts.filter((alert) => {
      if (!alert.triggeredAt || !String(alert.triggeredAt).startsWith(bucket.date)) {
        return false;
      }

      const visitor = state.visitors.find((entry) => entry.id === alert.visitorId);
      return visitor && visitor.organizationId === bucket.organizationId && visitor.locationId === bucket.locationId;
    }).length;

    rows.push({
      date: bucket.date,
      organizationId: bucket.organizationId,
      locationId: bucket.locationId,
      totalVisitors: bucket.visitors.length,
      avgDurationMin: Math.round(
        completedVisitors.reduce((sum, visitor) => sum + Number(visitor.durationMin || 0), 0) /
          (completedVisitors.length || 1),
      ),
      peakHour: peakHour ? `${String(peakHour[0]).padStart(2, '0')}:00` : null,
      topDestination: topDestination ? topDestination[0] : null,
      alertsCount,
    });
  });

  return rows;
}

async function loadStateFromDatabase() {
  const [
    organizations,
    locations,
    users,
    visitors,
    visitorPositions,
    mapNodes,
    mapEdges,
    alerts,
    faq,
    auditLog,
    notifications,
  ] = await Promise.all([
    query('SELECT * FROM organizations ORDER BY created_at DESC'),
    query('SELECT * FROM locations ORDER BY created_at DESC'),
    query('SELECT * FROM users ORDER BY name ASC'),
    query('SELECT * FROM visitors ORDER BY checkin_time DESC'),
    query('SELECT * FROM visitor_positions ORDER BY timestamp DESC'),
    query('SELECT * FROM map_nodes ORDER BY location_id ASC, id ASC'),
    query('SELECT * FROM map_edges ORDER BY location_id ASC, id ASC'),
    query('SELECT * FROM alerts ORDER BY triggered_at DESC'),
    query('SELECT * FROM chatbot_faq ORDER BY question ASC'),
    query('SELECT * FROM audit_log ORDER BY timestamp DESC'),
    query('SELECT * FROM notifications ORDER BY created_at DESC'),
  ]);

  const maps = {};

  locations.forEach((location) => {
    maps[location.id] = {
      floorplanImage: null,
      nodes: [],
      edges: [],
    };
  });

  mapNodes.forEach((row) => {
    maps[row.location_id] = maps[row.location_id] || { floorplanImage: null, nodes: [], edges: [] };

    if (row.id === '__floorplan__') {
      maps[row.location_id].floorplanImage = row.label || null;
      return;
    }

    maps[row.location_id].nodes.push({
      id: row.id,
      label: row.label,
      aliases: parseJson(row.aliases, []),
      type: row.type,
      zone: row.zone,
      x: Number(row.x),
      y: Number(row.y),
      floor: Number(row.floor || 1),
    });
  });

  mapEdges.forEach((row) => {
    maps[row.location_id] = maps[row.location_id] || { floorplanImage: null, nodes: [], edges: [] };
    maps[row.location_id].edges.push({
      id: row.id,
      from: row.from_node_id,
      to: row.to_node_id,
      distanceM: Number(row.distance_m),
      direction: row.direction,
      directionHint: row.direction_hint,
      isAccessible: Boolean(row.is_accessible),
    });
  });

  return ensureHydrated({
    organizations: organizations.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      contactEmail: row.contact_email || '',
      contactPhone: row.contact_phone || '',
      address: row.address || '',
      logoUrl: row.logo_url || null,
      status: row.status,
      createdAt: toIsoString(row.created_at),
      createdBy: row.created_by,
    })),
    locations: locations.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      address: row.address || '',
      floorCount: Number(row.floor_count || 1),
      description: row.description || '',
      status: row.status,
      qrCodeToken: row.qr_code_token,
      receptionistIds: parseJson(row.receptionist_ids, []),
      createdAt: toIsoString(row.created_at),
    })),
    users: users.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      organizationId: row.organization_id,
      locationId: row.location_id,
      permissions: parseJson(row.permissions, {}),
      status: row.status,
      lastLogin: toIsoString(row.last_login),
      createdBy: row.created_by,
    })),
    visitors: visitors.map((row) => ({
      id: row.id,
      name: row.name,
      idNumber: row.id_number || '',
      phone: row.phone || '',
      organizationId: row.organization_id,
      locationId: row.location_id,
      checkinTime: toIsoString(row.checkin_time),
      checkoutTime: toIsoString(row.checkout_time),
      status: row.status,
      destinationText: row.destination_text || '',
      destinationNodeId: row.destination_node_id,
      routeNodeIds: parseJson(row.route_node_ids, []),
      routeSteps: parseJson(row.route_steps, []),
      currentNodeId: row.current_node_id,
      lastPositionUpdateAt: toIsoString(row.last_position_update_at),
      source: row.source,
      hostName: row.host_name || '',
      language: row.language || 'en',
      durationMin: row.duration_min === null ? null : Number(row.duration_min),
      arrivedAt: toIsoString(row.arrived_at),
      departmentNotifiedAt: toIsoString(row.department_notified_at),
      departmentNotificationBy: row.department_notification_by,
      survey: parseJson(row.survey, null),
    })),
    visitorPositions: visitorPositions.map((row) => ({
      id: row.id,
      visitorId: row.visitor_id,
      zoneId: row.zone_id,
      nodeId: row.node_id,
      x: Number(row.x),
      y: Number(row.y),
      timestamp: toIsoString(row.timestamp),
      source: row.source,
    })),
    alerts: alerts.map((row) => ({
      id: row.id,
      visitorId: row.visitor_id,
      type: row.type,
      zoneId: row.zone_id,
      severity: row.severity,
      message: row.message,
      triggeredAt: toIsoString(row.triggered_at),
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: toIsoString(row.acknowledged_at),
      resolvedAt: toIsoString(row.resolved_at),
      ruleKey: row.rule_key,
    })),
    faq: faq.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      language: row.language,
      question: row.question,
      answer: row.answer,
      keywords: parseJson(row.keywords, []),
      hitCount: Number(row.hit_count || 0),
      createdBy: row.created_by,
    })),
    auditLog: auditLog.map((row) => ({
      id: row.id,
      userId: row.user_id,
      actorName: row.actor_name,
      actionType: row.action_type,
      targetType: row.target_type,
      targetId: row.target_id,
      details: row.details,
      ipAddress: row.ip_address,
      timestamp: toIsoString(row.timestamp),
    })),
    notifications: notifications.map((row) => ({
      id: row.id,
      type: row.type,
      visitorId: row.visitor_id,
      message: row.message,
      createdAt: toIsoString(row.created_at),
      createdBy: row.created_by,
    })),
    maps,
  });
}

async function clearTables(connection) {
  const tables = [
    'analytics_daily',
    'notifications',
    'audit_log',
    'alerts',
    'visitor_positions',
    'chatbot_faq',
    'map_edges',
    'map_nodes',
    'visitors',
    'users',
    'locations',
    'organizations',
  ];

  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await connection.query(`DELETE FROM ${table}`);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function persistState(state) {
  const nextState = ensureHydrated(state);

  await withTransaction(async (connection) => {
    await clearTables(connection);

    for (const organization of nextState.organizations) {
      await connection.query(
        `INSERT INTO organizations (
          id, name, description, contact_email, contact_phone, address, logo_url, status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          organization.id,
          organization.name,
          organization.description || '',
          organization.contactEmail || '',
          organization.contactPhone || '',
          organization.address || '',
          organization.logoUrl,
          organization.status,
          organization.createdBy,
          toSqlDateTime(organization.createdAt),
        ],
      );
    }

    for (const location of nextState.locations) {
      await connection.query(
        `INSERT INTO locations (
          id, organization_id, name, address, floor_count, description, status, qr_code_token, receptionist_ids, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          location.id,
          location.organizationId,
          location.name,
          location.address || '',
          Number(location.floorCount || 1),
          location.description || '',
          location.status,
          location.qrCodeToken,
          JSON.stringify(location.receptionistIds || []),
          toSqlDateTime(location.createdAt),
        ],
      );
    }

    for (const user of nextState.users) {
      await connection.query(
        `INSERT INTO users (
          id, name, email, password_hash, role, organization_id, location_id, permissions, status, last_login, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.name,
          user.email,
          user.passwordHash,
          user.role,
          user.organizationId,
          user.locationId,
          JSON.stringify(user.permissions || {}),
          user.status,
          toSqlDateTime(user.lastLogin),
          user.createdBy,
        ],
      );
    }

    for (const visitor of nextState.visitors) {
      await connection.query(
        `INSERT INTO visitors (
          id, name, id_number, phone, organization_id, location_id, checkin_time, checkout_time, status,
          destination_text, destination_node_id, route_node_ids, route_steps, current_node_id,
          last_position_update_at, source, host_name, language, duration_min, arrived_at,
          department_notified_at, department_notification_by, survey
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          visitor.id,
          visitor.name,
          visitor.idNumber || '',
          visitor.phone || '',
          visitor.organizationId,
          visitor.locationId,
          toSqlDateTime(visitor.checkinTime),
          toSqlDateTime(visitor.checkoutTime),
          visitor.status,
          visitor.destinationText || '',
          visitor.destinationNodeId,
          JSON.stringify(visitor.routeNodeIds || []),
          JSON.stringify(visitor.routeSteps || []),
          visitor.currentNodeId,
          toSqlDateTime(visitor.lastPositionUpdateAt),
          visitor.source,
          visitor.hostName || '',
          visitor.language || 'en',
          visitor.durationMin === null || visitor.durationMin === undefined ? null : Number(visitor.durationMin),
          toSqlDateTime(visitor.arrivedAt),
          toSqlDateTime(visitor.departmentNotifiedAt),
          visitor.departmentNotificationBy,
          visitor.survey ? JSON.stringify(visitor.survey) : null,
        ],
      );
    }

    for (const position of nextState.visitorPositions) {
      await connection.query(
        `INSERT INTO visitor_positions (
          id, visitor_id, zone_id, node_id, x, y, timestamp, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          position.id,
          position.visitorId,
          position.zoneId,
          position.nodeId,
          Number(position.x),
          Number(position.y),
          toSqlDateTime(position.timestamp),
          position.source,
        ],
      );
    }

    for (const [locationId, map] of Object.entries(nextState.maps || {})) {
      if (map.floorplanImage) {
        await connection.query(
          `INSERT INTO map_nodes (id, location_id, label, aliases, type, zone, x, y, floor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['__floorplan__', locationId, map.floorplanImage, JSON.stringify([]), 'floorplan', 'public', 0, 0, 1],
        );
      }

      for (const node of map.nodes || []) {
        await connection.query(
          `INSERT INTO map_nodes (id, location_id, label, aliases, type, zone, x, y, floor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            node.id,
            locationId,
            node.label,
            JSON.stringify(node.aliases || []),
            node.type,
            node.zone,
            Number(node.x),
            Number(node.y),
            Number(node.floor || 1),
          ],
        );
      }

      for (const edge of map.edges || []) {
        await connection.query(
          `INSERT INTO map_edges (
            id, location_id, from_node_id, to_node_id, distance_m, direction, direction_hint, is_accessible
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            edge.id,
            locationId,
            edge.from,
            edge.to,
            Number(edge.distanceM || 0),
            edge.direction || 'straight',
            edge.directionHint || '',
            edge.isAccessible ? 1 : 0,
          ],
        );
      }
    }

    for (const alert of nextState.alerts) {
      await connection.query(
        `INSERT INTO alerts (
          id, visitor_id, type, zone_id, severity, message, triggered_at, acknowledged_by, acknowledged_at, resolved_at, rule_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alert.id,
          alert.visitorId,
          alert.type,
          alert.zoneId,
          alert.severity,
          alert.message || '',
          toSqlDateTime(alert.triggeredAt),
          alert.acknowledgedBy,
          toSqlDateTime(alert.acknowledgedAt),
          toSqlDateTime(alert.resolvedAt),
          alert.ruleKey || null,
        ],
      );
    }

    for (const faqEntry of nextState.faq) {
      await connection.query(
        `INSERT INTO chatbot_faq (
          id, organization_id, language, question, answer, keywords, hit_count, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          faqEntry.id,
          faqEntry.organizationId,
          faqEntry.language,
          faqEntry.question,
          faqEntry.answer,
          JSON.stringify(faqEntry.keywords || []),
          Number(faqEntry.hitCount || 0),
          faqEntry.createdBy,
        ],
      );
    }

    for (const entry of nextState.auditLog) {
      await connection.query(
        `INSERT INTO audit_log (
          id, user_id, actor_name, action_type, target_type, target_id, details, ip_address, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.userId,
          entry.actorName,
          entry.actionType,
          entry.targetType,
          entry.targetId,
          entry.details || '',
          entry.ipAddress || '',
          toSqlDateTime(entry.timestamp),
        ],
      );
    }

    for (const notification of nextState.notifications || []) {
      await connection.query(
        `INSERT INTO notifications (
          id, type, visitor_id, message, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          notification.id,
          notification.type,
          notification.visitorId,
          notification.message,
          toSqlDateTime(notification.createdAt),
          notification.createdBy,
        ],
      );
    }

    const analyticsRows = buildAnalyticsRows(nextState);
    for (const row of analyticsRows) {
      await connection.query(
        `INSERT INTO analytics_daily (
          date, organization_id, location_id, total_visitors, avg_duration_min, peak_hour, top_destination, alerts_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.date,
          row.organizationId,
          row.locationId,
          row.totalVisitors,
          row.avgDurationMin,
          row.peakHour,
          row.topDestination,
          row.alertsCount,
        ],
      );
    }
  });

  stateCache = nextState;
  return stateCache;
}

async function initStore() {
  if (!initPromise) {
    initPromise = (async () => {
      await runMigrations();
      const [organizationCountRow] = await query('SELECT COUNT(*) AS total FROM organizations');

      if (Number(organizationCountRow.total) === 0) {
        await persistState(createSeedState());
      } else {
        const loadedState = await loadStateFromDatabase();
        const { state: cleanedState, changed: cleaned } = removeLegacyPartnerDefaults(loadedState);
        const { state: mergedState, changed } = mergeMissingSeedEntities(cleanedState);

        if (cleaned || changed) {
          await persistState(mergedState);
        } else {
          stateCache = mergedState;
        }
      }

      return stateCache;
    })();
  }

  return initPromise;
}

async function getState() {
  if (stateCache) {
    return stateCache;
  }

  return initStore();
}

async function setState(nextState) {
  return persistState(nextState);
}

async function mutateState(mutator) {
  const draft = clone(await getState());
  const result = (await mutator(draft)) || draft;
  return setState(result);
}

module.exports = {
  getState,
  initStore,
  mutateState,
  setState,
};
