
/******************************************************************
 * App Soka Gakkai — 100% Frontend (GitHub Pages) + Google Sign-In
 * - Autenticación con Google Identity Services (GIS)
 * - Datos en localStorage (Hanes, Grupos, Personas, Visitas)
 * - Filtros, CSV import/export
 * - SIN KPIs y SIN gráficos
 ******************************************************************/

// ====== Configurar Google Sign-In ======
const CLIENT_ID = "569099432032-38i5gd0ckti341cq2n5n906n4b56skm9.apps.googleusercontent.com"; // <-- reemplazar con tu Client ID

// ====== Estado / Cache ======
let currentUser = null;      // { email, name, picture, sub(uid) }
let currentRole = "Usuario"; // "Admin" | "Usuario"
let hanes = [];   // [{id,name,city}]
let grupos = [];  // [{id,name}]
let personas = []; // [{id,...}]
let visitas = []; // [{id, personaId, fecha, obs, createdBy }]

// ====== Constantes ======
const ADMIN_EMAILS = [
  "pedro.l.oldani@gmail.com" // <-- agregá aquí tus cuentas admin de Gmail
];

const STORAGE_KEYS = {
  hanes: "soka_hanes",
  grupos: "soka_grupos",
  personas: "soka_personas",
  visitas: "soka_visitas",
  session: "soka_session"    // { email, name, picture, sub, role }
};

// Reintenta hasta que GIS esté listo (máx 10 intentos cada 200 ms)
function ensureGISLoadedThenInit(retries = 10, delayMs = 200) {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    initGoogleSignIn();
    return;
  }
  if (retries <= 0) {
    console.warn("GIS no disponible tras reintentos. Verifica la etiqueta <script src='https://accounts.google.com/gsi/client'> y el dominio autorizado.");
    return;
  }
  setTimeout(() => ensureGISLoadedThenInit(retries - 1, delayMs), delayMs);
}

// En vez de initGoogleSignIn() directo:
document.addEventListener("DOMContentLoaded", () => {
  // ... tu inicialización actual ...
  ensureGISLoadedThenInit();
});

window.addEventListener("load", () => {
  if (!window.google) {
    ensureGISLoadedThenInit();
  }
});

// ====== Helpers DOM ======
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
function toast(msg) { console.log(msg); }

// ====== JWT (GIS) ======
function parseJwt(token) {
  // Base64URL decode
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));
  return JSON.parse(jsonPayload);
}

// ====== Persistencia local ======
function loadData() {
  hanes = JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes) || "[]");
  grupos = JSON.parse(localStorage.getItem(STORAGE_KEYS.grupos) || "[]");
  personas = JSON.parse(localStorage.getItem(STORAGE_KEYS.personas) || "[]");
  visitas = JSON.parse(localStorage.getItem(STORAGE_KEYS.visitas) || "[]");
}
function saveData() {
  localStorage.setItem(STORAGE_KEYS.hanes, JSON.stringify(hanes));
  localStorage.setItem(STORAGE_KEYS.grupos, JSON.stringify(grupos));
  localStorage.setItem(STORAGE_KEYS.personas, JSON.stringify(personas));
  localStorage.setItem(STORAGE_KEYS.visitas, JSON.stringify(visitas));
}

