const bcrypt = require('bcryptjs');

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

const adminPermissions = {
  viewLiveMap: true,
  manualRegister: true,
  manualCheckout: true,
  viewAlerts: true,
  notifyDepartment: true,
  analytics: true,
  exportData: true,
  manageFaq: true,
  manageUsers: true,
  manageOrganizations: true,
  manageLocations: true,
  editMap: true,
  viewAuditLog: true,
};

const receptionistPermissions = {
  viewLiveMap: true,
  manualRegister: true,
  manualCheckout: true,
  viewAlerts: true,
  notifyDepartment: true,
  analytics: false,
  exportData: false,
  manageFaq: false,
  manageUsers: false,
  manageOrganizations: false,
  manageLocations: false,
  editMap: false,
  viewAuditLog: false,
};

// Converts (x%, y%) layout to real lat/lng around a building footprint.
// The x/y values in nodes are percentages (0-100) of a rectangular site;
// origin.widthM/heightM map that rectangle onto meters on the ground,
// so each node gets a realistic lat/lng for Leaflet/OSM.
function attachGeo(mapDef, origin) {
  const { baseLat, baseLng, widthM, heightM } = origin;
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((baseLat * Math.PI) / 180);

  function toLatLng(x, y) {
    const dxM = ((x - 50) / 100) * widthM;
    const dyM = ((50 - y) / 100) * heightM; // screen y grows downward; north = lower y
    return {
      lat: baseLat + dyM / mPerDegLat,
      lng: baseLng + dxM / mPerDegLng,
    };
  }

  const nodes = mapDef.nodes.map((node) => {
    const { lat, lng } = toLatLng(node.x, node.y);
    return { ...node, lat, lng };
  });

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const edges = mapDef.edges.map((edge) => {
    const from = nodeById[edge.from];
    const to = nodeById[edge.to];
    if (!from || !to) return edge;
    return {
      ...edge,
      gpsTrail: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
    };
  });

  return { ...mapDef, origin, nodes, edges };
}

