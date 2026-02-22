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

// Monochrome ISS Icon SVG for map marker
const issIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
  <defs>
    <linearGradient id="mBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#2d2d2d"/>
      <stop offset="100%" style="stop-color:#111"/>
    </linearGradient>
  </defs>
  <rect x="24" y="28" width="16" height="8" rx="2" fill="url(#mBody)" stroke="#888" stroke-width="0.8"/>
  <g transform="rotate(-5 20 32)">
    <rect x="2" y="26" width="18" height="12" rx="1" fill="#222" stroke="#666" stroke-width="1"/>
    <line x1="5" y1="26" x2="5" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="8" y1="26" x2="8" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="11" y1="26" x2="11" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="14" y1="26" x2="14" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="17" y1="26" x2="17" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
  </g>
  <g transform="rotate(5 44 32)">
    <rect x="44" y="26" width="18" height="12" rx="1" fill="#222" stroke="#666" stroke-width="1"/>
    <line x1="47" y1="26" x2="47" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="50" y1="26" x2="50" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="53" y1="26" x2="53" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="56" y1="26" x2="56" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
    <line x1="59" y1="26" x2="59" y2="38" stroke="#555" stroke-width="0.4" opacity="0.7"/>
  </g>
  <rect x="20" y="30" width="24" height="4" fill="#333" stroke="#555" stroke-width="0.5"/>
  <ellipse cx="32" cy="32" rx="4" ry="3" fill="#eee" stroke="#999" stroke-width="0.5"/>
  <circle cx="28" cy="32" r="2" fill="#333" opacity="0.9"/>
  <circle cx="36" cy="32" r="2" fill="#333" opacity="0.9"/>
  <rect x="22" y="20" width="3" height="6" fill="#ddd" opacity="0.8"/>
  <rect x="39" y="20" width="3" height="6" fill="#ddd" opacity="0.8"/>
  <rect x="22" y="38" width="3" height="6" fill="#ddd" opacity="0.8"/>
  <rect x="39" y="38" width="3" height="6" fill="#ddd" opacity="0.8"/>
  <ellipse cx="32" cy="32" rx="8" ry="6" fill="none" stroke="#999" stroke-width="0.5" opacity="0.3">
    <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite"/>
  </ellipse>
</svg>`;

// Create custom Leaflet icon for ISS
const createIssIcon = () => {
  return L.divIcon({
    className: 'iss-marker',
    html: `<div class="iss-icon">${issIconSvg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
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

const createTerminator = () => terminator();

const initVisualization = () => {
  map = L.map('map', {
    worldCopyJump: true,
    zoomControl: false,
    fadeAnimation: true,
    zoomAnimation: true
  }).setView([state.observer.lat, state.observer.lon], 2);

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
    .pathTransitionDuration(0);

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

  // ISS glow on globe
  const issGlow = new THREE.PointLight('#444444', 0.4, 50);
  issGlow.position.set(0, 0, 1.02);
  globe.scene().add(issGlow);
  globe._issGlow = issGlow;
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('vasey-settings');
    if (!saved) return;
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

const updateViewPreference = () => {
  const view = state.settings.view;
  const mapEl = document.querySelector('#map');
  const globeEl = document.querySelector('#globe');
  if (!map || !globe) return;
  if (view === 'map') {
    mapEl.style.display = 'block';
    globeEl.style.display = 'none';
  } else if (view === 'globe') {
    mapEl.style.display = 'none';
    globeEl.style.display = 'block';
  } else {
    mapEl.style.display = 'block';
    globeEl.style.display = 'block';
  }
  setTimeout(() => {
    map.invalidateSize();
    globe.width(globeEl.clientWidth);
    globe.height(globeEl.clientHeight);
  }, 0);
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
  elements.issStatus.textContent = `${lat}, ${lon} | ${altitude} | ${speed}`;
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

const renderPasses = () => {
  elements.passes.innerHTML = '';
  if (!state.passes.length) {
    elements.passes.innerHTML =
      '<div class="card"><p class="card__title">No passes available yet.</p><p class="card__meta">Update your location or wait for orbital data to load.</p></div>';
    return;
  }

  state.passes.slice(0, 12).forEach((pass) => {
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

    elements.passes.appendChild(container);
  });
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
    // Past track (90 minutes)
    cachedTrack = computeGroundTrack(state.satrec, new Date(), 90, 60);
    trackLine.setLatLngs(cachedTrack.map((point) => [point.lat, point.lon]));

    // Future track (45 minutes ahead)
    const futureStart = new Date();
    cachedFutureTrack = computeGroundTrack(state.satrec, futureStart, 45, 60);
    futureTrackLine.setLatLngs(cachedFutureTrack.map((point) => [point.lat, point.lon]));

    lastTrackUpdate = Date.now();
  }

  // Update terminator every 5 minutes
  if (Date.now() - lastTerminatorUpdate > 5 * 60 * 1000) {
    terminatorLayer.remove();
    terminatorLayer = createTerminator();
    terminatorLayer.addTo(map);
    lastTerminatorUpdate = Date.now();
  }

  // Update 3D globe
  globe.pointsData([{
    lat: position.lat,
    lng: position.lon,
    altitude: 0.025,
    color: '#111827'
  }]);

  globe.pathsData([
    {
      path: cachedTrack.map((point) => ({
        lat: point.lat,
        lng: point.lon
      }))
    }
  ]);

  // Update ISS glow position on globe
  if (globe._issGlow) {
    const phi = THREE.MathUtils.degToRad(90 - position.lat);
    const theta = THREE.MathUtils.degToRad(position.lon + 180);
    const radius = 1.025;
    globe._issGlow.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }
};

const updateLoop = () => {
  if (!state.satrec) return;
  const position = computePosition(state.satrec, new Date());
  updateStatusPanel(position);
  updateMapAndGlobe(position);
  updateVisibilityNow();
  updateCountdown();

  // Update sun position on globe
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

const bindEvents = () => {
  // Settings dropdown toggle
  const settingsToggle = document.querySelector('#settings-toggle');
  if (settingsToggle) {
    settingsToggle.addEventListener('click', () => {
      const expanded = settingsToggle.getAttribute('aria-expanded') === 'true';
      settingsToggle.setAttribute('aria-expanded', String(!expanded));
    });
  }

  window.addEventListener('resize', () => {
    const globeEl = document.querySelector('#globe');
    if (globe && map) {
      globe.width(globeEl.clientWidth);
      globe.height(globeEl.clientHeight);
      map.invalidateSize();
    }
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
    elements.locationFeedback.textContent = 'Requesting location permission...';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        applyLocation(latitude, longitude, 'My location');
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

    const globeEl = document.querySelector('#globe');
    globe.width(globeEl.clientWidth);
    globe.height(globeEl.clientHeight);

    // Load saved location
    try {
      const savedLocation = localStorage.getItem('vasey-location');
      if (savedLocation) {
        const parsed = JSON.parse(savedLocation);
        state.observer.lat = parsed.lat;
        state.observer.lon = parsed.lon;
        state.locationName = parsed.name;
        map.setView([state.observer.lat, state.observer.lon], 3);
        userMarker.setLatLng([state.observer.lat, state.observer.lon]);
        updateLocationInputs();
      }
    } catch {
      // localStorage unavailable or corrupt
    }

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
          elements.issStatus.textContent = `Retrying orbital data fetch...`;
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
