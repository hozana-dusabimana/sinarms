import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useGeolocation } from '../lib/useGeolocation';
import { distanceMeters } from '../lib/geo';

// GPS simulation harness. A real device standing still never reports the same
// coordinate twice — each fix lands somewhere inside the accuracy circle. We
// install a fake geolocation whose watchPosition hands us the success callback
// so the test can replay an exact stream of fixes and assert the smoothed
// position (which drives the on-screen distance + the map marker) holds steady
// through noise and only moves on confirmed travel.

const BASE = [-1.949983, 30.229861]; // a seeded entrance pin

// Offset a [lat,lng] by roughly metresN north / metresE east.
function offset([lat, lng], metresN, metresE) {
  const dLat = metresN / 111320;
  const dLng = metresE / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

let fire; // (coords, accuracy, tsMs) => void — pushes a fix into the hook
let baseTs;

function installGeolocation() {
  baseTs = 1_700_000_000_000; // fixed epoch so the sim is deterministic
  let cb = null;
  const watchPosition = vi.fn((onSuccess) => {
    cb = onSuccess;
    return 1;
  });
  // No getCurrentPosition on purpose: the hook only starts its 4 s poll when
  // that exists, so the sim stays driven entirely by our explicit fires.
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch: vi.fn() },
    configurable: true,
    writable: true,
  });
  fire = (coords, accuracy, tOffsetMs = 0) => {
    act(() => {
      cb({ coords: { latitude: coords[0], longitude: coords[1], accuracy }, timestamp: baseTs + tOffsetMs });
    });
  };
}

describe('useGeolocation GPS simulation', () => {
  beforeEach(() => installGeolocation());
  afterEach(() => {
    cleanup();
    delete navigator.geolocation;
    vi.restoreAllMocks();
  });

  it('holds the smoothed position steady through stationary jitter', () => {
    const { result } = renderHook(() => useGeolocation());

    // First fix establishes the anchor.
    fire(BASE, 8, 0);
    const anchor = result.current.position;
    expect(anchor).not.toBeNull();
    expect(distanceMeters(anchor, BASE)).toBeLessThan(0.001);

    // 30 noisy fixes within the accuracy circle (±4 m), as if standing still.
    const jitter = [
      [3, -2], [-3, 1], [2, 3], [-1, -4], [4, 0], [0, 4], [-4, -1], [1, 2],
      [3, 3], [-2, -3], [2, -4], [-3, 3], [4, -2], [-1, 4], [0, -4], [3, 1],
      [-4, 2], [2, -1], [-2, 4], [1, -3], [4, 3], [-3, -2], [0, 3], [3, -4],
      [-4, 0], [2, 2], [-1, -4], [4, 1], [-2, -3], [1, 4],
    ];
    jitter.forEach(([n, e], i) => fire(offset(BASE, n, e), 8, 1000 * (i + 1)));

    // The marker — and therefore the displayed distance — must not have drifted.
    const drift = distanceMeters(result.current.position, anchor);
    expect(drift).toBeLessThan(0.5); // sub-metre: effectively pinned
    // The simulated distance-to-entrance reading is rock steady.
    expect(Math.round(distanceMeters(result.current.position, BASE))).toBe(0);
  });

  it('ignores a single outlier spike (does not re-pin the anchor)', () => {
    const { result } = renderHook(() => useGeolocation());
    fire(BASE, 8, 0);
    const anchor = result.current.position;

    // One lone fix 10 m away (beyond the 6 m deadband, below the 2.5x travel
    // threshold) — a classic noise spike.
    fire(offset(BASE, 10, 0), 8, 1000);
    expect(distanceMeters(result.current.position, anchor)).toBeLessThan(0.5);

    // Then back inside the cloud — the spike is forgotten, no drift.
    fire(offset(BASE, 2, -1), 8, 2000);
    expect(distanceMeters(result.current.position, anchor)).toBeLessThan(0.5);
  });

  it('tracks genuine sustained movement after confirmation', () => {
    const { result } = renderHook(() => useGeolocation());
    fire(BASE, 8, 0);
    const anchor = result.current.position;

    // Two consecutive fixes ~12 m north — sustained travel, not a spike.
    fire(offset(BASE, 12, 0), 8, 1000);
    fire(offset(BASE, 13, 0), 8, 2000);

    // The marker has released the hold and moved meaningfully toward the new
    // position (blend won't snap fully, but it must clearly leave the anchor).
    expect(distanceMeters(result.current.position, anchor)).toBeGreaterThan(3);
  });

  it('reacts immediately to an unmistakable large jump', () => {
    const { result } = renderHook(() => useGeolocation());
    fire(BASE, 8, 0);
    const anchor = result.current.position;

    // One fix 40 m away (>> 2.5x deadband) — real travel, react on first fix.
    fire(offset(BASE, 40, 0), 8, 1000);
    expect(distanceMeters(result.current.position, anchor)).toBeGreaterThan(3);
  });
});
