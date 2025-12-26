
/******************************************************************
 * Soka Gakkai — Frontend + Firebase Auth (Google)
 * - Login con Firebase Auth (popup/redirect según navegador)
 * - Datos en localStorage (Hanes, Grupos, Personas, Visitas)
 * - Filtros, CSV import/export (PapaParse)
 * - SIN KPIs y SIN gráficos
 ******************************************************************/

/* ========================= Estado / Cache ========================= */
let currentUser = null;      // { email, displayName, uid }
let currentRole = "Usuario"; // "Admin" | "Usuario"

let hanes   = [];  // [{id,name,city}]
let grupos  = [];  // [{id,name}]
let personas= [];  // [{id,...}]
let visitas = [];  // [{id, personaId, fecha, obs, createdBy }]

/* ========================= Config ========================= */
// >>> Editá esta lista con tus correos admin:
const ADMIN_EMAILS = [
  "pedro.l.oldani@gmail.com"
];

const STORAGE_KEYS = {
  hanes:   "soka_hanes",
  grupos:  "soka_grupos",
  personas:"soka_personas",
  visitas: "soka_visitas",
  session: "soka_session"    // { email, displayName, uid, role }
};

/* ========================= Helpers DOM ========================= */
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ========================= Persistencia local ========================= */
function loadData() {
  hanes    = JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes)    || "[]");
  grupos   = JSON.parse(localStorage.getItem(STORAGE_KEYS.grupos)   || "[]");
  personas = JSON.parse(localStorage.getItem(STORAGE_KEYS.personas) || "[]");
  visitas  = JSON.parse(localStorage.getItem(STORAGE_KEYS.visitas)  || "[]");
}
function saveData() {
  localStorage.setItem(STORAGE_KEYS.hanes,    JSON.stringify(hanes));
  localStorage.setItem(STORAGE_KEYS.grupos,   JSON.stringify(grupos));
  localStorage.setItem(STORAGE_KEYS.personas, JSON.stringify(personas));
  localStorage.setItem(STORAGE_KEYS.visitas,  JSON.stringify(visitas));
}
function ensureSeedData() {
  if (!hanes.length) {
    hanes = [
      { id: uid(), name: "Han Centro", city: "Rosario" },
      { id: uid(), name: "Han Norte",  city: "Granadero Baigorria" },
      { id: uid(), name: "Han Oeste",  city: "Funes" }
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
      { id: uid(), firstName: "Juan", lastName: "Pérez", email: "juan@ejemplo.com", status: "Miembro",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Frecuentemente", frecuenciaZadankai: "Poco",
        suscriptoHumanismoSoka: true,  realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Ana",  lastName: "García", email: "ana@ejemplo.com",  status: "Amigo Soka",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Poco",         frecuenciaZadankai: "Nunca",
        suscriptoHumanismoSoka: false,     realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Luis", lastName: "Mendoza", email: "luis@ejemplo.com", status: "Miembro",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Nunca",        frecuenciaZadankai: "Frecuentemente",
        suscriptoHumanismoSoka: true,      realizaZaimu: true,  updatedAt: Date.now() }
    ];
  }
  saveData();
}

// ===== Menú de Administración (dropdown) =====
const adminMenu      = $("adminMenu");
const adminMenuBtn   = $("adminMenuBtn");
const adminDropdown  = $("adminDropdown");
const adminPanels    = ["adminHanes", "adminGrupos"];

// Toggle abrir/cerrar menú
adminMenuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = !adminDropdown.classList.contains("hidden");
  adminDropdown.classList.toggle("hidden", isOpen);
  adminMenuBtn.setAttribute("aria-expanded", String(!isOpen));
});

// Cerrar al hacer click fuera
document.addEventListener("click", (e) => {
  if (!adminDropdown) return;
  const clickedInside = adminDropdown.contains(e.target) || adminMenuBtn.contains(e.target);
  if (!clickedInside) {
    adminDropdown.classList.add("hidden");
    adminMenuBtn?.setAttribute("aria-expanded", "false");
  }
});

