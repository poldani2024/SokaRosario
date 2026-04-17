(function () {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEYS = {
    hanes: 'soka_hanes',
    personas: 'soka_personas',
    stats: 'soka_estadisticas_mensuales'
  };

  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  let hanes = [];
  let personas = [];
  let currentSnapshot = null;
  let currentDocId = '';

  const FLAG_KEYS = ['han', 'zadankai', 'filosofiaAccion', 'humanismoSoka', 'zaimu'];

  function loadLs(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function saveStatsLs(store) {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(store || {}));
  }

  function getDocId({ year, month, hanId }) {
    return `${year}-${String(month).padStart(2, '0')}-${hanId}`;
  }

  function formatDateTime(value) {
    if (!value) return '';
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  function personLabel(person) {
    const fullName = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
    return fullName || person?.displayName || person?.name || person?.email || '(Sin nombre)';
  }

  function resolveHanName(hanId) {
    const h = (hanes || []).find((x) => x.id === hanId);
    return h?.name || hanId;
  }

  function buildSnapshotEntriesForHan(hanId) {
    const hanName = resolveHanName(hanId);
    return (personas || [])
      .filter((p) => (p.hanId && p.hanId === hanId) || (p.hanName && p.hanName === hanName))
      .map((p) => ({
        personId: p.id || '',
        personName: personLabel(p),
        snapshotHanId: hanId,
        snapshotHanName: hanName,
        han: false,
        zadankai: false,
        filosofiaAccion: false,
        humanismoSoka: false,
        zaimu: false,
        comentario: ''
      }));
  }

  function currentSelector() {
    const month = Number($('statsMonth')?.value || 0);
    const year = Number($('statsYear')?.value || 0);
    const hanId = $('statsHan')?.value || '';
    return { month, year, hanId };
  }

  function buildAuditEvent(action) {
    const user = window.auth?.currentUser;
    const nowIso = new Date().toISOString();
    return {
      action,
      byUid: user?.uid || '',
      byEmail: user?.email || '',
      atIso: nowIso,
    };
  }

  function isFirestorePermissionError(err) {
    const code = String(err?.code || '');
    const message = String(err?.message || '').toLowerCase();
    return code === 'permission-denied' || message.includes('missing or insufficient permissions');
  }

  async function loadHanes() {
    if (window.db) {
      try {
        const snap = await db.collection('hanes').get();
        hanes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        localStorage.setItem(STORAGE_KEYS.hanes, JSON.stringify(hanes));
        return;
      } catch (err) {
        console.warn('[estadisticas] no se pudo leer hanes en Firestore:', err);
      }
    }
    hanes = loadLs(STORAGE_KEYS.hanes, []);
  }

  async function loadPersonas() {
    if (window.db) {
      try {
        const snap = await db.collection('personas').get();
        personas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        localStorage.setItem(STORAGE_KEYS.personas, JSON.stringify(personas));
        return;
      } catch (err) {
        console.warn('[estadisticas] no se pudo leer personas en Firestore:', err);
      }
    }
    personas = loadLs(STORAGE_KEYS.personas, []);
  }

  function fillMonthAndYear() {
    const monthSel = $('statsMonth');
    const yearSel = $('statsYear');
    if (!monthSel || !yearSel) return;

    monthSel.innerHTML = MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    yearSel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');

    monthSel.value = String(now.getMonth() + 1);
    yearSel.value = String(currentYear);
  }

  function fillHanSelect() {
    const sel = $('statsHan');
    if (!sel) return;
    const options = ['<option value="">Seleccionar Han...</option>']
      .concat((hanes || []).map((h) => `<option value="${h.id}">${h.name || h.id}</option>`));
    sel.innerHTML = options.join('');
  }

  function updateLockUi() {
    const lock = $('statsLockState');
    const closeBtn = $('statsCloseBtn');
    const openBtn = $('statsOpenBtn');
    const saveBtn = $('statsSaveBtn');

    const hasSnapshot = !!currentSnapshot;
    const isClosed = (currentSnapshot?.status || '') === 'closed';

    if (!hasSnapshot) {
      lock?.classList.add('hidden');
      closeBtn?.classList.add('hidden');
      openBtn?.classList.add('hidden');
      closeBtn && (closeBtn.disabled = true);
      openBtn && (openBtn.disabled = true);
      saveBtn && (saveBtn.disabled = true);
      return;
    }

    if (lock) {
      lock.classList.remove('hidden');
      lock.classList.toggle('status-open', !isClosed);
      lock.classList.toggle('status-closed', isClosed);
      lock.textContent = isClosed ? 'Estadística cerrada' : 'Estadística abierta';
    }

    closeBtn?.classList.toggle('hidden', isClosed);
    openBtn?.classList.toggle('hidden', !isClosed);
    if (closeBtn) closeBtn.disabled = isClosed;
    if (openBtn) openBtn.disabled = !isClosed;
    if (saveBtn) saveBtn.disabled = isClosed;
  }

  function renderAudit() {
    const msg = $('statsAuditMsg');
    if (!msg) return;
    const audit = Array.isArray(currentSnapshot?.audit) ? currentSnapshot.audit : [];
    const last = audit[audit.length - 1];
    if (!last) {
      msg.textContent = '';
      return;
    }
    msg.textContent = `Última acción: ${last.action} por ${last.byEmail || '(sin email)'} el ${formatDateTime(last.at || last.atIso)}.`;
  }

  function renderTable() {
    const tbody = $('estadisticasTable')?.querySelector('tbody');
    if (!tbody) return;

    const entries = Array.isArray(currentSnapshot?.entries) ? currentSnapshot.entries : [];
    const isClosed = (currentSnapshot?.status || '') === 'closed';

    tbody.innerHTML = '';
    entries.forEach((entry, index) => {
      const tr = document.createElement('tr');
      if (isClosed) tr.classList.add('locked');

      tr.innerHTML = `
        <td>${entry.personName || ''}</td>
        <td><input type="checkbox" data-index="${index}" data-key="han" ${entry.han ? 'checked' : ''} ${isClosed ? 'disabled' : ''}></td>
        <td><input type="checkbox" data-index="${index}" data-key="zadankai" ${entry.zadankai ? 'checked' : ''} ${isClosed ? 'disabled' : ''}></td>
        <td><input type="checkbox" data-index="${index}" data-key="filosofiaAccion" ${entry.filosofiaAccion ? 'checked' : ''} ${isClosed ? 'disabled' : ''}></td>
        <td><input type="checkbox" data-index="${index}" data-key="humanismoSoka" ${entry.humanismoSoka ? 'checked' : ''} ${isClosed ? 'disabled' : ''}></td>
        <td><input type="checkbox" data-index="${index}" data-key="zaimu" ${entry.zaimu ? 'checked' : ''} ${isClosed ? 'disabled' : ''}></td>
        <td><input type="text" data-index="${index}" data-key="comentario" value="${String(entry.comentario || '').replace(/"/g, '&quot;')}" ${isClosed ? 'disabled' : ''} placeholder="Observación mensual"></td>
      `;
      tbody.appendChild(tr);
    });

    $('statsEmpty')?.classList.toggle('hidden', entries.length > 0);
    updateLockUi();
    renderAudit();
  }

  async function loadSnapshotForSelection({ month, year, hanId }) {
    if (!month || !year || !hanId) {
      alert('Seleccioná mes, año y han.');
      return;
    }

    currentDocId = getDocId({ month, year, hanId });

    if (window.db) {
      try {
        const ref = db.collection('monthlyStats').doc(currentDocId);
        const snap = await ref.get();
        if (snap.exists) {
          currentSnapshot = { id: snap.id, ...snap.data() };
        } else {
          const entries = buildSnapshotEntriesForHan(hanId);
          currentSnapshot = {
            id: currentDocId,
            month,
            year,
            hanId,
            hanName: resolveHanName(hanId),
            status: 'open',
            entries,
            createdBy: window.auth?.currentUser?.email || '',
            createdAt: new Date().toISOString(),
            audit: [buildAuditEvent('created')],
          };
          await ref.set(currentSnapshot, { merge: true });
        }
      } catch (err) {
        if (!isFirestorePermissionError(err)) throw err;
        console.info('[estadisticas] Firestore monthlyStats no disponible para este usuario/sesión. Se usa modo local.', err);
        const store = loadLs(STORAGE_KEYS.stats, {});
        if (store[currentDocId]) {
          currentSnapshot = store[currentDocId];
        } else {
          currentSnapshot = {
            id: currentDocId,
            month,
            year,
            hanId,
            hanName: resolveHanName(hanId),
            status: 'open',
            entries: buildSnapshotEntriesForHan(hanId),
            createdBy: window.auth?.currentUser?.email || '',
            createdAt: new Date().toISOString(),
            audit: [buildAuditEvent('created')],
          };
          store[currentDocId] = currentSnapshot;
          saveStatsLs(store);
        }
        $('statsStatusMsg').textContent = `Mostrando ${MONTHS[month - 1]} ${year} para ${resolveHanName(hanId)} (modo local por permisos).`;
        renderTable();
        return;
      }
    } else {
      const store = loadLs(STORAGE_KEYS.stats, {});
      if (store[currentDocId]) {
        currentSnapshot = store[currentDocId];
      } else {
        currentSnapshot = {
          id: currentDocId,
          month,
          year,
          hanId,
          hanName: resolveHanName(hanId),
          status: 'open',
          entries: buildSnapshotEntriesForHan(hanId),
          createdBy: window.auth?.currentUser?.email || '',
          createdAt: new Date().toISOString(),
          audit: [buildAuditEvent('created')],
        };
        store[currentDocId] = currentSnapshot;
        saveStatsLs(store);
      }
    }

    $('statsStatusMsg').textContent = `Mostrando ${MONTHS[month - 1]} ${year} para ${resolveHanName(hanId)}.`;
    renderTable();
  }

  async function persistCurrentSnapshot() {
    if (!currentSnapshot || !currentDocId) return;
    if ((currentSnapshot.status || '') === 'closed') {
      alert('La estadística está cerrada. Abrila para editar.');
      return;
    }

    if (window.db) {
      try {
        await db.collection('monthlyStats').doc(currentDocId).set(currentSnapshot, { merge: true });
      } catch (err) {
        if (!isFirestorePermissionError(err)) throw err;
        const store = loadLs(STORAGE_KEYS.stats, {});
        store[currentDocId] = currentSnapshot;
        saveStatsLs(store);
        $('statsStatusMsg').textContent = 'Cambios guardados en modo local (sin permisos Firestore) ✅';
        return;
      }
    } else {
      const store = loadLs(STORAGE_KEYS.stats, {});
      store[currentDocId] = currentSnapshot;
      saveStatsLs(store);
    }
    $('statsStatusMsg').textContent = 'Cambios guardados ✅';
  }

  async function setSnapshotStatus(status) {
    if (!currentSnapshot || !currentDocId) return;
    const action = status === 'closed' ? 'closed' : 'opened';
    currentSnapshot.status = status;
    currentSnapshot.audit = (currentSnapshot.audit || []).concat(buildAuditEvent(action));

    if (window.db) {
      try {
        await db.collection('monthlyStats').doc(currentDocId).set({
          status: currentSnapshot.status,
          audit: currentSnapshot.audit,
        }, { merge: true });
      } catch (err) {
        if (!isFirestorePermissionError(err)) throw err;
        const store = loadLs(STORAGE_KEYS.stats, {});
        store[currentDocId] = currentSnapshot;
        saveStatsLs(store);
        $('statsStatusMsg').textContent = 'Estado actualizado en modo local (sin permisos Firestore).';
        renderTable();
        return;
      }
    } else {
      const store = loadLs(STORAGE_KEYS.stats, {});
      store[currentDocId] = currentSnapshot;
      saveStatsLs(store);
    }

    renderTable();
  }

  function wireTableEvents() {
    const tbody = $('estadisticasTable')?.querySelector('tbody');
    if (!tbody) return;

    tbody.addEventListener('change', (e) => {
      const target = e.target;
      if (!currentSnapshot || (currentSnapshot.status || '') === 'closed') return;
      const idx = Number(target?.dataset?.index);
      const key = String(target?.dataset?.key || '');
      if (!Number.isFinite(idx) || !key || !currentSnapshot.entries?.[idx]) return;

      if (FLAG_KEYS.includes(key)) {
        currentSnapshot.entries[idx][key] = !!target.checked;
      } else if (key === 'comentario') {
        currentSnapshot.entries[idx][key] = target.value || '';
      }
    });

    tbody.addEventListener('input', (e) => {
      const target = e.target;
      if (!currentSnapshot || (currentSnapshot.status || '') === 'closed') return;
      const idx = Number(target?.dataset?.index);
      const key = String(target?.dataset?.key || '');
      if (!Number.isFinite(idx) || key !== 'comentario' || !currentSnapshot.entries?.[idx]) return;
      currentSnapshot.entries[idx][key] = target.value || '';
    });
  }

  async function init() {
    await Promise.all([loadHanes(), loadPersonas()]);
    fillMonthAndYear();
    fillHanSelect();
    wireTableEvents();

    $('statsLoadBtn')?.addEventListener('click', async () => {
      try {
        await loadSnapshotForSelection(currentSelector());
      } catch (err) {
        console.error('[estadisticas] error al cargar/crear snapshot:', err);
        alert('No se pudo cargar la estadística mensual.');
      }
    });

    $('statsSaveBtn')?.addEventListener('click', async () => {
      try {
        await persistCurrentSnapshot();
      } catch (err) {
        console.error('[estadisticas] error al guardar snapshot:', err);
        alert('No se pudieron guardar los cambios.');
      }
    });

    $('statsCloseBtn')?.addEventListener('click', async () => {
      if (!confirm('¿Cerrar esta estadística mensual? Luego no podrá editarse hasta abrirla.')) return;
      try { await setSnapshotStatus('closed'); }
      catch (err) {
        console.error('[estadisticas] error al cerrar snapshot:', err);
        alert('No se pudo cerrar la estadística.');
      }
    });

    $('statsOpenBtn')?.addEventListener('click', async () => {
      if (!confirm('¿Abrir esta estadística mensual? Se habilitará edición.')) return;
      try { await setSnapshotStatus('open'); }
      catch (err) {
        console.error('[estadisticas] error al abrir snapshot:', err);
        alert('No se pudo abrir la estadística.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
