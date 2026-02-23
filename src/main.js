// Import libraries from npm packages (bundled by Vite)
import * as THREE from 'three';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Globe from 'globe.gl';
import * as satellite from 'satellite.js';
import SunCalc from 'suncalc';

// Import leaflet terminator (default export is a factory function)
import terminator from '@joergdietrich/leaflet.terminator';

// Make satellite and SunCalc available globally for lib modules
globalThis.satellite = satellite;
globalThis.SunCalc = SunCalc;

import {
  formatCoord,
  formatAltitude,
  formatSpeed,
  formatTime,
  formatDateTime,
  formatDuration,
  formatAzimuth
} from './lib/format.js';
import {
  fetchTle,
  getSatrec,
  computePosition,
  computeGroundTrack,
  getSunSubPoint
} from './lib/orbit.js';
import { computePasses, describeVisibility } from './lib/passes.js';

const state = {
  satrec: null,
  observer: { lat: 47.6062, lon: -122.3321, height: 0 },
  locationName: 'Seattle, WA',
  passes: [],
  settings: {
    units: 'imperial',
    updateRate: 1000,
    timeFormat: '24',
    view: 'both'
  }
};

const elements = {
  issStatus: document.querySelector('#iss-status'),
  nextPass: document.querySelector('#next-pass'),
  visibilityState: document.querySelector('#visibility-state'),
  countdown: document.querySelector('#countdown'),
  topPicks: document.querySelector('#top-picks'),
  passes: document.querySelector('#passes'),
  locationName: document.querySelector('#location-name'),
  locationCoords: document.querySelector('#location-coords'),
  locationSearch: document.querySelector('#location-search'),
  locationLat: document.querySelector('#location-lat'),
  locationLon: document.querySelector('#location-lon'),
  locationFeedback: document.querySelector('#location-feedback'),
  useLocation: document.querySelector('#use-location'),
  applyLocation: document.querySelector('#apply-location'),
  toggleView: document.querySelector('#toggle-view'),
  centerIss: document.querySelector('#center-iss'),
  centerUser: document.querySelector('#center-user'),
  settingUnits: document.querySelector('#setting-units'),
  settingRate: document.querySelector('#setting-rate'),
  settingTime: document.querySelector('#setting-time'),
  settingView: document.querySelector('#setting-view')
};

let map;
let issMarker;
let userMarker;
let trackLine;
let futureTrackLine;
let terminatorLayer;
let globe;
let light;
let lastTerminatorUpdate = 0;
let lastTrackUpdate = 0;
let cachedTrack = [];
let cachedFutureTrack = [];
let passPage = 0;
const PASSES_PER_PAGE = 5;
const MAX_DISPLAY_PASSES = 25;

// ISS orbital altitude as fraction of Earth radius for 3D globe
const ISS_ALT_GLOBE = 0.06;

