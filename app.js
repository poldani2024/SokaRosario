
/******************************************************************
 * INICIO — Soka Gakkai + Firebase Auth (Google) + localStorage
 * - Personas: filtros + grilla (click -> llena Datos Personales)
 * - Datos Personales (antes Mi Perfil): editable si dueño o Admin
 * - Visitas: registro y listado
 ******************************************************************/

/* ===== Estado ===== */
let currentUser = null;      // { email, displayName, uid }
let currentRole = "Usuario"; // "Admin" | "Usuario"

let editPersonaId = null; // null => alta; id => edición de esa persona

let hanes   = [];
let grupos  = [];
let personas= [];
let visitas = [];

const ADMIN_EMAILS = ["pedro.l.oldani@gmail.com"];
const STORAGE_KEYS = {
  hanes:"soka_hanes", grupos:"soka_grupos", personas:"soka_personas",
  visitas:"soka_visitas", session:"soka_session"
};

/* ===== Helpers ===== */
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle("hidden", hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ===== localStorage ===== */
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
      { id: uid(), firstName: "Juan", lastName: "Pérez", email:"juan@ejemplo.com", status:"Miembro",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Frecuentemente", frecuenciaZadankai:"Poco",
        suscriptoHumanismoSoka:true,  realizaZaimu:false, updatedAt:Date.now() },
      { id: uid(), firstName: "Ana",  lastName: "García", email:"ana@ejemplo.com",  status:"Amigo Soka",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Poco",         frecuenciaZadankai:"Nunca",
        suscriptoHumanismoSoka:false,     realizaZaimu:false, updatedAt:Date.now() },
      { id: uid(), firstName: "Luis", lastName: "Mendoza", email:"luis@ejemplo.com", status:"Miembro",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Nunca",        frecuenciaZadankai:"Frecuentemente",
        suscriptoHumanismoSoka:true,      realizaZaimu:true,  updatedAt:Date.now() }
    ];
  }
  saveData();
}

/* ===== Auth (Firebase v8) ===== */
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
    howLoginGate(false);
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
      email, displayName: user.displayName || email, uid: user.uid, role
    }));

    text("user-email", email);
    text("role-badge", role);
    setHidden($("login-form"), true);
    setHidden($("user-info"), false);
    document.body.classList.toggle("role-admin", role === "Admin");
    document.body.classList.toggle("role-user", role !== "Admin");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", role !== "Admin"));

    // Render
    renderCatalogsToSelects();
    renderPersonas();
    renderVisitas();
    loadMiPerfil(user.uid, email);
  } else {
    showLoginGate(true);
    setHidden($("login-form"), false);
    setHidden($("user-info"), true);
    document.body.classList.remove("role-admin", "role-user");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    text("user-email", ""); text("role-badge", "");
    localStorage.removeItem(STORAGE_KEYS.session);
  }
});

/* ===== Hook del botón "Nueva persona" ===== */
document.getElementById('newPersonaBtn')?.addEventListener('click', () => {
  editPersonaId = null; // modo alta
  // limpiamos el formulario de Datos Personales y habilitamos edición (solo Admin)
  clearDatosPersonales();
  const readonly = !(currentRole === "Admin");
  toggleDatosPersonalesReadonly(readonly);
});

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  ensureSeedData();

  renderCatalogsToSelects();
  renderPersonas();
  renderVisitas();

  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
  if (s && s.email) { text("user-email", s.email); text("role-badge", s.role); }
});

/* ===== Catálogos → Selects ===== */
function renderCatalogsToSelects() {
  // Datos Personales
  fillSelect($("hanSelect"),   hanes,  "id", "name", true);
  fillSelect($("grupoSelect"), grupos, "id", "name", true);
  // Editor admin
  fillSelect($("p_hanSelect"),   hanes,  "id", "name", true);
  fillSelect($("p_grupoSelect"), grupos, "id", "name", true);
  // Filtros
  fillSelect($("filtroHan"),   [{ id:"", name:"Todos" }, ...hanes],  "id", "name", false);
  fillSelect($("filtroGrupo"), [{ id:"", name:"Todos" }, ...grupos], "id", "name", false);

  $("hanSelect")?.addEventListener("change", () => {
    const sel = $("hanSelect").value;
    const h = hanes.find(x => x.id === sel);
    $("hanLocalidad").value = h?.city || "";
  });
}