// Selección de pantalla
adminDropdown?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-target]");
  if (!btn) return;
  const targetId = btn.dataset.target;
  showAdminPanel(targetId);
  // cerrar menú luego de seleccionar
  adminDropdown.classList.add("hidden");
  adminMenuBtn?.setAttribute("aria-expanded", "false");
});

// Mostrar una pantalla admin y ocultar las otras
function showAdminPanel(targetId) {
  adminPanels.forEach(id => setHidden($(id), id !== targetId));
  // scroll suave a la pantalla
  $(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ========================= Login con Firebase Auth (Google) ========================= */
// Requiere firebase.js que expone: window.auth = firebase.auth()
const auth = window.auth;

// Detección para usar redirect en iOS/Safari (más estable que popup)
const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

$("googleLoginBtn")?.addEventListener("click", async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    if (isIOS && isSafari) {
      await auth.signInWithRedirect(provider);
    } else {
      await auth.signInWithPopup(provider);
    }
  } catch (err) {
    console.error("[auth] signIn error", err);
    alert("No se pudo iniciar sesión con Google. Probá nuevamente.");
  }
});

$("logoutBtn")?.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged((user) => {
  currentUser = user || null;
  currentRole = "Usuario";

  if (user) {
    const email = user.email?.toLowerCase() || "";
    const displayName = user.displayName || email;
    const role = ADMIN_EMAILS.includes(email) ? "Admin" : "Usuario";
    currentRole = role;

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
      email, displayName, uid: user.uid, role
    }));

    // UI
    text("user-email", email);
    text("role-badge", role);
    setHidden($("login-form"), true);
    setHidden($("user-info"), false);
    document.body.classList.toggle("role-admin", role === "Admin");
    document.body.classList.toggle("role-user", role !== "Admin");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", role !== "Admin"));

    // Render inicial
    renderCatalogsToSelects();
    renderPersonas();
    renderVisitas();
    loadMiPerfil(user.uid, email);
  } else {
    // limpiar UI
    setHidden($("login-form"), false);
    setHidden($("user-info"), true);
    document.body.classList.remove("role-admin", "role-user");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    text("user-email", "");
    text("role-badge", "");
    localStorage.removeItem(STORAGE_KEYS.session);
  }
});

/* ========================= Inicialización ========================= */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  ensureSeedData();

  renderCatalogsToSelects();
  renderPersonas();
  renderVisitas();

  // “Pantallazo” leve de sesión previa (Auth real define el estado luego)
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
  if (s && s.email) {
    text("user-email", s.email);
    text("role-badge", s.role);
  }
});

/* ========================= Catálogos → Selects ========================= */
function renderCatalogsToSelects() {
  // Mi Perfil
  fillSelect($("hanSelect"),   hanes,  "id", "name", true);
  fillSelect($("grupoSelect"), grupos, "id", "name", true);

  // Editor admin
  fillSelect($("p_hanSelect"),   hanes,  "id", "name", true);
  fillSelect($("p_grupoSelect"), grupos, "id", "name", true);

  // Filtros
  fillSelect($("filtroHan"),   [{ id: "", name: "Todos" }, ...hanes],  "id", "name", false);
  fillSelect($("filtroGrupo"), [{ id: "", name: "Todos" }, ...grupos], "id", "name", false);

  // Cambio de Han en Mi Perfil → muestra localidad
  $("hanSelect")?.addEventListener("change", () => {
    const sel = $("hanSelect").value;
    const h = hanes.find(x => x.id === sel);
    $("hanLocalidad").value = h?.city || "";
  });
}

/* ========================= Mi Perfil ========================= */
function loadMiPerfil(uid, email) {
  $("email").value = email;
  const p = personas.find(x => x.uid === uid || x.email === email);
  if (p) {
    $("firstName").value = p.firstName || "";
    $("lastName").value  = p.lastName  || "";
    $("birthDate").value = p.birthDate || "";
    $("address").value   = p.address   || "";
    $("city").value      = p.city      || "";
    $("phone").value     = p.phone     || "";
    $("status").value    = p.status    || "Miembro";

    $("hanSelect").value     = p.hanId || "";
    $("hanLocalidad").value  = p.hanCity || "";
    $("grupoSelect").value   = p.grupoId || "";

    $("frecuenciaSemanal").value   = p.frecuenciaSemanal   || "";
    $("frecuenciaZadankai").value  = p.frecuenciaZadankai  || "";
    $("suscriptoHumanismoSoka").checked = !!p.suscriptoHumanismoSoka;
    $("realizaZaimu").checked           = !!p.realizaZaimu;
  }
}

