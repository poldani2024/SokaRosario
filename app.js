
/* ===== app.js (Roles + Comentarios + Sector en Han) =====
   - Detección de rol (claims -> fallback email admin)
   - Filtros por rol (LiderSector/LiderHan)
   - Ocultar/mostrar columna Comentarios según rol
   - Seeds con han.sector y persona.hanSector
   - CSV con comentarios/hanSector
   - Login: popup (Chrome/Edge/Firefox) / redirect (Safari/iOS)
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
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ===== Roles & gating ===== */
function resolveRoleFromClaims(user) {
  let role = "Usuario";
  roleDetails = { hanIds: [], sector: "", city: "" };

  if (!user) return { role, roleDetails };
  const email = (user.email ?? "").toLowerCase();

  return user.getIdTokenResult()
    .then(token => {
      const claims = token?.claims ?? {};
      if (typeof claims.role === "string") role = claims.role;        // claim 'role' tiene prioridad
      if (ADMIN_EMAILS.includes(email)) role = "Admin";               // fallback rápido
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

function canSeeVisitas(role) {
  return ["Admin", "LiderCiudad", "LiderSector", "LiderHan"].includes(role);
}
function canSeeComentarios(role) {
  return ["Admin", "LiderCiudad", "LiderSector", "LiderHan"].includes(role);
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

/* Seeds + migración suave (agrega sector y comentarios) */
function ensureSeedData() {
  if (!hanes.length) {
    hanes = [
      { id: uid(), name: "Han Centro", city: "Rosario",             sector: "Centro" },
      { id: uid(), name: "Han Norte",  city: "Granadero Baigorria", sector: "Norte"  },
      { id: uid(), name: "Han Oeste",  city: "Funes",               sector: "Oeste"  }
    ];
  }
  if (!grupos.length) {
    grupos = [
      { id: uid(), name: "Grupo A" },
      { id: uid(), name: "Grupo B" },
      { id: uid(), name: "Grupo C" }
    ];
  }
  if (!personas.length) {
    const h0 = hanes[0], g0 = grupos[0];
    personas = [
      { id: uid(), firstName: "Juan", lastName: "Pérez",  email:"juan@ejemplo.com", status:"Miembro",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, hanSector:h0.sector,
        grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Frecuentemente", frecuenciaZadankai:"Poco",
        suscriptoHumanismoSoka:true, realizaZaimu:false, comentarios:"",
        updatedAt:Date.now() },
      { id: uid(), firstName: "Ana",  lastName: "García", email:"ana@ejemplo.com", status:"Amigo Soka",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, hanSector:h0.sector,
        grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Poco", frecuenciaZadankai:"Nunca",
        suscriptoHumanismoSoka:false, realizaZaimu:false, comentarios:"",
        updatedAt:Date.now() },
      { id: uid(), firstName: "Luis", lastName: "Mendoza", email:"luis@ejemplo.com", status:"Miembro",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, hanSector:h0.sector,
        grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Nunca", frecuenciaZadankai:"Frecuentemente",
        suscriptoHumanismoSoka:true, realizaZaimu:true, comentarios:"",
        updatedAt:Date.now() }
    ];
  }
  // Migración: completar hanSector y comentarios si faltan
  const idxHan = Object.fromEntries(hanes.map(h => [h.id, h]));
  personas = (personas ?? []).map(p => {
    const h = idxHan[p.hanId];
    return {
      ...p,
      hanSector: p.hanSector ?? h?.sector ?? "",
      comentarios: typeof p.comentarios === "string" ? p.comentarios : ""
    };
  });
  saveData();
}

/* ===== Auth (Firebase v8) ===== */
// Botón logout
$("logoutBtn")?.addEventListener("click", () => auth.signOut());

function applySignedInUser(user) {
  currentUser = user;
  const email = user.email?.toLowerCase() ?? "";

  resolveRoleFromClaims(user).then(({ role, roleDetails: details }) => {
    currentRole = role;
    roleDetails = details;

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
      email, displayName: user.displayName ?? email, uid: user.uid, role, roleDetails
    }));

    text("user-email", email);
    text("role-badge", role);
    setHidden($("login-form"), true);
    setHidden($("user-info"), false);
    applyRoleVisibility(role);

    renderCatalogsToSelects();
    renderPersonas();
    renderVisitas();
    loadMiPerfil(user.uid, email);
  });
}

function applySignedOut() {
  currentUser = null;
  currentRole = "Usuario";
  roleDetails = { hanIds: [], sector: "", city: "" };

  text("user-email", "");
  text("role-badge", "");
  setHidden($("login-form"), false);
  setHidden($("user-info"), true);
  applyRoleVisibility("Usuario");
  localStorage.removeItem(STORAGE_KEYS.session);
}

// Suscripción principal (se ejecuta cuando auth existe)
auth.onAuthStateChanged((user) => { if (user) applySignedInUser(user); else applySignedOut(); });

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  ensureSeedData();
  renderCatalogsToSelects();
  renderPersonas();
  renderVisitas();

  // Render inmediato si había sesión (evita parpadeo)
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) ?? "null");
  if (s && s.email) {
    text("user-email", s.email);
    text("role-badge", s.role);
    setHidden($("login-form"), true);
    setHidden($("user-info"), false);
    applyRoleVisibility(s.role);
    currentRole = s.role;
    roleDetails = s.roleDetails ?? roleDetails;
  }

  // ===== Botón login (popup/redirect según navegador) =====
  let isSigningIn = false;
  const loginBtn = document.getElementById("googleLoginBtn");

  // Detectores robustos (sin regex con saltos de línea)
  const ua = navigator.userAgent.toLowerCase();
  const isIOS    = /iphone|ipad|ipod/.test(ua);
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      if (isSigningIn) return;
      isSigningIn = true;
      loginBtn.disabled = true;
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        if (isIOS || isSafari) {                      // Safari/iOS => redirect
          sessionStorage.setItem("soka_signin", "1");
          await auth.signInWithRedirect(provider);
        } else {                                      // Otros => popup
          await auth.signInWithPopup(provider);
        }
      } catch (err) {
        console.error("[auth] signIn error", err);
        alert("No se pudo iniciar sesión con Google. Probá nuevamente.");
      } finally {
        loginBtn.disabled = false;
        isSigningIn = false;
      }
    });
  }

  // Consolidación de redirect al volver
  auth.getRedirectResult()
    .then((result) => { if (result && result.user) applySignedInUser(result.user); })
    .catch((err) => { console.error("[auth] getRedirectResult error:", err); })
    .finally(() => {
      sessionStorage.removeItem("soka_signin");
      if (loginBtn) loginBtn.disabled = false;
      isSigningIn = false;
    });

  // Alta rápida (solo Admin)
  $("newPersonaBtn")?.addEventListener("click", () => {
    if (currentRole !== "Admin") return alert("Solo Admin puede crear personas nuevas.");
    editPersonaId = null;
    clearDatosPersonales();
    toggleDatosPersonalesReadonly(false);
    $("firstName")?.focus();
  });

  // Limpiar form
  $("personaClearBtn")?.addEventListener("click", () => {
    editPersonaId = null;
    clearDatosPersonales();
    toggleDatosPersonalesReadonly(!(currentRole === "Admin"));
  });
});