// ====== Seed inicial (si no hay datos) ======
function ensureSeedData() {
  if (!hanes.length) {
    hanes = [
      { id: uid(), name: "Han Centro", city: "Rosario" },
      { id: uid(), name: "Han Norte", city: "Granadero Baigorria" },
      { id: uid(), name: "Han Oeste", city: "Funes" },
    ];
  }
  if (!grupos.length) {
    grupos = [
      { id: uid(), name: "Grupo A" },
      { id: uid(), name: "Grupo B" },
      { id: uid(), name: "Grupo C" },
    ];
  }
  if (!personas.length) {
    const h0 = hanes[0], g0 = grupos[0];
    personas = [
      { id: uid(), firstName: "Juan", lastName: "Pérez", email: "juan@ejemplo.com", status: "Miembro",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Frecuentemente", frecuenciaZadankai: "Poco",
        suscriptoHumanismoSoka: true, realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Ana",  lastName: "García", email: "ana@ejemplo.com",  status: "Amigo Soka",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Poco", frecuenciaZadankai: "Nunca",
        suscriptoHumanismoSoka: false, realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Luis", lastName: "Mendoza", email: "luis@ejemplo.com", status: "Miembro",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Nunca", frecuenciaZadankai: "Frecuentemente",
        suscriptoHumanismoSoka: true, realizaZaimu: true, updatedAt: Date.now() },
    ];
  }
  saveData();
}

// ====== Google Sign-In (GIS) ======
function initGoogleSignIn() {
  if (!window.google || !CLIENT_ID.includes(".apps.googleusercontent.com")) {
    console.warn("GIS no cargado o CLIENT_ID faltante."||CLIENT_ID);
    return;
  }

  // Inicializa GIS
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    ux_mode: "popup"
  });

  // Renderiza botón
  google.accounts.id.renderButton(
    document.getElementById("googleBtnContainer"),
    { theme: "outline", size: "large", type: "standard", text: "signin_with" }
  );
}

function handleCredentialResponse(response) {
  try {
    const payload = parseJwt(response.credential);
    const email = (payload.email || "").toLowerCase();
    const name = payload.name || email;
    const picture = payload.picture || "";
    const sub = payload.sub || email; // unique Google user id

    const role = ADMIN_EMAILS.includes(email) ? "Admin" : "Usuario";
    currentUser = { email, name, picture, sub };
    currentRole = role;

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ email, name, picture, sub, role }));
    postLoginUI();
  } catch (err) {
    console.error("Error decodificando credencial:", err);
    alert("No se pudo iniciar sesión con Google.");
  }
}

function revokeGoogle() {
  if (!currentUser?.email || !window.google) return;
  google.accounts.id.revoke(currentUser.email, () => {
    console.log("Token revocado");
  });
}

// ====== Login / Logout UI ======
$("logoutBtn").addEventListener("click", () => {
  revokeGoogle();
  localStorage.removeItem(STORAGE_KEYS.session);
  currentUser = null;
  currentRole = "Usuario";
  preLoginUI();
});

function postLoginUI() {
  setHidden($("login-form"), true);
  setHidden($("user-info"), false);
  text("user-email", currentUser.email);
  text("role-badge", currentRole);
  document.body.classList.toggle("role-admin", currentRole === "Admin");
  document.body.classList.toggle("role-user", currentRole !== "Admin");
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", currentRole !== "Admin"));

  renderCatalogsToSelects();
  renderPersonas();
  renderVisitas();
  loadMiPerfil(currentUser.sub, currentUser.email);
}

function preLoginUI() {
  setHidden($("login-form"), false);
  setHidden($("user-info"), true);
  text("user-email", "");
  text("role-badge", "");
  document.body.classList.remove("role-admin", "role-user");
  document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
}

// ====== Inicialización App ======
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  ensureSeedData();
  renderCatalogsToSelects();
  renderPersonas();
  renderVisitas();

  // Restaurar sesión si existe
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
  if (s && s.email) {
    currentUser = { email: s.email, name: s.name, picture: s.picture, sub: s.sub };
    currentRole = s.role || "Usuario";
    postLoginUI();
  }

  // Inicializar GIS
  initGoogleSignIn();
});

