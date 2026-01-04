const { L, Globe, THREE, terminator } = window;
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
    units: 'metric',
    updateRate: 1000,
    timeFormat: '24',
    view: 'both'
  }
};

const elements = {
  issStatus: document.querySelector('#iss-status'),
  nextPass: document.querySelector('#next-pass'),
  visibilityState: document.querySelector('#visibility-state'),
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
let trackLine;
let terminatorLayer;
let globe;
let light;
let lastTerminatorUpdate = 0;
let lastTrackUpdate = 0;
let cachedTrack = [];

const createTerminator = () =>
  typeof terminator === 'function' ? terminator() : L.terminator();

const initVisualization = () => {
  map = L.map('map', {
    worldCopyJump: true,
    zoomControl: false
  }).setView([state.observer.lat, state.observer.lon], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  issMarker = L.circleMarker([0, 0], {
    radius: 6,
    color: '#ff6b2c',
    fillColor: '#ff6b2c',
    fillOpacity: 0.9
  }).addTo(map);

  trackLine = L.polyline([], { color: '#f5f7fb', weight: 1 }).addTo(map);
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
    .backgroundColor('#0b0d11')
    .showAtmosphere(true)
    .atmosphereColor('#ff6b2c')
    .atmosphereAltitude(0.15)
    .pointAltitude(0.02)
    .pointColor(() => '#ff6b2c')
    .pointRadius(0.4)
    .pathColor(() => '#ffffff')
    .pathStroke(1.2)
    .pathPointAlt(() => 0.02);

  globe.controls().enableDamping = true;
  light = new THREE.DirectionalLight('#ffffff', 1.2);
  light.position.set(1, 1, 1);
  globe.scene().add(light);
};

const loadSettings = () => {
  const saved = localStorage.getItem('vasey-settings');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.settings = { ...state.settings, ...parsed };
  } catch (error) {
    console.warn('Unable to load settings', error);
  }
};

const persistSettings = () => {
  localStorage.setItem('vasey-settings', JSON.stringify(state.settings));
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
  elements.issStatus.textContent = `${lat}, ${lon} • ${altitude} • ${speed}`;
};

const updateVisibilityNow = () => {
  if (!state.passes.length) {
    elements.visibilityState.textContent = '—';
    return;
  }
  const now = new Date();
  const active = state.passes.find(
    (pass) => now >= pass.start && now <= pass.end
  );
  if (!active) {
    elements.visibilityState.textContent = 'Below your horizon';
  } else {
    elements.visibilityState.textContent =
      active.visible ? 'Visible in dark skies' : 'Overhead but not visible';
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
      '<div class="card"><p class="card__title">No visible passes in the next 72 hours.</p><p class="card__meta">Try adjusting your location or check back later.</p></div>';
    return;
  }

  picks.forEach((pass) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="badge">Score ${pass.score}</div>
      <p class="card__title">${formatDateTime(
        pass.start,
        state.settings.timeFormat
      )}</p>
      <p class="card__meta">Peak ${pass.maxElevation.toFixed(
        0
      )}° • ${formatDuration(pass.duration)} • ${pass.brightness}</p>
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
    'PRODID:-//VASEY/SPACE//ISS Tracker//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:ISS pass over ${state.locationName}`,
    `DESCRIPTION:Peak elevation ${pass.maxElevation.toFixed(0)}° — ${pass.brightness}.`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');
};

const renderPasses = () => {
  elements.passes.innerHTML = '';
  if (!state.passes.length) {
    elements.passes.innerHTML =
      '<div class="card"><p class="card__title">No passes available yet.</p><p class="card__meta">Update your location or try again in a moment.</p></div>';
    return;
  }

  state.passes.slice(0, 12).forEach((pass) => {
    const container = document.createElement('div');
    container.className = 'pass';
    const directionLabel = `${formatAzimuth(pass.startAz)} → ${formatAzimuth(
      pass.endAz
    )}`;
    container.innerHTML = `
      <div class="pass__header">
        <div>
          <div class="badge">${pass.visible ? 'Visible' : 'Overhead'}</div>
          <p class="card__title">${formatDateTime(
            pass.start,
            state.settings.timeFormat
          )}</p>
          <p class="card__meta">${describeVisibility(pass)}</p>
        </div>
        <div class="pass__actions">
          <button class="button" data-share>Share</button>
          <button class="button" data-remind>Reminder</button>
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
        )} • ${pass.maxElevation.toFixed(0)}°</div>
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
        await navigator.share({
          title: 'ISS pass details',
          text: `Next ISS pass over ${state.locationName}`,
          url: shareUrl
        });
      } else {
        try {
          await navigator.clipboard.writeText(shareUrl);
          elements.locationFeedback.textContent =
            'Share link copied to clipboard.';
        } catch {
          elements.locationFeedback.textContent =
            'Unable to copy link. Share manually: ' + shareUrl;
        }
      }
    });

    remindButton.addEventListener('click', () => {
      const ics = createICS(pass);
      const blob = new Blob([ics], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `iss-pass-${pass.start.toISOString()}.ics`;
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
  const next = state.passes[0];
  elements.nextPass.textContent = `${formatDateTime(
    next.start,
    state.settings.timeFormat
  )} • ${next.maxElevation.toFixed(0)}° peak`;
};

const updateMapAndGlobe = (position) => {
  if (!position) return;
  issMarker.setLatLng([position.lat, position.lon]);
  if (Date.now() - lastTrackUpdate > 60 * 1000) {
    cachedTrack = computeGroundTrack(state.satrec, new Date(), 90, 60);
    trackLine.setLatLngs(cachedTrack.map((point) => [point.lat, point.lon]));
    lastTrackUpdate = Date.now();
  }
  if (Date.now() - lastTerminatorUpdate > 5 * 60 * 1000) {
    terminatorLayer.remove();
    terminatorLayer = createTerminator();
    terminatorLayer.addTo(map);
    lastTerminatorUpdate = Date.now();
  }

  globe.pointsData([{ lat: position.lat, lng: position.lon }]);
  globe.pathsData([
    {
      path: cachedTrack.map((point) => ({
        lat: point.lat,
        lng: point.lon
      }))
    }
  ]);
};

const updateLoop = () => {
  if (!state.satrec) return;
  const position = computePosition(state.satrec, new Date());
  updateStatusPanel(position);
  updateMapAndGlobe(position);
  updateVisibilityNow();
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
};

const applyLocation = async (lat, lon, name = '') => {
  state.observer.lat = lat;
  state.observer.lon = lon;
  state.locationName = name || 'Custom location';
  localStorage.setItem(
    'vasey-location',
    JSON.stringify({ lat, lon, name: state.locationName })
  );
  map.setView([lat, lon], 3);
  updateLocationInputs();
  recalcPasses();
  elements.locationFeedback.textContent = `Location set to ${state.locationName}.`;
};

const searchLocation = async (query) => {
  const params = new URLSearchParams({
    format: 'json',
    q: query
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
    throw new Error('No results found.');
  }
  return results[0];
};

const bindEvents = () => {
  window.addEventListener('resize', () => {
    const globeEl = document.querySelector('#globe');
    if (globe && map) {
      globe.width(globeEl.clientWidth);
      globe.height(globeEl.clientHeight);
      map.invalidateSize();
    }
  });
  elements.useLocation.addEventListener('click', () => {
    elements.locationFeedback.textContent = 'Requesting location permission…';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        applyLocation(latitude, longitude, 'My location');
      },
      () => {
        elements.locationFeedback.textContent =
          'Unable to access location. Enter coordinates manually.';
      }
    );
  });

  elements.applyLocation.addEventListener('click', async () => {
    try {
      if (elements.locationSearch.value.trim()) {
        elements.locationFeedback.textContent = 'Searching…';
        const result = await searchLocation(elements.locationSearch.value.trim());
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
      map.setView([position.lat, position.lon], 3);
      globe.pointOfView({ lat: position.lat, lng: position.lon, altitude: 2 });
    }
  });

  elements.centerUser.addEventListener('click', () => {
    map.setView([state.observer.lat, state.observer.lon], 4);
    globe.pointOfView({
      lat: state.observer.lat,
      lng: state.observer.lon,
      altitude: 2
    });
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
    state.observer.lat = parseFloat(lat);
    state.observer.lon = parseFloat(lon);
  }
};

const init = async () => {
  const missing = [];
  if (!L) missing.push('Leaflet');
  if (!Globe) missing.push('Globe.gl');
  if (!THREE) missing.push('Three.js');
  if (missing.length) {
    elements.issStatus.textContent = `Missing required libraries: ${missing.join(', ')}`;
    elements.locationFeedback.textContent =
      'Check your network connection and refresh.';
    return;
  }
  loadSettings();
  hydrateFromUrl();
  initVisualization();
  applySettings();
  updateLocationInputs();
  const globeEl = document.querySelector('#globe');
  globe.width(globeEl.clientWidth);
  globe.height(globeEl.clientHeight);

  const savedLocation = localStorage.getItem('vasey-location');
  if (savedLocation) {
    try {
      const parsed = JSON.parse(savedLocation);
      state.observer.lat = parsed.lat;
      state.observer.lon = parsed.lon;
      state.locationName = parsed.name;
      map.setView([state.observer.lat, state.observer.lon], 3);
      updateLocationInputs();
    } catch (error) {
      console.warn('Unable to load saved location', error);
    }
  }

  try {
    const tle = await fetchTle();
    state.satrec = getSatrec(tle);
    recalcPasses();
    startLoop();
    updateLoop();
  } catch (error) {
    elements.issStatus.textContent = 'Unable to load ISS data.';
    elements.locationFeedback.textContent = error.message;
  }
};

bindEvents();
init();
