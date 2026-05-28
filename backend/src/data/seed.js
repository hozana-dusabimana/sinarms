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
  const { baseLat, baseLng, widthM, heightM, rotationDeg = 0 } = origin;
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((baseLat * Math.PI) / 180);
  const theta = (rotationDeg * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  function toLatLng(x, y) {
    // Axis-aligned site offsets in metres (before rotation): east grows with x,
    // north grows as y shrinks (screen y points downward).
    const e0 = ((x - 50) / 100) * widthM;
    const n0 = ((50 - y) / 100) * heightM;
    // Rotate the footprint so the surveyed control points line up with the real
    // site orientation. rotationDeg = 0 leaves the footprint north-aligned.
    const eastM = e0 * cosT - n0 * sinT;
    const northM = e0 * sinT + n0 * cosT;
    return {
      lat: baseLat + northM / mPerDegLat,
      lng: baseLng + eastM / mPerDegLng,
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

// Inverse of attachGeo's toLatLng: turns a real (lat,lng) into the (x,y)
// percentage on the site footprint defined by origin, so seed nodes can be
// authored with real GPS coordinates and still round-trip through attachGeo.
function geoToXY({ lat, lng }, origin) {
  const { baseLat, baseLng, widthM, heightM, rotationDeg = 0 } = origin;
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((baseLat * Math.PI) / 180);
  const theta = (rotationDeg * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const northM = (lat - baseLat) * mPerDegLat;
  const eastM = (lng - baseLng) * mPerDegLng;
  // Un-rotate back into axis-aligned site offsets before scaling to x/y %.
  const e0 = eastM * cosT + northM * sinT;
  const n0 = -eastM * sinT + northM * cosT;
  return {
    x: 50 + (e0 / widthM) * 100,
    y: 50 - (n0 / heightM) * 100,
  };
}

// Georeferences an abstract (x%, y%) schematic onto the real world from two
// surveyed GPS control points. Two points fix a unique translation + rotation
// + scale, so the two named schematic nodes land exactly on their real
// coordinates and every other node rides along the same transform — which is
// how we lay out the rest of a factory/office site from just a couple of known
// pins. Returns an `origin` consumable by attachGeo (with rotationDeg).
//
// The two control points here sit on the same site corridor line (identical
// y), which fixes the east–west scale and the rotation but leaves the
// north–south scale free; we keep the schematic's authored aspect ratio for
// that axis (passed as widthM:heightM).
function solveRotatedOrigin(anchorA, anchorB, aspect) {
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((anchorA.lat * Math.PI) / 180);

  // Real ground vector A -> B (metres, east/north) and its bearing.
  const eastM = (anchorB.lng - anchorA.lng) * mPerDegLng;
  const northM = (anchorB.lat - anchorA.lat) * mPerDegLat;
  const realLen = Math.hypot(eastM, northM);
  const realBearing = Math.atan2(northM, eastM);

  // Schematic vector A -> B in % units (north = 50 - y) and its bearing.
  const dxPct = anchorB.x - anchorA.x;
  const dnPct = anchorA.y - anchorB.y; // north component: (50 - yB) - (50 - yA)
  const schemLenPct = Math.hypot(dxPct, dnPct);
  const schemBearing = Math.atan2(dnPct, dxPct);

  const theta = realBearing - schemBearing;
  // Control points share a corridor line, so their schematic span is purely
  // along x — widthM is the full-width scale that makes that span match the
  // real ground length; heightM follows the authored aspect ratio.
  const widthM = (realLen / schemLenPct) * 100;
  const heightM = widthM / aspect;

  // Solve the base (lat/lng of the footprint centre x=50,y=50) so anchorA maps
  // exactly onto its surveyed GPS.
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const e0 = ((anchorA.x - 50) / 100) * widthM;
  const n0 = ((50 - anchorA.y) / 100) * heightM;
  const eastRot = e0 * cosT - n0 * sinT;
  const northRot = e0 * sinT + n0 * cosT;

  return {
    baseLat: anchorA.lat - northRot / mPerDegLat,
    baseLng: anchorA.lng - eastRot / mPerDegLng,
    widthM,
    heightM,
    rotationDeg: (theta * 180) / Math.PI,
  };
}

function geoDistanceM(a, b) {
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * mPerDegLat;
  const dx = (a.lng - b.lng) * mPerDegLng;
  return Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
}

function geoNode(node, origin) {
  const { lat, lng, floor, ...rest } = node;
  const { x, y } = geoToXY({ lat, lng }, origin);
  return { ...rest, x, y, floor: floor || 1 };
}

function createSeedState() {
  const orgRuliba = 'org-ruliba';
  const locMain = 'loc-ruliba-main';
  const orgTumba = 'org-rp-tumba';
  const locTumba = 'loc-rp-tumba-main';

  // Two GPS pins surveyed on site and forwarded by the Ruliba team: the Admin
  // block and the Technical / Industry block. We don't have a coordinate for
  // every office, so these two control points are used to georeference the
  // whole schematic (see solveRotatedOrigin) and the remaining offices are
  // placed by the layout that radiates off the entrance→reception→blocks spine.
  //   Admin block      -> block-a-corridor node (x:22, y:55)
  //   Technical block  -> industry-area node    (x:64, y:55)
  // A third reading (-1.949086, 30.230263) was not used as a control point, but
  // under this transform it falls on the Block B maintenance offices (~x:53,
  // y:30), which matches its position on the ground — a good sanity check.
  const rulibaAdminPin = { lat: -1.949983, lng: 30.229861 };
  const rulibaTechnicalPin = { lat: -1.949358, lng: 30.230784 };
  const rulibaOrigin = solveRotatedOrigin(
    { x: 22, y: 55, ...rulibaAdminPin },
    { x: 64, y: 55, ...rulibaTechnicalPin },
    140 / 110, // keep the schematic's authored width:height aspect
  );

  const tumbaOrigin = {
    // Centred on the RP Tumba College campus footprint. The full bounding
    // box of all surveyed offices (procurement included) fits inside a
    // ~300 m × ~300 m rectangle.
    baseLat: -1.69547,
    baseLng: 29.92054,
    widthM: 350,
    heightM: 350,
  };

  const tumbaEntrance = { lat: -1.69560, lng: 29.91990 };
  const tumbaReception = { lat: -1.69500, lng: 29.92010 };

  const tumbaOffices = [
    { id: 'clinic', label: 'Clinic', aliases: ['clinic', 'medical room', 'health centre', 'ivuriro'], lat: -1.694343, lng: 29.920102 },
    { id: 'server-room', label: 'Server Room', aliases: ['server room', 'data centre', 'servers'], lat: -1.694322, lng: 29.920188 },
    { id: 'it-lab-2', label: 'IT Lab II', aliases: ['it lab 2', 'it lab ii', 'it lab two'], lat: -1.694386, lng: 29.920038 },
    { id: 'it-lab-1', label: 'IT Lab I', aliases: ['it lab 1', 'it lab i', 'it lab one'], lat: -1.694450, lng: 29.920059 },
    { id: 'it-lab-4', label: 'IT Lab IV', aliases: ['it lab 4', 'it lab iv', 'it lab four'], lat: -1.694408, lng: 29.920081 },
    { id: 'ett-lab-3', label: 'ETT Lab III', aliases: ['ett lab 3', 'ett lab iii', 'ett lab', 'electronics telecom lab'], lat: -1.694408, lng: 29.920038 },
    { id: 'toilets', label: 'Toilets', aliases: ['toilet', 'toilette', 'toilets', 'wc', 'restroom', 'umusarani'], lat: -1.694369, lng: 29.920059 },
    { id: 'it-lab-3', label: 'IT Lab III', aliases: ['it lab 3', 'it lab iii', 'it lab three'], lat: -1.694365, lng: 29.920059 },
    { id: 'et-lab-2', label: 'ET Lab II', aliases: ['et lab 2', 'et lab ii', 'electrical lab two'], lat: -1.694300, lng: 29.919759 },
    // Source row "Examination Test Room -1694343" — missing decimal point in the survey; corrected to match the surrounding cluster.
    { id: 'examination-test-room', label: 'Examination Test Room', aliases: ['exam room', 'examination room', 'test room', 'examination test room'], lat: -1.694343, lng: 29.919887 },
    { id: 'academic-services-unit', label: 'Academic Services Unit', aliases: ['academic services', 'asu', 'registrar', 'academic services unit'], lat: -1.694221, lng: 29.919891 },
    { id: 'renewable-energy-lab', label: 'Renewable Energy Lab', aliases: ['renewable energy lab', 're lab'], lat: -1.694199, lng: 29.919891 },
    { id: 'common-course-department', label: 'Common Course Department', aliases: ['common course', 'common course department', 'ccd'], lat: -1.694306, lng: 29.919719 },
    { id: 'network-lab', label: 'Network Lab', aliases: ['network lab', 'networking lab'], lat: -1.694242, lng: 29.919784 },
    { id: 'career-support-office', label: 'Career Support Office', aliases: ['career support', 'career office', 'cso', 'career support office'], lat: -1.694349, lng: 29.919848 },
    { id: 'business-incubation-center', label: 'Business Incubation Center', aliases: ['business incubation', 'incubation centre', 'bic', 'business incubation center'], lat: -1.694178, lng: 29.919311 },
    { id: 'it-department', label: 'IT Department', aliases: ['it department', 'information technology department'], lat: -1.694264, lng: 29.919376 },
    { id: 'it-lab-7', label: 'IT Lab 7', aliases: ['it lab 7', 'it lab seven'], lat: -1.694242, lng: 29.919333 },
    { id: 'it-lab-6', label: 'IT Lab 6', aliases: ['it lab 6', 'it lab six'], lat: -1.694242, lng: 29.919376 },
    { id: 'dc-machine-lab', label: 'DC Machine Lab', aliases: ['dc machine lab', 'dc lab', 'dc machines'], lat: -1.694199, lng: 29.919419 },
    { id: 'renewable-energy-department', label: 'Renewable Energy Department', aliases: ['renewable energy department', 're department'], lat: -1.694242, lng: 29.919440 },
    { id: 'mechanical-workshop', label: 'Mechanical Workshop', aliases: ['mechanical workshop', 'mech workshop'], lat: -1.694135, lng: 29.919376 },
    { id: 'electrical-workshop', label: 'Electrical Workshop', aliases: ['electrical workshop', 'elec workshop'], lat: -1.694178, lng: 29.919440 },
    { id: 'administrator-office', label: 'Administrator Office', aliases: ['administrator', 'administrator office'], lat: -1.694993, lng: 29.920728 },
    { id: 'administrative-staff-office', label: 'Administrative Staff Office', aliases: ['administrative staff', 'admin staff office'], lat: -1.694900, lng: 29.920680 },
    { id: 'office-of-procurement', label: 'Office of the Procurement', aliases: ['procurement', 'procurement office', 'office of the procurement'], lat: -1.696813, lng: 29.921761 },
    { id: 'board-room', label: 'Board Room', aliases: ['board room', 'boardroom'], lat: -1.694930, lng: 29.920720 },
    { id: 'office-of-department-principal', label: 'Office of the Department Principal', aliases: ['principal office', 'department principal', 'department principle', 'office of department principal'], lat: -1.694900, lng: 29.920730 },
    { id: 'main-hall', label: 'Main Hall', aliases: ['main hall', 'auditorium'], lat: -1.694960, lng: 29.920740 },
    { id: 'library', label: 'Library', aliases: ['library', 'isomero'], lat: -1.694910, lng: 29.920280 },
    { id: 'rooftop-restaurant', label: 'Rooftop Restaurant', aliases: ['rooftop restaurant', 'roof restaurant'], lat: -1.694950, lng: 29.920300 },
    { id: 'enjoy-restaurant', label: 'Enjoy Restaurant', aliases: ['enjoy restaurant', 'cafeteria', 'canteen'], lat: -1.694900, lng: 29.920250 },
    { id: 'gb-hostel', label: 'GB Hostel', aliases: ['gb hostel', 'girls hostel'], lat: -1.694890, lng: 29.920280 },
    { id: 'nb-hostel', label: 'NB Hostel', aliases: ['nb hostel', 'boys hostel'], lat: -1.694960, lng: 29.920260 },
  ];

  const tumbaNodes = [
    geoNode(
      { id: 'entrance', label: 'Main Entrance', aliases: ['entrance', 'main gate', 'gate', 'irembo', 'site entrance'], type: 'checkpoint', zone: 'public', ...tumbaEntrance },
      tumbaOrigin,
    ),
    geoNode(
      { id: 'reception', label: 'Reception', aliases: ['reception', 'reception desk', 'front desk', 'accueil', 'akira abashyitsi'], type: 'office', zone: 'public', ...tumbaReception },
      tumbaOrigin,
    ),
    ...tumbaOffices.map((office) =>
      geoNode({ ...office, type: 'office', zone: 'public' }, tumbaOrigin),
    ),
  ];

  const tumbaEdges = [
    {
      id: 'edge-tumba-entrance-reception',
      from: 'entrance',
      to: 'reception',
      distanceM: geoDistanceM(tumbaEntrance, tumbaReception),
      direction: 'straight',
      directionHint: 'Walk from the main entrance to the Reception.',
      isAccessible: true,
    },
    ...tumbaOffices.map((office) => ({
      id: `edge-tumba-rec-${office.id}`,
      from: 'reception',
      to: office.id,
      distanceM: geoDistanceM(tumbaReception, office),
      direction: 'straight',
      directionHint: `Walk from Reception to the ${office.label}.`,
      isAccessible: true,
    })),
  ];

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
      {
        id: orgTumba,
        name: 'RP Tumba College',
        description: 'Rwanda Polytechnic – Tumba College, a TVET institution in Northern Province offering IT, electronics, renewable energy and other engineering programs.',
        contactEmail: 'info@tumbacollege.ac.rw',
        contactPhone: '+250 788 000 010',
        address: 'Tumba, Rulindo District, Northern Province, Rwanda',
        logoUrl: null,
        status: 'active',
        // Older than Ruliba so existing tests that read locations[0]/organizations[0]
        // (sorted DESC by created_at) keep resolving to the Ruliba seed.
        createdAt: hoursAgo(1000),
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
      {
        id: locTumba,
        organizationId: orgTumba,
        name: 'RP Tumba College - Main Campus',
        address: 'Tumba, Rulindo District, Northern Province, Rwanda',
        floorCount: 1,
        description: 'RP Tumba College main campus covering the academic block (Clinic, IT/ET labs, Renewable Energy facilities, Academic Services), workshops (Mechanical, Electrical, DC Machine, Incubation Center), administration block (Administrator, Board Room, Department Principal, Main Hall) and student facilities (Library, Restaurants, Hostels).',
        status: 'active',
        qrCodeToken: 'SINARMS-TUMBA-MAIN',
        receptionistIds: ['user-rec-2'],
        createdAt: hoursAgo(980),
      },
    ],
    users: [
      {
        id: 'user-admin-1',
        name: 'Alice Mutoni',
        email: 'admin@sinarms.rw',
        passwordHash: bcrypt.hashSync('Admin123!', 10),
        role: 'admin',
        organizationId: null,
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
      {
        id: 'user-rec-2',
        name: 'Sarah Uwimana',
        email: 'reception@tumbacollege.ac.rw',
        passwordHash: bcrypt.hashSync('Reception123!', 10),
        role: 'receptionist',
        organizationId: orgTumba,
        locationId: locTumba,
        permissions: receptionistPermissions,
        status: 'active',
        lastLogin: minutesAgo(60),
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
      {
        id: 'audit-2',
        userId: 'user-admin-1',
        actorName: 'Alice Mutoni',
        actionType: 'CREATE_USER',
        targetType: 'user',
        targetId: 'user-rec-2',
        details: 'Created receptionist account Sarah Uwimana for RP Tumba College main reception.',
        ipAddress: '10.0.0.45',
        timestamp: hoursAgo(48),
      },
    ],
    notifications: [],
    // Single Ruliba Clays campus combining all the offices documented in the
    // operational survey (see ai/README.md): Block A (administrative), Block
    // B (operations & support), Industry Area, Stock / Warehouse Area, plus
    // shared facilities (Restaurant, Toilets). The schematic is georeferenced
    // onto the real site from the two surveyed GPS pins (rulibaOrigin), so the
    // Admin and Technical blocks sit on their exact coordinates and the rest of
    // the offices are positioned by the same rotation/scale transform.
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
      }, rulibaOrigin),
      // RP Tumba College main campus. Nodes are authored with real GPS
      // coordinates from the campus survey and converted to the site
      // footprint via geoNode so attachGeo's round-trip preserves them.
      [locTumba]: attachGeo(
        { floorplanImage: null, nodes: tumbaNodes, edges: tumbaEdges },
        tumbaOrigin,
      ),
    },
  };
}

module.exports = {
  adminPermissions,
  createSeedState,
  receptionistPermissions,
};

