const compassPoints = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW'
];

export const toDegrees = (radians) => (radians * 180) / Math.PI;

export const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const formatCoord = (value, positive, negative) => {
  const direction = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}° ${direction}`;
};

export const formatAltitude = (km, units) => {
  if (units === 'imperial') {
    return `${(km * 0.621371).toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
};

export const formatSpeed = (kmPerSec, units) => {
  if (units === 'imperial') {
    return `${(kmPerSec * 2236.94).toFixed(0)} mph`;
  }
  return `${kmPerSec.toFixed(2)} km/s`;
};

export const formatTime = (date, timeFormat) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat === '12'
  });
  return formatter.format(date);
};

export const formatDateTime = (date, timeFormat) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12'
  });
  return formatter.format(date);
};

export const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
};

export const azimuthToCompass = (azimuthDeg) => {
  const index = Math.round(azimuthDeg / 22.5) % 16;
  return compassPoints[index];
};

export const formatAzimuth = (azimuthDeg) => {
  return `${azimuthToCompass(azimuthDeg)} ${azimuthDeg.toFixed(0)}°`;
};

export const scorePass = (maxElevation, durationSeconds, sunAltitudeDeg) => {
  const elevationScore = Math.min(maxElevation / 90, 1) * 50;
  const durationScore = Math.min(durationSeconds / 600, 1) * 30;
  const darknessScore = Math.min(Math.max((-sunAltitudeDeg - 6) / 12, 0), 1) * 20;
  return Math.round(elevationScore + durationScore + darknessScore);
};

export const estimateBrightness = (maxElevation, sunAltitudeDeg) => {
  const darkness = Math.min(Math.max((-sunAltitudeDeg - 6) / 12, 0), 1);
  const score = maxElevation * 0.7 + darkness * 30;
  if (score > 70) return 'Very bright';
  if (score > 50) return 'Bright';
  if (score > 30) return 'Moderate';
  return 'Dim';
};
