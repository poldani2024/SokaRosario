
// Firebase Modular SDK (v10.x) - usar imports ESM
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ========================= Configurar Firebase =========================
// ⚠️ Reemplazá estos valores por los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDSC8bYc5XF94OhHjM7rmQMR1zX8CE7h9E",
  authDomain: "sokarosario.firebaseapp.com",
  projectId: "sokarosario",
  storageBucket: "sokarosario.appspot.com", // recomendado
  messagingSenderId: "569099432032",
  appId: "1:569099432032:web:b520d16270508ed25f1305"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ========================= Estado / Cache en memoria =========================
let currentUser = null;
let currentRole = "Usuario"; // Default
let hanes = [];   // {id, name, city}
let grupos = [];  // {id, name}
let personas = []; // array de personas
let visitas = []; // array de visitas

// ========================= Helpers DOM =========================
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };

function toast(msg) { console.log(msg); /* podés agregar un snackbar si querés */ }

// ========================= Auth =========================
$("googleLoginBtn").addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    alert("Error al ingresar con Google: " + err.message);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
    alert("Error al cerrar sesión: " + err.message);
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  setHidden($("login-form"), !!user);
  setHidden($("user-info"), !user);

  if (!user) {
    text("user-email", "");
    text("role-badge", "");
    // Ocultar admin
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    return;
  }

  text("user-email", user.email);

  // Rol (roles/{uid} -> { role: "Admin" | "Usuario" })
  try {
    const roleSnap = await getDoc(doc(db, "roles", user.uid));
    if (roleSnap.exists()) {
      currentRole = roleSnap.data().role || "Usuario";
    } else {
      // Si no existe, lo creo como Usuario por defecto
      await setDoc(doc(db, "roles", user.uid), { role: "Usuario", email: user.email });
      currentRole = "Usuario";
    }
  } catch (e) {
    console.error("Error obteniendo rol:", e);
    currentRole = "Usuario";
  }

  text("role-badge", currentRole);
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", currentRole !== "Admin"));

  // Cargar datos base
  listenHanes();
  listenGrupos();
  listenPersonas();
  listenVisitas();

  // Cargar perfil del usuario
  loadMiPerfil(user.uid, user.email);
});

// ========================= Hanes (CRUD) =========================
function listenHanes() {
  const qHanes = query(collection(db, "hanes"), orderBy("name", "asc"));
  onSnapshot(qHanes, (snap) => {
    hanes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Render lista (Admin)
    const ul = $("hanList");
    if (ul) {
      ul.innerHTML = "";
      hanes.forEach(h => {
        const li = document.createElement("li");
        li.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span><strong>${h.name}</strong> — ${h.city}</span>
            <div class="actions">
              <button data-action="edit" data-id="${h.id}" class="secondary">Editar</button>
              <button data-action="delete" data-id="${h.id}" class="secondary">Eliminar</button>
            </div>
          </div>`;
        ul.appendChild(li);
      });
    }

    // Poblar selects
    fillSelect($("hanSelect"), hanes, "id", "name", true);
    fillSelect($("p_hanSelect"), hanes, "id", "name", true);
    fillSelect($("filtroHan"), [{ id: "", name: "Todos" }, ...hanes], "id", "name", false);

    // Actualizar localidad automática en Mi Perfil
    $("hanSelect")?.addEventListener("change", () => {
      const sel = $("hanSelect").value;
      const h = hanes.find(x => x.id === sel);
      $("hanLocalidad").value = h?.city || "";
    });
  });
}

$("hanForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("hanId").value.trim();
  const name = $("hanName").value.trim();
  const city = $("hanCity").value.trim();
  if (!name || !city) return;

  try {
    if (id) {
      await updateDoc(doc(db, "hanes", id), { name, city });
      toast("Han actualizado");
    } else {
      await addDoc(collection(db, "hanes"), { name, city });
      toast("Han creado");
    }
    $("hanForm").reset();
  } catch (err) {
    console.error(err);
    alert("Error guardando Han: " + err.message);
  }
});

$("hanCancelBtn").addEventListener("click", () => $("hanForm").reset());
$("hanList").addEventListener("click", async (e) => {
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
    await deleteDoc(doc(db, "hanes", id));
  }
});

// ========================= Grupos (CRUD) =========================
function listenGrupos() {
  const qGrupos = query(collection(db, "grupos"), orderBy("name", "asc"));
  onSnapshot(qGrupos, (snap) => {
    grupos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Render lista (Admin)
    const ul = $("grupoList");
    if (ul) {
      ul.innerHTML = "";
      grupos.forEach(g => {
        const li = document.createElement("li");
        li.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span><strong>${g.name}</strong></span>
            <div class="actions">
              <button data-action="edit" data-id="${g.id}" class="secondary">Editar</button>
              <button data-action="delete" data-id="${g.id}" class="secondary">Eliminar</button>
            </div>
          </div>`;
        ul.appendChild(li);
      });
    }

    // Poblar selects
    fillSelect($("grupoSelect"), grupos, "id", "name", true);
    fillSelect($("p_grupoSelect"), grupos, "id", "name", true);
    fillSelect($("filtroGrupo"), [{ id: "", name: "Todos" }, ...grupos], "id", "name", false);
  });
}

