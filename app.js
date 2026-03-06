
/* ===== app.js (Personas + Visitas + Catálogos) =====
   - Sin pre-carga de datos (no seeds). Si no hay datos, muestra texto "No hay personas cargadas aún".
   - Botones Editar/Eliminar con <button> y data-action/data-id.
   - Event delegation en tbody para filas y botones.
*/
let currentUser = null;      // { email, displayName, uid }
let currentRole = "Usuario"; // Admin, LiderCiudad, LiderSector, LiderHan, Usuario+, Usuario
let roleDetails = { hanIds: [], sector: "", city: "" };

let hanes = [];
let grupos = [];
let personas = [];
let visitas = [];
let localidades = [];
let editPersonaId = null;

const ADMIN_EMAILS = ["pedro.l.oldani@gmail.com", "pedro.loldani@gmail.com"]; // fallback rápido
const STORAGE_KEYS = {
  hanes: "soka_hanes",
  grupos: "soka_grupos",
  personas: "soka_personas",
  visitas: "soka_visitas",
  localidades: "soka_localidades",
  session: "soka_session"
};

const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const uid  = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ===== Roles & gating ===== */
function resolveRoleFromClaims(user) {
  let role = "Usuario";
  roleDetails = { hanIds: [], sector: "", city: "" };
  if (!user) return { role, roleDetails };
  const email = (user.email ?? "").toLowerCase();
  return user.getIdTokenResult()
    .then(token => {
      const claims = token?.claims ?? {};
      if (typeof claims.role === "string") role = claims.role;
      if (ADMIN_EMAILS.includes(email)) role = "Admin"; // fallback
      if (Array.isArray(claims.hanIds)) roleDetails.hanIds = claims.hanIds;
      if (typeof claims.sector === "string") roleDetails.sector = claims.sector;
      if (typeof claims.city === "string") roleDetails.city = claims.city;
      return { role, roleDetails };
    })
    .catch(() => {
      if (ADMIN_EMAILS.includes(email)) role = "Admin";
      return { role, roleDetails };
    });
}
function applyRoleVisibility(role) {
  document.body.classList.toggle("role-admin", role === "Admin");
  document.body.classList.toggle("role-user", role !== "Admin");
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", role !== "Admin"));
}
function canSeeVisitas(role) { return ["Admin","LiderCiudad","LiderSector","LiderHan"].includes(role); }
function canSeeComentarios(role) { return ["Admin","LiderCiudad","LiderSector","LiderHan"].includes(role); }


/* ===== Firestore integration (v8) ===== */
const useDb = !!window.db; // true si firebase-firestore.js está cargado y window.db existe

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

async function hydrateFromDb() {
  if (!useDb) return;
  try {
    // Personas
    const pSnap = await window.db.collection('personas').get();
    const pList = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (Array.isArray(pList)) personas = pList;
    // Visitas
    const vSnap = await window.db.collection('visitas').get();
    const vList = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (Array.isArray(vList)) visitas = vList;
    // Localidades (maestro ciudades)
    try {
      const cSnap = await window.db.collection('ciudades').get();
      const cList = cSnap.docs.map(d => (d.data()?.name || d.id || '').trim()).filter(Boolean);
      if (Array.isArray(cList) && cList.length) localidades = Array.from(new Set(cList)).sort();
    } catch {}

    // Opcional: sincronizar a local como backup
    saveData();
    console.info('[DB] Datos cargados desde Firestore', { personas: personas.length, visitas: visitas.length, localidades: localidades.length });
  } catch (err) {
    console.warn('[DB] No se pudo leer desde Firestore. Usando localStorage.', err);
  }
}

async function savePersonaToDb(p) {
  if (!useDb) return;
  const id = p.id || (p.id = genId());
  await window.db.collection('personas').doc(id).set(p, { merge: true });
}

async function deletePersonaFromDb(id) {
  if (!useDb) return;
  await window.db.collection('personas').doc(id).delete();
}

async function saveVisitaToDb(v) {
  if (!useDb) return;
  const id = v.id || (v.id = genId());
  await window.db.collection('visitas').doc(id).set(v, { merge: true });
}