// ====== Catálogos → Selects ======
function renderCatalogsToSelects() {
  // Selects de Mi Perfil
  fillSelect($("hanSelect"), hanes, "id", "name", true);
  fillSelect($("grupoSelect"), grupos, "id", "name", true);
  // Selects del editor de persona (admin)
  fillSelect($("p_hanSelect"), hanes, "id", "name", true);
  fillSelect($("p_grupoSelect"), grupos, "id", "name", true);
  // Filtros
  fillSelect($("filtroHan"), [{ id: "", name: "Todos" }, ...hanes], "id", "name", false);
  fillSelect($("filtroGrupo"), [{ id: "", name: "Todos" }, ...grupos], "id", "name", false);

  // Cambio de Han en Mi Perfil → muestra localidad
  $("hanSelect")?.addEventListener("change", () => {
    const sel = $("hanSelect").value;
    const h = hanes.find(x => x.id === sel);
    $("hanLocalidad").value = h?.city || "";
  });
}

// ====== Mi Perfil ======
function loadMiPerfil(uid, email) {
  $("email").value = email;
  const p = personas.find(x => x.uid === uid || x.email === email);
  if (p) {
    $("firstName").value = p.firstName || "";
    $("lastName").value = p.lastName || "";
    $("birthDate").value = p.birthDate || "";
    $("address").value = p.address || "";
    $("city").value = p.city || "";
    $("phone").value = p.phone || "";
    $("status").value = p.status || "Miembro";
    $("hanSelect").value = p.hanId || "";
    $("hanLocalidad").value = p.hanCity || "";
    $("grupoSelect").value = p.grupoId || "";
    $("frecuenciaSemanal").value = p.frecuenciaSemanal || "";
    $("frecuenciaZadankai").value = p.frecuenciaZadankai || "";
    $("suscriptoHumanismoSoka").checked = !!p.suscriptoHumanismoSoka;
    $("realizaZaimu").checked = !!p.realizaZaimu;
  }
}

$("miPerfilForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Ingresá con Google primero.");

  const hanId = $("hanSelect").value || "";
  const hanObj = hanes.find(h => h.id === hanId);
  const grupoId = $("grupoSelect").value || "";
  const grupoObj = grupos.find(g => g.id === grupoId);

  const persona = {
    id: uid(),
    firstName: $("firstName").value.trim(),
    lastName: $("lastName").value.trim(),
    birthDate: $("birthDate").value || "",
    address: $("address").value.trim(),
    city: $("city").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    status: $("status").value || "Miembro",
    hanId, hanName: hanObj?.name || "", hanCity: hanObj?.city || "",
    grupoId, grupoName: grupoObj?.name || "",
    frecuenciaSemanal: $("frecuenciaSemanal").value || "",
    frecuenciaZadankai: $("frecuenciaZadankai").value || "",
    suscriptoHumanismoSoka: $("suscriptoHumanismoSoka").checked,
    realizaZaimu: $("realizaZaimu").checked,
    uid: currentUser.sub,
    updatedAt: Date.now(),
  };

  const idx = personas.findIndex(x => x.uid === currentUser.sub);
  if (idx >= 0) {
    persona.id = personas[idx].id;
    personas[idx] = persona;
  } else {
    personas.push(persona);
  }
  saveData();
  renderPersonas();
  alert("Perfil guardado correctamente");
});

// ====== Hanes (CRUD, solo admin) ======
$("hanForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("hanId").value.trim();
  const name = $("hanName").value.trim();
  const city = $("hanCity").value.trim();
  if (!name || !city) return;

  if (id) {
    const i = hanes.findIndex(h => h.id === id);
    if (i >= 0) hanes[i] = { ...hanes[i], name, city };
  } else {
    hanes.push({ id: uid(), name, city });
  }
  saveData();
  $("hanForm").reset();
  renderCatalogsToSelects();
  renderHanesAdmin();
});

$("hanCancelBtn").addEventListener("click", () => $("hanForm").reset());
$("hanList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const h = hanes.find(x => x.id === id);
  if (!h) return;

  if (action === "edit") {
    $("hanId").value = h.id;
    $("hanName").value = h.name;
    $("hanCity").value = h.city;
  } else if (action === "delete") {
    if (!confirm(`¿Eliminar Han "${h.name}"?`)) return;
    hanes = hanes.filter(x => x.id !== id);
    saveData();
    renderCatalogsToSelects();
    renderHanesAdmin();
  }
});

