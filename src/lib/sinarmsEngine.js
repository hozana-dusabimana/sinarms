const NAVIGATION_KEYWORDS = [
  'go',
  'find',
  'route',
  'navigate',
  'direction',
  'office',
  'department',
  'manager',
  'meet',
  'see',
  'where is',
  'how do i get',
  'kwerekeza',
  'ndashaka',
  'njya',
  'ou',
  'aller',
  'bureau',
];

const FAQ_FALLBACK = 'I am not sure about that. Please ask at the Reception desk.';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDurationMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 min';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function minutesBetween(start, end = new Date().toISOString()) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function getLocationMap(state, locationId) {
  return state.maps[locationId] || { nodes: [], edges: [], floorplanImage: null };
}

export function getNode(map, nodeId) {
  return map.nodes.find((node) => node.id === nodeId) || null;
}

export function getLocationById(state, locationId) {
  return state.locations.find((location) => location.id === locationId) || null;
}

export function getOrganizationById(state, organizationId) {
  return state.organizations.find((organization) => organization.id === organizationId) || null;
}

export function getUserById(state, userId) {
  return state.users.find((user) => user.id === userId) || null;
}

export function getVisitorById(state, visitorId) {
  return state.visitors.find((visitor) => visitor.id === visitorId) || null;
}

export function inferLanguageLabel(code) {
  if (code === 'fr') return 'Français';
  if (code === 'rw') return 'Kinyarwanda';
  return 'English';
}

function scoreAliasMatch(text, alias) {
  const normalizedText = normalizeText(text);
  const normalizedAlias = normalizeText(alias);

  if (!normalizedText || !normalizedAlias) {
    return 0;
  }

  if (normalizedText === normalizedAlias) {
    return 1;
  }

  if (normalizedText.includes(normalizedAlias)) {
    return Math.min(0.95, 0.7 + normalizedAlias.length / 100);
  }

  const textTokens = normalizedText.split(' ');
  const aliasTokens = normalizedAlias.split(' ');
  const sharedTokens = aliasTokens.filter((token) => textTokens.includes(token));

  if (!sharedTokens.length) {
    return 0;
  }

  return Math.min(0.89, (sharedTokens.length / aliasTokens.length) * 0.75);
}

export function classifyDestination({ map, text }) {
  const nodes = map.nodes.filter((node) => node.type !== 'exit' && node.type !== 'checkpoint');
  const scoredNodes = nodes
    .map((node) => {
      const aliases = [node.label, ...(node.aliases || [])];
      const score = aliases.reduce((best, alias) => Math.max(best, scoreAliasMatch(text, alias)), 0);
      return {
        nodeId: node.id,
        label: node.label,
        confidence: Number(score.toFixed(2)),
      };
    })
    .filter((entry) => entry.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);

  if (!scoredNodes.length) {
    return {
      status: 'retry',
      confidence: 0.21,
      destinationNodeId: null,
      alternatives: [],
      message: 'We could not find that location. Please describe it differently or ask at the Reception desk.',
    };
  }

  const top = scoredNodes[0];
  const second = scoredNodes[1];

  if (top.confidence < 0.5) {
    return {
      status: 'retry',
      confidence: top.confidence,
      destinationNodeId: null,
      alternatives: scoredNodes.slice(0, 2),
      message: 'We could not find that location. Please describe it differently or ask at the Reception desk.',
    };
  }

  if (top.confidence < 0.8 || (second && Math.abs(top.confidence - second.confidence) < 0.15)) {
    return {
      status: 'confirm',
      confidence: top.confidence,
      destinationNodeId: null,
      alternatives: scoredNodes.slice(0, 2),
      message: 'Did you mean one of these destinations?',
    };
  }

  return {
    status: 'resolved',
    confidence: top.confidence,
    destinationNodeId: top.nodeId,
    alternatives: second ? [second] : [],
    message: 'Destination recognized.',
  };
}