async function deleteVisitasByPersona(idPersona) {
  if (!useDb) return;
  const qs = await window.db.collection('visitas').where('personaId', '==', idPersona).get();
  const batch = window.db.batch();
  qs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

/* ===== Datos en localStorage ===== */
function loadData() {
  hanes    = JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes)    ?? "[]");
  grupos   = JSON.parse(localStorage.getItem(STORAGE_KEYS.grupos)   ?? "[]");
  personas = JSON.parse(localStorage.getItem(STORAGE_KEYS.personas) ?? "[]");
  visitas  = JSON.parse(localStorage.getItem(STORAGE_KEYS.visitas)  ?? "[]");
  localidades = JSON.parse(localStorage.getItem(STORAGE_KEYS.localidades) ?? "[]");
}
function saveData() {
  localStorage.setItem(STORAGE_KEYS.hanes,    JSON.stringify(hanes));
  localStorage.setItem(STORAGE_KEYS.grupos,   JSON.stringify(grupos));
  localStorage.setItem(STORAGE_KEYS.personas, JSON.stringify(personas));
  localStorage.setItem(STORAGE_KEYS.visitas,  JSON.stringify(visitas));
  localStorage.setItem(STORAGE_KEYS.localidades, JSON.stringify(localidades));
}

/* ===== Normalización SIN seeds ===== */
function ensureSeedData() {
  // No creamos datos. Solo normalizamos lo existente y migramos campos.
  hanes    = Array.isArray(hanes)    ? hanes    : [];
  grupos   = Array.isArray(grupos)   ? grupos   : [];
  personas = Array.isArray(personas) ? personas : [];
  localidades = Array.isArray(localidades) ? localidades : [];

  const idxHan = Object.fromEntries((hanes ?? []).map(h => [h.id, h]));
  personas = (personas ?? []).map(p => ({
    ...p,
    hanSector: p.hanSector ?? idxHan[p.hanId]?.sector ?? "",
    comentarios: typeof p.comentarios === "string" ? p.comentarios : ""
  }));
  saveData();
}

/**
 * Llena el formulario de Datos Personales con el objeto 'p'
 * @param {Object} p - Persona
 * @param {{readonly?: boolean}} opts - Opciones (readonly)
 */
function populateDatosPersonales(p, opts = {}) {
  const readonly = !!opts.readonly;

  // Campos de texto
  const mapText = {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    birthDate: p.birthDate ?? '',
    address: p.address ?? '',
    city: p.city ?? '',
    phone: p.phone ?? '',
    phoneFixed: p.phoneFixed ?? '',
    email: p.email ?? '',
    fechaIngreso: p.fechaIngreso ?? ''
  };
  Object.entries(mapText).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  // Selects
  const selStatus = document.getElementById('status');
  if (selStatus) selStatus.value = p.status ?? 'Miembro';
  const selDivision = document.getElementById('division');
  if (selDivision) selDivision.value = p.division ?? '';
  const selExamen = document.getElementById('nivelExamen');
  if (selExamen) selExamen.value = p.nivelExamen ?? '';
  const selCargo = document.getElementById('cargo');
  if (selCargo) selCargo.value = p.cargo ?? '';
  const selGohonzo = document.getElementById('gohonzo');
  if (selGohonzo) selGohonzo.value = p.gohonzo ?? '';
  const selHan = document.getElementById('hanSelect');
  if (selHan) {
    selHan.value = p.hanId ?? '';
    const hasSelected = Array.from(selHan.options).some(o => o.value === selHan.value && selHan.value);
    if (!hasSelected && p.hanName) {
      const nk = normalizeTextKey(p.hanName);
      const match = (hanes || []).find(h => normalizeTextKey(h.name) === nk);
      if (match?.id) selHan.value = match.id;
    }
  }
  const selGrupo = document.getElementById('grupoSelect');
  if (selGrupo) selGrupo.value = p.grupoId ?? '';
  const freqSem = document.getElementById('frecuenciaSemanal');
  if (freqSem) freqSem.value = p.frecuenciaSemanal ?? '';
  const freqZad = document.getElementById('frecuenciaZadankai');
  if (freqZad) freqZad.value = p.frecuenciaZadankai ?? '';

  // Checkboxes
  const chkHs = document.getElementById('suscriptoHumanismoSoka');
  if (chkHs) chkHs.checked = !!p.suscriptoHumanismoSoka;
  const chkZ = document.getElementById('realizaZaimu');
  if (chkZ) chkZ.checked = !!p.realizaZaimu;

  // Derivados
  const hanLoc = document.getElementById('hanLocalidad');
  if (hanLoc) {
    const selectedHan = (hanes || []).find(h => h.id === (selHan?.value || ''));
    hanLoc.value = p.hanCity ?? selectedHan?.city ?? p.city ?? '';
  }

  // Comentarios
  const com = document.getElementById('comentarios');
  if (com) com.value = p.comentarios ?? '';

  // Readonly
  toggleDatosPersonalesReadonly(readonly);
}