// Create custom Leaflet icon for ISS using the updated icon
const createIssIcon = () => {
  return L.divIcon({
    className: 'iss-marker',
    html: '<div class="iss-icon"><img src="/iss-icon.svg" alt="ISS" width="36" height="36" /></div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

// User location marker
const createUserIcon = () => {
  return L.divIcon({
    className: 'user-marker',
    html: `<div style="width:12px;height:12px;background:#111827;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const createTerminator = () => {
  const t = terminator();
  t.setStyle({
    fillColor: '#000',
    fillOpacity: 0.12,
    stroke: true,
    color: '#333',
    weight: 0.5,
    opacity: 0.4
  });
  return t;
};

/**
 * Split a ground track into segments at antimeridian crossings
 * to prevent Leaflet from drawing lines across the entire map.
 */
const segmentTrack = (points) => {
  if (points.length < 2) return [points.map((p) => [p.lat, p.lon])];
  const segments = [];
  let segment = [[points[0].lat, points[0].lon]];
  for (let i = 1; i < points.length; i++) {
    const prevLon = points[i - 1].lon;
    const currLon = points[i].lon;
    // Detect antimeridian crossing (large jump > 180 degrees)
    if (Math.abs(currLon - prevLon) > 180) {
      segments.push(segment);
      segment = [];
    }
    segment.push([points[i].lat, points[i].lon]);
  }
  if (segment.length) segments.push(segment);
  return segments;
};

/**
 * Build a 3D ISS model using Three.js primitives for the globe.
 */
const buildIssMesh = () => {
  const group = new THREE.Group();

  // Main body
  const bodyGeo = new THREE.BoxGeometry(0.008, 0.004, 0.004);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.6, roughness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Solar panel left
  const panelGeo = new THREE.BoxGeometry(0.002, 0.018, 0.001);
  const panelMat = new THREE.MeshStandardMaterial({ color: '#1a1a3a', metalness: 0.3, roughness: 0.6 });
  const panelL = new THREE.Mesh(panelGeo, panelMat);
  panelL.position.set(-0.006, 0, 0);
  group.add(panelL);

  // Solar panel right
  const panelR = new THREE.Mesh(panelGeo, panelMat);
  panelR.position.set(0.006, 0, 0);
  group.add(panelR);

  // Glow ring
  const glowGeo = new THREE.RingGeometry(0.008, 0.012, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: '#2dd4bf',
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  return group;
};

const initVisualization = () => {
  map = L.map('map', {
    worldCopyJump: true,
    zoomControl: false,
    fadeAnimation: true,
    zoomAnimation: true
  }).setView([state.observer.lat, state.observer.lon], 2);

  // Add zoom control in bottom-left to not conflict with globe controls
  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  // Light-themed map tiles for monochrome aesthetic
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // ISS marker
  issMarker = L.marker([0, 0], {
    icon: createIssIcon(),
    zIndexOffset: 1000
  }).addTo(map);

  // User location marker
  userMarker = L.marker([state.observer.lat, state.observer.lon], {
    icon: createUserIcon(),
    zIndexOffset: 500
  }).addTo(map);

  // Ground track (past)
  trackLine = L.polyline([], {
    color: '#333',
    weight: 2,
    opacity: 0.7,
    smoothFactor: 1,
    className: 'iss-track'
  }).addTo(map);

  // Future track
  futureTrackLine = L.polyline([], {
    color: '#999',
    weight: 1.5,
    opacity: 0.4,
    dashArray: '5, 10',
    className: 'iss-track-future'
  }).addTo(map);

  terminatorLayer = createTerminator();
  terminatorLayer.addTo(map);

  const globeContainer = document.getElementById('globe');
  globe = Globe()(globeContainer)
    .globeImageUrl(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
    )
    .bumpImageUrl(
      'https://unpkg.com/three-globe/example/img/earth-topology.png'
    )
    .backgroundColor('#f0f2f5')
    .showAtmosphere(true)
    .atmosphereColor('#aaaaaa')
    .atmosphereAltitude(0.18)
    .pointAltitude(0.025)
    .pointColor(() => '#111827')
    .pointRadius(0.5)
    .pathColor(() => ['#333', '#999'])
    .pathStroke(2)
    .pathPointAlt(() => 0.015)
    .pathTransitionDuration(0)
    // ISS as a custom 3D object on the globe
    .customLayerData([])
    .customThreeObject(() => buildIssMesh())
    .customThreeObjectUpdate((obj, d) => {
      Object.assign(obj.position, globe.getCoords(d.lat, d.lng, d.alt));
      // Orient the ISS model to face the camera roughly
      obj.lookAt(globe.camera().position);
    })
    // HTML label for ISS
    .htmlElementsData([])
    .htmlElement(() => {
      const el = document.createElement('div');
      el.className = 'iss-3d-label';
      el.textContent = 'ISS';
      return el;
    })
    .htmlAltitude(ISS_ALT_GLOBE + 0.015);

  // Set initial point of view to observer location
  globe.pointOfView({ lat: state.observer.lat, lng: state.observer.lon, altitude: 2.5 });

  // Smooth controls
  globe.controls().enableDamping = true;
  globe.controls().dampingFactor = 0.1;
  globe.controls().rotateSpeed = 0.5;
  globe.controls().zoomSpeed = 0.8;
  globe.controls().autoRotate = false;

  // Lighting for the globe
  const ambientLight = new THREE.AmbientLight('#ffffff', 0.6);
  globe.scene().add(ambientLight);

  light = new THREE.DirectionalLight('#ffffff', 1.2);
  light.position.set(1, 1, 1);
  globe.scene().add(light);
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('vasey-settings');
    if (!saved) {
      // Persist defaults (imperial) for new users
      persistSettings();
      return;
    }
    const parsed = JSON.parse(saved);
    state.settings = { ...state.settings, ...parsed };
  } catch {
    // localStorage unavailable or corrupt - use defaults
  }
};

const persistSettings = () => {
  try {
    localStorage.setItem('vasey-settings', JSON.stringify(state.settings));
  } catch {
    // localStorage unavailable - settings won't persist
  }
};

const applySettings = () => {
  elements.settingUnits.value = state.settings.units;
  elements.settingRate.value = String(state.settings.updateRate);
  elements.settingTime.value = state.settings.timeFormat;
  elements.settingView.value = state.settings.view;
  updateViewPreference();
};

const resizeGlobe = () => {
  if (!globe) return;
  const globeEl = document.querySelector('#globe');
  if (!globeEl) return;
  const w = globeEl.clientWidth;
  const h = globeEl.clientHeight;
  if (w > 0 && h > 0) {
    globe.width(w);
    globe.height(h);
  }
};

const updateViewPreference = () => {
  const view = state.settings.view;
  const mapContainer = document.querySelector('.visualization__map-container');
  const globeContainer = document.querySelector('.visualization__globe-container');
  if (!map || !globe || !mapContainer || !globeContainer) return;
  if (view === 'map') {
    mapContainer.style.display = 'block';
    globeContainer.style.display = 'none';
  } else if (view === 'globe') {
    mapContainer.style.display = 'none';
    globeContainer.style.display = 'block';
  } else {
    mapContainer.style.display = 'block';
    globeContainer.style.display = 'block';
  }
  // Defer size recalculation to next frame so layout is settled
  requestAnimationFrame(() => {
    map.invalidateSize();
    resizeGlobe();
  });
};

const updateLocationInputs = () => {
  elements.locationLat.value = state.observer.lat.toFixed(4);
  elements.locationLon.value = state.observer.lon.toFixed(4);
};

const updateStatusPanel = (position) => {
  if (!position) return;
  const lat = formatCoord(position.lat, 'N', 'S');
  const lon = formatCoord(position.lon, 'E', 'W');
  const altitude = formatAltitude(position.altitude, state.settings.units);
  const speed = formatSpeed(position.speed, state.settings.units);
  elements.issStatus.textContent = `${lat}, ${lon}\n${altitude}\n${speed}`;
};

const updateCountdown = () => {
  if (!state.passes.length) {
    elements.countdown.textContent = '--';
    return;
  }
  const now = new Date();
  // Find next upcoming pass
  const next = state.passes.find((pass) => pass.start > now);
  if (!next) {
    elements.countdown.textContent = 'No upcoming passes';
    return;
  }
  const diff = next.start - now;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (hours > 0) {
    elements.countdown.textContent = `${hours}h ${minutes}m ${seconds}s`;
  } else {
    elements.countdown.textContent = `${minutes}m ${seconds}s`;
  }
};

const updateVisibilityNow = () => {
  if (!state.passes.length) {
    elements.visibilityState.textContent = '--';
    return;
  }
  const now = new Date();
  const active = state.passes.find(
    (pass) => now >= pass.start && now <= pass.end
  );
  if (!active) {
    // Check if a visible pass is coming up
    const nextVisible = state.passes.find(
      (pass) => pass.visible && pass.start > now
    );
    if (nextVisible) {
      const diffHours = (nextVisible.start - now) / 3600000;
      if (diffHours < 1) {
        elements.visibilityState.textContent = 'Visible pass approaching';
      } else {
        elements.visibilityState.textContent = 'Below your horizon';
      }
    } else {
      elements.visibilityState.textContent = 'Below your horizon';
    }
  } else {
    elements.visibilityState.textContent =
      active.visible ? 'VISIBLE NOW — Look up!' : 'Overhead but not visible';
  }
};

const renderTopPicks = () => {
  elements.topPicks.innerHTML = '';
  const picks = [...state.passes]
    .filter((pass) => pass.visible)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!picks.length) {
    elements.topPicks.innerHTML =
      '<div class="card"><p class="card__title">No visible passes in the next 72 hours.</p><p class="card__meta">Try adjusting your location or check back later. Visibility requires dark skies at your location and a sunlit ISS.</p></div>';
    return;
  }

  picks.forEach((pass) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="badge badge--score">Score ${pass.score}</div>
      <p class="card__title">${formatDateTime(
        pass.start,
        state.settings.timeFormat
      )}</p>
      <p class="card__meta">Peak ${pass.maxElevation.toFixed(
        0
      )}° | ${formatDuration(pass.duration)} | ${pass.brightness}</p>
    `;
    elements.topPicks.appendChild(card);
  });
};

const buildShareUrl = (pass) => {
  const params = new URLSearchParams();
  params.set('lat', state.observer.lat.toFixed(4));
  params.set('lon', state.observer.lon.toFixed(4));
  params.set('pass', pass.start.toISOString());
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
};

const createICS = (pass) => {
  const start = pass.start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = pass.end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VASEY/SPACE//ISS Observer//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:ISS pass over ${state.locationName}`,
    `DESCRIPTION:Peak elevation ${pass.maxElevation.toFixed(0)}° — ${pass.brightness}. Look ${formatAzimuth(pass.startAz)} to start.`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');
};

const getDisplayPasses = () => {
  const now = new Date();
  const upcoming = state.passes.filter((p) => p.end > now);

  // Prioritize visible passes: put first 2 upcoming visible at top, then
  // up to 3 more high-score visible, then fill with chronological
  const visible = upcoming.filter((p) => p.visible);

  // First 2 upcoming visible (by time)
  const firstVisible = visible.slice(0, 2);
  // Up to 3 more visible sorted by score
  const bonusVisible = visible
    .slice(2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const prioritized = [...firstVisible, ...bonusVisible];
  const prioritizedSet = new Set(prioritized);

  // Fill remaining slots with chronological passes (visible or not)
  const rest = upcoming
    .filter((p) => !prioritizedSet.has(p))
    .slice(0, MAX_DISPLAY_PASSES - prioritized.length);

  // Combine and sort all chronologically
  return [...prioritized, ...rest].sort((a, b) => a.start - b.start).slice(0, MAX_DISPLAY_PASSES);
};

const renderPassCard = (pass) => {
  const container = document.createElement('div');
  container.className = `pass${pass.visible ? ' pass--visible' : ''}`;
  const directionLabel = `${formatAzimuth(pass.startAz)} → ${formatAzimuth(
    pass.endAz
  )}`;
  container.innerHTML = `
    <div class="pass__header">
      <div>
        <div class="badge${pass.visible ? ' badge--visible' : ''}">${pass.visible ? 'Visible' : 'Overhead'}</div>
        <p class="card__title">${formatDateTime(
          pass.start,
          state.settings.timeFormat
        )}</p>
        <p class="card__meta">${describeVisibility(pass)}</p>
      </div>
      <div class="pass__actions">
        <button class="button button--small" data-share>Share</button>
        <button class="button button--small" data-remind>Reminder</button>
      </div>
    </div>
    <div>
      <div class="pass__label">Start</div>
      <div class="pass__value">${formatTime(
        pass.start,
        state.settings.timeFormat
      )}</div>
    </div>
    <div>
      <div class="pass__label">Peak</div>
      <div class="pass__value">${formatTime(
        pass.peakTime,
        state.settings.timeFormat
      )} | ${pass.maxElevation.toFixed(0)}°</div>
    </div>
    <div>
      <div class="pass__label">End</div>
      <div class="pass__value">${formatTime(
        pass.end,
        state.settings.timeFormat
      )}</div>
    </div>
    <div>
      <div class="pass__label">Direction</div>
      <div class="pass__value">${directionLabel}</div>
    </div>
    <div>
      <div class="pass__label">Duration</div>
      <div class="pass__value">${formatDuration(pass.duration)}</div>
    </div>
    <div>
      <div class="pass__label">Brightness</div>
      <div class="pass__value">${pass.brightness}</div>
    </div>
  `;
  const shareButton = container.querySelector('[data-share]');
  const remindButton = container.querySelector('[data-remind]');

  shareButton.addEventListener('click', async () => {
    const shareUrl = buildShareUrl(pass);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ISS pass details',
          text: `Next ISS pass over ${state.locationName}`,
          url: shareUrl
        });
      } catch {
        // User cancelled share dialog
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        elements.locationFeedback.textContent =
          'Share link copied to clipboard.';
      } catch {
        elements.locationFeedback.textContent =
          'Unable to copy link.';
      }
    }
  });

  remindButton.addEventListener('click', () => {
    const ics = createICS(pass);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iss-pass-${pass.start.toISOString().slice(0, 10)}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  });

  return container;
};