$("miPerfilForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Ingresá con Google primero.");

  const hanId   = $("hanSelect").value || "";
  const hanObj  = hanes.find(h => h.id === hanId);
  const grupoId = $("grupoSelect").value || "";
  const grupoObj= grupos.find(g => g.id === grupoId);

  const persona = {
    id: uid(),
    firstName: $("firstName").value.trim(),
    lastName:  $("lastName").value.trim(),
    birthDate: $("birthDate").value || "",
    address:   $("address").value.trim(),
    city:      $("city").value.trim(),
    phone:     $("phone").value.trim(),
    email:     $("email").value.trim(),
    status:    $("status").value || "Miembro",

    hanId,   hanName:  hanObj?.name  || "", hanCity: hanObj?.city  || "",
    grupoId, grupoName:grupoObj?.name|| "",

    frecuenciaSemanal:  $("frecuenciaSemanal").value  || "",
    frecuenciaZadankai: $("frecuenciaZadankai").value || "",
    suscriptoHumanismoSoka: $("suscriptoHumanismoSoka").checked,
    realizaZaimu:           $("realizaZaimu").checked,

    uid: currentUser.uid,
    updatedAt: Date.now(),
  };

  const idx = personas.findIndex(x => x.uid === currentUser.uid);
  if (idx >= 0) {
    persona.id = personas[idx].id;   // conservar ID
    personas[idx] = persona;
  } else {
    personas.push(persona);
  }
  saveData();
  renderPersonas();
  alert("Perfil guardado correctamente");
});

/* ========================= Hanes (CRUD admin) ========================= */
$("hanForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const id   = $("hanId").value.trim();
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
$("hanCancelBtn")?.addEventListener("click", () => $("hanForm").reset());

$("hanList")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const h = hanes.find(x => x.id === id);
  if (!h) return;

  if (action === "edit") {
    $("hanId").value   = h.id;
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
        editEditar</button>
        deleteEliminar</button>
      </div>
    `;
    // completar botones con data-attrs
    const container = document.createElement("div");
    container.innerHTML = `
      editEditar</button>
      deleteEliminar</button>
    `;
    // Mejor: crear botones explícitos
    const actions = li.querySelector(".acciones-admin");
    actions.innerHTML = "";
    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar";
    btnEdit.dataset.action = "edit";
    btnEdit.dataset.id = h.id;

    const btnDel = document.createElement("button");
    btnDel.textContent = "Eliminar";
    btnDel.className = "secondary";
    btnDel.dataset.action = "delete";
    btnDel.dataset.id = h.id;

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);

    ul.appendChild(li);
  });
}
renderHanesAdmin();

/* ========================= Grupos (CRUD admin) ========================= */
$("grupoForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const id   = $("grupoId").value.trim();
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
$("grupoCancelBtn")?.addEventListener("click", () => $("grupoForm").reset());

$("grupoList")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const g = grupos.find(x => x.id === id);
  if (!g) return;

  if (action === "edit") {
    $("grupoId").value   = g.id;
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
      <div class="actions acciones-admin"></div>
    `;
    const actions = li.querySelector(".acciones-admin");
    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar";
    btnEdit.dataset.action = "edit";
    btnEdit.dataset.id = g.id;

    const btnDel = document.createElement("button");
    btnDel.textContent = "Eliminar";
    btnDel.className = "secondary";
    btnDel.dataset.action = "delete";
    btnDel.dataset.id = g.id;

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);

    ul.appendChild(li);
  });
}
renderGruposAdmin();

/* ========================= Personas (listado + filtros + editor admin) ========================= */
["filtroHan","filtroGrupo","filtroEstado","filtroFreqSemanal","filtroFreqZadankai","buscarTexto"]
  .forEach(id => $(id)?.addEventListener("input", () => { renderPersonas(); }));