/* ===== Auth (Firebase v8) ===== */
$("logoutBtn")?.addEventListener("click", () => auth.signOut());
function applySignedInUser(user) {
  currentUser = user;
  const email = user.email?.toLowerCase() ?? "";
  resolveRoleFromClaims(user).then(async ({ role, roleDetails: details }) => {
    currentRole = role; roleDetails = details;
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ email, displayName: user.displayName ?? email, uid: user.uid, role, roleDetails }));
    text("user-email", email); text("role-badge", role);
    setHidden($("login-form"), true); setHidden($("user-info"), false); applyRoleVisibility(role);
      if (useDb) { await hydrateFromDb(); }
  renderCatalogsToSelects(); renderPersonas(); renderVisitas(); loadMiPerfil(user.uid, email);
  });
}
function applySignedOut() {
  currentUser = null; currentRole = "Usuario"; roleDetails = { hanIds: [], sector: "", city: "" };
  text("user-email", ""); text("role-badge", "");
  setHidden($("login-form"), false); setHidden($("user-info"), true); applyRoleVisibility("Usuario");
  localStorage.removeItem(STORAGE_KEYS.session);
}
auth.onAuthStateChanged((user) => { if (user) applySignedInUser(user); else applySignedOut(); });

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", async () => {
  loadData(); ensureSeedData();
  renderCatalogsToSelects(); renderPersonas(); renderVisitas();

  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) ?? "null");
  if (s && s.email) {
    text("user-email", s.email); text("role-badge", s.role);
    setHidden($("login-form"), true); setHidden($("user-info"), false);
    applyRoleVisibility(s.role); currentRole = s.role; roleDetails = s.roleDetails ?? roleDetails;
  }

  // Login button (popup/redirect según navegador)
  let isSigningIn = false; const loginBtn = document.getElementById("googleLoginBtn");
  const ua = navigator.userAgent.toLowerCase(); const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      if (isSigningIn) return; isSigningIn = true; loginBtn.disabled = true;
      try { const provider = new firebase.auth.GoogleAuthProvider();
        if (isIOS || isSafari) { sessionStorage.setItem("soka_signin","1"); await auth.signInWithRedirect(provider); }
        else { await auth.signInWithPopup(provider); }
      } catch (err) { console.error("[auth] signIn error", err); alert("No se pudo iniciar sesión con Google. Probá nuevamente."); }
      finally { loginBtn.disabled = false; isSigningIn = false; }
    });
  }
  auth.getRedirectResult().then((result) => { if (result && result.user) applySignedInUser(result.user); })
    .catch((err) => { console.error("[auth] getRedirectResult error:", err); })
    .finally(() => { sessionStorage.removeItem("soka_signin"); if (loginBtn) loginBtn.disabled = false; isSigningIn = false; });

  // Alta rápida (solo Admin)
  $("newPersonaBtn")?.addEventListener("click", () => {
    if (currentRole !== "Admin") return alert("Solo Admin puede crear personas nuevas.");
    editPersonaId = null; clearDatosPersonales(); toggleDatosPersonalesReadonly(false); renderPersonas(); $("firstName")?.focus();
  });
  // Limpiar form
  $("personaClearBtn")?.addEventListener("click", () => { editPersonaId = null; clearDatosPersonales(); toggleDatosPersonalesReadonly(!(currentRole === "Admin")); renderPersonas(); });
  $("personaDeleteBtn")?.addEventListener("click", () => {
    if (!editPersonaId) return alert("Seleccioná una persona de la grilla para eliminar.");
    const deletingId = editPersonaId;
    onDeletePersona(deletingId);
    editPersonaId = null;
    clearDatosPersonales();
    toggleDatosPersonalesReadonly(!(currentRole === "Admin"));
    renderPersonas();
  });

  // === EVENT DELEGATION en tbody de Personas ===
  const tbodyPersonas = $("personasTable")?.querySelector("tbody");
  if (tbodyPersonas) {
    tbodyPersonas.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-id]");
      if (tr?.dataset?.id) {
        const id = tr.dataset.id; const p = personas.find(x => x.id === id); if (p) {
          editPersonaId = id; const readonly = !(currentRole === "Admin" || (currentUser && (p.uid === currentUser.uid)));
          populateDatosPersonales(p, { readonly });
          renderPersonas();
        }
      }
    });
  }
});

