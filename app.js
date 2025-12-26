
// ====== Estado / Cache ======
let currentUser = null;      // { email, uid }
let currentRole = "Usuario"; // "Admin" | "Usuario"
let hanes = [];   // [{id,name,city}]
let grupos = [];  // [{id,name}]
let personas = []; // [{id,...}]
let visitas = []; // [{id, personaId, fecha, obs, createdBy }]

// ====== Constantes / Config ======
const ADMIN_EMAILS = [
  "pedro@ejemplo.com", // Cambiá por tus correos de admin
  "admin@soka.org"
];

const STORAGE_KEYS = {
  hanes: "soka_hanes",
  grupos: "soka_grupos",
  personas: "soka_personas",
  visitas: "soka_visitas",
  session: "soka_session"    // { email, uid, role }
};

// ====== Helpers DOM ======
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
function toast(msg) { console.log(msg); }

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
      { id: uid(), firstName: "Juan", lastName: "Pérez", email: "juan@ejemplo.com", status: "Miembro", hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name, frecuenciaSemanal: "Frecuentemente", frecuenciaZadankai: "Poco", suscriptoHumanismoSoka: true, realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Ana",  lastName: "García", email: "ana@ejemplo.com",  status: "Amigo Soka", hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name, frecuenciaSemanal: "Poco", frecuenciaZadankai: "Nunca", suscriptoHumanismoSoka: false, realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Luis", lastName: "Mendoza", email: "luis@ejemplo.com", status: "Miembro", hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name, frecuenciaSemanal: "Nunca", frecuenciaZadankai: "Frecuentemente", suscriptoHumanismoSoka: true, realizaZaimu: true, updatedAt: Date.now() },
    ];
  }
  saveData();
}

// ====== Login simple ======
$("simpleLoginBtn").addEventListener("click", () => {
  const email = ($("loginEmail").value || "").trim().toLowerCase();
  if (!email) return alert("Ingresá tu email.");
  const role = ADMIN_EMAILS.includes(email) ? "Admin" : "Usuario";
  currentUser = { email, uid: email }; // usamos email como uid simple
  currentRole = role;
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ email, uid: currentUser.uid, role }));
  postLoginUI();
});
$("logoutBtn").addEventListener("click", () => {
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
  updateKPIs();
  updateCharts();
  renderVisitas();
  loadMiPerfil(currentUser.uid, currentUser.email);
}
function preLoginUI() {
  setHidden($("login-form"), false);
  setHidden($("user-info"), true);
  text("user-email", "");
  text("role-badge", "");
  document.body.classList.remove("role-admin", "role-user");
  document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
}

// ====== Inicialización ======
loadData();
ensureSeedData();
renderCatalogsToSelects(); // para ver filtros y selects antes del login también
renderPersonas();
updateKPIs();
updateCharts();
renderVisitas();
// restaurar sesión si existe
const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
if (s && s.email) {
  currentUser = { email: s.email, uid: s.uid };
  currentRole = s.role || "Usuario";
  postLoginUI();
}

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
  if (!currentUser) return alert("Ingresá primero.");

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
    uid: currentUser.uid,
    updatedAt: Date.now(),
  };

  const idx = personas.findIndex(x => x.uid === currentUser.uid);
  if (idx >= 0) {
    persona.id = personas[idx].id;
    personas[idx] = persona;
  } else {
    personas.push(persona);
  }
  saveData();
  renderPersonas();
  updateKPIs();
  updateCharts();
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
        <button data-action="delete" data-id="${h.id}">Eliminar</button>
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
        <button data-action="delete" data-id="${g.id}">Eliminar</button>
      </div>`;
    ul.appendChild(li);
  });
}
renderGruposAdmin();

// ====== Personas (listado + filtros + acciones admin) ======