function renderHanesAdmin() {
  const ul = $("hanList");
  if (!ul) return;
  ul.innerHTML = "";
  hanes.forEach(h => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><strong>${h.name}</strong> — ${h.city}</span>
      <div class="actions acciones-admin">
        <button data-action="edit" data-id="${h.id}">Editar</button>
        <button data-action="delete" data-id="${h.id}" class="secondary">Eliminar</button>
      </div>`;
    ul.appendChild(li);
  });
}
renderHanesAdmin();

// ====== Grupos (CRUD, solo admin) ======
$("grupoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("grupoId").value.trim();
  const name = $("grupoName").value.trim();
  if (!name) return;

  if (id) {
    const i = grupos.findIndex(g => g.id === id);
    if (i >= 0) grupos[i] = { ...grupos[i], name };
  } else {
    grupos.push({ id: uid(), name });
  }
  saveData();
  $("grupoForm").reset();
  renderCatalogsToSelects();
  renderGruposAdmin();
});

$("grupoCancelBtn").addEventListener("click", () => $("grupoForm").reset());
$("grupoList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const g = grupos.find(x => x.id === id);
  if (!g) return;

  if (action === "edit") {
    $("grupoId").value = g.id;
    $("grupoName").value = g.name;
  } else if (action === "delete") {
    if (!confirm(`¿Eliminar Grupo "${g.name}"?`)) return;
    grupos = grupos.filter(x => x.id !== id);
    saveData();
    renderCatalogsToSelects();
    renderGruposAdmin();
  }
});

function renderGruposAdmin() {
  const ul = $("grupoList");
  if (!ul) return;
  ul.innerHTML = "";
  grupos.forEach(g => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><strong>${g.name}</strong></span>
      <div class="actions acciones-admin">
        <button data-action="edit" data-id="${g.id}">Editar</button>
        <button data-action="delete" data-id="${g.id}" class="secondary">Eliminar</button>
      </div>`;
    ul.appendChild(li);
  });
}
renderGruposAdmin();

// ====== Personas (listado + filtros + acciones admin) ======
["filtroHan", "filtroGrupo", "filtroEstado", "filtroFreqSemanal", "filtroFreqZadankai", "buscarTexto"]
  .forEach(id => $(id)?.addEventListener("input", () => { renderPersonas(); }));

function applyFilters(list) {
  const fHan = $("filtroHan").value || "";
  const fGrupo = $("filtroGrupo").value || "";
  const fEstado = $("filtroEstado").value || "";
  const fSem = $("filtroFreqSemanal").value || "";
  const fZad = $("filtroFreqZadankai").value || "";
  const qText = ($("buscarTexto").value || "").toLowerCase();

  return list.filter(p => {
    const okHan = !fHan || p.hanId === fHan;
    const okGrupo = !fGrupo || p.grupoId === fGrupo;
    const okEstado = !fEstado || (p.status || "") === fEstado;
    const okSem = !fSem || (p.frecuenciaSemanal || "") === fSem;
    const okZad = !fZad || (p.frecuenciaZadankai || "") === fZad;
    const txt = `${p.lastName || ""} ${p.firstName || ""} ${p.email || ""}`.toLowerCase();
    const okText = !qText || txt.includes(qText);
    return okHan && okGrupo && okEstado && okSem && okZad && okText;
  });
}