const renderPasses = () => {
  elements.passes.innerHTML = '';
  if (!state.passes.length) {
    elements.passes.innerHTML =
      '<div class="card"><p class="card__title">No passes available yet.</p><p class="card__meta">Update your location or wait for orbital data to load.</p></div>';
    return;
  }

  const displayPasses = getDisplayPasses();
  const totalPages = Math.ceil(displayPasses.length / PASSES_PER_PAGE);

  // Clamp current page
  if (passPage >= totalPages) passPage = Math.max(0, totalPages - 1);

  const start = passPage * PASSES_PER_PAGE;
  const pagePasses = displayPasses.slice(start, start + PASSES_PER_PAGE);

  pagePasses.forEach((pass) => {
    elements.passes.appendChild(renderPassCard(pass));
  });

  // Add pagination controls if more than one page
  if (totalPages > 1) {
    const nav = document.createElement('div');
    nav.className = 'passes__nav';
    nav.innerHTML = `
      <button class="passes__nav-btn" data-page="prev" ${passPage === 0 ? 'disabled' : ''} aria-label="Previous passes">&lsaquo;</button>
      <span class="passes__nav-info">${passPage + 1} / ${totalPages}</span>
      <button class="passes__nav-btn" data-page="next" ${passPage >= totalPages - 1 ? 'disabled' : ''} aria-label="Next passes">&rsaquo;</button>
    `;
    nav.querySelector('[data-page="prev"]').addEventListener('click', () => {
      if (passPage > 0) {
        passPage--;
        renderPasses();
      }
    });
    nav.querySelector('[data-page="next"]').addEventListener('click', () => {
      if (passPage < totalPages - 1) {
        passPage++;
        renderPasses();
      }
    });
    elements.passes.appendChild(nav);
  }
};

