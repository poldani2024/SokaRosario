
// hanes.js — listado + alta/edición (localStorage y opcional Firestore)
(function () {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEYS = { hanes: 'soka_hanes' };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  let hanes = [];
  let editHanId = null;

  function loadHanesLS() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes) ?? '[]'); } catch { return []; } }
  function saveHanesLS(list) { localStorage.setItem(STORAGE_KEYS.hanes, JSON.stringify(list ?? [])); }

  async function loadHanesFS() { if (!window.db) return null; const snap = await db.collection('hanes').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  async function saveHanFS({ id, name, city, sector, address, phone, leader }) {
    if (!window.db) return null; const coll = db.collection('hanes');
    if (id) { await coll.doc(id).set({ name, city, sector, address, phone, leader }, { merge: true }); return id; }
    const docRef = await coll.add({ name, city, sector, address, phone, leader }); return docRef.id;
  }
  async function deleteHanFS(id) { if (!window.db) return null; await db.collection('hanes').doc(id).delete(); return true; }

  async function loadAndRenderHanes() {
    try { const fsList = await loadHanesFS(); hanes = Array.isArray(fsList) ? fsList : loadHanesLS(); if (Array.isArray(fsList)) saveHanesLS(hanes); }
    catch (err) { console.warn('[hanes] Firestore no disponible, usando localStorage.', err); hanes = loadHanesLS(); }
    renderHanesTable();
  }

  function renderHanesTable() {
    const tbody = $('hanesTable')?.querySelector('tbody'); if (!tbody) return;
    const q = ($('hanSearch')?.value ?? '').toLowerCase().trim();
    const filtered = (hanes ?? []).filter(h => { const txt = `${h.name ?? ''} ${h.city ?? ''} ${h.sector ?? ''}`.toLowerCase(); return !q || txt.includes(q); });

    tbody.innerHTML = '';
    filtered.forEach(h => {
      const tr = document.createElement('tr'); tr.dataset.id = h.id;
      tr.innerHTML = `
        <td>${h.name ?? ''}</td>
        <td>${h.city ?? ''}</td>
        <td>${h.sector ?? ''}</td>
        <td>${h.address ?? ''}</td>
        <td>${h.phone ?? ''}</td>
        <td>${h.leader ?? ''}</td>
        <td class="actions">
          editEditar</button>
          deleteEliminar</button>
        </td>`;
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
      leader: $('hanLeaderInput')?.value?.trim() ?? '',
    };
  }
  function clearForm() {
    ['hanNameInput','hanCityInput','hanSectorInput','hanAddressInput','hanPhoneInput','hanLeaderInput']
      .forEach(id => { const el = $(id); if (el) el.value = ''; });
    editHanId = null; $('hanSaveBtn')?.textContent && ($('hanSaveBtn').textContent = 'Guardar Han');
  }
  async function onSaveHan() {
    if (!window.auth?.currentUser) { alert('Ingresá con Google primero.'); return; }
    const vals = formValues(); if (!vals.name) { alert('Ingresá el nombre del Han.'); $('hanNameInput')?.focus(); return; }
    try {
      let savedId = null; if (window.db) savedId = await saveHanFS({ id: editHanId, ...vals });
      if (!savedId) { let list = loadHanesLS(); if (editHanId) {
          const i = list.findIndex(h => h.id === editHanId);
          if (i >= 0) list[i] = { ...list[i], ...vals }; else list.push({ id: editHanId, ...vals });
        } else { list.push({ id: uid(), ...vals }); editHanId = list[list.length - 1].id; }
        saveHanesLS(list);
      }
      await loadAndRenderHanes(); clearForm(); alert('Han guardado ✅');
    } catch (err) { console.error('[hanes] Error al guardar', err); alert('No se pudo guardar el Han.'); }
  }
  function onCancelEdit(){ clearForm(); }

  function onEditHan(id) {
    const h = (hanes ?? []).find(x => x.id === id); if (!h) return; editHanId = id;
    $('hanNameInput').value   = h.name   ?? '';
    $('hanCityInput').value   = h.city   ?? '';
    $('hanSectorInput').value = h.sector ?? '';
    $('hanAddressInput').value= h.address?? '';
    $('hanPhoneInput').value  = h.phone  ?? '';
    $('hanLeaderInput').value = h.leader ?? '';
    $('hanSaveBtn').textContent = 'Actualizar Han';
  }
  async function onDeleteHan(id) {
    if (!confirm('¿Eliminar este Han?')) return;
    try { if (window.db) await deleteHanFS(id); const list = loadHanesLS().filter(h => h.id !== id); saveHanesLS(list); await loadAndRenderHanes(); }
    catch (err) { console.error('[hanes] Error al eliminar', err); alert('No se pudo eliminar el Han.'); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAndRenderHanes(); $('hanSearch')?.addEventListener('input', renderHanesTable);
    $('hanSaveBtn') ?.addEventListener('click', onSaveHan);
    $('hanCancelBtn')?.addEventListener('click', onCancelEdit);

    const tbody = $('hanesTable')?.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (btn) { const id = btn.dataset.id; const action = btn.dataset.action; if (action === 'edit') onEditHan(id); if (action === 'delete') onDeleteHan(id); return; }
        const tr = e.target.closest('tr[data-id]'); if (tr?.dataset?.id) onEditHan(tr.dataset.id);
      });
    }
  });
})();
