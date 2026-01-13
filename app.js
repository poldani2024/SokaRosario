
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
let editPersonaId = null;

const ADMIN_EMAILS = ["pedro.l.oldani@gmail.com", "pedro.loldani@gmail.com"]; // fallback rápido
const STORAGE_KEYS = {
  hanes: "soka_hanes",
  grupos: "soka_grupos",
  personas: "soka_personas",
  visitas: "soka_visitas",
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
    // Opcional: sincronizar a local como backup
    saveData();
    console.info('[DB] Datos cargados desde Firestore', { personas: personas.length, visitas: visitas.length });
  } catch (err) {
    console.warn('[DB] No se pudo leer desde Firestore. Usando localStorage.', err);
  }
}

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

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
}
function saveData() {
  localStorage.setItem(STORAGE_KEYS.hanes,    JSON.stringify(hanes));
  localStorage.setItem(STORAGE_KEYS.grupos,   JSON.stringify(grupos));
  localStorage.setItem(STORAGE_KEYS.personas, JSON.stringify(personas));
  localStorage.setItem(STORAGE_KEYS.visitas,  JSON.stringify(visitas));
}

/* ===== Normalización SIN seeds ===== */
function ensureSeedData() {
  // No creamos datos. Solo normalizamos lo existente y migramos campos.
  hanes    = Array.isArray(hanes)    ? hanes    : [];
  grupos   = Array.isArray(grupos)   ? grupos   : [];
  personas = Array.isArray(personas) ? personas : [];

  const idxHan = Object.fromEntries((hanes ?? []).map(h => [h.id, h]));
  personas = (personas ?? []).map(p => ({
    ...p,
    hanSector: p.hanSector ?? idxHan[p.hanId]?.sector ?? "",
    comentarios: typeof p.comentarios === "string" ? p.comentarios : ""
  }));
  saveData();
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
    editPersonaId = null; clearDatosPersonales(); toggleDatosPersonalesReadonly(false); $("firstName")?.focus();
  });
  // Limpiar form
  $("personaClearBtn")?.addEventListener("click", () => { editPersonaId = null; clearDatosPersonales(); toggleDatosPersonalesReadonly(!(currentRole === "Admin")); });

  // === EVENT DELEGATION en tbody de Personas ===
  const tbodyPersonas = $("personasTable")?.querySelector("tbody");
  if (tbodyPersonas) {
    tbodyPersonas.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (btn) {
        const id = btn.dataset.id; const action = btn.dataset.action;
        if (action === "edit-persona") {
          const p = personas.find(x => x.id === id); if (p) {
            editPersonaId = id; const readonly = !(currentRole === "Admin" || (currentUser && (p.uid === currentUser.uid)));
            populateDatosPersonales(p, { readonly });
          }
        } else if (action === "delete-persona") { onDeletePersona(id); }
        return;
      }
      const tr = e.target.closest("tr[data-id]");
      if (tr?.dataset?.id) {
        const id = tr.dataset.id; const p = personas.find(x => x.id === id); if (p) {
          editPersonaId = id; const readonly = !(currentRole === "Admin" || (currentUser && (p.uid === currentUser.uid)));
          populateDatosPersonales(p, { readonly });
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

  if (selHan)   fillSelect(selHan,   hanes,  "id","name", true);
  if (selGrupo) fillSelect(selGrupo, grupos, "id","name", true);
  if (filHan)   fillSelect(filHan,   [{ id:"", name:"Todos" }, ...hanes],  "id","name", false);
  if (filGrupo) fillSelect(filGrupo, [{ id:"", name:"Todos" }, ...grupos], "id","name", false);

  if (selHan && hanLoc) {
    selHan.addEventListener('change', () => { const h = hanes.find(x => x.id === selHan.value); hanLoc.value = h?.city ?? ''; });
  }
}

/* ===== Persona (form) ===== */
function clearDatosPersonales() {
  ["firstName","lastName","birthDate","address","city","phone","email"].forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["status","hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai"].forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["suscriptoHumanismoSoka","realizaZaimu"].forEach(id => { const el = $(id); if (el) el.checked = false; });
  $("hanLocalidad")?.value && ($("hanLocalidad").value = ""); $("comentarios")?.value && ($("comentarios").value = "");
}
function toggleDatosPersonalesReadonly(readonly) {
  const fields = ["firstName","lastName","birthDate","address","city","phone","email","status","hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai","suscriptoHumanismoSoka","realizaZaimu","comentarios"];
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
    address:   $("address").value.trim(),   city:      $("city").value.trim(),     phone:     $("phone").value.trim(),
    email:     $("email").value.trim(),     status:    $("status").value ?? "Miembro",
    hanId, hanName: hanObj?.name ?? "", hanCity: hanObj?.city ?? "", hanSector: hanObj?.sector ?? "",
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
["filtroHan","filtroGrupo","filtroEstado","filtroFreqSemanal","filtroFreqZadankai","buscarTexto"].forEach(id => $(id)?.addEventListener("input", () => renderPersonas()));

function applyFiltersBase(list) {
  const fHan   = $("filtroHan")?.value ?? "";
  const fGrupo = $("filtroGrupo")?.value ?? "";
  const fEstado= $("filtroEstado")?.value ?? "";
  const fSem   = $("filtroFreqSemanal")?.value ?? "";
  const fZad   = $("filtroFreqZadankai")?.value ?? "";
  const qText  = ($("buscarTexto")?.value ?? "").toLowerCase();
  return (list ?? []).filter(p => {
    const okHan   = !fHan   || p.hanId === fHan;
    const okGrupo = !fGrupo || p.grupoId === fGrupo;
    const okEst   = !fEstado|| (p.status ?? "") === fEstado;
    const okSem   = !fSem   || (p.frecuenciaSemanal   ?? "") === fSem;
    const okZad   = !fZad   || (p.frecuenciaZadankai ?? "") === fZad;
    const txt = `${p.lastName ?? ""} ${p.firstName ?? ""} ${p.email ?? ""}`.toLowerCase();
    const okText  = !qText  || txt.includes(qText);
    return okHan && okGrupo && okEst && okSem && okZad && okText;
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
    tr.innerHTML = `
      <td>${p.firstName ?? ""}</td>
      <td>${p.lastName  ?? ""}</td>
      <td>${p.status    ?? ""}</td>
      <td>${p.hanName   ?? ""}</td>
      <td>${p.grupoName ?? ""}</td>
      <td>${p.frecuenciaSemanal   ?? ""}</td>
      <td>${p.frecuenciaZadankai  ?? ""}</td>
      <td>${p.suscriptoHumanismoSoka ? "Sí" : "No"}</td>
      <td>${p.realizaZaimu            ? "Sí" : "No"}</td>
      <td class="td-comentarios">${canSeeComentarios(currentRole) ? (p.comentarios ?? "").replace(/
/g,"<br/>") : "—"}</td>
      <td class="acciones-admin">
        <button data-action="edit-persona" data-id="${p.id}">Editar</button>
        <button data-action="delete-persona" data-id="${p.id}">Eliminar</button>
      </td>`;
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
  if (!esDueno && currentRole !== "Admin") { alert("No tenés permisos para eliminar esta persona."); return; 
}/* ===== Visitas ===== */
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
  const allow = canSeeVisitas(currentRole); tabla.style.display = allow ? "" : "none"; form.style.display = allow ? "" : "none";
  const tbody = tabla.querySelector("tbody"); if (!tbody) return; tbody.innerHTML = "";
  const idx = Object.fromEntries(personas.map(p => [p.id, `${p.lastName ?? ""}, ${p.firstName ?? ""}`]));
  const visibles = filterByRoleVisitas(visitas);
  visibles.forEach(v => { const tr = document.createElement("tr"); const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0, 10) : ""; tr.innerHTML = `<td>${idx[v.personaId] ?? v.personaId ?? "-"}</td><td>${fecha}</td><td>${(v.obs ?? "").replace(/
/g,"<br/>")}</td>`; tbody.appendChild(tr); });
}
$("visitaForm")?.addEventListener("submit", (e) => {
  e.preventDefault(); if (!canSeeVisitas(currentRole)) return alert("Tu rol no puede registrar visitas.");
  const personaId = $("visitaPersonaSelect").value; const fechaStr = $("visitaFecha").value; const obs = $("visitaObs").value.trim();
  if (!personaId || !fechaStr) return; visitas.push({ id:uid(), personaId, fecha:new Date(fechaStr).toISOString(), obs, createdBy:currentUser?.uid ?? "", createdAt:Date.now() });
  (async () => { try { if (useDb) await saveVisitaToDb(visitas[visitas.length-1]); } catch(err){ console.error('[DB] No se pudo guardar visita en Firestore:', err);} })();
 saveData(); $("visitaForm").reset(); renderVisitas();
});

/* ===== Utils ===== */
function fillSelect(selectEl, items, valueKey, labelKey, includeEmpty) {
  if (!selectEl) return; const current = selectEl.value; selectEl.innerHTML = "";
  if (includeEmpty) { const opt = document.createElement("option"); opt.value=""; opt.textContent="Seleccionar..."; selectEl.appendChild(opt); }
  (items ?? []).forEach(it => { const v = typeof it === "object" ? it[valueKey] : it; const l = typeof it === "object" ? it[labelKey] : String(it); const opt = document.createElement("option"); opt.value = v ?? ""; opt.textContent = l ?? ""; selectEl.appendChild(opt); });
  if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
}