$("grupoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("grupoId").value.trim();
  const name = $("grupoName").value.trim();
  if (!name) return;

  try {
    if (id) {
      await updateDoc(doc(db, "grupos", id), { name });
      toast("Grupo actualizado");
    } else {
      await addDoc(collection(db, "grupos"), { name });
      toast("Grupo creado");
    }
    $("grupoForm").reset();
  } catch (err) {
    console.error(err);
    alert("Error guardando Grupo: " + err.message);
  }
});

$("grupoCancelBtn").addEventListener("click", () => $("grupoForm").reset());
$("grupoList").addEventListener("click", async (e) => {
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
    await deleteDoc(doc(db, "grupos", id));
  }
});

// ========================= Mi Perfil =========================
async function loadMiPerfil(uid, email) {
  $("email").value = email;

  try {
    const snap = await getDoc(doc(db, "personas", uid));
    if (snap.exists()) {
      const p = snap.data();
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
  } catch (err) {
    console.error(err);
  }
}

$("miPerfilForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Ingresá con Google primero.");

  const hanId = $("hanSelect").value || "";
  const hanObj = hanes.find(h => h.id === hanId);
  const grupoId = $("grupoSelect").value || "";
  const grupoObj = grupos.find(g => g.id === grupoId);

  const persona = {
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

  try {
    await setDoc(doc(db, "personas", currentUser.uid), persona, { merge: true });
    toast("Perfil guardado");
    alert("Perfil guardado correctamente");
  } catch (err) {
    console.error(err);
    alert("Error guardando perfil: " + err.message);
  }
});

// ========================= Personas (Admin) =========================
function listenPersonas() {
  const qPersonas = query(collection(db, "personas"), orderBy("lastName", "asc"));
  onSnapshot(qPersonas, (snap) => {
    personas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPersonas();
    updateKPIs();
    updateCharts();
    fillSelect($("visitaPersonaSelect"), personas.map(p => ({ id: p.id, name: `${p.lastName}, ${p.firstName}` })), "id", "name", true);
  });

  // Filtros
  ["filtroHan", "filtroGrupo", "filtroEstado", "filtroFreqSemanal", "filtroFreqZadankai", "buscarTexto"]
    .forEach(id => $(id)?.addEventListener("input", () => { renderPersonas(); updateKPIs(); updateCharts(); }));
}

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
      <td>
        <button class="secondary" data-action="edit-persona" data-id="${p.id}">Editar</button>
        <button class="secondary" data-action="delete-persona" data-id="${p.id}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Eventos de edición/eliminación
  tbody.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const p = personas.find(x => x.id === id);
      if (!p) return;

      if (action === "edit-persona") {
        openPersonaEditor(p);
      } else if (action === "delete-persona") {
        if (!confirm(`¿Eliminar persona "${p.lastName}, ${p.firstName}"?`)) return;
        await deleteDoc(doc(db, "personas", id));
      }
    });
  });
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
$("personaAdminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("personaId").value;
  const hanId = $("p_hanSelect").value || "";
  const hanObj = hanes.find(h => h.id === hanId);
  const grupoId = $("p_grupoSelect").value || "";
  const grupoObj = grupos.find(g => g.id === grupoId);

  const data = {
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

  try {
    await setDoc(doc(db, "personas", id), data, { merge: true });
    toast("Persona actualizada");
    setHidden($("personaEditor"), true);
  } catch (err) {
    console.error(err);
    alert("Error guardando persona: " + err.message);
  }
});