function clearDatosPersonales() {
  ["firstName","lastName","birthDate","address","city","phone","email"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  ["status","hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  ["suscriptoHumanismoSoka","realizaZaimu"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
}

function toggleDatosPersonalesReadonly(readonly) {
  const fields = [
    "firstName","lastName","birthDate","address","city","phone","status",
    "hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai",
    "suscriptoHumanismoSoka","realizaZaimu"
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !!readonly;
  });
}

/* ===== Datos Personales (antes Mi Perfil) ===== */
function loadMiPerfil(uid, email) {
  $("email").value = email;
  const p = personas.find(x => x.uid === uid || x.email === email);
  if (p) populateDatosPersonales(p, { readonly: false });
}


document.getElementById("miPerfilForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser && currentRole !== "Admin") {
    return alert("Ingresá con Google primero.");
  }

  const hanId = document.getElementById("hanSelect").value ?? "";
  const hanObj = hanes.find(h => h.id === hanId);
  const grupoId = document.getElementById("grupoSelect").value ?? "";
  const grupoObj = grupos.find(g => g.id === grupoId);

  const base = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    birthDate: document.getElementById("birthDate").value ?? "",
    address: document.getElementById("address").value.trim(),
    city: document.getElementById("city").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    status: document.getElementById("status").value ?? "Miembro",
    hanId, hanName: hanObj?.name ?? "", hanCity: hanObj?.city ?? "",
    grupoId, grupoName: grupoObj?.name ?? "",
    frecuenciaSemanal: document.getElementById("frecuenciaSemanal").value ?? "",
    frecuenciaZadankai: document.getElementById("frecuenciaZadankai").value ?? "",
    suscriptoHumanismoSoka: document.getElementById("suscriptoHumanismoSoka").checked,
    realizaZaimu: document.getElementById("realizaZaimu").checked,
    updatedAt: Date.now(),
  };

  if (editPersonaId) {
    // edición
    const i = personas.findIndex(x => x.id === editPersonaId);
    if (i >= 0) {
      personas[i] = { ...personas[i], ...base };
    }
  } else {
    // alta
    const nueva = {
      id: uid(),
      ...base,
      uid: currentUser?.uid ?? "", // si es admin creando, puede quedar vacío o el mail del formulario
    };
    personas.push(nueva);
    editPersonaId = nueva.id;
  }

  saveData();
  renderPersonas();
  alert("Persona guardada");
});


/* ===== Personas: filtros + grilla + click -> llenar Datos Personales ===== */
["filtroHan","filtroGrupo","filtroEstado","filtroFreqSemanal","filtroFreqZadankai","buscarTexto"]
  .forEach(id => $(id)?.addEventListener("input", () => renderPersonas()));