/* ===== Catálogos → Selects ===== */
function renderCatalogsToSelects() {
  const selHan    = $("hanSelect");
  const selGrupo  = $("grupoSelect");
  const filHan    = $("filtroHan");
  const filGrupo  = $("filtroGrupo");
  const hanLoc    = $("hanLocalidad");
  const citySel   = $("city");

  if (selHan)   fillSelect(selHan,   hanes,  "id","name", true);
  if (selGrupo) fillSelect(selGrupo, grupos, "id","name", true);
  if (filHan)   fillSelect(filHan,   [{ id:"", name:"Todos" }, ...hanes],  "id","name", false);
  if (filGrupo) fillSelect(filGrupo, [{ id:"", name:"Todos" }, ...grupos], "id","name", false);

  const locSet = new Set([...(localidades || []), ...(hanes || []).map(h => h.city || '').filter(Boolean), ...(personas || []).map(p => p.city || '').filter(Boolean)]);
  const locItems = Array.from(locSet).sort((a,b)=>a.localeCompare(b,'es')).map(x => ({ id:x, name:x }));
  if (citySel) fillSelect(citySel, [{ id:'', name:'Seleccionar...' }, ...locItems], 'id', 'name', false);
  if (hanLoc) fillSelect(hanLoc, [{ id:'', name:'Seleccionar...' }, ...locItems], 'id', 'name', false);

  if (selHan && hanLoc) {
    selHan.onchange = () => {
      const h = hanes.find(x => x.id === selHan.value);
      if (h?.city) hanLoc.value = h.city;
    };
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml; // si otros scripts lo usan

function normalizeTextKey(v) {
  return String(v ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/* ===== Persona (form) ===== */
function clearDatosPersonales() {
  ["firstName","lastName","birthDate","address","city","phone","phoneFixed","email","fechaIngreso"].forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["status","division","nivelExamen","cargo","gohonzo","hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai"].forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["suscriptoHumanismoSoka","realizaZaimu"].forEach(id => { const el = $(id); if (el) el.checked = false; });
  $("comentarios")?.value && ($("comentarios").value = "");
}
function toggleDatosPersonalesReadonly(readonly) {
  const fields = ["firstName","lastName","birthDate","address","city","phone","phoneFixed","email","status","division","nivelExamen","fechaIngreso","cargo","gohonzo","hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai","suscriptoHumanismoSoka","realizaZaimu","comentarios"];
  fields.forEach(id => { const el = $(id); if (!el) return; el.disabled = !!readonly; });
}
function loadMiPerfil(uid, email) {
  const emailInput = $("email"); if (!emailInput) return; // Guard: Home no tiene este input
  emailInput.value = email;
  const p = personas.find(x => (x.uid && x.uid === uid) || x.email === email);
  if (p) { editPersonaId = p.id; populateDatosPersonales(p, { readonly: false }); }
  else { editPersonaId = null; toggleDatosPersonalesReadonly(!(currentRole === "Admin")); }
}

$("miPerfilForm")?.addEventListener("submit", (e) => {
  e.preventDefault(); if (!currentUser) return alert("Ingresá con Google primero.");
  const hanId   = $("hanSelect").value ?? "";  const hanObj  = hanes.find(h => h.id === hanId);
  const grupoId = $("grupoSelect").value ?? "";const grupoObj= grupos.find(g => g.id === grupoId);
  const base = {
    firstName: $("firstName").value.trim(), lastName:  $("lastName").value.trim(), birthDate: $("birthDate").value ?? "",
    address:   $("address").value.trim(),   city:      $("city").value ?? "",     phone:     $("phone").value.trim(),
    phoneFixed: $("phoneFixed").value.trim(),
    email:     $("email").value.trim(),     status:    $("status").value ?? "Miembro",
    division:  $("division").value ?? "",
    nivelExamen: $("nivelExamen").value ?? "",
    fechaIngreso: $("fechaIngreso").value ?? "",
    cargo: $("cargo").value ?? "",
    gohonzo: $("gohonzo").value ?? "",
    hanId, hanName: hanObj?.name ?? "", hanCity: $("hanLocalidad").value ?? hanObj?.city ?? "", hanSector: hanObj?.sector ?? "",
    grupoId, grupoName: grupoObj?.name ?? "",
    frecuenciaSemanal:  $("frecuenciaSemanal").value ?? "",
    frecuenciaZadankai: $("frecuenciaZadankai").value ?? "",
    suscriptoHumanismoSoka: $("suscriptoHumanismoSoka").checked,
    realizaZaimu:           $("realizaZaimu").checked,
    comentarios: $("comentarios")?.value?.trim() ?? "",
    updatedAt: Date.now()
  };

  if (editPersonaId) {
    const i = personas.findIndex(x => x.id === editPersonaId);
    if (i >= 0) {
      const esDueno = personas[i].uid && personas[i].uid === currentUser.uid;
      if (currentRole !== "Admin" && !esDueno) { return alert("Solo podés editar tu propio registro."); }
      personas[i] = { ...personas[i], ...base };
    }
  } else {
    if (currentRole !== "Admin") return alert("Solo Admin puede crear nuevas personas.");
    const nueva = { id: uid(), ...base, uid: "" }; personas.push(nueva); editPersonaId = nueva.id;
  }
  (async () => { try { if (useDb) await savePersonaToDb(editPersonaId ? personas[personas.findIndex(x => x.id === editPersonaId)] : personas[personas.length-1]); } catch(err){ console.error('[DB] Guardado Firestore falló:', err);} })();
 saveData(); renderPersonas(); alert('Persona guardada');
});

/* ===== Listado + Filtros ===== */
["filtroHan","filtroGrupo","filtroEstado","filtroDivision","filtroFreqSemanal","filtroFreqZadankai","buscarTexto"].forEach(id => $(id)?.addEventListener("input", () => renderPersonas()));

function applyFiltersBase(list) {
  const fHan   = $("filtroHan")?.value ?? "";
  const fGrupo = $("filtroGrupo")?.value ?? "";
  const fEstado= $("filtroEstado")?.value ?? "";
  const fDivision = $("filtroDivision")?.value ?? "";
  const fSem   = $("filtroFreqSemanal")?.value ?? "";
  const fZad   = $("filtroFreqZadankai")?.value ?? "";
  const qText  = ($("buscarTexto")?.value ?? "").toLowerCase();
  return (list ?? []).filter(p => {
    const okHan   = !fHan   || p.hanId === fHan;
    const okGrupo = !fGrupo || p.grupoId === fGrupo;
    const okEst   = !fEstado|| (p.status ?? "") === fEstado;
    const okDivision = !fDivision || (p.division ?? "") === fDivision;
    const okSem   = !fSem   || (p.frecuenciaSemanal   ?? "") === fSem;
    const okZad   = !fZad   || (p.frecuenciaZadankai ?? "") === fZad;
    const txt = `${p.lastName ?? ""} ${p.firstName ?? ""} ${p.email ?? ""}`.toLowerCase();
    const okText  = !qText  || txt.includes(qText);
    return okHan && okGrupo && okEst && okDivision && okSem && okZad && okText;
  });
}
function filterByRolePersonas(list) {
  switch (currentRole) {
    case "Admin":
    case "LiderCiudad": return list;
    case "LiderSector": return list.filter(p => (p.hanSector ?? "") === (roleDetails.sector ?? ""));
    case "LiderHan":    return list.filter(p => (roleDetails.hanIds ?? []).includes(p.hanId));
    case "Usuario+":
    case "Usuario":
    default:            return list; // ven personas (sin comentarios)
  }
}
function renderEmptyStatePersonas(list) {
  const empty = $("personasEmpty"); const table = $("personasTable");
  const hasData = Array.isArray(list) && list.length > 0;
  if (empty) empty.classList.toggle('hidden', hasData);
  if (table) table.classList.toggle('hidden', !hasData);
}
function renderPersonas() {
  const table = $("personasTable"); if (!table) return; const tbody = table.querySelector("tbody"); if (!tbody) return;
  const base = applyFiltersBase(personas); const filtered = filterByRolePersonas(base);
  renderEmptyStatePersonas(filtered);

  const thComentarios = table.querySelector("thead th.th-comentarios");
  if (thComentarios) thComentarios.style.display = canSeeComentarios(currentRole) ? "" : "none";

  tbody.innerHTML = "";
  filtered.forEach(p => {
    const tr = document.createElement("tr"); tr.dataset.id = p.id;
    if (editPersonaId && p.id === editPersonaId) tr.classList.add('is-selected');
    tr.innerHTML = `
  <td>${escapeHtml(p.firstName)}</td>
  <td>${escapeHtml(p.lastName)}</td>
  <td>${escapeHtml(p.status)}</td>
  <td>${escapeHtml(p.division)}</td>
  <td>${escapeHtml(p.nivelExamen)}</td>
  <td>${escapeHtml(p.cargo)}</td>
  <td>${escapeHtml(p.gohonzo)}</td>
  <td>${escapeHtml(p.hanName)}</td>
  <td>${escapeHtml(p.grupoName)}</td>
  <td>${escapeHtml(p.frecuenciaSemanal)}</td>
  <td>${escapeHtml(p.frecuenciaZadankai)}</td>
  <td>${p.suscriptoHumanismoSoka ? 'Sí' : 'No'}</td>
  <td>${p.realizaZaimu ? 'Sí' : 'No'}</td>
  <td class="td-comentarios">${canSeeComentarios(currentRole) ? `<span class="comentarios" style="white-space: pre-line">${escapeHtml(p.comentarios)}</span>` : '-'}</td>`
    const tdC = tr.querySelector(".td-comentarios"); if (tdC) tdC.style.display = canSeeComentarios(currentRole) ? "" : "none";
    tbody.appendChild(tr);
  });

  // llenar select de visitas si existe en esta página
  const visitaSel = $("visitaPersonaSelect");
  if (visitaSel) { const items = personas.map(p => ({ id:p.id, name:`${p.lastName ?? ""}, ${p.firstName ?? ""}` })); fillSelect(visitaSel, items, "id","name", true); }
}

/* ===== Eliminar persona ===== */
function onDeletePersona(id) {
  const i = personas.findIndex(x => x.id === id); if (i < 0) return;
  const esDueno = (personas[i].uid && currentUser && personas[i].uid === currentUser.uid);
  if (!esDueno && currentRole !== "Admin") { alert("No tenés permisos para eliminar esta persona."); return; }
  if (!confirm("¿Eliminar la persona seleccionada?")) return;

  // 1) Actualización de UI fuera del stack del click (evita warning de handler lento)
  setTimeout(() => {
    personas.splice(i, 1);
    visitas = (visitas ?? []).filter(v => v.personaId !== id);
    saveData();
    renderPersonas();
    renderVisitas();
  }, 0);

  // 2) Persistencia en segundo plano
  setTimeout(async () => {
    try {
      if (useDb) {
        await deletePersonaFromDb(id);
        await deleteVisitasByPersona(id);
      }
    } catch (err) {
      console.error('[deletePersona] Error al borrar en Firestore:', err);
      alert('La persona se quitó de la vista local, pero falló el borrado en Firestore.');
    }
  }, 0);
}
/* ===== Visitas ===== */
function filterByRoleVisitas(list) {
  if (!canSeeVisitas(currentRole)) return [];
  switch (currentRole) {
    case "Admin":
    case "LiderCiudad": return list;
    case "LiderSector": return list.filter(v => { const p = personas.find(x => x.id === v.personaId); return (p?.hanSector ?? "") === (roleDetails.sector ?? ""); });
    case "LiderHan":    return list.filter(v => { const p = personas.find(x => x.id === v.personaId); return (roleDetails.hanIds ?? []).includes(p?.hanId); });
    default:              return [];
  }
}
function renderVisitas() {
  const tabla = $("visitasTable"); const form = $("visitaForm"); if (!tabla || !form) return;
  const allow = canSeeVisitas(currentRole); tabla.style.display = allow ? '' : 'none'; form.style.display = allow ? '' : 'none';
  if (!allow) return;
  const tbody = tabla.querySelector('tbody'); if (!tbody) return; tbody.innerHTML = '';
  const idx = Object.fromEntries((personas ?? []).map(p => [p.id, `${escapeHtml(p.lastName ?? '')}, ${escapeHtml(p.firstName ?? '')}`]));
  const visibles = filterByRoleVisitas(visitas ?? []);
   
   visibles.forEach(v => {
     const tr = document.createElement('tr');
     const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0, 10) : '';
   
     // ✅ Escapar HTML y convertir saltos de línea
     const obsSafe = escapeHtml(v.obs ?? '').replace(/\r?\n/g, '<br/>');
   
     tr.innerHTML = `
       <td>${idx[v.personaId] ?? escapeHtml(v.personaId ?? '-')}</td>
       <td>${escapeHtml(fecha)}</td>
       <td><span class="visita-obs" style="white-space: pre-line">${obsSafe}</span></td>
     `;
     tbody.appendChild(tr);
   });
  
}
$("visitaForm")?.addEventListener("submit", (e) => {
  e.preventDefault(); if (!canSeeVisitas(currentRole)) return alert("Tu rol no puede registrar visitas.");
  const personaId = $("visitaPersonaSelect").value; const fechaStr = $("visitaFecha").value; const obs = $("visitaObs").value.trim();
  if (!personaId || !fechaStr) return; visitas.push({ id:uid(), personaId, fecha:new Date(fechaStr).toISOString(), obs, createdBy:currentUser?.uid ?? "", createdAt:Date.now() });
  (async () => { try { if (useDb) await saveVisitaToDb(visitas[visitas.length-1]); } catch(err){ console.error('[DB] No se pudo guardar visita en Firestore:', err);} })();
 saveData(); $("visitaForm").reset(); renderVisitas();
});


/* ===== Import/Export CSV Personas ===== */
function normalizeHeader(h) {
  return String(h || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '');
}
function parseDelimitedCsv(text) {
  const firstLine = text.split('\n')[0] || '';
  const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = [];
  let cur = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (q && text[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === sep && !q) {
      row.push(cur); cur = '';
    } else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => normalizeHeader(h));
  return rows.filter(r => r.some(c => String(c).trim())).map(r => {
    const o = {}; headers.forEach((h, idx) => o[h] = String(r[idx] || '').trim()); return o;
  });
}
function csvPick(row, keys) {
  for (const k of keys) {
    const nk = normalizeHeader(k);
    if (row[nk]) return row[nk];
  }
  return '';
}
function parseCsvDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0'); const mo = m[2].padStart(2, '0');
    const y = m[3].length === 2 ? `19${m[3]}` : m[3];
    return `${y}-${mo}-${d}`;
  }
  return s;
}
function mapCsvToPersona(row) {
  const firstName = csvPick(row, ['nombres','nombre']);
  const lastName = csvPick(row, ['apellido','apellidos']);
  const division = csvPick(row, ['division','d']);
  const hanNameRaw = csvPick(row, ['hannucleo','han','hannucleo']);
  const city = csvPick(row, ['localidad']);
  const address = csvPick(row, ['domicilio']);
  const phoneFixed = csvPick(row, ['telefono','telfono']);
  const phone = csvPick(row, ['movil','celular']);
  const birthDate = parseCsvDate(csvPick(row, ['fechanac','fechanacimiento']));
  const fechaIngreso = parseCsvDate(csvPick(row, ['fechaingre','fechaingreso']));
  const nivelExamen = csvPick(row, ['grcapacitaci','gradocapacitacion']) || '';
  const comentarios = csvPick(row, ['observaciones']);
  const gohonzo = csvPick(row, ['miembro','gohonzo','gohonzon']);

  const han = hanes.find(h => normalizeHeader(h.name || '') === normalizeHeader(hanNameRaw));
  const grupo = grupos.find(g => normalizeHeader(g.name || '') === normalizeHeader(nivelExamen));

  return {
    id: uid(),
    uid: '',
    firstName, lastName, birthDate,
    address, city,
    phone, phoneFixed,
    email: '',
    status: 'Miembro',
    division,
    nivelExamen,
    fechaIngreso,
    cargo: '',
    gohonzo,
    hanId: han?.id || '', hanName: han?.name || hanNameRaw || '', hanCity: han?.city || '', hanSector: han?.sector || '',
    grupoId: grupo?.id || '', grupoName: grupo?.name || '',
    frecuenciaSemanal: '', frecuenciaZadankai: '',
    suscriptoHumanismoSoka: false,
    realizaZaimu: false,
    comentarios,
    updatedAt: Date.now(),
  };
}

document.getElementById('importCSV')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseDelimitedCsv(text);
  const imported = rows.map(mapCsvToPersona).filter(p => p.firstName || p.lastName);
  if (!imported.length) return alert('No se encontraron filas válidas en el CSV.');
  personas = [...personas, ...imported];
  saveData();
  if (useDb) {
    for (const p of imported) {
      try { await savePersonaToDb(p); } catch (err) { console.warn('No se pudo subir persona a Firestore', err); }
    }
  }
  renderPersonas();
  alert(`Importación completa: ${imported.length} personas.`);
  e.target.value = '';
});

