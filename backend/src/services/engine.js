function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function minutesBetween(start, end = new Date().toISOString()) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function getLocationMap(state, locationId) {
  return state.maps[locationId] || { nodes: [], edges: [], floorplanImage: null };
}

function getNode(map, nodeId) {
  return map.nodes.find((node) => node.id === nodeId) || null;
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

function classifyDestination(map, text) {
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
      message: 'We could not find that destination. Please describe it differently or ask at the Reception desk.',
    };
  }

  const top = scoredNodes[0];
  const second = scoredNodes[1];

  if (top.confidence < 0.35) {
    return {
      status: 'retry',
      confidence: top.confidence,
      destinationNodeId: null,
      alternatives: scoredNodes.slice(0, 3),
      message: 'We could not find that destination. Please describe it differently or ask at the Reception desk.',
    };
  }

  if (top.confidence < 0.65 || (second && Math.abs(top.confidence - second.confidence) < 0.1)) {
    return {
      status: 'confirm',
      confidence: top.confidence,
      destinationNodeId: null,
      alternatives: scoredNodes.slice(0, 3),
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

const COMPASS_POINTS = [
  'north', 'north-east', 'east', 'south-east',
  'south', 'south-west', 'west', 'north-west',
];

// Compass bearing (clockwise from north) of the segment between two nodes,
// using their georeferenced schematic coordinates. Screen space has x growing
// east and y growing south, so north is -y.
function headingDeg(from, to) {
  const dx = Number(to.x) - Number(from.x);
  const dy = Number(to.y) - Number(from.y);
  if (dx === 0 && dy === 0) {
    return null;
  }
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) {
    deg += 360;
  }
  return deg;
}

function compassFromHeading(deg) {
  return COMPASS_POINTS[Math.round(deg / 45) % 8];
}

// Signed turn from one heading to the next, normalized to (-180, 180].
// Positive means a clockwise (right) turn, negative a left turn.
function turnDelta(prevHeading, nextHeading) {
  let delta = nextHeading - prevHeading;
  while (delta > 180) {
    delta -= 360;
  }
  while (delta <= -180) {
    delta += 360;
  }
  return delta;
}

function classifyTurn(delta) {
  const magnitude = Math.abs(delta);
  const side = delta > 0 ? 'right' : 'left';

  if (magnitude < 25) {
    return { direction: 'straight', verb: 'continue straight' };
  }
  if (magnitude < 60) {
    return { direction: side, verb: `bear ${side}` };
  }
  if (magnitude < 150) {
    return { direction: side, verb: `turn ${side}` };
  }
  return { direction: side, verb: 'make a U-turn' };
}

function buildInstruction({ isFirst, isLast, currentLabel, nextLabel, compass, turn }) {
  if (isFirst || !turn) {
    const heading = compass ? `${compass} ` : '';
    return `Head ${heading}from ${currentLabel} to ${nextLabel}.`;
  }
  if (turn.direction === 'straight') {
    return isLast
      ? `Continue straight to arrive at ${nextLabel}.`
      : `Continue straight toward ${nextLabel}.`;
  }
  return isLast
    ? `At ${currentLabel}, ${turn.verb} to arrive at ${nextLabel}.`
    : `At ${currentLabel}, ${turn.verb} toward ${nextLabel}.`;
}

function calculateRoute(map, fromNodeId, toNodeId) {
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
  let prevHeading = null;

  for (let index = 0; index < path.length - 1; index += 1) {
    const currentId = path[index];
    const nextId = path[index + 1];
    const edge = map.edges.find(
      (candidate) =>
        (candidate.from === currentId && candidate.to === nextId) ||
        (candidate.from === nextId && candidate.to === currentId),
    );
    const currentNode = getNode(map, currentId);
    const nextNode = getNode(map, nextId);

    if (!edge || !currentNode || !nextNode) {
      continue;
    }

    // Derive the instruction from the real georeferenced positions of the
    // nodes rather than a static hint, so each leg reflects the actual
    // heading and turn taken on the ground.
    const heading = headingDeg(currentNode, nextNode);
    const effectiveHeading = heading === null ? prevHeading : heading;
    const isFirst = prevHeading === null;
    const isLast = nextId === toNodeId;
    const turn =
      isFirst || prevHeading === null || effectiveHeading === null
        ? null
        : classifyTurn(turnDelta(prevHeading, effectiveHeading));

    const instruction = buildInstruction({
      isFirst,
      isLast,
      currentLabel: currentNode.label,
      nextLabel: nextNode.label,
      compass: effectiveHeading === null ? null : compassFromHeading(effectiveHeading),
      turn,
    });

    totalDistanceM += Number(edge.distanceM || 0);
    steps.push({
      step: index + 1,
      nodeId: nextId,
      instruction,
      distanceM: Number(edge.distanceM || 0),
      direction: turn ? turn.direction : 'straight',
    });

    if (effectiveHeading !== null) {
      prevHeading = effectiveHeading;
    }
  }

  return {
    pathNodeIds: path,
    steps,
    totalDistanceM,
    estimatedTimeMin: Math.max(1, Math.ceil(totalDistanceM / 45)),
  };
}

const FAQ_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'did',
  'for', 'from', 'go', 'have', 'has', 'how', 'i', 'in', 'is', 'it', 'me', 'my',
  'of', 'on', 'or', 'please', 'the', 'there', 'this', 'to', 'was', 'we', 'were',
  'what', 'when', 'where', 'who', 'why', 'will', 'with', 'you', 'your',
]);

