// visitas.js — usa window.auth y localStorage de app (2).js
(function(){
  const $ = (id) => document.getElementById(id);
  const show = (el) => { if (el) el.style.display = ''; };
  const hide = (el) => { if (el) el.style.display = 'none'; };

  // Claves compartidas con app (2).js
  const STORAGE_KEYS = { personas: 'soka_personas', visitas: 'soka_visitas' };

  function loadPersonas() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.personas) || '[]'); }
    catch { return []; }
  }
  function loadVisitas() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.visitas) || '[]'); }
    catch { return []; }
  }
  function saveVisitas(list) {
    localStorage.setItem(STORAGE_KEYS.visitas, JSON.stringify(list || []));
  }

  function fillSelect(selectEl, items) {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = '';
    const empty = document.createElement('option'); empty.value=''; empty.textContent='Seleccionar...'; selectEl.appendChild(empty);
    items.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `${p.lastName || ''}, ${p.firstName || ''}`; selectEl.appendChild(opt);
    });
    if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
  }

  function renderVisitas() {
    const personas = loadPersonas();
    const visitas = loadVisitas();
    const tbody = document.querySelector('#visitasTable tbody');
    if (!tbody) return;
    const idx = Object.fromEntries(personas.map(p => [p.id, `${p.lastName || ''}, ${p.firstName || ''}`]));
    tbody.innerHTML = '';
    visitas.forEach(v => {
      const tr = document.createElement('tr');
      const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0,10) : '';
      tr.innerHTML = `<td>${idx[v.personaId] || v.personaId || '-'}</td><td>${fecha}</td><td>${(v.obs || '').replace(/\n/g,'<br/>')}</td>`;
      tbody.appendChild(tr);
    });
    fillSelect(document.getElementById('visitaPersonaSelect'), personas);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('login-form');
    const userInfo  = $('user-info');
    const emailSpan = $('user-email');
    const roleBadge = $('role-badge');
    const loginBtn  = $('googleLoginBtn');
    const logoutBtn = $('logoutBtn');

    auth.getRedirectResult().catch(() => {});

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const email = (user.email||'').toLowerCase();
        emailSpan.textContent = email; roleBadge.textContent = 'Usuario';
        hide(loginForm); show(userInfo);
        renderVisitas();
      } else {
        show(loginForm); hide(userInfo);
      }
    });

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        try { if (isSafari) await auth.signInWithRedirect(provider); else await auth.signInWithPopup(provider); }
        catch { alert('No se pudo iniciar sesión. Intentá de nuevo.'); }
      });
    }

    if (logoutBtn) { logoutBtn.addEventListener('click', async () => { await auth.signOut(); }); }

    // Alta de visitas
    const form = $('visitaForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const personaId = $('visitaPersonaSelect').value;
        const fechaStr  = $('visitaFecha').value;
        const obs       = $('visitaObs').value.trim();
        if (!personaId || !fechaStr) return;
        const visitas = loadVisitas();
        const uid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        visitas.push({ id: uid, personaId, fecha: new Date(fechaStr).toISOString(), obs, createdAt: Date.now() });
        saveVisitas(visitas);
        form.reset();
        renderVisitas();
      });
    }
  });
})();