/* ===== Catálogos → Selects ===== */
function renderCatalogsToSelects() {
  fillSelect($("hanSelect"),    hanes,  "id", "name", true);
  fillSelect($("grupoSelect"),  grupos, "id", "name", true);
  fillSelect($("filtroHan"),   [{ id:"", name:"Todos" }, ...hanes],  "id", "name", false);
  fillSelect($("filtroGrupo"), [{ id:"", name:"Todos" }, ...grupos], "id", "name", false);

  $("hanSelect")?.addEventListener("change", () => {
    const sel = $("hanSelect").value;
    const h = hanes.find(x => x.id === sel);
    $("hanLocalidad").value = h?.city ?? "";
  });
}

/* ===== Persona (form) ===== */
function clearDatosPersonales() {
  ["firstName","lastName","birthDate","address","city","phone","email"]
    .forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["status","hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai"]
    .forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["suscriptoHumanismoSoka","realizaZaimu"]
    .forEach(id => { const el = $(id); if (el) el.checked = false; });
  $("hanLocalidad")?.value && ($("hanLocalidad").value = "");
  $("comentarios")?.value && ($("comentarios").value = "");
}

function toggleDatosPersonalesReadonly(readonly) {
  const fields = [
    "firstName","lastName","birthDate","address","city","phone","email","status",
    "hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai",
    "suscriptoHumanismoSoka","realizaZaimu","comentarios"
  ];
  fields.forEach(id => { const el = $(id); if (!el) return; el.disabled = !!readonly; });
}