export function calculateRoute({ map, fromNodeId, toNodeId }) {
  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set(map.nodes.map((node) => node.id));

  map.nodes.forEach((node) => distances.set(node.id, Infinity));
  distances.set(fromNodeId, 0);

  while (unvisited.size) {
    let currentNodeId = null;
    let shortestDistance = Infinity;

    unvisited.forEach((nodeId) => {
      const candidateDistance = distances.get(nodeId);
      if (candidateDistance < shortestDistance) {
        shortestDistance = candidateDistance;
        currentNodeId = nodeId;
      }
    });

    if (!currentNodeId || currentNodeId === toNodeId) {
      break;
    }

    unvisited.delete(currentNodeId);

    map.edges.forEach((edge) => {
      if (![edge.from, edge.to].includes(currentNodeId)) {
        return;
      }

      const neighborId = edge.from === currentNodeId ? edge.to : edge.from;
      if (!unvisited.has(neighborId)) {
        return;
      }

      const nextDistance = distances.get(currentNodeId) + Number(edge.distanceM || 1);
      if (nextDistance < distances.get(neighborId)) {
        distances.set(neighborId, nextDistance);
        previous.set(neighborId, currentNodeId);
      }
    });
  }

  const path = [];
  let cursor = toNodeId;

  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(cursor);
    if (cursor === fromNodeId) {
      path.unshift(cursor);
      break;
    }
  }

  if (!path.length || path[0] !== fromNodeId) {
    return {
      pathNodeIds: [fromNodeId],
      steps: [],
      totalDistanceM: 0,
      estimatedTimeMin: 0,
    };
  }

  const steps = [];
  let totalDistanceM = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const currentId = path[index];
    const nextId = path[index + 1];
    const edge = map.edges.find(
      (candidate) =>
        (candidate.from === currentId && candidate.to === nextId) ||
        (candidate.from === nextId && candidate.to === currentId),
    );
    const nextNode = getNode(map, nextId);

    if (!edge || !nextNode) {
      continue;
    }

    totalDistanceM += Number(edge.distanceM || 0);
    steps.push({
      step: index + 1,
      nodeId: nextId,
      instruction: edge.directionHint || `Continue to ${nextNode.label}.`,
      distanceM: Number(edge.distanceM || 0),
      direction: edge.direction || 'straight',
    });
  }

  return {
    pathNodeIds: path,
    steps,
    totalDistanceM,
    estimatedTimeMin: Math.max(1, Math.ceil(totalDistanceM / 45)),
  };
}