// ========================= Import / Export CSV =========================
$("importCSV").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (res) => {
      const rows = res.data;
      for (const r of rows) {
        try {
          // Crear/obtener Han
          let hanId = "";
          if (r.hanName) {
            const ex = hanes.find(h => h.name === r.hanName && (!r.hanCity || h.city === r.hanCity));
            if (ex) {
              hanId = ex.id;
            } else {
              const d = await addDoc(collection(db, "hanes"), { name: r.hanName, city: r.hanCity || "" });
              hanId = d.id;
            }
          }
          // Crear/obtener Grupo
          let grupoId = "";
          if (r.grupoName) {
            const exg = grupos.find(g => g.name === r.grupoName);
            if (exg) {
              grupoId = exg.id;
            } else {
              const d = await addDoc(collection(db, "grupos"), { name: r.grupoName });
              grupoId = d.id;
            }
          }
          // Upsert Persona
          const id = (r.uid && r.uid.trim()) || doc(collection(db, "personas")).id;
          const persona = {
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

            uid: r.uid || "",
            importedAt: Date.now(),
          };
          await setDoc(doc(db, "personas", id), persona, { merge: true });
        } catch (err) {
          console.error("Error importando fila:", r, err);
        }
      }
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

// ========================= KPIs =========================
function updateKPIs() {
  const list = applyFilters(personas);
  const total = list.length;

  const count = (prop, val) => list.filter(p => (p[prop] || "") === val).length;
  const pct = (n) => total ? Math.round((n / total) * 100) + "%" : "0%";

  text("kpiTotal", String(total));
  text("kpiSemFre", pct(count("frecuenciaSemanal", "Frecuentemente")));
  text("kpiSemPoco", pct(count("frecuenciaSemanal", "Poco")));
  text("kpiSemNunca", pct(count("frecuenciaSemanal", "Nunca")));
  text("kpiZadFre", pct(count("frecuenciaZadankai", "Frecuentemente")));
  text("kpiZadPoco", pct(count("frecuenciaZadankai", "Poco")));
  text("kpiZadNunca", pct(count("frecuenciaZadankai", "Nunca")));
  text("kpiHumanismo", pct(list.filter(p => !!p.suscriptoHumanismoSoka).length));
  text("kpiZaimu", pct(list.filter(p => !!p.realizaZaimu).length));
}

// ========================= Charts (Chart.js) =========================
let chartFrecuencias = null;
let chartCompromisos = null;

function updateCharts() {
  const list = applyFilters(personas);

  const sem = {
    Frecuentemente: list.filter(p => p.frecuenciaSemanal === "Frecuentemente").length,
    Poco: list.filter(p => p.frecuenciaSemanal === "Poco").length,
    Nunca: list.filter(p => p.frecuenciaSemanal === "Nunca").length,
  };
  const zad = {
    Frecuentemente: list.filter(p => p.frecuenciaZadankai === "Frecuentemente").length,
    Poco: list.filter(p => p.frecuenciaZadankai === "Poco").length,
    Nunca: list.filter(p => p.frecuenciaZadankai === "Nunca").length,
  };
  const compromisos = {
    Humanismo: list.filter(p => !!p.suscriptoHumanismoSoka).length,
    Zaimu: list.filter(p => !!p.realizaZaimu).length,
  };

  // Frecuencias (barras agrupadas)
  const ctx1 = $("chartFrecuencias").getContext("2d");
  if (chartFrecuencias) chartFrecuencias.destroy();
  chartFrecuencias = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: ["Frecuente", "Poco", "Nunca"],
      datasets: [
        { label: "Semanal", data: [sem.Frecuentemente, sem.Poco, sem.Nunca], backgroundColor: "#43b0f1" },
        { label: "Zadankai", data: [zad.Frecuentemente, zad.Poco, zad.Nunca], backgroundColor: "#9b59b6" },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" }, tooltip: { enabled: true } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
    }
  });

  // Compromisos (dona)
  const ctx2 = $("chartCompromisos").getContext("2d");
  if (chartCompromisos) chartCompromisos.destroy();
  chartCompromisos = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: ["Humanismo", "Zaimu"],
      datasets: [{ data: [compromisos.Humanismo, compromisos.Zaimu], backgroundColor: ["#2ecc71", "#e67e22"] }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

// ========================= Visitas =========================
function listenVisitas() {
  const qVisitas = query(collection(db, "visitas"), orderBy("fecha", "desc"));
  onSnapshot(qVisitas, (snap) => {
    visitas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderVisitas();
  });
}

function renderVisitas() {
  const tbody = $("visitasTable").querySelector("tbody");
  tbody.innerHTML = "";
  const personasIndex = Object.fromEntries(personas.map(p => [p.id, `${p.lastName || ""}, ${p.firstName || ""}`]));

  visitas.forEach(v => {
    const tr = document.createElement("tr");
    const fecha = v.fecha ? (new Date(v.fecha)).toISOString().slice(0, 10) : "";
    tr.innerHTML = `
      <td>${personasIndex[v.personaId] || v.personaId || "-"}</td>
      <td>${fecha}</td>
      <td>${(v.obs || "").replace(/\n/g, "<br/>")}</td>
    `;
    tbody.appendChild(tr);
  });
}

$("visitaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const personaId = $("visitaPersonaSelect").value;
  const fechaStr = $("visitaFecha").value;
  const obs = $("visitaObs").value.trim();

  if (!personaId || !fechaStr) return;

  try {
    await addDoc(collection(db, "visitas"), {
      personaId,
      fecha: new Date(fechaStr).toISOString(),
      obs,
      createdBy: currentUser?.uid || "",
      createdAt: Date.now(),
    });
    $("visitaForm").reset();
    toast("Visita registrada");
  } catch (err) {
    console.error(err);
    alert("Error registrando visita: " + err.message);
  }
});

// ========================= Utilidades =========================
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
  // restaurar selección si posible
  if ([...selectEl.options].some(o => o.value === current)) {
    selectEl.value = current;
  }
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "sí", "si", "yes"].includes(v.trim().toLowerCase());
  return !!v;
}
