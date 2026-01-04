import { toDegrees, scorePass, estimateBrightness } from './format.js';
import { computeLookAngles, isSatSunlit } from './orbit.js';

const STEP_SECONDS = 20;
const PASS_WINDOW_HOURS = 72;
const getSatellite = () => {
  const satellite = globalThis.satellite;
  if (!satellite) {
    throw new Error('satellite.js is not loaded.');
  }
  return satellite;
};
const getSunCalc = () => {
  const sunCalc = globalThis.SunCalc;
  if (!sunCalc) {
    throw new Error('SunCalc is not loaded.');
  }
  return sunCalc;
};

const isObserverDark = (date, observer) => {
  const sunCalc = getSunCalc();
  const sunPosition = sunCalc.getPosition(date, observer.lat, observer.lon);
  const sunAltitude = toDegrees(sunPosition.altitude);
  return { dark: sunAltitude < -6, altitude: sunAltitude };
};

const buildPass = (pass, observer) => {
  const duration = (pass.end - pass.start) / 1000;
  const darkAtPeak = isObserverDark(pass.peakTime, observer).altitude;
  const score = scorePass(pass.maxElevation, duration, darkAtPeak);
  const brightness = estimateBrightness(pass.maxElevation, darkAtPeak);
  return {
    ...pass,
    duration,
    score,
    brightness
  };
};

export const computePasses = (satrec, observer, start = new Date()) => {
  const satellite = getSatellite();
  const passes = [];
  const endTime = new Date(start.getTime() + PASS_WINDOW_HOURS * 3600 * 1000);
  let currentPass = null;
  let maxElevation = -90;
  let peakData = null;

  for (
    let time = new Date(start);
    time <= endTime;
    time = new Date(time.getTime() + STEP_SECONDS * 1000)
  ) {
    const { position } = satellite.propagate(satrec, time);
    if (!position) {
      continue;
    }
    const gmst = satellite.gstime(time);
    const lookAngles = computeLookAngles(observer, position, gmst);
    const elevationDeg = toDegrees(lookAngles.elevation);
    const azimuthDeg = (toDegrees(lookAngles.azimuth) + 360) % 360;

    if (elevationDeg > 0 && !currentPass) {
      currentPass = {
        start: new Date(time),
        startAz: azimuthDeg,
        maxElevation: elevationDeg,
        peakTime: new Date(time),
        peakAz: azimuthDeg,
        end: null,
        endAz: null,
        visible: false,
        visibleSegments: []
      };
      maxElevation = elevationDeg;
      peakData = { time: new Date(time), az: azimuthDeg };
    }

    if (currentPass) {
      if (elevationDeg > maxElevation) {
        maxElevation = elevationDeg;
        peakData = { time: new Date(time), az: azimuthDeg };
      }

      const sunlit = isSatSunlit(position, time);
      const { dark } = isObserverDark(time, observer);
      if (sunlit && dark) {
        currentPass.visible = true;
        const lastSegment = currentPass.visibleSegments.at(-1);
        if (!lastSegment || lastSegment.end) {
          currentPass.visibleSegments.push({ start: new Date(time), end: null });
        }
      } else if (currentPass.visibleSegments.length) {
        const lastSegment = currentPass.visibleSegments.at(-1);
        if (lastSegment && !lastSegment.end) {
          lastSegment.end = new Date(time);
        }
      }

      if (elevationDeg <= 0) {
        currentPass.end = new Date(time);
        currentPass.endAz = azimuthDeg;
        currentPass.maxElevation = maxElevation;
        currentPass.peakTime = peakData.time;
        currentPass.peakAz = peakData.az;
        passes.push(buildPass(currentPass, observer));
        currentPass = null;
        maxElevation = -90;
        peakData = null;
      }
    }
  }

  if (currentPass) {
    currentPass.end = new Date(endTime);
    currentPass.endAz = currentPass.endAz ?? currentPass.startAz;
    currentPass.maxElevation = maxElevation;
    currentPass.peakTime = peakData?.time ?? currentPass.start;
    currentPass.peakAz = peakData?.az ?? currentPass.startAz;
    passes.push(buildPass(currentPass, observer));
  }

  return passes;
};

export const describeVisibility = (pass) => {
  if (!pass.visible) {
    return 'Not visible (daylight or shadowed)';
  }
  if (!pass.visibleSegments.length) {
    return 'Visible briefly';
  }
  const segment = pass.visibleSegments[0];
  if (segment && segment.end) {
    const duration = Math.round((segment.end - segment.start) / 60000);
    if (duration >= 4) return 'Visible for most of pass';
  }
  return 'Visible in part of pass';
};