function loadMiPerfil(uid, email) {
  $("email").value = email;
  const p = personas.find(x => (x.uid && x.uid === uid) || x.email === email);
  if (p) {
    editPersonaId = p.id;
    populateDatosPersonales(p, { readonly: false });
  } else {
    editPersonaId = null;
    toggleDatosPersonalesReadonly(!(currentRole === "Admin"));
  }
}

$("miPerfilForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Ingresá con Google primero.");

  const hanId   = $("hanSelect").value ?? "";
  const hanObj  = hanes.find(h => h.id === hanId);
  const grupoId = $("grupoSelect").value ?? "";
  const grupoObj= grupos.find(g => g.id === grupoId);

  const base = {
    firstName: $("firstName").value.trim(),
    lastName:  $("lastName").value.trim(),
    birthDate: $("birthDate").value ?? "",
    address:   $("address").value.trim(),
    city:      $("city").value.trim(),
    phone:     $("phone").value.trim(),
    email:     $("email").value.trim(),
    status:    $("status").value ?? "Miembro",
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
      if (currentRole !== "Admin" && !esDueno) {
        return alert("Solo podés editar tu propio registro.");
      }
      personas[i] = { ...personas[i], ...base };
    }
  } else {
    if (currentRole !== "Admin") {
      return alert("Solo Admin puede crear nuevas personas.");
    }
    const nueva = { id: uid(), ...base, uid: "" }; // alta sin dueño
    personas.push(nueva);
    editPersonaId = nueva.id;
  }

  saveData();
  renderPersonas();
  alert("Persona guardada");
});

/* ===== Filtros ===== */
["filtroHan","filtroGrupo","filtroEstado","filtroFreqSemanal","filtroFreqZadankai","buscarTexto"]
  .forEach(id => $(id)?.addEventListener("input", () => renderPersonas()));

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

/* Filtro por rol */
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

