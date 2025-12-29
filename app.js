
/*******************************************************
 * INICIO — Soka Gakkai + Firebase Auth (Google) + localStorage
 * - Personas: filtros + grilla (click -> llenar Persona)
 * - Persona (unificado: alta/edición en el mismo form)
 * - Visitas: registro y listado
 *******************************************************/

/* ===== Estado ===== */
let currentUser = null; // { email, displayName, uid }
let currentRole = "Usuario"; // "Admin" | "Usuario"
let hanes = [];
let grupos = [];
let personas= [];
let visitas = [];
let editPersonaId = null; // null => alta; id => edición

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

function clearDatosPersonales() {
  ["firstName","lastName","birthDate","address","city","phone","email"]
    .forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["status","hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai"]
    .forEach(id => { const el = $(id); if (el) el.value = ""; });
  ["suscriptoHumanismoSoka","realizaZaimu"]
    .forEach(id => { const el = $(id); if (el) el.checked = false; });
  $("hanLocalidad")?.value && ($("hanLocalidad").value = "");
}

function toggleDatosPersonalesReadonly(readonly) {
  const fields = [
    "firstName","lastName","birthDate","address","city","phone","email","status",
    "hanSelect","grupoSelect","frecuenciaSemanal","frecuenciaZadankai",
    "suscriptoHumanismoSoka","realizaZaimu"
  ];
  fields.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.disabled = !!readonly;
  });
}

/* ===== localStorage ===== */
function loadData() {
  hanes = JSON.parse(localStorage.getItem(STORAGE_KEYS.hanes) ?? "[]");
  grupos = JSON.parse(localStorage.getItem(STORAGE_KEYS.grupos) ?? "[]");
  personas = JSON.parse(localStorage.getItem(STORAGE_KEYS.personas) ?? "[]");
  visitas = JSON.parse(localStorage.getItem(STORAGE_KEYS.visitas) ?? "[]");
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
      { id: uid(), name: "Han Oeste", city: "Funes" }
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
        suscriptoHumanismoSoka:true, realizaZaimu:false, updatedAt:Date.now() },
      { id: uid(), firstName: "Ana", lastName: "García", email:"ana@ejemplo.com", status:"Amigo Soka",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Poco", frecuenciaZadankai:"Nunca",
        suscriptoHumanismoSoka:false, realizaZaimu:false, updatedAt:Date.now() },
      { id: uid(), firstName: "Luis", lastName: "Mendoza", email:"luis@ejemplo.com", status:"Miembro",
        hanId:h0.id, hanName:h0.name, hanCity:h0.city, grupoId:g0.id, grupoName:g0.name,
        frecuenciaSemanal:"Nunca", frecuenciaZadankai:"Frecuentemente",
        suscriptoHumanismoSoka:true, realizaZaimu:true, updatedAt:Date.now() }
    ];
  }
  saveData();
}

/* ===== Auth (Firebase v8) ===== */
const auth = window.auth;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^(?!(chrome|android)).*safari/i.test(navigator.userAgent);

// ¡Importante! NO adjuntamos el listener aquí antes del DOM.
// Lo hacemos dentro de DOMContentLoaded más abajo.