function renderPersonas() {
  const tbody = $("personasTable").querySelector("tbody");
  tbody.innerHTML = "";
  const filtered = applyFilters(personas);

  filtered.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.firstName || ""}</td>
      <td>${p.lastName || ""}</td>
      <td>${p.status || ""}</td>
      <td>${p.hanName || ""}</td>
      <td>${p.grupoName || ""}</td>
      <td>${p.frecuenciaSemanal || ""}</td>
      <td>${p.frecuenciaZadankai || ""}</td>
      <td>${p.suscriptoHumanismoSoka ? "Sí" : "No"}</td>
      <td>${p.realizaZaimu ? "Sí" : "No"}</td>
      <td class="acciones-admin">
        <div class="actions">
          <button data-action="edit-persona" data-id="${p.id}">Editar</button>
          <button data-action="delete-persona" data-id="${p.id}" class="secondary">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Eventos de edición/eliminación
  tbody.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const p = personas.find(x => x.id === id);
      if (!p) return;

      if (action === "edit-persona") {
        openPersonaEditor(p);
      } else if (action === "delete-persona") {
        if (!confirm(`¿Eliminar persona "${p.lastName || ""}, ${p.firstName || ""}"?`)) return;
        personas = personas.filter(x => x.id !== id);
        saveData();
        renderPersonas();
      }
    });
  });

  // Select de visitas (personas)
  fillSelect($("visitaPersonaSelect"),
    personas.map(p => ({ id: p.id, name: `${p.lastName || ""}, ${p.firstName || ""}` })),
    "id", "name", true
  );
}

function openPersonaEditor(p) {
  setHidden($("personaEditor"), false);
  $("personaId").value = p.id;
  $("p_firstName").value = p.firstName || "";
  $("p_lastName").value = p.lastName || "";
  $("p_birthDate").value = p.birthDate || "";
  $("p_address").value = p.address || "";
  $("p_city").value = p.city || "";
  $("p_phone").value = p.phone || "";
  $("p_email").value = p.email || "";
  $("p_status").value = p.status || "Miembro";
  $("p_hanSelect").value = p.hanId || "";
  $("p_grupoSelect").value = p.grupoId || "";
  $("p_frecuenciaSemanal").value = p.frecuenciaSemanal || "";
  $("p_frecuenciaZadankai").value = p.frecuenciaZadankai || "";
  $("p_suscriptoHumanismoSoka").checked = !!p.suscriptoHumanismoSoka;
  $("p_realizaZaimu").checked = !!p.realizaZaimu;
}

$("personaCancelBtn").addEventListener("click", () => setHidden($("personaEditor"), true));
$("personaAdminForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("personaId").value;
  const hanId = $("p_hanSelect").value || "";
  const hanObj = hanes.find(h => h.id === hanId);
  const grupoId = $("p_grupoSelect").value || "";
  const grupoObj = grupos.find(g => g.id === grupoId);

  const data = {
    id,
    firstName: $("p_firstName").value.trim(),
    lastName: $("p_lastName").value.trim(),
    birthDate: $("p_birthDate").value || "",
    address: $("p_address").value.trim(),
    city: $("p_city").value.trim(),
    phone: $("p_phone").value.trim(),
    email: $("p_email").value.trim(),
    status: $("p_status").value || "Miembro",
    hanId, hanName: hanObj?.name || "", hanCity: hanObj?.city || "",
    grupoId, grupoName: grupoObj?.name || "",
    frecuenciaSemanal: $("p_frecuenciaSemanal").value || "",
    frecuenciaZadankai: $("p_frecuenciaZadankai").value || "",
    suscriptoHumanismoSoka: $("p_suscriptoHumanismoSoka").checked,
    realizaZaimu: $("p_realizaZaimu").checked,
    updatedAt: Date.now(),
  };

  const i = personas.findIndex(x => x.id === id);
  if (i >= 0) personas[i] = data;
  saveData();
  toast("Persona actualizada");
  setHidden($("personaEditor"), true);
  renderPersonas();
});

