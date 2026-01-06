
// hanes.js — guarda Han en localStorage (y opcionalmente en Firestore si está disponible)
(function () {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEYS = { hanes: 'soka_hanes' };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  function loadHanes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes) ?? '[]'); }
    catch { return []; }
  }
  function saveHanes(list) {
    localStorage.setItem(STORAGE_KEYS.hanes, JSON.stringify(list ?? []));
  }

  async function saveHanLocal({ id, name, city, sector, address, phone, leader }) {
    let list = loadHanes();
    if (id) {
      const i = list.findIndex(h => h.id === id);
      if (i >= 0) list[i] = { ...list[i], name, city, sector, address, phone, leader };
      else list.push({ id, name, city, sector, address, phone, leader });
    } else {
      list.push({ id: uid(), name, city, sector, address, phone, leader });
    }
    saveHanes(list);
    return list[list.length - 1].id;
  }

  async function saveHanFirestore({ id, name, city, sector, address, phone, leader }) {
    if (!window.db) return null;
    const coll = window.db.collection('hanes');
    if (id) {
      await coll.doc(id).set({ name, city, sector, address, phone, leader }, { merge: true });
      return id;
    } else {
      const docRef = await coll.add({ name, city, sector, address, phone, leader });
      return docRef.id;
    }
  }

  function clearForm() {
    ['hanNameInput','hanCityInput','hanSectorInput','hanAddressInput','hanPhoneInput','hanLeaderInput']
      .forEach(id => { const el = $(id); if (el) el.value = ''; });
  }

  async function onSaveHan() {
    // gating básico: requiere auth y rol Admin (ya lo maneja admin.js visualmente)
    if (!window.auth?.currentUser) { alert('Ingresá con Google primero.'); return; }

    const name = $('hanNameInput')?.value?.trim();
    const city = $('hanCityInput')?.value?.trim();
    const sector = $('hanSectorInput')?.value?.trim();
    const address = $('hanAddressInput')?.value?.trim();
    const phone = $('hanPhoneInput')?.value?.trim();
    const leader = $('hanLeaderInput')?.value?.trim();

    if (!name) { alert('Ingresá el nombre del Han.'); $('hanNameInput')?.focus(); return; }

    // Primero intentar Firestore si está disponible; si no, Local
    let savedId = null;
    try {
      if (window.db) {
        savedId = await saveHanFirestore({ id: null, name, city, sector, address, phone, leader });
      }
    } catch (err) {
      console.warn('[hanes] Firestore no disponible, usando localStorage.', err);
    }
    if (!savedId) {
      savedId = await saveHanLocal({ id: null, name, city, sector, address, phone, leader });
    }

    clearForm();
    alert('Han guardado ✅');
  }

  function onCancelEdit() {
    clearForm();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnSave = $('hanSaveBtn');
    const btnCancel = $('hanCancelBtn');
    if (btnSave) btnSave.addEventListener('click', onSaveHan);
    if (btnCancel) btnCancel.addEventListener('click', onCancelEdit);
  });
})();
