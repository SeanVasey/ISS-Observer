// Shareable pass link helpers.
// A share link encodes the observer location and the pass start time so a
// recipient sees the same pick: ?lat=<deg>&lon=<deg>&pass=<ISO>&loc=<name>

// Successive ISS passes are ~90 minutes apart, so a generous ±15 minute
// tolerance absorbs TLE drift between sharer and recipient without ever
// matching a neighboring pass.
export const PASS_MATCH_TOLERANCE_MS = 15 * 60 * 1000;

const MAX_LOCATION_NAME_LENGTH = 80;

// Placeholder names that carry no meaning for a recipient; omitted from
// links so the recipient's device resolves a real name instead.
const PLACEHOLDER_NAMES = new Set([
  'custom location',
  'custom coordinates',
  'shared location',
  'locating...'
]);

export const isPlaceholderName = (name) =>
  PLACEHOLDER_NAMES.has(String(name || '').trim().toLowerCase());

/**
 * Build the query params for a share link.
 * @param {{lat: number, lon: number}} observer
 * @param {{start: Date}} pass
 * @param {string} [locationName]
 * @returns {URLSearchParams}
 */
export const buildShareParams = (observer, pass, locationName = '') => {
  const params = new URLSearchParams();
  params.set('lat', observer.lat.toFixed(4));
  params.set('lon', observer.lon.toFixed(4));
  params.set('pass', pass.start.toISOString());
  const name = String(locationName).trim();
  if (name && !isPlaceholderName(name)) {
    params.set('loc', name.slice(0, MAX_LOCATION_NAME_LENGTH));
  }
  return params;
};

/**
 * Parse share params from a query string. Invalid or out-of-range values
 * are dropped rather than throwing, so a mangled link degrades gracefully.
 * @param {string} search - window.location.search (with or without '?')
 * @returns {{observer: {lat: number, lon: number}|null, passTime: Date|null, locationName: string}}
 */
export const parseShareParams = (search) => {
  const params = new URLSearchParams(search);
  const result = { observer: null, passTime: null, locationName: '' };

  const lat = Number.parseFloat(params.get('lat'));
  const lon = Number.parseFloat(params.get('lon'));
  if (
    Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lon) && lon >= -180 && lon <= 180
  ) {
    result.observer = { lat, lon };
  }

  const passParam = params.get('pass');
  if (passParam) {
    const time = new Date(passParam);
    if (!Number.isNaN(time.getTime())) {
      result.passTime = time;
    }
  }

  const loc = String(params.get('loc') || '').trim();
  if (loc && !isPlaceholderName(loc)) {
    result.locationName = loc.slice(0, MAX_LOCATION_NAME_LENGTH);
  }

  return result;
};

/**
 * Find the pass a shared timestamp refers to. Matches when the target falls
 * within the pass window (± tolerance) and prefers the pass whose start time
 * is closest to the target.
 * @param {Array<{start: Date, end: Date}>} passes
 * @param {Date|null} targetTime
 * @param {number} [toleranceMs]
 * @returns {object|null}
 */
export const findSharedPass = (passes, targetTime, toleranceMs = PASS_MATCH_TOLERANCE_MS) => {
  if (!targetTime || Number.isNaN(targetTime.getTime())) return null;
  const target = targetTime.getTime();
  let best = null;
  let bestDelta = Infinity;
  for (const pass of passes) {
    const windowStart = pass.start.getTime() - toleranceMs;
    const windowEnd = pass.end.getTime() + toleranceMs;
    if (target < windowStart || target > windowEnd) continue;
    const delta = Math.abs(pass.start.getTime() - target);
    if (delta < bestDelta) {
      best = pass;
      bestDelta = delta;
    }
  }
  return best;
};
