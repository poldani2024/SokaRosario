
(function () {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEYS = { hanes: 'soka_hanes' };
  const PERSONAS_STORAGE_KEY = 'soka_personas';
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  let hanes = [];
  let personas = [];
  let selectedHanId = null;
  let actionMode = 'idle'; // idle | create | edit | delete

  function loadHanesLS() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes) ?? '[]'); } catch { return []; } }
  function saveHanesLS(list) { localStorage.setItem(STORAGE_KEYS.hanes, JSON.stringify(list ?? [])); }
  function loadPersonasLS() { try { return JSON.parse(localStorage.getItem(PERSONAS_STORAGE_KEY) ?? '[]'); } catch { return []; } }

  async function loadHanesFS() { if (!window.db) return null; const snap = await db.collection('hanes').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  async function loadPersonasFS() { if (!window.db) return null; const snap = await db.collection('personas').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  async function saveHanFS({ id, name, city, sector, address, phone, leader, meetingDay, meetingTime, zadankaiDay, zadankaiTime, leaderId }) {
    if (!window.db) return null; const coll = db.collection('hanes');
    const payload = { name, city, sector, address, phone, leader, meetingDay, meetingTime, zadankaiDay, zadankaiTime, leaderId };
    if (id) { await coll.doc(id).set(payload, { merge: true }); return id; }
    const docRef = await coll.add(payload); return docRef.id;
  }
  async function deleteHanFS(id) { if (!window.db) return null; await db.collection('hanes').doc(id).delete(); return true; }

  function renderEmptyState(list) {
    const empty = $('hanesEmpty'); const table = $('hanesTable');
    const hasData = Array.isArray(list) && list.length > 0;
    if (empty) empty.classList.toggle('hidden', hasData);
    if (table) table.classList.toggle('hidden', !hasData);
  }

  async function loadAndRenderHanes() {
    try { const fsList = await loadHanesFS(); hanes = Array.isArray(fsList) ? fsList : loadHanesLS(); if (Array.isArray(fsList)) saveHanesLS(hanes); }
    catch (err) { console.warn('[hanes] Firestore no disponible, usando localStorage.', err); hanes = loadHanesLS(); }
    renderHanesTable();
  }
  async function loadPersonasForSuggestions() {
    try { const fsList = await loadPersonasFS(); personas = Array.isArray(fsList) ? fsList : loadPersonasLS(); }
    catch (err) { console.warn('[hanes] Personas en Firestore no disponibles, usando localStorage.', err); personas = loadPersonasLS(); }
    renderLeaderSuggestions();
  }

  function normalizeText(v) {
    return String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function personaLabel(persona) {
    const name = [persona?.firstName, persona?.lastName].filter(Boolean).join(' ').trim();
    return name || String(persona?.displayName ?? persona?.name ?? persona?.email ?? '').trim();
  }

  function filterLeaderMatches(rawQuery) {
    const query = normalizeText(rawQuery);
    const source = Array.isArray(personas) ? personas : [];
    if (!query) {
      return source.map((p) => ({ id: p.id, label: personaLabel(p) })).filter((p) => !!p.label).slice(0, 80);
    }
    return source
      .map((p) => ({ id: p.id, label: personaLabel(p), searchable: normalizeText([p?.firstName, p?.lastName, p?.email].filter(Boolean).join(' ')) }))
      .filter((p) => p.label && p.searchable.includes(query))
      .slice(0, 20);
  }

  function renderLeaderSuggestions(query = '') {
    const datalist = $('hanLeaderSuggestions');
    if (!datalist) return;
    const matches = filterLeaderMatches(query);
    datalist.innerHTML = '';
    matches.forEach((match) => {
      const option = document.createElement('option');
      option.value = match.label;
      option.dataset.id = match.id ?? '';
      datalist.appendChild(option);
    });
  }

  function resolveLeaderSelection(rawValue) {
    const value = String(rawValue ?? '').trim();
    if (!value) return { leader: '', leaderId: '' };
    const exact = (personas ?? []).find((p) => personaLabel(p) === value);
    return { leader: value, leaderId: exact?.id ?? '' };
  }

  function renderHanesTable() {
    const tbody = $('hanesTable')?.querySelector('tbody'); if (!tbody) return;
    const q = ($('hanSearch')?.value ?? '').toLowerCase().trim();
    const filtered = (hanes ?? []).filter(h => { const txt = `${h.name ?? ''} ${h.city ?? ''} ${h.sector ?? ''}`.toLowerCase(); return !q || txt.includes(q); });

    renderEmptyState(filtered);
    tbody.innerHTML = '';
    filtered.forEach(h => {
      const tr = document.createElement('tr'); tr.dataset.id = h.id;
      if (h.id === selectedHanId) tr.classList.add('selected');
      tr.innerHTML = `
        <td>${h.name ?? ''}</td>
        <td>${h.city ?? ''}</td>
        <td>${h.sector ?? ''}</td>
        <td>${h.address ?? ''}</td>
        <td>${h.phone ?? ''}</td>
        <td>${h.leader ?? ''}</td>`;
      tbody.appendChild(tr);
    });
  }

  function formValues() {
    return {
      name:   $('hanNameInput')?.value?.trim()   ?? '',
      city:   $('hanCityInput')?.value?.trim()   ?? '',
      sector: $('hanSectorInput')?.value?.trim() ?? '',
      address:$('hanAddressInput')?.value?.trim()?? '',
      phone:  $('hanPhoneInput')?.value?.trim()  ?? '',
      meetingDay: $('hanMeetingDayInput')?.value ?? '',
      meetingTime: $('hanMeetingTimeInput')?.value ?? '',
      zadankaiDay: $('hanZadankaiDayInput')?.value ?? '',
      zadankaiTime: $('hanZadankaiTimeInput')?.value ?? '',
      ...resolveLeaderSelection($('hanLeaderInput')?.value),
    };
  }
  function clearForm() {
    ['hanNameInput','hanCityInput','hanSectorInput','hanAddressInput','hanPhoneInput','hanMeetingDayInput','hanMeetingTimeInput','hanZadankaiDayInput','hanZadankaiTimeInput','hanLeaderInput']
      .forEach(id => { const el = $(id); if (el) el.value = ''; });
    renderLeaderSuggestions('');
  }

  function renderActionMode() {
    const inAction = actionMode !== 'idle';
    $('hanNewBtn')?.classList.toggle('hidden', inAction);
    $('hanEditBtn')?.classList.toggle('hidden', inAction);
    $('hanDeleteBtn')?.classList.toggle('hidden', inAction);
    $('hanConfirmBtn')?.classList.toggle('hidden', !inAction);
    $('hanCancelBtn')?.classList.toggle('hidden', !inAction);

    const msg = $('hanModeMsg');
    if (!msg) return;
    if (actionMode === 'create') msg.textContent = 'Modo nuevo: completá datos y confirmá o cancelá.';
    else if (actionMode === 'edit') msg.textContent = 'Modo edición: revisá cambios y confirmá o cancelá.';
    else if (actionMode === 'delete') msg.textContent = 'Modo eliminación: confirmá para eliminar el Han seleccionado.';
    else msg.textContent = 'Seleccioná un Han de la grilla para editar o eliminar.';
  }

  async function saveHan({ id, vals }) {
    if (!window.auth?.currentUser) { alert('Ingresá con Google primero.'); return; }
    if (!vals.name) { alert('Ingresá el nombre del Han.'); $('hanNameInput')?.focus(); return; }
    try {
      let savedId = null; if (window.db) savedId = await saveHanFS({ id, ...vals });
      if (!savedId) { let list = loadHanesLS(); if (id) {
          const i = list.findIndex(h => h.id === id);
          if (i >= 0) list[i] = { ...list[i], ...vals }; else list.push({ id, ...vals });
        } else {
          list.push({ id: uid(), ...vals });
        }
        saveHanesLS(list);
      }
      await loadAndRenderHanes(); alert('Han guardado ✅');
    } catch (err) { console.error('[hanes] Error al guardar', err); alert('No se pudo guardar el Han.'); }
  }

  function loadSelectedHanInForm(id) {
    const h = (hanes ?? []).find(x => x.id === id); if (!h) return;
    selectedHanId = id;
    $('hanNameInput').value   = h.name   ?? '';
    $('hanCityInput').value   = h.city   ?? '';
    $('hanSectorInput').value = h.sector ?? '';
    $('hanAddressInput').value= h.address?? '';
    $('hanPhoneInput').value  = h.phone  ?? '';
    $('hanMeetingDayInput').value = h.meetingDay ?? '';
    $('hanMeetingTimeInput').value = h.meetingTime ?? '';
    $('hanZadankaiDayInput').value = h.zadankaiDay ?? '';
    $('hanZadankaiTimeInput').value = h.zadankaiTime ?? '';
    $('hanLeaderInput').value = h.leader ?? '';
    renderLeaderSuggestions(h.leader ?? '');
    renderHanesTable();
  }

  async function deleteSelectedHan() {
    if (!selectedHanId) return;
    try {
      if (window.db) await deleteHanFS(selectedHanId);
      const list = loadHanesLS().filter(h => h.id !== selectedHanId);
      saveHanesLS(list);
      await loadAndRenderHanes();
    } catch (err) { console.error('[hanes] Error al eliminar', err); alert('No se pudo eliminar el Han.'); }
  }

  function beginCreate() {
    actionMode = 'create';
    selectedHanId = null;
    clearForm();
    renderHanesTable();
    renderActionMode();
  }
  function beginEdit() {
    if (!selectedHanId) return alert('Seleccioná un Han de la grilla primero.');
    actionMode = 'edit';
    renderActionMode();
  }
  function beginDelete() {
    if (!selectedHanId) return alert('Seleccioná un Han de la grilla primero.');
    actionMode = 'delete';
    renderActionMode();
  }
  function cancelAction() {
    actionMode = 'idle';
    renderActionMode();
  }
  async function confirmAction() {
    if (actionMode === 'create') {
      await saveHan({ id: null, vals: formValues() });
      selectedHanId = null;
      clearForm();
    } else if (actionMode === 'edit') {
      if (!selectedHanId) return alert('Seleccioná un Han válido.');
      await saveHan({ id: selectedHanId, vals: formValues() });
    } else if (actionMode === 'delete') {
      if (!selectedHanId) return alert('Seleccioná un Han válido.');
      await deleteSelectedHan();
      selectedHanId = null;
      clearForm();
    } else {
      return;
    }
    actionMode = 'idle';
    renderActionMode();
    renderHanesTable();
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAndRenderHanes(); $('hanSearch')?.addEventListener('input', renderHanesTable);
    loadPersonasForSuggestions();
    renderActionMode();
    $('hanNewBtn')?.addEventListener('click', beginCreate);
    $('hanEditBtn')?.addEventListener('click', beginEdit);
    $('hanDeleteBtn')?.addEventListener('click', beginDelete);
    $('hanConfirmBtn')?.addEventListener('click', confirmAction);
    $('hanCancelBtn')?.addEventListener('click', cancelAction);
    $('hanLeaderInput')?.addEventListener('input', (e) => renderLeaderSuggestions(e.target.value));
    $('hanLeaderInput')?.addEventListener('focus', (e) => renderLeaderSuggestions(e.target.value));

    const tbody = $('hanesTable')?.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-id]');
        if (tr?.dataset?.id) loadSelectedHanInForm(tr.dataset.id);
      });
    }
  });
})();