const updateNextPass = () => {
  if (!state.passes.length) {
    elements.nextPass.textContent = 'No passes available yet.';
    return;
  }
  const now = new Date();
  // Find next visible pass specifically
  const nextVisible = state.passes.find(
    (pass) => pass.visible && pass.start > now
  );
  if (nextVisible) {
    elements.nextPass.textContent = `${formatDateTime(
      nextVisible.start,
      state.settings.timeFormat
    )} | ${nextVisible.maxElevation.toFixed(0)}° peak`;
  } else {
    // Show next pass even if not visible
    const next = state.passes.find((pass) => pass.start > now);
    if (next) {
      elements.nextPass.textContent = `${formatDateTime(
        next.start,
        state.settings.timeFormat
      )} (not visible)`;
    } else {
      elements.nextPass.textContent = 'No upcoming passes';
    }
  }
};

const updateMapAndGlobe = (position) => {
  if (!position) return;

  // Update ISS marker
  issMarker.setLatLng([position.lat, position.lon]);

  // Update ground tracks every 60 seconds
  if (Date.now() - lastTrackUpdate > 60 * 1000) {
    // Past track (90 minutes — one full orbit)
    cachedTrack = computeGroundTrack(state.satrec, new Date(), 90, 30);

    // Segment tracks at antimeridian crossings for correct 2D display
    const pastSegments = segmentTrack(cachedTrack);
    trackLine.setLatLngs(pastSegments);

    // Future track (90 minutes ahead — one full orbit)
    const futureStart = new Date();
    cachedFutureTrack = computeGroundTrack(state.satrec, futureStart, 90, 30);
    const futureSegments = segmentTrack(cachedFutureTrack);
    futureTrackLine.setLatLngs(futureSegments);

    lastTrackUpdate = Date.now();
  }

  // Update terminator every 5 minutes
  if (Date.now() - lastTerminatorUpdate > 5 * 60 * 1000) {
    terminatorLayer.remove();
    terminatorLayer = createTerminator();
    terminatorLayer.addTo(map);
    lastTerminatorUpdate = Date.now();
  }

  // Update 3D globe — ISS as custom 3D object
  globe.customLayerData([{
    lat: position.lat,
    lng: position.lon,
    alt: ISS_ALT_GLOBE
  }]);

  // ISS label
  globe.htmlElementsData([{
    lat: position.lat,
    lng: position.lon,
    alt: ISS_ALT_GLOBE + 0.015
  }]);

  // Observer point
  globe.pointsData([{
    lat: state.observer.lat,
    lng: state.observer.lon,
    altitude: 0.01,
    color: '#14b8a6'
  }]);

  // Both past and future tracks on globe
  const paths = [];
  if (cachedTrack.length > 1) {
    paths.push(cachedTrack.map((point) => ({
      lat: point.lat,
      lng: point.lon
    })));
  }
  if (cachedFutureTrack.length > 1) {
    paths.push(cachedFutureTrack.map((point) => ({
      lat: point.lat,
      lng: point.lon
    })));
  }
  globe.pathsData(paths);
};