$("logoutBtn")?.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged((user) => {
  currentUser = user ?? null;
  currentRole = "Usuario";

  if (user) {
    const email = user.email?.toLowerCase() ?? "";
    const role = ADMIN_EMAILS.includes(email) ? "Admin" : "Usuario";
    currentRole = role;

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
      email, displayName: user.displayName ?? email, uid: user.uid, role
    }));
    text("user-email", email);
    text("role-badge", role);

    // Render inicial
    renderCatalogsToSelects();
    renderPersonas();
    renderVisitas();

    // Si el dueño tiene registro previo, cargarlo
    loadMiPerfil(user.uid, email);
  } else {
    // limpiar sesión visual
    text("user-email", "");
    text("role-badge", "");
    localStorage.removeItem(STORAGE_KEYS.session);
  }
});

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  ensureSeedData();
  renderCatalogsToSelects();
  renderPersonas();
  renderVisitas();

  // mostrar email/rol si había sesión previa
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) ?? "null");
  if (s && s.email) { text("user-email", s.email); text("role-badge", s.role); }

  // Listener del botón de login: ahora sí existe en el DOM
  const loginBtn = document.getElementById("googleLoginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        if (isIOS && isSafari) await auth.signInWithRedirect(provider);
        else await auth.signInWithPopup(provider);
      } catch (err) {
        console.error("[auth] signIn error", err);
        alert("No se pudo iniciar sesión con Google. Probá nuevamente.");
      }
    });
  }
  // Fallback por si el botón se renderiza dinámicamente luego
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("#googleLoginBtn");
    if (!btn) return;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      if (isIOS && isSafari) await auth.signInWithRedirect(provider);
      else await auth.signInWithPopup(provider);
    } catch (err) {
      console.error("[auth] signIn error", err);
      alert("No se pudo iniciar sesión con Google. Probá nuevamente.");
    }
  });

  // Alta rápida (solo Admin)
  $("newPersonaBtn")?.addEventListener("click", () => {
    if (currentRole !== "Admin") return alert("Solo Admin puede crear personas nuevas.");
    editPersonaId = null;           // modo alta
    clearDatosPersonales();         // limpiar form
    toggleDatosPersonalesReadonly(false); // habilitar edición
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
  // Form unificado
  fillSelect($("hanSelect"), hanes, "id", "name", true);
  fillSelect($("grupoSelect"), grupos, "id", "name", true);

  // Filtros
  fillSelect($("filtroHan"), [{ id:"", name:"Todos" }, ...hanes], "id", "name", false);
  fillSelect($("filtroGrupo"), [{ id:"", name:"Todos" }, ...grupos], "id", "name", false);

  $("hanSelect")?.addEventListener("change", () => {
    const sel = $("hanSelect").value;
    const h = hanes.find(x => x.id === sel);
    $("hanLocalidad").value = h?.city ?? "";
  });
}

/* ===== Persona (antes Mi Perfil) ===== */
function loadMiPerfil(uid, email) {
  $("email").value = email;
  const p = personas.find(x => x.uid === uid || x.email === email);
  if (p) {
    editPersonaId = p.id; // si existe, quedamos en modo edición
    populateDatosPersonales(p, { readonly: false });
  } else {
    // si no hay registro previo, dejamos en alta (según rol)
    editPersonaId = null;
    toggleDatosPersonalesReadonly(!(currentRole === "Admin"));
  }
}

// Submit unificado: alta/edición
$("miPerfilForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Ingresá con Google primero.");

  const hanId = $("hanSelect").value ?? "";
  const hanObj = hanes.find(h => h.id === hanId);
  const grupoId = $("grupoSelect").value ?? "";
  const grupoObj= grupos.find(g => g.id === grupoId);

  const base = {
    firstName: $("firstName").value.trim(),
    lastName: $("lastName").value.trim(),
    birthDate: $("birthDate").value ?? "",
    address: $("address").value.trim(),
    city: $("city").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    status: $("status").value ?? "Miembro",
    hanId, hanName: hanObj?.name ?? "", hanCity: hanObj?.city ?? "",
    grupoId, grupoName: grupoObj?.name ?? "",
    frecuenciaSemanal: $("frecuenciaSemanal").value ?? "",
    frecuenciaZadankai: $("frecuenciaZadankai").value ?? "",
    suscriptoHumanismoSoka: $("suscriptoHumanismoSoka").checked,
    realizaZaimu: $("realizaZaimu").checked,
    updatedAt: Date.now(),
  };

  // Reglas de edición:
  // - Admin puede editar cualquiera y crear nuevas
  // - Usuario solo puede editar su propio registro (uid == currentUser.uid)
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
      // Usuarios no-admin no pueden dar de alta otros registros
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

/* ===== Personas: filtros + grilla ===== */
["filtroHan","filtroGrupo","filtroEstado","filtroFreqSemanal","filtroFreqZadankai","buscarTexto"]
  .forEach(id => $(id)?.addEventListener("input", () => renderPersonas()));

function applyFilters(list) {
  const fHan = $("filtroHan")?.value ?? "";
  const fGrupo = $("filtroGrupo")?.value ?? "";
  const fEstado= $("filtroEstado")?.value ?? "";
  const fSem = $("filtroFreqSemanal")?.value ?? "";
  const fZad = $("filtroFreqZadankai")?.value ?? "";
  const qText = ($("buscarTexto")?.value ?? "").toLowerCase();

  return (list ?? []).filter(p => {
    const okHan   = !fHan   || p.hanId === fHan;
    const okGrupo = !fGrupo || p.grupoId === fGrupo;
    const okEst   = !fEstado|| (p.status ?? "") === fEstado;
    const okSem   = !fSem   || (p.frecuenciaSemanal ?? "") === fSem;
    const okZad   = !fZad   || (p.frecuenciaZadankai ?? "") === fZad;
    const txt = `${p.lastName ?? ""} ${p.firstName ?? ""} ${p.email ?? ""}`.toLowerCase();
    const okText  = !qText || txt.includes(qText);
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
      <td>${p.firstName ?? ""}</td>
      <td>${p.lastName ?? ""}</td>
      <td>${p.status ?? ""}</td>
      <td>${p.hanName ?? ""}</td>
      <td>${p.grupoName ?? ""}</td>
      <td>${p.frecuenciaSemanal ?? ""}</td>
      <td>${p.frecuenciaZadankai ?? ""}</td>
      <td>${p.suscriptoHumanismoSoka ? "Sí" : "No"}</td>
      <td>${p.realizaZaimu ? "Sí" : "No"}</td>
      <td class="acciones-admin"><div class="actions"></div></td>
    `;

    // Click en fila → cargar en el form unificado (editable si admin o dueño)
    tr.addEventListener("click", () => {
      editPersonaId = p.id;
      const readonly = !(currentRole === "Admin" || (currentUser && (p.uid === currentUser.uid)));
      populateDatosPersonales(p, { readonly });
    });

    // Acciones (Editar / Eliminar)
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

  // Delegado de botones dentro del tbody (para no pisar el click de fila)
  tbody.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const p = personas.find(x => x.id === id);
      if (!p) return;

      if (action === "edit-persona") {
        editPersonaId = p.id;
        const readonly = !(currentRole === "Admin" || (currentUser && (p.uid === currentUser.uid)));
        populateDatosPersonales(p, { readonly });
      } else if (action === "delete-persona") {
        if (!confirm(`¿Eliminar persona "${p.lastName ?? ""}, ${p.firstName ?? ""}"?`)) return;
        personas = personas.filter(x => x.id !== id);
        saveData();
        renderPersonas();
      }
    });
  });

  // Select de Visitas
  fillSelect(
    $("visitaPersonaSelect"),
    personas.map(p => ({ id:p.id, name:`${p.lastName ?? ""}, ${p.firstName ?? ""}` })),
    "id","name", true
  );
}

function populateDatosPersonales(p, { readonly }) {
  $("firstName").value = p.firstName ?? "";
  $("lastName").value = p.lastName ?? "";
  $("birthDate").value = p.birthDate ?? "";
  $("address").value = p.address ?? "";
  $("city").value = p.city ?? "";
  $("phone").value = p.phone ?? "";
  $("email").value = p.email ?? "";
  $("status").value = p.status ?? "Miembro";
  $("hanSelect").value = p.hanId ?? "";
  $("hanLocalidad").value = p.hanCity ?? "";
  $("grupoSelect").value = p.grupoId ?? "";
  $("frecuenciaSemanal").value = p.frecuenciaSemanal ?? "";
  $("frecuenciaZadankai").value = p.frecuenciaZadankai ?? "";
  $("suscriptoHumanismoSoka").checked = !!p.suscriptoHumanismoSoka;
  $("realizaZaimu").checked = !!p.realizaZaimu;

  toggleDatosPersonalesReadonly(!!readonly);
}

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
          if (!ex) { ex = { id: uid(), name: r.hanName, city: r.hanCity ?? "" }; hanes.push(ex); }
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
          firstName: r.firstName ?? "", lastName: r.lastName ?? "", birthDate: r.birthDate ?? "",
          address: r.address ?? "", city: r.city ?? "", phone: r.phone ?? "",
          email: r.email ?? "", status: r.status ?? "Miembro",
          hanId, hanName: r.hanName ?? "", hanCity: r.hanCity ?? "",
          grupoId, grupoName: r.grupoName ?? "",
          frecuenciaSemanal: r.frecuenciaSemanal ?? "", frecuenciaZadankai: r.frecuenciaZadankai ?? "",
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
    firstName: p.firstName ?? "", lastName: p.lastName ?? "", birthDate: p.birthDate ?? "",
    address: p.address ?? "", city: p.city ?? "", phone: p.phone ?? "", email: p.email ?? "",
    status: p.status ?? "", hanName: p.hanName ?? "", hanCity: p.hanCity ?? "",
    grupoName: p.grupoName ?? "", frecuenciaSemanal: p.frecuenciaSemanal ?? "",
    frecuenciaZadankai: p.frecuenciaZadankai ?? "", suscriptoHumanismoSoka: !!p.suscriptoHumanismoSoka,
    realizaZaimu: !!p.realizaZaimu, uid: p.id ?? ""
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "personas_filtrado.csv"; a.click();
  URL.revokeObjectURL(url);
});

/* ===== Visitas ===== */
function renderVisitas() {
  const tabla = $("visitasTable"); if (!tabla) return;
  const tbody = tabla.querySelector("tbody"); if (!tbody) return;
  tbody.innerHTML = "";

  const idx = Object.fromEntries(personas.map(p => [p.id, `${p.lastName ?? ""}, ${p.firstName ?? ""}`]));
  visitas.forEach(v => {
    const tr = document.createElement("tr");
    const fecha = v.fecha ? new Date(v.fecha).toISOString().slice(0, 10) : "";
    tr.innerHTML = `<td>${idx[v.personaId] ?? v.personaId ?? "-"}</td><td>${fecha}</td><td>${(v.obs ?? "").replace(/\n/g,"<br/>")}</td>`;
    tbody.appendChild(tr);
  });
}

$("visitaForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
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
  if (typeof v === "string") return ["true","1","sí","si","yes"].includes(v.trim().toLowerCase());
  return !!v;
}
