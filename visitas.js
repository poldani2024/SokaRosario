
// visitas.js — Roles + filtros por sector/han + gating de página
// Basado en tu visitas.js actual (auth header, render, localStorage).  // [4](https://cargillonline-my.sharepoint.com/personal/pedro_oldani_cargill_com/Documents/Microsoft%20Copilot%20Chat%20Files/visitas.js)
(function(){
  const $ = (id) => document.getElementById(id);
  const show = (el) => { if (el) el.style.display = ''; };
  const hide = (el) => { if (el) el.style.display = 'none'; };
  const STORAGE_KEYS = { personas: 'soka_personas', visitas: 'soka_visitas', hanes:'soka_hanes' };

  let currentRole = "Usuario";
  let roleDetails = { hanIds: [], sector: "", city: "" };

  function resolveRole(user) {
    if (!user) return Promise.resolve({ role: "Usuario", details: roleDetails });
    const email = (user.email ?? "").toLowerCase();
    const ADMINS = new Set(['pedro.l.oldani@gmail.com','pedro.loldani@gmail.com']);
    return user.getIdTokenResult().then(token => {
      const claims = token?.claims ?? {};
      let role = claims.role || (ADMINS.has(email) ? 'Admin' : 'Usuario');
      const details = {
        hanIds: Array.isArray(claims.hanIds) ? claims.hanIds : [],
        sector: typeof claims.sector === "string" ? claims.sector : "",
        city: typeof claims.city === "string" ? claims.city : ""
      };
      return { role, details };
    }).catch(() => ({ role: ADMINS.has(email) ? 'Admin' : 'Usuario', details: roleDetails }));
  }

  function canSeeVisitas(role){ return ["Admin","LiderCiudad","LiderSector","LiderHan"].includes(role); }

  function loadPersonas(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.personas) ?? '[]'); }catch{ return []; } }
  function loadVisitas(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.visitas) ?? '[]'); }catch{ return []; } }
  function loadHanes(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes) ?? '[]'); }catch{ return []; } }
  function saveVisitas(list){ localStorage.setItem(STORAGE_KEYS.visitas, JSON.stringify(list ?? [])); }

  function filterVisibles(visitas){
    if (!canSeeVisitas(currentRole)) return [];
    const personas = loadPersonas();
    const idxP = Object.fromEntries(personas.map(p => [p.id, p]));
    switch (currentRole) {
      case "Admin":
      case "LiderCiudad": return visitas;
      case "LiderSector": {
        const hanes = loadHanes();
        const idxHan = Object.fromEntries(hanes.map(h => [h.id, h]));
        return visitas.filter(v => {
          const p = idxP[v.personaId];
          const han = idxHan[p?.hanId];
          return (han?.sector ?? p?.hanSector ?? "") === (roleDetails.sector ?? "");
        });
      }
      case "LiderHan":
        return visitas.filter(v => {
          const p = idxP[v.personaId];
          return (roleDetails.hanIds ?? []).includes(p?.hanId);
        });
      default:
        return [];
    }
  }

  function fillSelect(selectEl, items){
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML='';
    const empty = document.createElement('option'); empty.value=''; empty.textContent='Seleccionar...'; selectEl.appendChild(empty);
    items.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = `${p.lastName ?? ''}, ${p.firstName ?? ''}`; selectEl.appendChild(opt); });
    if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
  }

  function renderVisitas(){
    const personas = loadPersonas();
    const visitas = loadVisitas();
    const tbody = document.querySelector('#visitasTable tbody');
    const form = $('visitaForm'); const table = $('visitasTable');
    if (!tbody || !form || !table) return;

    const allow = canSeeVisitas(currentRole);
    form.style.display = allow ? '' : 'none';
    table.style.display = allow ? '' : 'none';

    const idx = Object.fromEntries(personas.map(p => [p.id, `${p.lastName ?? ''}, ${p.firstName ?? ''}`]));
    tbody.innerHTML = '';
    filterVisibles(visitas).forEach(v => {
      const tr = document.createElement('tr');
      const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0,10) : '';
      tr.innerHTML = ` ${idx[v.personaId] ?? v.personaId ?? '-'} ${fecha} ${(v.obs ?? '').replace(/\n/g,'<br/>')} `;
      tbody.appendChild(tr);
    });
    fillSelect(document.getElementById('visitaPersonaSelect'), personas);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('login-form'); const userInfo = $('user-info');
    const emailSpan = $('user-email'); const roleBadge = $('role-badge');
    const loginBtn = $('googleLoginBtn'); const logoutBtn = $('logoutBtn');

    auth.getRedirectResult().catch(()=>{});
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const { role, details } = await resolveRole(user);
        currentRole = role; roleDetails = details;

        const email = (user.email ?? '').toLowerCase();
        emailSpan.textContent = email;
        roleBadge.textContent = role;

        hide(loginForm); show(userInfo);
        renderVisitas();
      } else {
        show(loginForm); hide(userInfo);
      }
    });

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        const isSafari = /^(?!(chrome|android)).*safari/i.test(navigator.userAgent);
        try { if (isSafari) await auth.signInWithRedirect(provider); else await auth.signInWithPopup(provider); }
        catch { alert('No se pudo iniciar sesión. Intentá de nuevo.'); }
      });
    }
    if (logoutBtn) { logoutBtn.addEventListener('click', async () => { await auth.signOut(); }); }

    const form = $('visitaForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!canSeeVisitas(currentRole)) return alert("Tu rol no puede registrar visitas.");
        const personaId = $('visitaPersonaSelect').value;
        const fechaStr = $('visitaFecha').value;
        const obs = $('visitaObs').value.trim();
        if (!personaId || !fechaStr) return;
        const visitas = loadVisitas();
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        visitas.push({ id, personaId, fecha: new Date(fechaStr).toISOString(), obs, createdAt: Date.now() });
        saveVisitas(visitas);
        form.reset();
        renderVisitas();
      });
    }
  });
})();