const updateLoop = () => {
  if (!state.satrec) return;
  const position = computePosition(state.satrec, new Date());
  updateStatusPanel(position);
  updateMapAndGlobe(position);
  updateVisibilityNow();
  updateCountdown();

  // Update sun position on globe for day/night lighting
  const sun = getSunSubPoint(new Date());
  const phi = THREE.MathUtils.degToRad(90 - sun.lat);
  const theta = THREE.MathUtils.degToRad(sun.lon + 180);
  light.position.set(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );
};

const recalcPasses = () => {
  if (!state.satrec) return;
  state.passes = computePasses(state.satrec, state.observer);
  passPage = 0;
  updateNextPass();
  renderTopPicks();
  renderPasses();
  updateVisibilityNow();
  updateCountdown();
};

const applyLocation = async (lat, lon, name = '') => {
  // Validate coordinates
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    elements.locationFeedback.textContent = 'Coordinates out of valid range.';
    return;
  }

  state.observer.lat = lat;
  state.observer.lon = lon;
  state.locationName = name || 'Custom location';

  try {
    localStorage.setItem(
      'vasey-location',
      JSON.stringify({ lat, lon, name: state.locationName })
    );
  } catch {
    // localStorage unavailable
  }

  // Update user marker
  userMarker.setLatLng([lat, lon]);

  // Smooth fly-to animation
  map.flyTo([lat, lon], 3, {
    duration: 1.5,
    easeLinearity: 0.25
  });

  if (globe) {
    globe.pointOfView({ lat, lng: lon, altitude: 2.5 }, 1500);
  }

  updateLocationInputs();
  updateLocationDisplay();
  recalcPasses();
  elements.locationFeedback.textContent = `Location set to ${state.locationName}.`;
};

