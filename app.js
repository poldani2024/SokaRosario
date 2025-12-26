
/******************************************************************
 * Soka Gakkai — Frontend + Firebase Auth (Google)
 * - Datos en localStorage (Hanes, Grupos, Personas, Visitas)
 * - Login con Firebase Auth (popup/redirect)
 * - SIN KPIs y SIN gráficos
 ******************************************************************/

// ====== Estado / Cache ======
let currentUser = null;      // { email, displayName, uid }
let currentRole = "Usuario"; // "Admin" | "Usuario"
let hanes = [];
let grupos = [];
let personas = [];
let visitas = [];

// ====== Config ======
const ADMIN_EMAILS = [
  "pedro.l.oldani@gmail.com"  // <-- agregá tus cuentas admin
];

const STORAGE_KEYS = {
  hanes: "soka_hanes",
  grupos: "soka_grupos",
  personas: "soka_personas",
  visitas: "soka_visitas",
  session: "soka_session"    // { email, displayName, uid, role }
};

// ====== Helpers ======
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ====== localStorage ======
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
        frecuenciaSemanal: "Frecuentemente", frecuenciaZadankai: "Poco", suscriptoHumanismoSoka: true, realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Ana",  lastName: "García", email: "ana@ejemplo.com",  status: "Amigo Soka",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Poco", frecuenciaZadankai: "Nunca", suscriptoHumanismoSoka: false, realizaZaimu: false, updatedAt: Date.now() },
      { id: uid(), firstName: "Luis", lastName: "Mendoza", email: "luis@ejemplo.com", status: "Miembro",
        hanId: h0.id, hanName: h0.name, hanCity: h0.city, grupoId: g0.id, grupoName: g0.name,
        frecuenciaSemanal: "Nunca", frecuenciaZadankai: "Frecuentemente", suscriptoHumanismoSoka: true, realizaZaimu: true, updatedAt: Date.now() },
    ];
  }
  saveData();
}

// ====== Login con Firebase Auth (Google) ======
const googleLoginBtn = $("googleLoginBtn");
const logoutBtn = $("logoutBtn");
const userInfoDiv = $("user-info");
const loginFormDiv = $("login-form");

// Detección básica para usar redirect en iOS/Safari (más estable que popup)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

googleLoginBtn?.addEventListener("click", async () => {
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

logoutBtn?.addEventListener("click", () => auth.signOut());

// Observador de estado (igual que en tu otra app)
auth.onAuthStateChanged((user) => {
  currentUser = user || null;
  currentRole = "Usuario";

  if (user) {
    const email = user.email?.toLowerCase() || "";
    const displayName = user.displayName || email;
    const role = ADMIN_EMAILS.includes(email) ? "Admin" : "Usuario";
    currentRole = role;

    // Persistir sesión sencilla
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
      email, displayName, uid: user.uid, role
    }));

    // UI
    text("user-email", email);
    text("role-badge", role);
    setHidden(loginFormDiv, true);
    setHidden(userInfoDiv, false);
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
    setHidden(loginFormDiv, false);
    setHidden(userInfoDiv, true);
    document.body.classList.remove("role-admin", "role-user");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    text("user-email", "");
    text("role-badge", "");
    localStorage.removeItem(STORAGE_KEYS.session);
  }
});

// ====== Inicialización ======
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  ensureSeedData();

  renderCatalogsToSelects();
  renderPersonas();
  renderVisitas();

  // Restaurar sesión si había (solo para el UI; Auth real manda onAuthStateChanged)
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
  if (s && s.email) {
    // La sesión real se activa con onAuthStateChanged;
    // esto solo evita “pantallazo” si ya estás logueado.
    text("user-email", s.email);
    text("role-badge", s.role);
  }
});

// ====== Catálogos → Selects ======
function renderCatalogsToSelects() {
  // Mi Perfil
  fillSelect($("hanSelect"), hanes, "id", "name", true);
  fillSelect($("grupoSelect"), grupos, "id", "name", true);
  // Editor admin
  fillSelect($("p_hanSelect"), hanes, "id", "name", true);
  fillSelect($("p_grupoSelect"), grupos, "id", "name", true);
  // Filtros
  fillSelect($("filtroHan"), [{ id: "", name: "Todos" }, ...hanes], "id", "name", false);
  fillSelect($("filtroGrupo"), [{ id: "", name: "Todos" }, ...grupos], "id", "name", false);

  $("hanSelect")?.addEventListener("change", () => {
    const sel = $("hanSelect").value;
    const h = hanes.find(x => x.id === sel);
    $("hanLocalidad").value = h?.city || "";
  });
}

// ====== Mi Perfil (igual que tu versión localStorage) ======
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

$("miPerfilForm")?.addEventListener("submit", (e) => {
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
  alert("Perfil guardado correctamente");
});

// ====== Hanes / Grupos / Personas / Visitas (igual que versión anterior) ======
/* Mantengo todos tus handlers y funciones:
   - Hanes: submit, cancel, renderHanesAdmin, list click
   - Grupos: submit, cancel, renderGruposAdmin, list click
   - Personas: render, filtros, edición admin, import/export CSV
   - Visitas: alta y render
   - fillSelect, toBool, etc.
   Copiá aquí tu implementación previa (no la repito para no alargar). */
