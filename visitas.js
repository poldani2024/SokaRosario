
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
  function normalizeText(value){ return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function personaLabel(p){ return `${p.lastName ?? ''}, ${p.firstName ?? ''}`.replace(/^,\s*/, '').trim(); }
  function formatDateDdMmYyyy(value){
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }
  function parseDateInputToIso(raw){
    const value = String(raw ?? '').trim();
    if (!value) return null;
    const isoLike = /^(\d{4})-(\d{2})-(\d{2})$/;
    const arLike = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    let y; let m; let d;
    if (isoLike.test(value)) {
      const parts = value.match(isoLike);
      y = Number(parts[1]); m = Number(parts[2]); d = Number(parts[3]);
    } else if (arLike.test(value)) {
      const parts = value.match(arLike);
      d = Number(parts[1]); m = Number(parts[2]); y = Number(parts[3]);
    } else {
      return null;
    }
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date.toISOString();
  }

  function applyDateMaskToInput(el) {
    if (!el) return;
    el.addEventListener('input', () => {
      const digits = el.value.replace(/\D/g, '').slice(0, 8);
      const p1 = digits.slice(0, 2);
      const p2 = digits.slice(2, 4);
      const p3 = digits.slice(4, 8);
      el.value = [p1, p2, p3].filter(Boolean).join('/');
    });
  }

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

  function renderPersonaSuggestions(query = ''){
    const datalist = $('visitaPersonaSuggestions');
    if (!datalist) return;
    const personas = loadPersonas();
    const q = normalizeText(query);
    const filtered = personas.filter((p) => {
      if (!q) return true;
      const label = normalizeText(`${p.firstName ?? ''} ${p.lastName ?? ''} ${p.email ?? ''}`);
      return label.includes(q);
    }).slice(0, 30);
    datalist.innerHTML = '';
    filtered.forEach((p) => {
      const option = document.createElement('option');
      option.value = personaLabel(p);
      option.dataset.id = p.id;
      datalist.appendChild(option);
    });
  }

  function resolvePersonaByInput(rawValue){
    const personas = loadPersonas();
    const value = String(rawValue ?? '').trim();
    const exact = personas.find((p) => personaLabel(p) === value);
    return exact || null;
  }

  function updateTipoOtroVisibility() {
    const tipo = $('visitaTipoContacto')?.value || '';
    const wrap = $('visitaTipoOtroWrap');
    if (!wrap) return;
    wrap.classList.toggle('hidden', tipo !== 'Otro');
    if (tipo !== 'Otro') $('visitaTipoOtro').value = '';
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

    const idx = Object.fromEntries(personas.map(p => [p.id, personaLabel(p)]));
    tbody.innerHTML = '';
    filterVisibles(visitas).forEach(v => {
      const tr = document.createElement('tr');
      const fecha = v.fecha ? formatDateDdMmYyyy(v.fecha) : '';
      const tipo = v.contactType === 'Otro' ? (v.contactTypeOther || 'Otro') : (v.contactType || '-');
      tr.innerHTML = `<td>${idx[v.personaId] ?? v.personaNombre ?? '-'}</td><td>${tipo}</td><td>${fecha}</td><td>${(v.obs ?? '').replace(/\n/g,'<br/>')}</td>`;
      tbody.appendChild(tr);
    });
    renderPersonaSuggestions($('visitaPersonaInput')?.value ?? '');
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

    $('visitaPersonaInput')?.addEventListener('input', (e) => {
      renderPersonaSuggestions(e.target.value);
      $('visitaPersonaId').value = '';
    });
    $('visitaPersonaInput')?.addEventListener('blur', () => {
      const resolved = resolvePersonaByInput($('visitaPersonaInput').value);
      $('visitaPersonaId').value = resolved?.id || '';
    });
    $('visitaTipoContacto')?.addEventListener('change', updateTipoOtroVisibility);
    applyDateMaskToInput($('visitaFecha'));
    updateTipoOtroVisibility();

    const form = $('visitaForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!canSeeVisitas(currentRole)) return alert("Tu rol no puede registrar visitas.");
        const resolvedPersona = resolvePersonaByInput($('visitaPersonaInput').value);
        const personaId = resolvedPersona?.id || $('visitaPersonaId').value;
        const fechaStr = $('visitaFecha').value;
        const fechaIso = parseDateInputToIso(fechaStr);
        const contactType = $('visitaTipoContacto').value;
        const contactTypeOther = $('visitaTipoOtro').value.trim();
        const obs = $('visitaObs').value.trim();
        if (!personaId || !fechaIso || !contactType) return alert('Ingresá una fecha válida en formato DD/MM/YYYY.');
        if (contactType === 'Otro' && !contactTypeOther) return alert('Especificá el detalle del tipo de contacto.');
        const visitas = loadVisitas();
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        visitas.push({
          id,
          personaId,
          personaNombre: personaLabel(resolvedPersona || {}),
          contactType,
          contactTypeOther,
          fecha: fechaIso,
          obs,
          createdAt: Date.now()
        });
        saveVisitas(visitas);
        form.reset();
        updateTipoOtroVisibility();
        renderVisitas();
      });
    }
  });
})();