function applyFilters(list) {
  const fHan   = $("filtroHan")?.value || "";
  const fGrupo = $("filtroGrupo")?.value || "";
  const fEstado= $("filtroEstado")?.value || "";
  const fSem   = $("filtroFreqSemanal")?.value || "";
  const fZad   = $("filtroFreqZadankai")?.value || "";
  const qText  = ($("buscarTexto")?.value || "").toLowerCase();

  return (list || []).filter(p => {
    const okHan   = !fHan || p.hanId === fHan;
    const okGrupo = !fGrupo || p.grupoId === fGrupo;
    const okEst   = !fEstado|| (p.status || "") === fEstado;
    const okSem   = !fSem || (p.frecuenciaSemanal  || "") === fSem;
    const okZad   = !fZad || (p.frecuenciaZadankai || "") === fZad;
    const txt = `${p.lastName || ""} ${p.firstName || ""} ${p.email || ""}`.toLowerCase();
    const okText = !qText || txt.includes(qText);
    return okHan && okGrupo && okEst && okSem && okZad && okText;
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
      <td class="acciones-admin"><div class="actions"></div></td>
    `;
    // Click en fila -> llenar Datos Personales (solo lectura si no sos dueño ni admin)
     
      tr.addEventListener("click", () => {
        editPersonaId = p.id; // estamos editando esta persona
        const readonly = !(currentRole === "Admin" || (currentUser && p.uid === currentUser.uid));
        populateDatosPersonales(p, { readonly });
      });



    // Acciones Admin (Editar / Eliminar)
    const actions = tr.querySelector(".actions");
    
if (actions) {
  const btnVis = document.createElement("button");
  btnVis.textContent = "Visitas";
  btnVis.dataset.action = "visita-modal";
  btnVis.dataset.id = p.id;
  actions.appendChild(btnVis);

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

  tbody.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation(); // evitar que el click de botón dispare el click de fila
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const p = personas.find(x => x.id === id);
      if (!p) return;

      if (action === "edit-persona") openPersonaEditor(p);
      else if (action === "delete-persona") {
        if (!confirm(`¿Eliminar persona "${p.lastName || ""}, ${p.firstName || ""}"?`)) return;
        personas = personas.filter(x => x.id !== id);
        saveData();
        renderPersonas();
      }
      
      if (action === "visita-modal") {
        openVisitaModal(p);
        return;
      }

    });
  });

  // Select de Visitas
  fillSelect(
    $("visitaPersonaSelect"),
    personas.map(p => ({ id:p.id, name:`${p.lastName || ""}, ${p.firstName || ""}` })),
    "id","name", true
  );
}

function openVisitaModal(p) {
  const m = document.getElementById("visitaModal");
  if (!m) return;
  document.getElementById("visitaPersonaId").value = p.id;
  document.getElementById("visitaPersonaNombre").value = `${p.lastName ?? ""}, ${p.firstName ?? ""}`;
  document.getElementById("visitaModalFecha").value = new Date().toISOString().slice(0,10);
  document.getElementById("visitaModalObs").value = "";
  m.classList.remove("hidden");
}
document.getElementById("visitaModalCerrar")?.addEventListener("click", () => {
  document.getElementById("visitaModal")?.classList.add("hidden");
});

document.getElementById("visitaModalForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const personaId = document.getElementById("visitaPersonaId").value;
  const fechaStr  = document.getElementById("visitaModalFecha").value;
  const obs       = document.getElementById("visitaModalObs").value.trim();
  if (!personaId || !fechaStr) return;

  visitas.push({
    id: uid(),
    personaId,
    fecha: new Date(fechaStr).toISOString(),
    obs,
    createdBy: currentUser?.uid ?? "",
    createdAt: Date.now(),
  });
  saveData();
  renderVisitas();
  document.getElementById("visitaModal")?.classList.add("hidden");
});

function populateDatosPersonales(p, { readonly }) {
  $("firstName").value = p.firstName || "";
  $("lastName").value  = p.lastName  || "";
  $("birthDate").value = p.birthDate || "";
  $("address").value   = p.address   || "";
  $("city").value      = p.city      || "";
  $("phone").value     = p.phone     || "";
  $("email").value     = p.email     || "";
  $("status").value    = p.status    || "Miembro";
  $("hanSelect").value = p.hanId     || "";
  $("hanLocalidad").value = p.hanCity|| "";
  $("grupoSelect").value  = p.grupoId|| "";
  $("frecuenciaSemanal").value  = p.frecuenciaSemanal  || "";
  $("frecuenciaZadankai").value = p.frecuenciaZadankai || "";
  $("suscriptoHumanismoSoka").checked = !!p.suscriptoHumanismoSoka;
  $("realizaZaimu").checked           = !!p.realizaZaimu;

  // Modo solo-lectura si no sos dueño ni admin
  const fields = [
    "firstName","lastName","birthDate","address","city","phone","status",
    "hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai",
    "suscriptoHumanismoSoka","realizaZaimu"
  ];
  fields.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
      // los checkboxes usan .disabled
      el.disabled = !!readonly;
    }
  });
}

/* ===== Editor Admin (misma lógica que antes) ===== */
function openPersonaEditor(p) {
  const editor = $("personaEditor"); if (!editor) return;
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

/* ===== Import / Export CSV ===== */
$("importCSV")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: (res) => {
      const rows = res.data;
      for (const r of rows) {
        // Han
        let hanId = "";
        if (r.hanName) {
          let ex = hanes.find(h => h.name === r.hanName && (!r.hanCity || h.city === r.hanCity));
          if (!ex) { ex = { id: uid(), name: r.hanName, city: r.hanCity || "" }; hanes.push(ex); }
          hanId = ex.id;
        }
        // Grupo
        let grupoId = "";
        if (r.grupoName) {
          let exg = grupos.find(g => g.name === r.grupoName);
          if (!exg) { exg = { id: uid(), name: r.grupoName }; grupos.push(exg); }
          grupoId = exg.id;
        }
        // Persona
        const id = (r.uid && r.uid.trim()) || uid();
        const persona = {
          id,
          firstName: r.firstName || "", lastName: r.lastName || "", birthDate: r.birthDate || "",
          address: r.address || "", city: r.city || "", phone: r.phone || "",
          email: r.email || "", status: r.status || "Miembro",
          hanId, hanName: r.hanName || "", hanCity: r.hanCity || "",
          grupoId, grupoName: r.grupoName || "",
          frecuenciaSemanal: r.frecuenciaSemanal || "", frecuenciaZadankai: r.frecuenciaZadankai || "",
          suscriptoHumanismoSoka: toBool(r.suscriptoHumanismoSoka), realizaZaimu: toBool(r.realizaZaimu),
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
    firstName: p.firstName || "", lastName: p.lastName || "", birthDate: p.birthDate || "",
    address: p.address || "", city: p.city || "", phone: p.phone || "", email: p.email || "",
    status: p.status || "", hanName: p.hanName || "", hanCity: p.hanCity || "",
    grupoName: p.grupoName || "", frecuenciaSemanal: p.frecuenciaSemanal || "",
    frecuenciaZadankai: p.frecuenciaZadankai || "", suscriptoHumanismoSoka: !!p.suscriptoHumanismoSoka,
    realizaZaimu: !!p.realizaZaimu, uid: p.id || ""
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "personas_filtrado.csv"; a.click();
  URL.revokeObjectURL(url);
});

/* ===== Visitas ===== */
function renderVisitas() {
  const tabla = $("visitasTable"); if (!tabla) return;
  const tbody = tabla.querySelector("tbody"); if (!tbody) return;
  tbody.innerHTML = "";

  const idx = Object.fromEntries(personas.map(p => [p.id, `${p.lastName || ""}, ${p.firstName || ""}`]));
  visitas.forEach(v => {
    const tr = document.createElement("tr");
    const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0, 10) : "";
    tr.innerHTML = `<td>${idx[v.personaId] || v.personaId || "-"}</td><td>${fecha}</td><td>${(v.obs||"").replace(/\n/g,"<br/>")}</td>`;
    tbody.appendChild(tr);
  });
}
$("visitaForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const personaId = $("visitaPersonaSelect").value;
  const fechaStr  = $("visitaFecha").value;
  const obs       = $("visitaObs").value.trim();
  if (!personaId || !fechaStr) return;
  visitas.push({ id:uid(), personaId, fecha:new Date(fechaStr).toISOString(), obs, createdBy:currentUser?.uid||"", createdAt:Date.now() });
  saveData(); $("visitaForm").reset(); renderVisitas();
});

/* ===== Utils ===== */
function fillSelect(selectEl, items, valueKey, labelKey, includeEmpty) {
  if (!selectEl) return;
  const current = selectEl.value; selectEl.innerHTML = "";
  if (includeEmpty) { const opt = document.createElement("option"); opt.value=""; opt.textContent="Seleccionar..."; selectEl.appendChild(opt); }
  (items || []).forEach(it => {
    const v = typeof it === "object" ? it[valueKey] : it;
    const l = typeof it === "object" ? it[labelKey] : String(it);
    const opt = document.createElement("option"); opt.value = v ?? ""; opt.textContent = l ?? ""; selectEl.appendChild(opt);
  });
  if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
}
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true","1","sí","si","yes"].includes(v.trim().toLowerCase());
  return !!v;
}

function showLoginGate(show) {
  const gate = document.getElementById('login-gate');
  if (!gate) return;
  gate.classList.toggle('hidden', !show);
  gate.classList.toggle('visible', show);
}