// ====== Import / Export CSV ======
$("importCSV").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      const rows = res.data;
      for (const r of rows) {
        // Crear/obtener Han
        let hanId = "";
        if (r.hanName) {
          let ex = hanes.find(h => h.name === r.hanName && (!r.hanCity || h.city === r.hanCity));
          if (!ex) { ex = { id: uid(), name: r.hanName, city: r.hanCity || "" }; hanes.push(ex); }
          hanId = ex.id;
        }
        // Crear/obtener Grupo
        let grupoId = "";
        if (r.grupoName) {
          let exg = grupos.find(g => g.name === r.grupoName);
          if (!exg) { exg = { id: uid(), name: r.grupoName }; grupos.push(exg); }
          grupoId = exg.id;
        }
        // Upsert Persona
        const id = (r.uid && r.uid.trim()) || uid();
        const persona = {
          id,
          firstName: r.firstName || "",
          lastName: r.lastName || "",
          birthDate: r.birthDate || "",
          address: r.address || "",
          city: r.city || "",
          phone: r.phone || "",
          email: r.email || "",
          status: r.status || "Miembro",
          hanId, hanName: r.hanName || "", hanCity: r.hanCity || "",
          grupoId, grupoName: r.grupoName || "",
          frecuenciaSemanal: r.frecuenciaSemanal || "",
          frecuenciaZadankai: r.frecuenciaZadankai || "",
          suscriptoHumanismoSoka: toBool(r.suscriptoHumanismoSoka),
          realizaZaimu: toBool(r.realizaZaimu),
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

$("exportCSVBtn").addEventListener("click", () => {
  const filtered = applyFilters(personas);
  const data = filtered.map(p => ({
    firstName: p.firstName || "",
    lastName: p.lastName || "",
    birthDate: p.birthDate || "",
    address: p.address || "",
    city: p.city || "",
    phone: p.phone || "",
    email: p.email || "",
    status: p.status || "",
    hanName: p.hanName || "",
    hanCity: p.hanCity || "",
    grupoName: p.grupoName || "",
    frecuenciaSemanal: p.frecuenciaSemanal || "",
    frecuenciaZadankai: p.frecuenciaZadankai || "",
    suscriptoHumanismoSoka: !!p.suscriptoHumanismoSoka,
    realizaZaimu: !!p.realizaZaimu,
    uid: p.id || ""
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "personas_filtrado.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// ====== Visitas ======
function renderVisitas() {
  const tabla = document.getElementById("visitasTable");
  if (!tabla) return;
  const tbody = tabla.querySelector("tbody");
  tbody.innerHTML = "";
  const personasIndex = Object.fromEntries(personas.map(p => [p.id, `${p.lastName || ""}, ${p.firstName || ""}`]));

  visitas.forEach(v => {
    const tr = document.createElement("tr");
    const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0, 10) : "";
    tr.innerHTML = `
      <td>${personasIndex[v.personaId] || v.personaId || "-"}</td>
      <td>${fecha}</td>
      <td>${(v.obs || "").replace(/\n/g, "<br/>")}</td>
    `;
    tbody.appendChild(tr);
  });
}

$("visitaForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const personaId = $("visitaPersonaSelect").value;
  const fechaStr = $("visitaFecha").value;
  const obs = $("visitaObs").value.trim();
  if (!personaId || !fechaStr) return;

  visitas.push({
    id: uid(),
    personaId,
    fecha: new Date(fechaStr).toISOString(),
    obs,
    createdBy: currentUser?.sub || "",
    createdAt: Date.now(),
  });
  saveData();
  $("visitaForm").reset();
  toast("Visita registrada");
  renderVisitas();
});

// ====== Utilidades ======
function fillSelect(selectEl, items, valueKey, labelKey, includeEmpty) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = "";
  if (includeEmpty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Seleccionar...";
    selectEl.appendChild(opt);
  }
  items.forEach(it => {
    const opt = document.createElement("option");
    opt.value = it[valueKey];
    opt.textContent = it[labelKey];
    selectEl.appendChild(opt);
  });
  if ([...selectEl.options].some(o => o.value === current)) {
    selectEl.value = current;
  }
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "sí", "si", "yes"].includes(v.trim().toLowerCase());
  return !!v;
}
