import { useEffect, useRef, useState } from 'react';
import { isValidLatLng, distanceMeters, bearingBetween, blendPosition } from './geo';

// Reject a fix only when it implies impossible travel AND comes from a
// low-confidence source. A campus visitor on foot/by car never moves at
// >35 m/s (126 km/h), so a jump that fast from a coarse (>40 m) fix is almost
// always Wi-Fi/cell triangulation snapping to a far cell — discard it and keep
// the last good position. We deliberately do NOT hard-drop every coarse fix
// (the old behaviour), because that froze the marker whenever signal weakened
// mid-walk; instead coarse fixes are kept but down-weighted by blendPosition.
const MAX_PLAUSIBLE_SPEED_MS = 35;
const OUTLIER_ACCURACY_M = 40;
// Below this many metres of movement we don't recompute heading from two fixes
// (the bearing of a 1 m jitter step is meaningless); we keep the previous one.
const HEADING_MIN_STEP_M = 4;

// Shared, real-time geolocation tracking for the visitor experience.
//
// Sources: watchPosition (the live API) plus a getCurrentPosition poll, because
// on several Android/Chrome builds watchPosition emits one fix then goes quiet,
// freezing the marker even as the visitor walks. Both feed the same pipeline:
// outlier rejection -> accuracy-weighted smoothing -> heading. The returned
// `position` is the smoothed marker position; `rawPosition` is the unfiltered
// fix for logic that must not be damped (e.g. geofence distance checks).
export function useGeolocation({ enabled = true } = {}) {
  const [state, setState] = useState({
    position: null,
    rawPosition: null,
    accuracy: null,
    heading: null,
    speed: null,
    status: 'idle', // 'idle' | 'locating' | 'tracking' | 'error'
    error: null, // 'denied' | 'unavailable' | 'timeout' | 'unsupported'
  });
  const [retryToken, setRetryToken] = useState(0);

  const smoothedRef = useRef(null);
  const rawRef = useRef(null);
  const lastTsRef = useRef(null);
  const headingRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((s) => ({ ...s, status: 'error', error: 'unsupported' }));
      return undefined;
    }
    const geo = navigator.geolocation;

    // Re-entering (mount or retry): show "locating" unless we already have a fix.
    setState((s) => ({ ...s, status: s.position ? 'tracking' : 'locating', error: null }));

    const onFix = (pos) => {
      const c = pos?.coords || {};
      const next = [c.latitude, c.longitude];
      if (!isValidLatLng(next)) return;
      const acc = typeof c.accuracy === 'number' && !Number.isNaN(c.accuracy) ? c.accuracy : null;
      const ts = pos.timestamp || Date.now();

      // Outlier rejection: an implausibly fast jump from an inaccurate fix.
      const prevRaw = rawRef.current;
      const prevTs = lastTsRef.current;
      if (prevRaw && prevTs && acc != null && acc > OUTLIER_ACCURACY_M) {
        const dt = Math.max(0.001, (ts - prevTs) / 1000);
        if (distanceMeters(prevRaw, next) / dt > MAX_PLAUSIBLE_SPEED_MS) return;
      }

      // Heading: trust the device compass when it's moving, else derive it from
      // the travel direction between two real fixes.
      let heading = headingRef.current;
      if (typeof c.heading === 'number' && !Number.isNaN(c.heading) && (c.speed == null || c.speed > 0.3)) {
        heading = c.heading;
      }
      if (prevRaw && distanceMeters(prevRaw, next) >= HEADING_MIN_STEP_M) {
        const b = bearingBetween(prevRaw, next);
        if (b != null) heading = b;
      }
      headingRef.current = heading;

      const smoothed = blendPosition(smoothedRef.current, next, acc);
      smoothedRef.current = smoothed;
      rawRef.current = next;
      lastTsRef.current = ts;

      setState({
        position: smoothed,
        rawPosition: next,
        accuracy: acc,
        heading,
        speed: typeof c.speed === 'number' && !Number.isNaN(c.speed) ? c.speed : null,
        status: 'tracking',
        error: null,
      });
    };

    const onError = (err) => {
      let error = 'unavailable';
      if (err?.code === 1) error = 'denied';
      else if (err?.code === 2) error = 'unavailable';
      else if (err?.code === 3) error = 'timeout';
      setState((s) => ({ ...s, status: s.position ? 'tracking' : 'error', error }));
    };

    const opts = { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 };
    let watchId = null;
    let pollId = null;

    if (typeof geo.watchPosition === 'function') {
      watchId = geo.watchPosition(onFix, onError, opts);
    }
    // Poll fallback for builds where watchPosition stalls after the first fix.
    // Guarded so test stubs that only provide watchPosition don't crash.
    if (typeof geo.getCurrentPosition === 'function') {
      pollId = setInterval(() => {
        geo.getCurrentPosition(onFix, () => {}, { ...opts, timeout: 10000 });
      }, 4000);
    }

    return () => {
      if (watchId != null && typeof geo.clearWatch === 'function') geo.clearWatch(watchId);
      if (pollId != null) clearInterval(pollId);
    };
  }, [enabled, retryToken]);

  return { ...state, retry: () => setRetryToken((t) => t + 1) };
}