document.getElementById('exportCSVBtn')?.addEventListener('click', () => {
  const rows = filterByRolePersonas(applyFiltersBase(personas));
  const headers = ['Apellido','Nombres','División','Estado','NivelExamen','FechaIngreso','Cargo','Gohonzon','Han','Grupo','Localidad','Domicilio','TelefonoFijo','Movil','FechaNac','Observaciones'];
  const lines = [headers.join(';')];
  rows.forEach(p => {
    const vals = [p.lastName,p.firstName,p.division,p.status,p.nivelExamen,p.fechaIngreso,p.cargo,p.gohonzo,p.hanName,p.grupoName,p.city,p.address,p.phoneFixed,p.phone,p.birthDate,p.comentarios]
      .map(v => `"${String(v ?? '').replaceAll('"','""')}"`);
    lines.push(vals.join(';'));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'personas_filtrado.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ===== Utils ===== */
function fillSelect(selectEl, items, valueKey, labelKey, includeEmpty) {
  if (!selectEl) return; const current = selectEl.value; selectEl.innerHTML = "";
  if (includeEmpty) { const opt = document.createElement("option"); opt.value=""; opt.textContent="Seleccionar..."; selectEl.appendChild(opt); }
  (items ?? []).forEach(it => { const v = typeof it === "object" ? it[valueKey] : it; const l = typeof it === "object" ? it[labelKey] : String(it); const opt = document.createElement("option"); opt.value = v ?? ""; opt.textContent = l ?? ""; selectEl.appendChild(opt); });
  if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
}