const searchLocation = async (query) => {
  const params = new URLSearchParams({
    format: 'json',
    q: query.trim(),
    limit: '1'
  });
  const email = window.VASEY_CONFIG?.nominatimEmail;
  if (email) {
    params.set('email', email);
  }
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error('Unable to search location.');
  }
  const results = await response.json();
  if (!results.length) {
    throw new Error('No results found for that location.');
  }
  return results[0];
};

const reverseGeocode = async (lat, lon) => {
  const params = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lon),
    zoom: '10'
  });
  const email = window.VASEY_CONFIG?.nominatimEmail;
  if (email) {
    params.set('email', email);
  }
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
  );
  if (!response.ok) return null;
  const result = await response.json();
  if (!result || result.error) return null;
  // Build a short readable name from address components
  const addr = result.address || {};
  const city = addr.city || addr.town || addr.village || addr.hamlet || '';
  const stateCode = addr.state || '';
  const country = addr.country_code?.toUpperCase() || '';
  if (city && stateCode) return `${city}, ${stateCode}`;
  if (city && country) return `${city}, ${country}`;
  if (result.display_name) {
    // Return first two parts of the display name for brevity
    const parts = result.display_name.split(',').map((s) => s.trim());
    return parts.slice(0, 2).join(', ');
  }
  return null;
};

