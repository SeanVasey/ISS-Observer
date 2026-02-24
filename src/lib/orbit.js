import { toDegrees, toRadians } from './format.js';

const TLE_URL =
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const CACHE_KEY = 'iss-tle-cache-v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const EARTH_RADIUS_KM = 6371;

const getSatellite = () => {
  const satellite = globalThis.satellite;
  if (!satellite) {
    throw new Error('satellite.js is not loaded.');
  }
  return satellite;
};

export const fetchTle = async () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.tle?.length === 3) {
        return parsed.tle;
      }
    }
  } catch {
    // localStorage unavailable or corrupt - fetch fresh
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(TLE_URL, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    throw new Error('Unable to fetch TLE data.');
  }
  const text = await response.text();
  const lines = text.trim().split('\n');
  if (lines.length < 3) {
    throw new Error('Invalid TLE response.');
  }
  const tle = lines.slice(0, 3);
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ tle, timestamp: Date.now() })
    );
  } catch {
    // localStorage unavailable - skip caching
  }
  return tle;
};

export const getSatrec = (tle) => {
  const satellite = getSatellite();
  return satellite.twoline2satrec(tle[1], tle[2]);
};

export const computePosition = (satrec, date = new Date()) => {
  const satellite = getSatellite();
  const { position, velocity } = satellite.propagate(satrec, date);
  if (!position || !velocity) {
    return null;
  }
  const gmst = satellite.gstime(date);
  const positionGd = satellite.eciToGeodetic(position, gmst);
  const lat = toDegrees(positionGd.latitude);
  const lon = toDegrees(positionGd.longitude);
  const altitude = positionGd.height;
  const speed = Math.sqrt(
    velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2
  );
  return {
    lat,
    lon,
    altitude,
    speed,
    position,
    gmst
  };
};

export const computeGroundTrack = (satrec, startDate, minutes, stepSeconds) => {
  const points = [];
  const totalSteps = Math.floor((minutes * 60) / stepSeconds);
  for (let i = 0; i <= totalSteps; i += 1) {
    const date = new Date(startDate.getTime() + i * stepSeconds * 1000);
    const position = computePosition(satrec, date);
    if (position) {
      points.push({ lat: position.lat, lon: position.lon, date });
    }
  }
  return points;
};

/**
 * Compute the sun's position in ECI coordinates.
 * Uses astronomical algorithms (simplified solar position model).
 * This replaces satellite.sunPos() which is not available in satellite.js v5.
 */
const computeSunEci = (date) => {
  const satellite = getSatellite();
  const jd = satellite.jday(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );

  // Julian centuries from J2000.0
  const T = (jd - 2451545.0) / 36525.0;

  // Mean longitude of the sun (degrees)
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;

  // Mean anomaly of the sun (degrees)
  const M = (357.52911 + T * (35999.05029 - T * 0.0001537)) % 360;
  const Mrad = toRadians(M);

  // Equation of center
  const C = (1.914602 - T * (0.004817 + T * 0.000014)) * Math.sin(Mrad)
    + (0.019993 - T * 0.000101) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);

  // Sun's true longitude
  const sunLon = toRadians(L0 + C);

  // Obliquity of the ecliptic
  const obliquity = toRadians(23.439291 - T * 0.0130042);

  // Sun-Earth distance in km (AU to km)
  const AU_KM = 149597870.7;
  const e = 0.016708634 - T * (0.000042037 + T * 0.0000001267);
  const v = Mrad + toRadians(C);
  const R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(v));
  const distKm = R * AU_KM;

  // ECI coordinates (equatorial)
  const x = distKm * Math.cos(sunLon);
  const y = distKm * Math.cos(obliquity) * Math.sin(sunLon);
  const z = distKm * Math.sin(obliquity) * Math.sin(sunLon);

  return { x, y, z };
};

/**
 * Determine if a satellite is sunlit (not in Earth's shadow).
 * Uses cylindrical shadow model.
 * This replaces satellite.isSunlit() which is not available in satellite.js v5.
 */
export const isSatSunlit = (positionEci, date) => {
  const sunEci = computeSunEci(date);

  // Vector from Earth to satellite
  const satX = positionEci.x;
  const satY = positionEci.y;
  const satZ = positionEci.z;

  // Vector from Earth to sun
  const sunX = sunEci.x;
  const sunY = sunEci.y;
  const sunZ = sunEci.z;

  // Dot product of satellite and sun vectors
  const dot = satX * sunX + satY * sunY + satZ * sunZ;

  // If satellite is on the sunlit side of Earth, it's sunlit
  if (dot > 0) {
    return true;
  }

  // Check if satellite is in Earth's shadow using cylindrical model
  // Project satellite position onto sun direction
  const sunMag = Math.sqrt(sunX * sunX + sunY * sunY + sunZ * sunZ);
  const sunUnitX = sunX / sunMag;
  const sunUnitY = sunY / sunMag;
  const sunUnitZ = sunZ / sunMag;

  // Component of satellite perpendicular to sun direction
  const projScalar = satX * sunUnitX + satY * sunUnitY + satZ * sunUnitZ;
  const perpX = satX - projScalar * sunUnitX;
  const perpY = satY - projScalar * sunUnitY;
  const perpZ = satZ - projScalar * sunUnitZ;
  const perpDist = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);

  // If perpendicular distance > Earth radius, satellite is sunlit
  return perpDist > EARTH_RADIUS_KM;
};

/**
 * Get the sub-solar point (where the sun is directly overhead).
 * Uses simplified astronomical calculation for declination and hour angle.
 */
export const getSunSubPoint = (date) => {
  // Declination from day of year (Earth's axial tilt)
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const declination = -23.44 * Math.cos(toRadians((360 / 365) * (dayOfYear + 10)));

  // Sun longitude from UTC time (15 degrees per hour, solar noon at 12:00 UTC = 0° lon)
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const sunLon = -(hours - 12) * 15;

  return {
    lat: declination,
    lon: ((sunLon + 180) % 360) - 180
  };
};

export const computeLookAngles = (observer, positionEci, gmst) => {
  const satellite = getSatellite();
  const observerGd = {
    longitude: satellite.degreesToRadians(observer.lon),
    latitude: satellite.degreesToRadians(observer.lat),
    height: observer.height
  };
  const positionEcf = satellite.eciToEcf(positionEci, gmst);
  return satellite.ecfToLookAngles(observerGd, positionEcf);
};
