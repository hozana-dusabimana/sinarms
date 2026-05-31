// Proximity thresholds for the visitor geofence.
// Hysteresis: a visitor must be within CHECKIN_RADIUS_M to start a visit, and
// must be beyond CHECKOUT_RADIUS_M continuously for CHECKOUT_DEBOUNCE_MS
// before we auto-end the visit. The 20 m gap absorbs GPS noise so a visitor
// standing near the entrance can't bounce in/out on a single bad fix.
export const CHECKIN_RADIUS_M = 100;
export const CHECKOUT_RADIUS_M = 120;
export const CHECKOUT_DEBOUNCE_MS = 30000;

export function isValidLatLng(pos) {
  return Array.isArray(pos)
    && pos.length === 2
    && typeof pos[0] === 'number' && !Number.isNaN(pos[0])
    && typeof pos[1] === 'number' && !Number.isNaN(pos[1]);
}

// Haversine distance in metres between two [lat, lng] tuples.
export function distanceMeters(a, b) {
  if (!isValidLatLng(a) || !isValidLatLng(b)) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Initial bearing (degrees, 0 = north, clockwise) from point a to point b.
// Used to orient the "you are here" arrow in the direction the visitor is
// actually walking, the way Google Maps rotates its blue cone.
export function bearingBetween(a, b) {
  if (!isValidLatLng(a) || !isValidLatLng(b)) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Accuracy-weighted low-pass filter for the live marker. A precise fix (small
// accuracy radius) is trusted and moves the marker most of the way; a coarse
// fix (large radius — typically Wi-Fi/cell triangulation) barely nudges it, so
// the marker stays put instead of scattering while the visitor stands still.
// When the step is large relative to the fix's own uncertainty we treat it as
// genuine travel and let the marker catch up quickly, so real movement isn't
// over-damped into a lag. `goodAccuracyM` is the radius (~12 m) at which a fix
// is considered fully trustworthy.
export function blendPosition(prev, next, accuracyM, goodAccuracyM = 12) {
  if (!isValidLatLng(next)) return isValidLatLng(prev) ? prev : null;
  if (!isValidLatLng(prev)) return next;
  const acc = typeof accuracyM === 'number' && accuracyM > 0 ? accuracyM : goodAccuracyM;
  let alpha = goodAccuracyM / (goodAccuracyM + acc);
  const step = distanceMeters(prev, next);
  // Genuine travel (moved further than our uncertainty) — let the marker catch up.
  if (step > Math.max(acc, 15)) alpha = Math.max(alpha, 0.6);
  alpha = Math.min(0.95, Math.max(0.12, alpha));
  return [prev[0] + (next[0] - prev[0]) * alpha, prev[1] + (next[1] - prev[1]) * alpha];
}

// Project a [lat, lng] point onto a polyline and return the closest point,
// the index of the segment it falls on, and how far away it is. At the small
// scales we care about (a campus, a few hundred metres), local-plane geometry
// is accurate enough and far cheaper than great-circle math per tick.
export function nearestPointOnPolyline(route, point) {
  if (!Array.isArray(route) || route.length < 2 || !isValidLatLng(point)) {
    return null;
  }
  const [pLat, pLng] = point;
  const cosLat = Math.cos((pLat * Math.PI) / 180);
  let best = null;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    if (!isValidLatLng(a) || !isValidLatLng(b)) continue;
    const ax = a[1] * cosLat;
    const ay = a[0];
    const bx = b[1] * cosLat;
    const by = b[0];
    const px = pLng * cosLat;
    const py = pLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const projLat = a[0] + (b[0] - a[0]) * t;
    const projLng = a[1] + (b[1] - a[1]) * t;
    const d = distanceMeters(point, [projLat, projLng]);
    if (!best || d < best.distance) {
      best = { segmentIndex: i, t, distance: d, point: [projLat, projLng] };
    }
  }
  return best;
}

// Trim everything up to the visitor's current position off the front of the
// route polyline. Lets the drawn line shorten on every GPS tick without
// re-asking OSRM. If the visitor is off-route by more than offRouteMeters,
// returns null so callers can trigger a real re-route instead of drawing a
// stale line.
export function clipPolylineFromPosition(route, position, offRouteMeters = 30) {
  const near = nearestPointOnPolyline(route, position);
  if (!near || near.distance > offRouteMeters) return null;
  const tail = route.slice(near.segmentIndex + 1);
  return [near.point, ...tail];
}