const updateLocationDisplay = () => {
  if (elements.locationName) {
    elements.locationName.textContent = state.locationName;
  }
  if (elements.locationCoords) {
    elements.locationCoords.textContent =
      `${state.observer.lat.toFixed(4)}, ${state.observer.lon.toFixed(4)}`;
  }
};

const bindEvents = () => {
  // Settings dropdown toggle
  const settingsToggle = document.querySelector('#settings-toggle');
  const settingsPanel = document.querySelector('.settings-dropdown');
  const settingsContent = document.querySelector('#settings-content');
  if (settingsToggle) {
    const setSettingsExpanded = (expanded) => {
      settingsToggle.setAttribute('aria-expanded', String(expanded));
      if (settingsPanel) settingsPanel.classList.toggle('is-open', expanded);
      if (!settingsContent) return;

      if (expanded) {
        settingsContent.hidden = false;
        requestAnimationFrame(() => {
          if (settingsPanel) settingsPanel.classList.add('is-open');
        });
      } else {
        if (settingsContent.hidden) return;
        const handleClose = () => {
          settingsContent.hidden = true;
          settingsContent.removeEventListener('transitionend', handleClose);
        };
        settingsContent.addEventListener('transitionend', handleClose);
      }
    };

    const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
    setSettingsExpanded(isExpanded);

    settingsToggle.addEventListener('click', () => {
      const expanded = settingsToggle.getAttribute('aria-expanded') === 'true';
      setSettingsExpanded(!expanded);
    });
  }

  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
    resizeGlobe();
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (loopId) {
      clearInterval(loopId);
    }
  });

  elements.useLocation.addEventListener('click', () => {
    if (!navigator.geolocation) {
      elements.locationFeedback.textContent = 'Geolocation is not supported by your browser.';
      return;
    }
    elements.locationFeedback.textContent = 'Requesting location...';
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Apply immediately with temporary name, then resolve actual city
        await applyLocation(latitude, longitude, 'Locating...');
        try {
          const cityName = await reverseGeocode(latitude, longitude);
          if (cityName) {
            state.locationName = cityName;
            try {
              localStorage.setItem(
                'vasey-location',
                JSON.stringify({ lat: latitude, lon: longitude, name: cityName })
              );
            } catch { /* localStorage unavailable */ }
            updateLocationDisplay();
            elements.locationFeedback.textContent = `Location set to ${cityName}.`;
          }
        } catch {
          // Reverse geocoding failed — keep coordinates-based name
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          elements.locationFeedback.textContent =
            'Location permission denied. Enter coordinates manually.';
        } else {
          elements.locationFeedback.textContent =
            'Unable to determine location. Enter coordinates manually.';
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  // Support Enter key on search field
  elements.locationSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      elements.applyLocation.click();
    }
  });

  elements.applyLocation.addEventListener('click', async () => {
    try {
      if (elements.locationSearch.value.trim()) {
        elements.locationFeedback.textContent = 'Searching...';
        const result = await searchLocation(elements.locationSearch.value);
        await applyLocation(
          parseFloat(result.lat),
          parseFloat(result.lon),
          result.display_name
        );
      } else {
        const lat = parseFloat(elements.locationLat.value);
        const lon = parseFloat(elements.locationLon.value);
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          throw new Error('Enter valid coordinates.');
        }
        if (lat < -90 || lat > 90) {
          throw new Error('Latitude must be between -90 and 90.');
        }
        if (lon < -180 || lon > 180) {
          throw new Error('Longitude must be between -180 and 180.');
        }
        await applyLocation(lat, lon, 'Custom coordinates');
      }
    } catch (error) {
      elements.locationFeedback.textContent = error.message;
    }
  });

  elements.toggleView.addEventListener('click', () => {
    if (state.settings.view === 'both') {
      state.settings.view = 'map';
    } else if (state.settings.view === 'map') {
      state.settings.view = 'globe';
    } else {
      state.settings.view = 'both';
    }
    updateViewPreference();
    persistSettings();
  });

  elements.centerIss.addEventListener('click', () => {
    const position = computePosition(state.satrec, new Date());
    if (position) {
      map.flyTo([position.lat, position.lon], 3, {
        duration: 1.5,
        easeLinearity: 0.25
      });
      globe.pointOfView(
        { lat: position.lat, lng: position.lon, altitude: 2 },
        1500
      );
    }
  });

  elements.centerUser.addEventListener('click', () => {
    map.flyTo([state.observer.lat, state.observer.lon], 4, {
      duration: 1.5,
      easeLinearity: 0.25
    });
    globe.pointOfView(
      {
        lat: state.observer.lat,
        lng: state.observer.lon,
        altitude: 2
      },
      1500
    );
  });

  // Globe zoom controls
  const zoomIn = document.querySelector('#globe-zoom-in');
  const zoomOut = document.querySelector('#globe-zoom-out');
  if (zoomIn) {
    zoomIn.addEventListener('click', () => {
      if (!globe) return;
      const pov = globe.pointOfView();
      globe.pointOfView({ ...pov, altitude: Math.max(0.4, pov.altitude * 0.65) }, 400);
    });
  }
  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      if (!globe) return;
      const pov = globe.pointOfView();
      globe.pointOfView({ ...pov, altitude: Math.min(6, pov.altitude * 1.5) }, 400);
    });
  }

  elements.settingUnits.addEventListener('change', (event) => {
    state.settings.units = event.target.value;
    persistSettings();
    updateLoop();
    renderTopPicks();
    renderPasses();
  });

  elements.settingRate.addEventListener('change', (event) => {
    state.settings.updateRate = Number(event.target.value);
    persistSettings();
    startLoop();
  });

  elements.settingTime.addEventListener('change', (event) => {
    state.settings.timeFormat = event.target.value;
    persistSettings();
    updateNextPass();
    renderTopPicks();
    renderPasses();
  });

  elements.settingView.addEventListener('change', (event) => {
    state.settings.view = event.target.value;
    persistSettings();
    updateViewPreference();
  });
};

