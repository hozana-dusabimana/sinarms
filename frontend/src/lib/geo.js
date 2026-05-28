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
