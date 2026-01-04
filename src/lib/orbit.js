import { toDegrees } from './format.js';

const TLE_URL =
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const CACHE_KEY = 'iss-tle-cache-v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const getSatellite = () => {
  const satellite = globalThis.satellite;
  if (!satellite) {
    throw new Error('satellite.js is not loaded.');
  }
  return satellite;
};

export const fetchTle = async () => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.tle?.length === 3) {
      return parsed.tle;
    }
  }

  const response = await fetch(TLE_URL);
  if (!response.ok) {
    throw new Error('Unable to fetch TLE data.');
  }
  const text = await response.text();
  const lines = text.trim().split('\n');
  if (lines.length < 3) {
    throw new Error('Invalid TLE response.');
  }
  const tle = lines.slice(0, 3);
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ tle, timestamp: Date.now() })
  );
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
  const satellite = getSatellite();
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

export const getSunPositionEci = (date) => {
  const satellite = getSatellite();
  const gmst = satellite.gstime(date);
  return satellite.sunPos(gmst);
};

export const isSatSunlit = (positionEci, date) => {
  const satellite = getSatellite();
  const sunEci = getSunPositionEci(date);
  return satellite.isSunlit(positionEci, sunEci);
};

export const getSunSubPoint = (date) => {
  const satellite = getSatellite();
  const gmst = satellite.gstime(date);
  const sunEci = satellite.sunPos(gmst);
  const sunGd = satellite.eciToGeodetic(sunEci, gmst);
  return {
    lat: toDegrees(sunGd.latitude),
    lon: toDegrees(sunGd.longitude)
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