let loopId;
const startLoop = () => {
  if (loopId) {
    clearInterval(loopId);
  }
  loopId = setInterval(updateLoop, state.settings.updateRate);
};

const hydrateFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const lat = params.get('lat');
  const lon = params.get('lon');
  if (lat && lon) {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLon)) {
      state.observer.lat = parsedLat;
      state.observer.lon = parsedLon;
    }
  }
};

// Register service worker for PWA
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch {
      // Service worker registration failed - app still works without it
    }
  }
};

const init = async () => {
  try {
    elements.issStatus.textContent = 'Initializing...';
    loadSettings();
    hydrateFromUrl();
    initVisualization();
    applySettings();
    updateLocationInputs();

    // Defer initial globe sizing to ensure layout is settled
    requestAnimationFrame(() => {
      resizeGlobe();
    });

    // Load saved location
    try {
      const savedLocation = localStorage.getItem('vasey-location');
      if (savedLocation) {
        const parsed = JSON.parse(savedLocation);
        state.observer.lat = parsed.lat;
        state.observer.lon = parsed.lon;
        state.locationName = parsed.name || 'Custom location';
        map.setView([state.observer.lat, state.observer.lon], 3);
        userMarker.setLatLng([state.observer.lat, state.observer.lon]);
        updateLocationInputs();
      }
    } catch {
      // localStorage unavailable or corrupt
    }
    updateLocationDisplay();

    // Fetch TLE data with retry
    let retries = 3;
    while (retries > 0) {
      try {
        const tle = await fetchTle();
        state.satrec = getSatrec(tle);
        recalcPasses();
        startLoop();
        updateLoop();
        break;
      } catch (error) {
        retries--;
        if (retries > 0) {
          elements.issStatus.textContent = 'Retrying orbital data fetch...';
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          elements.issStatus.textContent = 'Unable to load ISS orbital data. Refresh to try again.';
          elements.locationFeedback.textContent = error.message;
        }
      }
    }

    // Register PWA service worker
    registerServiceWorker();
  } catch (error) {
    elements.issStatus.textContent = 'Failed to initialize. Refresh to try again.';
    console.error('ISS Observer init error:', error);
  }
};

bindEvents();
init();
