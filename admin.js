
/******************************************************************
 * ADMIN — Soka Gakkai + Firebase Auth (Google) + localStorage
 * - Solo Admin: CRUD Hanes y Grupos
 ******************************************************************/

/* ===== Estado ===== */
let currentUser = null;      // { email, displayName, uid }
let currentRole = "Usuario"; // "Admin" | "Usuario"

let hanes  = [];
let grupos = [];

const ADMIN_EMAILS = ["pedro.l.oldani@gmail.com"];
const STORAGE_KEYS = { hanes:"soka_hanes", grupos:"soka_grupos", session:"soka_session" };

/* ===== Helpers ===== */
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ===== localStorage ===== */
function loadData() {
  hanes  = JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes)  || "[]");
  grupos = JSON.parse(localStorage.getItem(STORAGE_KEYS.grupos) || "[]");
}
function saveData() {
  localStorage.setItem(STORAGE_KEYS.hanes,  JSON.stringify(hanes));
  localStorage.setItem(STORAGE_KEYS.grupos, JSON.stringify(grupos));
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
  saveData();
}

/* ===== Auth ===== */
const auth = window.auth;
const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

$("googleLoginBtn")?.addEventListener("click", async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    if (isIOS && isSafari) await auth.signInWithRedirect(provider);
    else await auth.signInWithPopup(provider);
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
    const role = ADMIN_EMAILS.includes(email) ? "Admin" : "Usuario";
    currentRole = role;

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
      email, displayName: user.displayName || email, uid: user.uid, role
    }));

    text("user-email", email); text("role-badge", role);
    setHidden($("login-form"), true); setHidden($("user-info"), false);

    if (role !== "Admin") {
      // Si no sos Admin, redirigimos a Inicio
      window.location.href = "index.html";
      return;
    }

    // Admin OK → mostrar contenido
    renderHanesAdmin();
    renderGruposAdmin();
  } else {
    setHidden($("login-form"), false); setHidden($("user-info"), true);
    text("user-email", ""); text("role-badge", "");
  }
});

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  ensureSeedData();

  // Si hay sesión previa que no es admin → igual dejá que Auth resuelva y redirija
});

/* ===== Hanes (CRUD) ===== */
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
  renderHanesAdmin();
});
$("hanCancelBtn")?.addEventListener("click", () => $("hanForm").reset());

$("hanList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  const id = btn.dataset.id; const action = btn.dataset.action;
  const h = hanes.find(x => x.id === id); if (!h) return;

  if (action === "edit") {
    $("hanId").value   = h.id;
    $("hanName").value = h.name;
    $("hanCity").value = h.city;
  } else if (action === "delete") {
    if (!confirm(`¿Eliminar Han "${h.name}"?`)) return;
    hanes = hanes.filter(x => x.id !== id);
    saveData(); renderHanesAdmin();
  }
});

function renderHanesAdmin() {
  const ul = $("hanList"); if (!ul) return;
  ul.innerHTML = "";
  hanes.forEach(h => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><strong>${h.name}</strong> — ${h.city}</span>
      <div class="actions acciones-admin"></div>
    `;
    const actions = li.querySelector(".acciones-admin");
    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar"; btnEdit.dataset.action = "edit"; btnEdit.dataset.id = h.id;
    const btnDel = document.createElement("button");
    btnDel.textContent = "Eliminar"; btnDel.className = "secondary"; btnDel.dataset.action = "delete"; btnDel.dataset.id = h.id;
    actions.appendChild(btnEdit); actions.appendChild(btnDel);
    ul.appendChild(li);
  });
}

/* ===== Grupos (CRUD) ===== */
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
  renderGruposAdmin();
});
$("grupoCancelBtn")?.addEventListener("click", () => $("grupoForm").reset());

$("grupoList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  const id = btn.dataset.id; const action = btn.dataset.action;
  const g = grupos.find(x => x.id === id); if (!g) return;

  if (action === "edit") {
    $("grupoId").value   = g.id;
    $("grupoName").value = g.name;
  } else if (action === "delete") {
    if (!confirm(`¿Eliminar Grupo "${g.name}"?`)) return;
    grupos = grupos.filter(x => x.id !== id);
    saveData(); renderGruposAdmin();
  }
});

function renderGruposAdmin() {
  const ul = $("grupoList"); if (!ul) return;
  ul.innerHTML = "";
  grupos.forEach(g => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><strong>${g.name}</strong></span>
      <div class="actions acciones-admin"></div>
    `;
    const actions = li.querySelector(".acciones-admin");
    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar"; btnEdit.dataset.action = "edit"; btnEdit.dataset.id = g.id;
    const btnDel = document.createElement("button");
    btnDel.textContent = "Eliminar"; btnDel.className = "secondary"; btnDel.dataset.action = "delete"; btnDel.dataset.id = g.id;
    actions.appendChild(btnEdit); actions.appendChild(btnDel);
    ul.appendChild(li);
  });
}

function showLoginGate(show) {
  const gate = document.getElementById('login-gate');
  if (!gate) return;
  gate.classList.toggle('hidden', !show);
  gate.classList.toggle('visible', show);
}