export function isNavigationQuery(query) {
  const normalized = normalizeText(query);
  return NAVIGATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function tokenScore(left, right) {
  const leftTokens = normalizeText(left).split(' ').filter(Boolean);
  const rightTokens = normalizeText(right).split(' ').filter(Boolean);

  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const shared = rightTokens.filter((token) => leftTokens.includes(token));
  if (!shared.length) {
    return 0;
  }

  return shared.length / new Set([...leftTokens, ...rightTokens]).size;
}

export function queryChatbot({ state, organizationId, locationId, query }) {
  const map = getLocationMap(state, locationId);

  if (isNavigationQuery(query)) {
    const classification = classifyDestination({ map, text: query });
    if (classification.destinationNodeId) {
      const node = getNode(map, classification.destinationNodeId);
      return {
        type: 'navigation',
        answer: `Head toward ${node?.label || 'your destination'}. Follow the highlighted route on the map.`,
        confidence: classification.confidence,
      };
    }
  }

  const scopedFaqs = state.faq.filter(
    (entry) => !entry.organizationId || entry.organizationId === organizationId,
  );

  const match = scopedFaqs
    .map((entry) => ({
      entry,
      score: Math.max(tokenScore(query, entry.question), tokenScore(query, entry.keywords?.join(' ') || '')),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!match || match.score < 0.15) {
    return {
      type: 'faq',
      answer: FAQ_FALLBACK,
      confidence: 0.31,
    };
  }

  return {
    type: 'faq',
    answer: match.entry.answer,
    confidence: Number(Math.min(0.96, 0.6 + match.score).toFixed(2)),
    faqId: match.entry.id,
  };
}

export function scopeUsers(users, currentUser) {
  if (!currentUser) {
    return [];
  }

  if (currentUser.role === 'admin') {
    return users;
  }

  return users.filter((user) => user.id === currentUser.id);
}

export function scopeVisitors(state, currentUser, filters = {}) {
  const visitors = [...state.visitors];
  const { status, includeHistory = true, organizationId, locationId } = filters;

  return visitors.filter((visitor) => {
    if (status && visitor.status !== status) {
      return false;
    }

    if (!includeHistory && visitor.status !== 'active') {
      return false;
    }

    if (organizationId && visitor.organizationId !== organizationId) {
      return false;
    }

    if (locationId && visitor.locationId !== locationId) {
      return false;
    }

    if (!currentUser || currentUser.role === 'admin') {
      return true;
    }

    const sameOrg = visitor.organizationId === currentUser.organizationId;
    const sameLocation = visitor.locationId === currentUser.locationId;
    const sameDay = new Date(visitor.checkinTime).toDateString() === new Date().toDateString();

    return sameOrg && sameLocation && sameDay;
  });
}

function buildAlertId(visitorId, type) {
  return `${visitorId}:${type}`;
}

export function refreshAlerts(state, nowIso = new Date().toISOString()) {
  const nextState = clone(state);
  const activeAlerts = nextState.alerts.filter((alert) => !alert.resolvedAt);
  const activeAlertIds = new Set(activeAlerts.map((alert) => alert.ruleKey));

  nextState.visitors.forEach((visitor) => {
    if (visitor.status !== 'active') {
      return;
    }

    const map = getLocationMap(nextState, visitor.locationId);
    const currentNode = getNode(map, visitor.currentNodeId);
    const durationMin = minutesBetween(visitor.checkinTime, nowIso);
    const idleMinutes = minutesBetween(visitor.lastPositionUpdateAt || visitor.checkinTime, nowIso);
    const ruleCandidates = [];

    if (currentNode?.zone === 'restricted') {
      ruleCandidates.push({
        type: 'RESTRICTED_ZONE',
        severity: 'high',
        message: `${visitor.name} entered ${currentNode.label}.`,
      });
    }

    if (idleMinutes > 25 && currentNode?.zone !== 'waiting') {
      ruleCandidates.push({
        type: 'IDLE_TIMEOUT',
        severity: 'medium',
        message: `${visitor.name} has been idle for ${idleMinutes} minutes.`,
      });
    }

    if (durationMin > 180) {
      ruleCandidates.push({
        type: 'LONG_STAY',
        severity: 'low',
        message: `${visitor.name} has been active for over 3 hours.`,
      });
    }

    if (durationMin > 10 && visitor.currentNodeId === 'entrance') {
      ruleCandidates.push({
        type: 'NO_SHOW',
        severity: 'low',
        message: `${visitor.name} is still near the entrance.`,
      });
    }

    ruleCandidates.forEach((candidate) => {
      const ruleKey = buildAlertId(visitor.id, candidate.type);
      if (activeAlertIds.has(ruleKey)) {
        return;
      }

      nextState.alerts.unshift({
        id: createId('alert'),
        visitorId: visitor.id,
        type: candidate.type,
        severity: candidate.severity,
        zoneId: visitor.currentNodeId,
        message: candidate.message,
        triggeredAt: nowIso,
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedAt: null,
        ruleKey,
      });
      activeAlertIds.add(ruleKey);
    });
  });

  nextState.alerts = nextState.alerts.map((alert) => {
    const visitor = getVisitorById(nextState, alert.visitorId);
    if (!visitor || visitor.status !== 'active') {
      return alert.resolvedAt ? alert : { ...alert, resolvedAt: nowIso };
    }

    if (alert.type === 'RESTRICTED_ZONE') {
      const map = getLocationMap(nextState, visitor.locationId);
      const node = getNode(map, visitor.currentNodeId);
      if (node?.zone !== 'restricted') {
        return { ...alert, resolvedAt: nowIso };
      }
    }

    return alert;
  });

  return nextState;
}

export function appendAuditEntry(state, entry) {
  const nextState = clone(state);
  nextState.auditLog.unshift({
    id: createId('audit'),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  return nextState;
}

export function scopeAlerts(state, currentUser) {
  return state.alerts.filter((alert) => {
    const visitor = getVisitorById(state, alert.visitorId);
    if (!visitor) {
      return false;
    }

    if (!currentUser || currentUser.role === 'admin') {
      return !alert.resolvedAt;
    }

    return (
      visitor.organizationId === currentUser.organizationId &&
      visitor.locationId === currentUser.locationId &&
      !alert.resolvedAt
    );
  });
}

export function buildPseudoQrSvg(content) {
  const normalized = slugify(content);
  const cells = [];
  const size = 21;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const seedIndex = (row * size + col) % normalized.length;
      const charCode = normalized.charCodeAt(seedIndex) || 97;
      const isDark = (charCode + row * 7 + col * 11) % 5 < 2;
      const isFinder =
        (row < 7 && col < 7) ||
        (row < 7 && col > size - 8) ||
        (row > size - 8 && col < 7);

      if (isDark || isFinder) {
        cells.push(
          `<rect x="${col * 8}" y="${row * 8}" width="8" height="8" fill="${isFinder ? '#0f172a' : '#cd5c5c'}" />`,
        );
      }
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="300" viewBox="0 0 240 300">
      <rect width="240" height="300" rx="24" fill="#ffffff" />
      <rect x="24" y="24" width="192" height="192" rx="18" fill="#f8fafc" stroke="#e2e8f0" />
      <g transform="translate(36, 36)">
        ${cells.join('')}
      </g>
      <text x="120" y="246" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="#0f172a">SINARMS</text>
      <text x="120" y="272" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" fill="#64748b">${content}</text>
    </svg>
  `.trim();
}

export function downloadTextFile(filename, contents, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, rows) {
  if (!rows.length) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  rows.forEach((row) => {
    const values = headers.map((header) => {
      const rawValue = row[header] ?? '';
      const safeValue = String(rawValue).replace(/"/g, '""');
      return `"${safeValue}"`;
    });
    lines.push(values.join(','));
  });

  downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
}

export function buildAnalytics(state, filters = {}) {
  const now = new Date();
  const visitors = state.visitors.filter((visitor) => {
    if (filters.organizationId && visitor.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.locationId && visitor.locationId !== filters.locationId) {
      return false;
    }

    return true;
  });

  const activeVisitors = visitors.filter((visitor) => visitor.status === 'active');
  const completedVisitors = visitors.filter((visitor) => visitor.status === 'exited');
  const avgDuration =
    completedVisitors.reduce((sum, visitor) => sum + Number(visitor.durationMin || 0), 0) /
    (completedVisitors.length || 1);

  const arrivalsByHour = Array.from({ length: 12 }).map((_, offset) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (11 - offset));
    const label = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const total = visitors.filter(
      (visitor) => new Date(visitor.checkinTime).toDateString() === date.toDateString(),
    ).length;
    return { label, total };
  });

  const destinationCounts = {};
  visitors.forEach((visitor) => {
    const map = getLocationMap(state, visitor.locationId);
    const node = getNode(map, visitor.destinationNodeId);
    const label = node?.label || visitor.destinationNodeId;
    destinationCounts[label] = (destinationCounts[label] || 0) + 1;
  });

  const topDestinations = Object.entries(destinationCounts)
    .map(([label, total]) => ({ label, total }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 5);

  const peakHours = Array.from({ length: 8 }).map((_, index) => {
    const hour = 9 + index;
    const total = visitors.filter((visitor) => new Date(visitor.checkinTime).getHours() === hour).length;
    return { hour: `${String(hour).padStart(2, '0')}:00`, total };
  });

  return {
    totalVisitors: visitors.length,
    activeVisitors: activeVisitors.length,
    averageDuration: Math.round(avgDuration || 0),
    alertsToday: state.alerts.filter(
      (alert) => new Date(alert.triggeredAt).toDateString() === now.toDateString(),
    ).length,
    arrivalsByDay: arrivalsByHour,
    topDestinations,
    peakHours,
  };
}