function createSeedState() {
  const orgRuliba = 'org-ruliba';
  const locMain = 'loc-ruliba-main';

  return {
    organizations: [
      {
        id: orgRuliba,
        name: 'Ruliba Clays Ltd',
        description: 'Clay construction-materials manufacturer based on the Kigali–Huye road, near the Nyabarongo river.',
        contactEmail: 'hello@ruliba.rw',
        contactPhone: '+250 788 000 001',
        address: 'BP 1275, Nyarugenge, Kigali, Rwanda',
        logoUrl: null,
        status: 'active',
        createdAt: hoursAgo(720),
        createdBy: 'user-admin-1',
      },
    ],
    locations: [
      {
        id: locMain,
        organizationId: orgRuliba,
        name: 'Ruliba Clays - Main Site',
        address: 'Ruliba, Kigali (15 km from town centre, Kigali–Huye road)',
        floorCount: 1,
        description: 'Single Ruliba Clays campus combining Block A (administrative offices), Block B (operations & support), the Industry Area and the Stock / Warehouse Area.',
        status: 'active',
        qrCodeToken: 'SINARMS-RULIBA-MAIN',
        receptionistIds: ['user-rec-1'],
        createdAt: hoursAgo(700),
      },
    ],
    users: [
      {
        id: 'user-admin-1',
        name: 'Alice Mutoni',
        email: 'admin@ruliba.rw',
        passwordHash: bcrypt.hashSync('Admin123!', 10),
        role: 'admin',
        organizationId: orgRuliba,
        locationId: null,
        permissions: adminPermissions,
        status: 'active',
        lastLogin: minutesAgo(90),
        createdBy: 'system',
      },
      {
        id: 'user-rec-1',
        name: 'Jean Paul',
        email: 'reception@ruliba.rw',
        passwordHash: bcrypt.hashSync('Reception123!', 10),
        role: 'receptionist',
        organizationId: orgRuliba,
        locationId: locMain,
        permissions: receptionistPermissions,
        status: 'active',
        lastLogin: minutesAgo(35),
        createdBy: 'user-admin-1',
      },
    ],
    visitors: [
      {
        id: 'visitor-jean-bosco',
        name: 'Jean Bosco',
        idNumber: '11998822',
        phone: '0788000002',
        organizationId: orgRuliba,
        locationId: locMain,
        checkinTime: minutesAgo(18),
        checkoutTime: null,
        status: 'active',
        destinationText: 'Plant Director Office',
        destinationNodeId: 'plant-director-office',
        routeNodeIds: ['entrance', 'reception', 'block-a-corridor', 'plant-director-office'],
        routeSteps: [],
        currentNodeId: 'block-a-corridor',
        lastPositionUpdateAt: minutesAgo(1),
        source: 'self',
        hostName: 'Plant Director',
        language: 'en',
        durationMin: null,
        arrivedAt: null,
        departmentNotifiedAt: null,
        departmentNotificationBy: null,
        survey: null,
      },
      {
        id: 'visitor-marie-claire',
        name: 'Marie Claire',
        idNumber: '070200330',
        phone: '0788000003',
        organizationId: orgRuliba,
        locationId: locMain,
        checkinTime: minutesAgo(31),
        checkoutTime: null,
        status: 'active',
        destinationText: 'General Offices',
        destinationNodeId: 'general-offices',
        routeNodeIds: ['entrance', 'reception', 'block-b-corridor', 'general-offices'],
        routeSteps: [],
        currentNodeId: 'block-b-corridor',
        lastPositionUpdateAt: minutesAgo(27),
        source: 'manual',
        hostName: 'General Offices',
        language: 'fr',
        durationMin: null,
        arrivedAt: null,
        departmentNotifiedAt: null,
        departmentNotificationBy: null,
        survey: null,
      },
    ],
    visitorPositions: [
      {
        id: 'pos-1',
        visitorId: 'visitor-jean-bosco',
        zoneId: 'block-a-corridor',
        nodeId: 'block-a-corridor',
        x: 22,
        y: 55,
        timestamp: minutesAgo(1),
        source: 'wifi',
      },
      {
        id: 'pos-2',
        visitorId: 'visitor-marie-claire',
        zoneId: 'block-b-corridor',
        nodeId: 'block-b-corridor',
        x: 40,
        y: 55,
        timestamp: minutesAgo(27),
        source: 'wifi',
      },
    ],
    alerts: [
      {
        id: 'alert-seeded-1',
        visitorId: 'visitor-marie-claire',
        type: 'IDLE_TIMEOUT',
        severity: 'medium',
        zoneId: 'block-b-corridor',
        message: 'Marie Claire has been idle for 27 minutes.',
        triggeredAt: minutesAgo(3),
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedAt: null,
        ruleKey: 'visitor-marie-claire:IDLE_TIMEOUT',
      },
    ],
    faq: [
      {
        id: 'faq-1',
        organizationId: null,
        language: 'en',
        question: 'Where is the nearest bathroom?',
        answer: 'The nearest bathroom is at the end of the main corridor beside the fire exit sign.',
        keywords: ['bathroom', 'toilet', 'restroom'],
        hitCount: 142,
        createdBy: 'user-admin-1',
      },
      {
        id: 'faq-2',
        organizationId: orgRuliba,
        language: 'en',
        question: 'Is there visitor parking?',
        answer: 'Yes. Visitor parking is available near the main gate before security.',
        keywords: ['parking', 'car park', 'vehicle'],
        hitCount: 89,
        createdBy: 'user-admin-1',
      },
    ],
    auditLog: [
      {
        id: 'audit-1',
        userId: 'user-admin-1',
        actorName: 'Alice Mutoni',
        actionType: 'CREATE_USER',
        targetType: 'user',
        targetId: 'user-rec-1',
        details: 'Created receptionist account Jean Paul for Ruliba Clays main reception.',
        ipAddress: '10.0.0.45',
        timestamp: hoursAgo(28),
      },
    ],
    notifications: [],
    // Single Ruliba Clays campus combining all the offices documented in the
    // operational survey (see ai/README.md): Block A (administrative), Block
    // B (operations & support), Industry Area, Stock / Warehouse Area, plus
    // shared facilities (Restaurant, Toilets). Coordinates are anchored on
    // the real Ruliba Clays GPS (Kigali–Huye road, near the Nyabarongo
    // river) and the layout uses a 140 m × 110 m site footprint.
    maps: {
      [locMain]: attachGeo({
        floorplanImage: null,
        nodes: [
          // Site spine (entrance → reception → corridors → exit)
          { id: 'entrance', label: 'Main Entrance', aliases: ['entrance', 'main gate', 'site entrance', 'irembo'], type: 'checkpoint', zone: 'public', x: 4, y: 55, floor: 1 },
          { id: 'reception', label: 'Reception', aliases: ['reception desk', 'front desk', 'accueil', 'akira abashyitsi'], type: 'office', zone: 'public', x: 12, y: 55, floor: 1 },
          { id: 'block-a-corridor', label: 'Block A Corridor', aliases: ['block a', 'block a corridor', 'administrative block', 'customer service block'], type: 'corridor', zone: 'public', x: 22, y: 55, floor: 1 },
          { id: 'block-b-corridor', label: 'Block B Corridor', aliases: ['block b', 'block b corridor', 'operational block', 'support offices block'], type: 'corridor', zone: 'public', x: 42, y: 55, floor: 1 },
          { id: 'industry-area', label: 'Industry Area', aliases: ['industry area', 'industrial operations', 'technical supervision', 'production area'], type: 'corridor', zone: 'public', x: 64, y: 55, floor: 1 },
          { id: 'stock-area', label: 'Stock / Warehouse Area', aliases: ['stock area', 'warehouse', 'stock warehouse area', 'ububiko'], type: 'office', zone: 'restricted', x: 84, y: 55, floor: 1 },
          { id: 'exit', label: 'Site Exit', aliases: ['exit', 'gate out', 'site exit'], type: 'exit', zone: 'emergency', x: 96, y: 55, floor: 1 },

          // Block A - Administrative & Customer Service Offices
          { id: 'md-office', label: 'Managing Director Office', aliases: ['managing director office', 'md office', 'director office', 'umuyobozi mukuru'], type: 'office', zone: 'public', x: 18, y: 28, floor: 1 },
          { id: 'plant-director-office', label: 'Plant Director Office', aliases: ['plant director office', 'director plant office'], type: 'office', zone: 'public', x: 26, y: 28, floor: 1 },
          { id: 'sales-office', label: 'Sales Office', aliases: ['sales office', 'commercial office', 'bureau des ventes'], type: 'office', zone: 'public', x: 26, y: 42, floor: 1 },

          // Block B - Operational & Support Offices
          { id: 'plant-manager-office', label: 'Plant Manager Office', aliases: ['plant manager office', 'manager office'], type: 'office', zone: 'public', x: 38, y: 32, floor: 1 },
          { id: 'plant-manager-secretary', label: 'Secretary to the Plant Manager', aliases: ['secretary to the plant manager', 'plant manager secretary', 'umunyamabanga'], type: 'office', zone: 'public', x: 46, y: 32, floor: 1 },
          { id: 'chief-maintenance-office', label: 'Chief of Maintenance Office', aliases: ['chief of maintenance office', 'maintenance chief office'], type: 'office', zone: 'public', x: 54, y: 32, floor: 1 },
          { id: 'maintenance-coordinator-office', label: 'Maintenance Coordinator Office', aliases: ['maintenance coordinator office', 'maintenance coordination'], type: 'office', zone: 'public', x: 38, y: 70, floor: 1 },
          { id: 'stock-office', label: 'Stock Office', aliases: ['stock office', 'inventory office', 'stock records'], type: 'office', zone: 'public', x: 46, y: 70, floor: 1 },
          { id: 'first-aid-office', label: 'First Aid Office', aliases: ['first aid office', 'clinic', 'medical room', 'ivuriro'], type: 'office', zone: 'public', x: 38, y: 82, floor: 1 },
          { id: 'general-offices', label: 'General Offices', aliases: ['general offices', 'general office'], type: 'office', zone: 'public', x: 46, y: 82, floor: 1 },

          // Industry Area
          { id: 'maintenance-supervisor-office', label: 'Maintenance Supervisor Office', aliases: ['maintenance supervisor office', 'supervisor office'], type: 'office', zone: 'public', x: 64, y: 78, floor: 1 },

          // Other Facilities
          { id: 'restaurant', label: 'Restaurant', aliases: ['cafeteria', 'canteen', 'restaurant', 'resitora'], type: 'office', zone: 'public', x: 76, y: 32, floor: 1 },
          { id: 'toilets', label: 'Toilets', aliases: ['toilets', 'toilet', 'restroom', 'bathroom', 'wc', 'umusarani'], type: 'office', zone: 'public', x: 76, y: 78, floor: 1 },
        ],
        edges: [
          // Spine: entrance → reception → block A → block B → industry → stock → exit
          { id: 'edge-spine-1', from: 'entrance', to: 'reception', distanceM: 11, direction: 'straight', directionHint: 'Walk straight from the entrance to Reception.', isAccessible: true },
          { id: 'edge-spine-2', from: 'reception', to: 'block-a-corridor', distanceM: 14, direction: 'straight', directionHint: 'Continue straight into the Block A corridor.', isAccessible: true },
          { id: 'edge-spine-3', from: 'block-a-corridor', to: 'block-b-corridor', distanceM: 28, direction: 'straight', directionHint: 'Walk along the corridor to Block B.', isAccessible: true },
          { id: 'edge-spine-4', from: 'block-b-corridor', to: 'industry-area', distanceM: 31, direction: 'straight', directionHint: 'Continue toward the Industry Area.', isAccessible: true },
          { id: 'edge-spine-5', from: 'industry-area', to: 'stock-area', distanceM: 28, direction: 'straight', directionHint: 'Proceed to the Stock / Warehouse Area.', isAccessible: false },
          { id: 'edge-spine-6', from: 'stock-area', to: 'exit', distanceM: 17, direction: 'straight', directionHint: 'Head to the Site Exit.', isAccessible: true },

          // Block A spurs
          { id: 'edge-a-md', from: 'block-a-corridor', to: 'md-office', distanceM: 30, direction: 'left', directionHint: 'Turn left to the Managing Director Office.', isAccessible: true },
          { id: 'edge-a-pd', from: 'block-a-corridor', to: 'plant-director-office', distanceM: 30, direction: 'left', directionHint: 'Turn left, the Plant Director Office is next to the MD.', isAccessible: true },
          { id: 'edge-a-sales', from: 'block-a-corridor', to: 'sales-office', distanceM: 16, direction: 'left', directionHint: 'Turn left for the Sales Office.', isAccessible: true },

          // Block B spurs (north-side offices)
          { id: 'edge-b-pm', from: 'block-b-corridor', to: 'plant-manager-office', distanceM: 26, direction: 'left', directionHint: 'Turn left to the Plant Manager Office.', isAccessible: true },
          { id: 'edge-b-sec', from: 'plant-manager-office', to: 'plant-manager-secretary', distanceM: 9, direction: 'right', directionHint: 'Next door is the Secretary to the Plant Manager.', isAccessible: true },
          { id: 'edge-b-chief', from: 'plant-manager-secretary', to: 'chief-maintenance-office', distanceM: 9, direction: 'right', directionHint: 'Continue to the Chief of Maintenance Office.', isAccessible: true },

          // Block B spurs (south-side offices)
          { id: 'edge-b-coord', from: 'block-b-corridor', to: 'maintenance-coordinator-office', distanceM: 17, direction: 'right', directionHint: 'Turn right to the Maintenance Coordinator Office.', isAccessible: true },
          { id: 'edge-b-stock', from: 'maintenance-coordinator-office', to: 'stock-office', distanceM: 9, direction: 'right', directionHint: 'Next door is the Stock Office.', isAccessible: true },
          { id: 'edge-b-first-aid', from: 'block-b-corridor', to: 'first-aid-office', distanceM: 30, direction: 'right', directionHint: 'Turn right to reach the First Aid Office.', isAccessible: true },
          { id: 'edge-b-gen', from: 'first-aid-office', to: 'general-offices', distanceM: 10, direction: 'right', directionHint: 'Continue to the General Offices.', isAccessible: true },

          // Industry Area spurs
          { id: 'edge-i-sup', from: 'industry-area', to: 'maintenance-supervisor-office', distanceM: 22, direction: 'right', directionHint: 'Turn right to the Maintenance Supervisor Office.', isAccessible: true },

          // Shared facilities
          { id: 'edge-shared-restaurant', from: 'block-b-corridor', to: 'restaurant', distanceM: 32, direction: 'left', directionHint: 'Cross the courtyard to the Restaurant.', isAccessible: true },
          { id: 'edge-shared-toilets', from: 'block-b-corridor', to: 'toilets', distanceM: 32, direction: 'right', directionHint: 'Turn right and follow the corridor to the Toilets.', isAccessible: true },
        ],
      }, {
        // Real Ruliba Clays Ltd GPS anchor (Kigali–Huye road, near the
        // Nyabarongo river). Centred on the site so the rectangular
        // footprint maps onto the actual factory plot.
        baseLat: -1.96115,
        baseLng: 30.00427,
        widthM: 140,
        heightM: 110,
      }),
    },
  };
}

module.exports = {
  adminPermissions,
  createSeedState,
  receptionistPermissions,
};