function renderPersonas() {
  const table = $("personasTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  // mostrar/ocultar columna Comentarios
  const thComentarios = table.querySelector("thead th.th-comentarios");
  if (thComentarios) thComentarios.style.display = canSeeComentarios(currentRole) ? "" : "none";

  tbody.innerHTML = "";
  const base = applyFiltersBase(personas);
  const filtered = filterByRolePersonas(base);

  filtered.forEach(p => {
    const tr = document.createElement("tr");
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
      <td class="td-comentarios">${canSeeComentarios(currentRole) ? (p.comentarios ?? "").replace(/\n/g,"<br/>") : "—"}</td>
      <td class="acciones-admin"><div class="actions"></div></td>
    `;
    const tdC = tr.querySelector(".td-comentarios");
    if (tdC) tdC.style.display = canSeeComentarios(currentRole) ? "" : "none";

    tr.addEventListener("click", () => {
      editPersonaId = p.id;
      const readonly = !(currentRole === "Admin" || (currentUser && (p.uid === currentUser.uid)));
      populateDatosPersonales(p, { readonly });
    });

    const actions = tr.querySelector(".actions");
    if (actions) {
      const btnEdit = document.createElement("button");
      btnEdit.textContent = "Editar";
      btnEdit.dataset.action = "edit-persona";
      btnEdit.dataset.id = p.id;

      const btnDel = document.createElement("button");
      btnDel.textContent = "Eliminar";
      btnDel.className   = "secondary";
      btnDel.dataset.action = "delete-persona";
      btnDel.dataset.id     = p.id;

      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
    }
    tbody.appendChild(tr);
  });

  // llenar select de visitas (si existe en esta página)
  fillSelect(
    $("visitaPersonaSelect"),
    personas.map(p => ({ id:p.id, name:`${p.lastName ?? ""}, ${p.firstName ?? ""}` })),
    "id","name", true
  );
}

function populateDatosPersonales(p, { readonly }) {
  $("firstName").value = p.firstName ?? "";
  $("lastName").value  = p.lastName  ?? "";
  $("birthDate").value = p.birthDate ?? "";
  $("address").value   = p.address   ?? "";
  $("city").value      = p.city      ?? "";
  $("phone").value     = p.phone     ?? "";
  $("email").value     = p.email     ?? "";
  $("status").value    = p.status    ?? "Miembro";

  $("hanSelect").value     = p.hanId   ?? "";
  $("hanLocalidad").value  = p.hanCity ?? "";
  $("grupoSelect").value   = p.grupoId ?? "";

  $("frecuenciaSemanal").value  = p.frecuenciaSemanal  ?? "";
  $("frecuenciaZadankai").value = p.frecuenciaZadankai ?? "";

  $("suscriptoHumanismoSoka").checked = !!p.suscriptoHumanismoSoka;
  $("realizaZaimu").checked           = !!p.realizaZaimu;
  if ($("comentarios")) $("comentarios").value = p.comentarios ?? "";

  toggleDatosPersonalesReadonly(!!readonly);
}

/* ===== CSV Import / Export ===== */
$("importCSV")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: (res) => {
      const rows = res.data;
      for (const r of rows) {
        // Han (+sector)
        let hanId = "";
        if (r.hanName) {
          let ex = hanes.find(h => h.name === r.hanName && (!r.hanCity || h.city === r.hanCity));
          if (!ex) { ex = { id: uid(), name: r.hanName, city: r.hanCity ?? "", sector: r.hanSector ?? "" }; hanes.push(ex); }
          hanId = ex.id;
        }
        // Grupo
        let grupoId = "";
        if (r.grupoName) {
          let exg = grupos.find(g => g.name === r.grupoName);
          if (!exg) { exg = { id: uid(), name: r.grupoName }; grupos.push(exg); }
          grupoId = exg.id;
        }
        const id = (r.uid && r.uid.trim()) || uid();
        const persona = {
          id,
          firstName: r.firstName ?? "", lastName: r.lastName ?? "", birthDate: r.birthDate ?? "",
          address: r.address ?? "", city: r.city ?? "", phone: r.phone ?? "",
          email: r.email ?? "", status: r.status ?? "Miembro",
          hanId, hanName: r.hanName ?? "", hanCity: r.hanCity ?? "",
          hanSector: r.hanSector ?? (hanes.find(h => h.id === hanId)?.sector ?? ""),
          grupoId, grupoName: r.grupoName ?? "",
          frecuenciaSemanal: r.frecuenciaSemanal ?? "", frecuenciaZadankai: r.frecuenciaZadankai ?? "",
          suscriptoHumanismoSoka: toBool(r.suscriptoHumanismoSoka), realizaZaimu: toBool(r.realizaZaimu),
          comentarios: r.comentarios ?? "",
          updatedAt: Date.now(),
        };
        const i = personas.findIndex(x => x.id === id);
        if (i >= 0) personas[i] = { ...personas[i], ...persona };
        else personas.push(persona);
      }
      saveData();
      renderCatalogsToSelects();
      renderPersonas();
      alert("Importación completada");
      $("importCSV").value = "";
    }
  });
});

$("exportCSVBtn")?.addEventListener("click", () => {
  const filtered = applyFiltersBase(filterByRolePersonas(personas));
  const data = filtered.map(p => ({
    firstName: p.firstName ?? "", lastName: p.lastName ?? "", birthDate: p.birthDate ?? "",
    address: p.address ?? "", city: p.city ?? "", phone: p.phone ?? "", email: p.email ?? "",
    status: p.status ?? "",
    hanName: p.hanName ?? "", hanCity: p.hanCity ?? "", hanSector: p.hanSector ?? "",
    grupoName: p.grupoName ?? "",
    frecuenciaSemanal: p.frecuenciaSemanal ?? "", frecuenciaZadankai: p.frecuenciaZadankai ?? "",
    suscriptoHumanismoSoka: !!p.suscriptoHumanismoSoka, realizaZaimu: !!p.realizaZaimu,
    comentarios: p.comentarios ?? "",
    uid: p.id ?? ""
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "personas_filtrado.csv"; a.click();
  URL.revokeObjectURL(url);
});

/* ===== Visitas ===== */
function filterByRoleVisitas(list) {
  if (!canSeeVisitas(currentRole)) return [];
  switch (currentRole) {
    case "Admin":
    case "LiderCiudad": return list;
    case "LiderSector":
      return list.filter(v => {
        const p = personas.find(x => x.id === v.personaId);
        return (p?.hanSector ?? "") === (roleDetails.sector ?? "");
      });
    case "LiderHan":
      return list.filter(v => {
        const p = personas.find(x => x.id === v.personaId);
        return (roleDetails.hanIds ?? []).includes(p?.hanId);
      });
    default:
      return [];
  }
}

function renderVisitas() {
  const tabla = $("visitasTable");
  const form  = $("visitaForm");
  if (!tabla || !form) return;

  const allow = canSeeVisitas(currentRole);
  tabla.style.display = allow ? "" : "none";
  form.style.display  = allow ? "" : "none";

  const tbody = tabla.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const idx = Object.fromEntries(personas.map(p => [p.id, `${p.lastName ?? ""}, ${p.firstName ?? ""}`]));
  const visibles = filterByRoleVisitas(visitas);

  visibles.forEach(v => {
    const tr = document.createElement("tr");
    const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0, 10) : "";
    tr.innerHTML = `<td>${idx[v.personaId] ?? v.personaId ?? "-"}</td><td>${fecha}</td><td>${(v.obs ?? "").replace(/\n/g,"<br/>")}</td>`;
    tbody.appendChild(tr);
  });
}

$("visitaForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!canSeeVisitas(currentRole)) return alert("Tu rol no puede registrar visitas.");
  const personaId = $("visitaPersonaSelect").value;
  const fechaStr  = $("visitaFecha").value;
  const obs       = $("visitaObs").value.trim();
  if (!personaId || !fechaStr) return;
  visitas.push({ id:uid(), personaId, fecha:new Date(fechaStr).toISOString(), obs, createdBy:currentUser?.uid ?? "", createdAt:Date.now() });
  saveData(); $("visitaForm").reset(); renderVisitas();
});

/* ===== Utils ===== */
function fillSelect(selectEl, items, valueKey, labelKey, includeEmpty) {
  if (!selectEl) return;
  const current = selectEl.value; selectEl.innerHTML = "";
  if (includeEmpty) { const opt = document.createElement("option"); opt.value=""; opt.textContent="Seleccionar..."; selectEl.appendChild(opt); }
  (items ?? []).forEach(it => {
    const v = typeof it === "object" ? it[valueKey] : it;
    const l = typeof it === "object" ? it[labelKey] : String(it);
    const opt = document.createElement("option"); opt.value = v ?? ""; opt.textContent = l ?? ""; selectEl.appendChild(opt);
  });
  if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
}
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string")  return ["true","1","sí","si","yes"].includes(v.trim().toLowerCase());
  return !!v;
}