function tokenScore(left, right) {
  const leftTokens = normalizeText(left).split(' ').filter((t) => t && !FAQ_STOPWORDS.has(t));
  const rightTokens = normalizeText(right).split(' ').filter((t) => t && !FAQ_STOPWORDS.has(t));

  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const shared = rightTokens.filter((token) => leftTokens.includes(token));
  if (!shared.length) {
    return 0;
  }

  return shared.length / new Set([...leftTokens, ...rightTokens]).size;
}

function queryFaq(state, organizationId, query) {
  const scopedFaqs = state.faq.filter(
    (entry) => !entry.organizationId || entry.organizationId === organizationId,
  );

  const match = scopedFaqs
    .map((entry) => ({
      entry,
      score: Math.max(tokenScore(query, entry.question), tokenScore(query, (entry.keywords || []).join(' '))),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!match || match.score < 0.15) {
    return {
      answer: null,
      fallback: 'I am not sure. Please ask at the Reception desk.',
      confidence: 0.31,
    };
  }

  return {
    answer: match.entry.answer,
    confidence: Number(Math.min(0.96, 0.6 + match.score).toFixed(2)),
    faqId: match.entry.id,
  };
}

function appendAuditEntry(state, entry) {
  const nextState = clone(state);
  nextState.auditLog.unshift({
    id: createId('audit'),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  return nextState;
}

function refreshAlerts(state, nowIso = new Date().toISOString()) {
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

    if (currentNode && currentNode.zone === 'restricted') {
      ruleCandidates.push({
        type: 'RESTRICTED_ZONE',
        severity: 'high',
        message: `${visitor.name} entered ${currentNode.label}.`,
      });
    }

    if (idleMinutes > 25 && currentNode && currentNode.zone !== 'waiting') {
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
      const ruleKey = `${visitor.id}:${candidate.type}`;
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
    const visitor = nextState.visitors.find((entry) => entry.id === alert.visitorId);
    if (!visitor || visitor.status !== 'active') {
      return alert.resolvedAt ? alert : { ...alert, resolvedAt: nowIso };
    }

    if (alert.type === 'RESTRICTED_ZONE') {
      const map = getLocationMap(nextState, visitor.locationId);
      const node = getNode(map, visitor.currentNodeId);
      if (!node || node.zone !== 'restricted') {
        return { ...alert, resolvedAt: nowIso };
      }
    }

    return alert;
  });

  return nextState;
}

module.exports = {
  appendAuditEntry,
  calculateRoute,
  classifyDestination,
  createId,
  getLocationMap,
  getNode,
  minutesBetween,
  normalizeText,
  queryFaq,
  refreshAlerts,
};