function applyFilters(list) {
  const fHan   = $("filtroHan")?.value || "";
  const fGrupo = $("filtroGrupo")?.value || "";
  const fEstado= $("filtroEstado")?.value || "";
  const fSem   = $("filtroFreqSemanal")?.value || "";
  const fZad   = $("filtroFreqZadankai")?.value || "";
  const qText  = ($("buscarTexto")?.value || "").toLowerCase();

  return (list || []).filter(p => {
    const okHan    = !fHan   || p.hanId === fHan;
    const okGrupo  = !fGrupo || p.grupoId === fGrupo;
    const okEstado = !fEstado|| (p.status || "") === fEstado;
    const okSem    = !fSem   || (p.frecuenciaSemanal   || "") === fSem;
    const okZad    = !fZad   || (p.frecuenciaZadankai  || "") === fZad;

    const txt = `${p.lastName || ""} ${p.firstName || ""} ${p.email || ""}`.toLowerCase();
    const okText  = !qText || txt.includes(qText);
    return okHan && okGrupo && okEstado && okSem && okZad && okText;
  });
}

function renderPersonas() {
  const table = $("personasTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtered = applyFilters(personas);

  filtered.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.firstName || ""}</td>
      <td>${p.lastName  || ""}</td>
      <td>${p.status    || ""}</td>
      <td>${p.hanName   || ""}</td>
      <td>${p.grupoName || ""}</td>
      <td>${p.frecuenciaSemanal  || ""}</td>
      <td>${p.frecuenciaZadankai || ""}</td>
      <td>${p.suscriptoHumanismoSoka ? "Sí" : "No"}</td>
      <td>${p.realizaZaimu ? "Sí" : "No"}</td>
      <td class="acciones-admin">
        <div class="actions"></div>
      </td>
    `;
    const actions = tr.querySelector(".actions");
    if (actions) {
      const btnEdit = document.createElement("button");
      btnEdit.textContent = "Editar";
      btnEdit.dataset.action = "edit-persona";
      btnEdit.dataset.id = p.id;

      const btnDel = document.createElement("button");
      btnDel.textContent = "Eliminar";
      btnDel.className = "secondary";
      btnDel.dataset.action = "delete-persona";
      btnDel.dataset.id = p.id;

      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
    }
    tbody.appendChild(tr);
  });

  // Eventos de acciones
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

  // Select de Visitas
  fillSelect(
    $("visitaPersonaSelect"),
    personas.map(p => ({ id: p.id, name: `${p.lastName || ""}, ${p.firstName || ""}` })),
    "id","name", true
  );
}

function openPersonaEditor(p) {
  const editor = $("personaEditor");
  if (!editor) return;
  setHidden(editor, false);

  $("personaId").value       = p.id;
  $("p_firstName").value     = p.firstName || "";
  $("p_lastName").value      = p.lastName  || "";
  $("p_birthDate").value     = p.birthDate || "";
  $("p_address").value       = p.address   || "";
  $("p_city").value          = p.city      || "";
  $("p_phone").value         = p.phone     || "";
  $("p_email").value         = p.email     || "";
  $("p_status").value        = p.status    || "Miembro";
  $("p_hanSelect").value     = p.hanId     || "";
  $("p_grupoSelect").value   = p.grupoId   || "";
  $("p_frecuenciaSemanal").value   = p.frecuenciaSemanal   || "";
  $("p_frecuenciaZadankai").value  = p.frecuenciaZadankai  || "";
  $("p_suscriptoHumanismoSoka").checked = !!p.suscriptoHumanismoSoka;
  $("p_realizaZaimu").checked           = !!p.realizaZaimu;
}

$("personaCancelBtn")?.addEventListener("click", () => setHidden($("personaEditor"), true));

$("personaAdminForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("personaId").value;

  const hanId   = $("p_hanSelect").value || "";
  const hanObj  = hanes.find(h => h.id === hanId);
  const grupoId = $("p_grupoSelect").value || "";
  const grupoObj= grupos.find(g => g.id === grupoId);

  const data = {
    id,
    firstName: $("p_firstName").value.trim(),
    lastName:  $("p_lastName").value.trim(),
    birthDate: $("p_birthDate").value || "",
    address:   $("p_address").value.trim(),
    city:      $("p_city").value.trim(),
    phone:     $("p_phone").value.trim(),
    email:     $("p_email").value.trim(),
    status:    $("p_status").value || "Miembro",

    hanId,   hanName:  hanObj?.name  || "", hanCity: hanObj?.city  || "",
    grupoId, grupoName:grupoObj?.name|| "",

    frecuenciaSemanal:  $("p_frecuenciaSemanal").value  || "",
    frecuenciaZadankai: $("p_frecuenciaZadankai").value || "",
    suscriptoHumanismoSoka: $("p_suscriptoHumanismoSoka").checked,
    realizaZaimu:           $("p_realizaZaimu").checked,

    updatedAt: Date.now(),
  };

  const i = personas.findIndex(x => x.id === id);
  if (i >= 0) personas[i] = data;

  saveData();
  setHidden($("personaEditor"), true);
  renderPersonas();
});

/* ========================= Import / Export CSV ========================= */
// Requiere PapaParse (CDN) → global Papa
$("importCSV")?.addEventListener("change", async (e) => {
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
          lastName:  r.lastName  || "",
          birthDate: r.birthDate || "",
          address:   r.address   || "",
          city:      r.city      || "",
          phone:     r.phone     || "",
          email:     r.email     || "",
          status:    r.status    || "Miembro",

          hanId,   hanName:  r.hanName  || "", hanCity: r.hanCity || "",
          grupoId, grupoName:r.grupoName|| "",

          frecuenciaSemanal:  r.frecuenciaSemanal  || "",
          frecuenciaZadankai: r.frecuenciaZadankai || "",
          suscriptoHumanismoSoka: toBool(r.suscriptoHumanismoSoka),
          realizaZaimu:           toBool(r.realizaZaimu),

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
  const filtered = applyFilters(personas);
  const data = filtered.map(p => ({
    firstName: p.firstName || "",
    lastName:  p.lastName  || "",
    birthDate: p.birthDate || "",
    address:   p.address   || "",
    city:      p.city      || "",
    phone:     p.phone     || "",
    email:     p.email     || "",
    status:    p.status    || "",
    hanName:   p.hanName   || "",
    hanCity:   p.hanCity   || "",
    grupoName: p.grupoName || "",
    frecuenciaSemanal:  p.frecuenciaSemanal  || "",
    frecuenciaZadankai: p.frecuenciaZadankai || "",
    suscriptoHumanismoSoka: !!p.suscriptoHumanismoSoka,
    realizaZaimu:           !!p.realizaZaimu,
    uid: p.id || ""
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = "personas_filtrado.csv";
  a.click();
  URL.revokeObjectURL(url);
});

/* ========================= Visitas ========================= */
function renderVisitas() {
  const tabla = $("visitasTable");
  if (!tabla) return;
  const tbody = tabla.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const personasIndex = Object.fromEntries(
    personas.map(p => [p.id, `${p.lastName || ""}, ${p.firstName || ""}`])
  );

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

$("visitaForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const personaId = $("visitaPersonaSelect").value;
  const fechaStr  = $("visitaFecha").value;
  const obs       = $("visitaObs").value.trim();
  if (!personaId || !fechaStr) return;

  visitas.push({
    id: uid(),
    personaId,
    fecha: new Date(fechaStr).toISOString(),
    obs,
    createdBy: currentUser?.uid || "",
    createdAt: Date.now(),
  });
  saveData();
  $("visitaForm").reset();
  renderVisitas();
});

/* ========================= Utilidades ========================= */
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

  (items || []).forEach(it => {
    const v = typeof it === "object" ? it[valueKey] : it;
    const l = typeof it === "object" ? it[labelKey] : String(it);
    const opt = document.createElement("option");
    opt.value = v ?? "";
    opt.textContent = l ?? "";
    selectEl.appendChild(opt);
  });

  if ([...selectEl.options].some(o => o.value === current)) {
    selectEl.value = current;
  }
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true","1","sí","si","yes"].includes(v.trim().toLowerCase());
  return !!v;
}
