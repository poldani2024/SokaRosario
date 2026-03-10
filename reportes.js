(function () {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEYS = {
    hanes: 'soka_hanes',
    personas: 'soka_personas',
    geocache: 'soka_geocache'
  };

  let hanes = [];
  let personas = [];
  let geoCache = {};

  let map = null;
  let hanesLayer = null;
  let personasHeatLayer = null;
  let renderToken = 0;

  function loadLocal() {
    try { hanes = JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes) ?? '[]'); } catch { hanes = []; }
    try { personas = JSON.parse(localStorage.getItem(STORAGE_KEYS.personas) ?? '[]'); } catch { personas = []; }
    try { geoCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.geocache) ?? '{}'); } catch { geoCache = {}; }
  }

  function saveGeoCache() {
    localStorage.setItem(STORAGE_KEYS.geocache, JSON.stringify(geoCache || {}));
  }

  async function hydrateFromFirestore() {
    if (!window.db) return;
    try {
      const [hSnap, pSnap] = await Promise.all([
        window.db.collection('hanes').get(),
        window.db.collection('personas').get()
      ]);
      hanes = hSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      personas = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      localStorage.setItem(STORAGE_KEYS.hanes, JSON.stringify(hanes));
      localStorage.setItem(STORAGE_KEYS.personas, JSON.stringify(personas));
    } catch (err) {
      console.warn('[reportes] Firestore no disponible, usando localStorage.', err);
    }
  }

  function normalizeTextKey(v) {
    return String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  function cityColor(city) {
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#17becf'];
    const key = normalizeTextKey(city || 'sin-ciudad');
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  }

  function fillSelect(el, items, valueKey = 'id', labelKey = 'name') {
    if (!el) return;
    el.innerHTML = '';
    items.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it[valueKey] ?? '';
      opt.textContent = it[labelKey] ?? '';
      el.appendChild(opt);
    });
  }

  function populateFilters() {
    const citySel = $('reportCityFilter');
    const hanSel = $('reportHanFilter');

    const prevCity = citySel?.value || '';
    const prevHan = hanSel?.value || '';

    const cities = Array.from(new Set([
      ...(hanes || []).map((h) => h.city || '').filter(Boolean),
      ...(personas || []).map((p) => p.city || p.hanCity || '').filter(Boolean)
    ])).sort((a, b) => a.localeCompare(b, 'es'));

    fillSelect(citySel, [{ id: '', name: 'Todas las ciudades' }, ...cities.map((c) => ({ id: c, name: c }))]);
    fillSelect(hanSel, [{ id: '', name: 'Todos los Hanes' }, ...(hanes || []).map((h) => ({ id: h.id, name: h.name || 'Han sin nombre' }))]);

    if (citySel) citySel.value = prevCity;
    if (hanSel) hanSel.value = prevHan;
  }

  function initMap() {
    const el = $('reportesMap');
    if (!el || !window.L || map) return;

    map = L.map(el).setView([-34.61, -58.38], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    hanesLayer = L.layerGroup().addTo(map);
  }

  function status(msg) {
    const el = $('reportStatus');
    if (el) el.textContent = msg;
  }

  async function geocodeWithCache(query, fallback = '') {
    const q = String(query || '').trim();
    if (!q) return null;
    const key = normalizeTextKey(q);
    if (geoCache[key]?.lat && geoCache[key]?.lng) return geoCache[key];

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await resp.json();
      if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
        const value = { lat: Number(data[0].lat), lng: Number(data[0].lon), query: q, updatedAt: Date.now() };
        geoCache[key] = value;
        saveGeoCache();
        return value;
      }
    } catch (err) {
      console.warn('[reportes] geocoding falló:', q, err);
    }

    if (fallback && fallback !== q) return geocodeWithCache(fallback, '');
    return null;
  }

  function membersByHan(list) {
    const map = new Map();
    (list || []).forEach((p) => {
      if (!p.hanId) return;
      map.set(p.hanId, (map.get(p.hanId) || 0) + 1);
    });
    return map;
  }

  function readFilters() {
    return {
      city: $('reportCityFilter')?.value || '',
      hanId: $('reportHanFilter')?.value || '',
      showHanes: $('reportShowHanes')?.checked !== false,
      showPersonas: $('reportShowPersonas')?.checked !== false
    };
  }

  async function renderReportMap() {
    initMap();
    if (!map || !hanesLayer) return;

    const token = ++renderToken;
    const f = readFilters();
    status('Actualizando reporte...');

    const filteredPersonas = (personas || []).filter((p) => {
      if (f.city && (p.city || p.hanCity || '') !== f.city) return false;
      if (f.hanId && (p.hanId || '') !== f.hanId) return false;
      return true;
    });

    const filteredHanes = (hanes || []).filter((h) => {
      if (f.city && (h.city || '') !== f.city) return false;
      if (f.hanId && (h.id || '') !== f.hanId) return false;
      return true;
    });

    const members = membersByHan(filteredPersonas);

    const hanPoints = [];
    for (const han of filteredHanes) {
      const query = [han.address, han.city, 'Argentina'].filter(Boolean).join(', ');
      const coords = await geocodeWithCache(query, `${han.city || ''}, Argentina`);
      if (token !== renderToken) return;
      if (!coords) continue;
      hanPoints.push({ han, count: members.get(han.id) || 0, lat: coords.lat, lng: coords.lng });
    }

    const cityCounter = new Map();
    filteredPersonas.forEach((p) => {
      const c = (p.city || p.hanCity || '').trim();
      if (!c) return;
      cityCounter.set(c, (cityCounter.get(c) || 0) + 1);
    });

    const heatPoints = [];
    for (const [city, count] of cityCounter.entries()) {
      const coords = await geocodeWithCache(`${city}, Argentina`, city);
      if (token !== renderToken) return;
      if (coords) heatPoints.push([coords.lat, coords.lng, Math.min(1, count / 10)]);
    }

    if (token !== renderToken) return;
    hanesLayer.clearLayers();

    if (f.showHanes) {
      hanPoints.forEach(({ han, count, lat, lng }) => {
        L.circleMarker([lat, lng], {
          radius: 6 + (Math.sqrt(Math.max(1, count)) * 4),
          color: cityColor(han.city),
          fillColor: cityColor(han.city),
          fillOpacity: 0.45,
          weight: 2
        }).bindPopup(`<strong>${han.name || 'Han'}</strong><br/>${han.address || '-'}, ${han.city || '-'}<br/>Miembros: <strong>${count}</strong>`)
          .addTo(hanesLayer);
      });
    }

    if (personasHeatLayer) map.removeLayer(personasHeatLayer);
    if (f.showPersonas && window.L.heatLayer) {
      personasHeatLayer = L.heatLayer(heatPoints, { radius: 28, blur: 24, maxZoom: 13 }).addTo(map);
    }

    const bounds = [];
    hanPoints.forEach((p) => bounds.push([p.lat, p.lng]));
    heatPoints.forEach((p) => bounds.push([p[0], p[1]]));
    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });

    status(`Hanes: ${hanPoints.length} · Ciudades con miembros: ${heatPoints.length}`);
  }

  async function init() {
    loadLocal();
    await hydrateFromFirestore();
    populateFilters();
    initMap();
    await renderReportMap();

    ['reportCityFilter', 'reportHanFilter', 'reportShowHanes', 'reportShowPersonas']
      .forEach((id) => $(id)?.addEventListener('input', () => renderReportMap()));
    $('refreshReportBtn')?.addEventListener('click', () => renderReportMap());
  }

  document.addEventListener('DOMContentLoaded', init);
})();
