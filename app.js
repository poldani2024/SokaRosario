
// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, getDocs, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1) Configuración Firebase (REEMPLAZÁ con tu config)
const firebaseConfig = {
  apiKey: "AIzaSyDSC8bYc5XF94OhHjM7rmQMR1zX8CE7h9E",
  authDomain: "sokarosario.firebaseapp.com",
  projectId: "sokarosario",
  storageBucket: "sokarosario.firebasestorage.app",
  messagingSenderId: "569099432032",
  appId: "1:569099432032:web:b520d16270508ed25f1305"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2) Referencias UI
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const roleBadge = document.getElementById('role-badge');
const loginFormDiv = document.getElementById('login-form');

const adminSections = document.querySelectorAll('.admin-only');

const miPerfilForm = document.getElementById('miPerfilForm');
const hanForm = document.getElementById('hanForm');
const grupoForm = document.getElementById('grupoForm');

const hanSelect = document.getElementById('hanSelect');
const hanLocalidadInput = document.getElementById('hanLocalidad');
const grupoSelect = document.getElementById('grupoSelect');

const personasTableBody = document.querySelector('#personasTable tbody');

const visitaForm = document.getElementById('visitaForm');
const visitaPersonaSelect = document.getElementById('visitaPersonaSelect');
const visitasTableBody = document.querySelector('#visitasTable tbody');

const f = (id) => document.getElementById(id);

// 3) Estado actual
let currentUser = null;
let isAdmin = false;

// 4) Auth con Google
googleLoginBtn.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Error al ingresar con Google: " + err.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    userInfo.classList.remove('hidden');
    userEmailSpan.textContent = user.email || '';
    loginFormDiv.classList.add('hidden');

    isAdmin = await esAdmin(user.uid);
    roleBadge.textContent = isAdmin ? 'Admin' : 'Usuario';
    adminSections.forEach(sec => sec.classList.toggle('hidden', !isAdmin));

    await cargarHanes();
    await listarHanes();
    await cargarGrupos();
    await listarGrupos();
    await cargarMiPerfil();
    await listarPersonas();
    await configurarVisitasSegunRol();
    await listarVisitas();
  } else {
    limpiarUI();
  }
});

async function esAdmin(uid) {
  const ref = doc(db, 'admins', uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

// 5) Hanes
async function cargarHanes() {
  hanSelect.innerHTML = '';
  const q = query(collection(db, 'hanes'), orderBy('name'));
  const snap = await getDocs(q);
  hanSelect.append(new Option('Seleccionar Han...', ''));
  snap.forEach(docu => {
    const d = docu.data();
    const opt = new Option(`${d.name} (${d.city})`, docu.id);
    opt.dataset.city = d.city;
    hanSelect.append(opt);
  });
}
hanSelect.addEventListener('change', () => {
  const opt = hanSelect.selectedOptions[0];
  hanLocalidadInput.value = opt?.dataset?.city || '';
});

async function listarHanes() {
  const ul = document.getElementById('hanList');
  if (!ul) return;
  ul.innerHTML = '';
  const snap = await getDocs(query(collection(db, 'hanes'), orderBy('name')));
  snap.forEach(docu => {
    const d = docu.data();
    const li = document.createElement('li');
    li.textContent = `${d.name} — ${d.city}`;
    ul.appendChild(li);
  });
}

hanForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) return alert('Solo Admin puede gestionar Hanes.');
  const name = f('hanName').value.trim();
  const city = f('hanCity').value.trim();
  if (!name || !city) return alert('Completá nombre y localidad del Han.');
  await addDoc(collection(db, 'hanes'), { name, city, createdAt: serverTimestamp() });
  f('hanName').value = ''; f('hanCity').value = '';
  await cargarHanes(); await listarHanes();
});

// 6) Grupos
async function cargarGrupos() {
  grupoSelect.innerHTML = '';
  const q = query(collection(db, 'grupos'), orderBy('name'));
  const snap = await getDocs(q);
  grupoSelect.append(new Option('Seleccionar grupo...', ''));
  snap.forEach(docu => {
    const d = docu.data();
    grupoSelect.append(new Option(d.name, docu.id));
  });
}

async function listarGrupos() {
  const ul = document.getElementById('grupoList');
  if (!ul) return;
  ul.innerHTML = '';
  const snap = await getDocs(query(collection(db, 'grupos'), orderBy('name')));
  snap.forEach(docu => {
    const d = docu.data();
    const li = document.createElement('li');
    li.textContent = d.name;
    ul.appendChild(li);
  });
}

grupoForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) return alert('Solo Admin puede gestionar Grupos.');
  const name = f('grupoName').value.trim();
  if (!name) return alert('Completá el nombre del grupo.');
  await addDoc(collection(db, 'grupos'), { name, createdAt: serverTimestamp() });
  f('grupoName').value = '';
  await cargarGrupos(); await listarGrupos();
});

// 7) Mi Perfil (personas/{uid})
async function cargarMiPerfil() {
  if (!currentUser) return;
  const ref = doc(db, 'personas', currentUser.uid);
  const snap = await getDoc(ref);
  f('email').value = currentUser.email || '';

  // Inicializar selects
  f('frecuenciaSemanal').value = '';
  f('frecuenciaZadankai').value = '';

  if (snap.exists()) {
    const p = snap.data();
    f('firstName').value = p.firstName || '';
    f('lastName').value = p.lastName || '';
    f('birthDate').value = p.birthDate || '';
    f('address').value = p.address || '';
    f('city').value = p.city || '';
    f('phone').value = p.phone || '';
    f('status').value = p.status || 'Miembro';
    if (p.hanId) { hanSelect.value = p.hanId; hanSelect.dispatchEvent(new Event('change')); }
    if (p.grupoId) { grupoSelect.value = p.grupoId; }

    f('frecuenciaSemanal').value = p.frecuenciaSemanal || '';
    f('frecuenciaZadankai').value = p.frecuenciaZadankai || '';

    f('suscriptoHumanismoSoka').checked = !!p.suscriptoHumanismoSoka;
    f('realizaZaimu').checked = !!p.realizaZaimu;
  }
}

miPerfilForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const niveles = ['Frecuentemente', 'Poco', 'Nunca'];
  const fs = f('frecuenciaSemanal').value;
  const fz = f('frecuenciaZadankai').value;
  if (fs && !niveles.includes(fs)) return alert('Seleccioná una frecuencia válida para reuniones semanales.');
  if (fz && !niveles.includes(fz)) return alert('Seleccioná una frecuencia válida para Zadankai.');

  const data = {
    ownerUid: currentUser.uid,
    firstName: f('firstName').value.trim(),
    lastName: f('lastName').value.trim(),
    birthDate: f('birthDate').value || null,
    address: f('address').value.trim(),
    city: f('city').value.trim(),
    phone: f('phone').value.trim(),
    email: currentUser.email || '',
    status: f('status').value,
    hanId: hanSelect.value || null,
    grupoId: grupoSelect.value || null,
    frecuenciaSemanal: fs || null,
    frecuenciaZadankai: fz || null,
    suscriptoHumanismoSoka: f('suscriptoHumanismoSoka').checked,
    realizaZaimu: f('realizaZaimu').checked,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  };
  if (!data.firstName || !data.lastName) return alert('Nombre y Apellido son obligatorios.');

  await setDoc(doc(db, 'personas', currentUser.uid), data, { merge: true });
  alert('Perfil guardado');
});

// 8) Tabla de Personas (solo Admin)
async function listarPersonas() {
  if (!isAdmin) return;
  personasTableBody.innerHTML = '';
  const snap = await getDocs(query(collection(db, 'personas'), orderBy('lastName')));
  for (const docu of snap.docs) {
    const p = docu.data();
    let hanName = '';
    if (p.hanId) {
      const hDoc = await getDoc(doc(db, 'hanes', p.hanId));
      hanName = hDoc.exists() ? `${hDoc.data().name}` : '';
    }
    let grupoName = '';
    if (p.grupoId) {
      const gDoc = await getDoc(doc(db, 'grupos', p.grupoId));
      grupoName = gDoc.exists() ? `${gDoc.data().name}` : '';
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.firstName || ''}</td>
      <td>${p.lastName || ''}</td>
      <td>${p.status || ''}</td>
      <td>${hanName}</td>
      <td>${grupoName}</td>
      <td>${p.frecuenciaSemanal || '-'}</td>
      <td>${p.frecuenciaZadankai || '-'}</td>
      <td>${p.suscriptoHumanismoSoka ? 'Sí' : 'No'}</td>
      <td>${p.realizaZaimu ? 'Sí' : 'No'}</td>
    `;
    personasTableBody.appendChild(tr);
  }
}

// 9) Visitas (roles)
async function configurarVisitasSegunRol() {
  visitaPersonaSelect.innerHTML = '';
  if (isAdmin) {
    visitaPersonaSelect.append(new Option('Seleccionar persona...', ''));
    const snap = await getDocs(query(collection(db, 'personas'), orderBy('lastName')));
    snap.forEach(docu => {
      const p = docu.data();
      visitaPersonaSelect.append(new Option(`${p.lastName || ''}, ${p.firstName || ''}`, docu.id));
    });
    visitaPersonaSelect.disabled = false;
  } else {
    visitaPersonaSelect.append(new Option('Yo mismo', currentUser.uid));
    visitaPersonaSelect.disabled = true;
  }
}

visitaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const personaId = visitaPersonaSelect.value;
  const fecha = f('visitaFecha').value;
  const obs = f('visitaObs').value.trim();
  if (!personaId || !fecha) return alert('Seleccioná una persona y fecha.');
  const visitasCol = collection(db, 'personas', personaId, 'visitas');
  await addDoc(visitasCol, { fecha, observaciones: obs, createdAt: serverTimestamp(), createdBy: currentUser.uid });
  await listarVisitas();
  visitaForm.reset();
});

async function listarVisitas() {
  visitasTableBody.innerHTML = '';
  if (isAdmin) {
    const personasSnap = await getDocs(collection(db, 'personas'));
    for (const docu of personasSnap.docs) {
      const nombre = `${docu.data().lastName || ''}, ${docu.data().firstName || ''}`.trim();
      const vSnap = await getDocs(collection(db, 'personas', docu.id, 'visitas'));
      vSnap.forEach(vDoc => {
        const v = vDoc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${nombre}</td><td>${v.fecha || ''}</td><td>${v.observaciones || ''}</td>`;
        visitasTableBody.appendChild(tr);
      });
    }
  } else {
    const pSnap = await getDocs(collection(db, 'personas', currentUser.uid, 'visitas'));
    const nombre = `${f('lastName').value || ''}, ${f('firstName').value || ''}`.trim();
    pSnap.forEach(vDoc => {
      const v = vDoc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${nombre}</td><td>${v.fecha || ''}</td><td>${v.observaciones || ''}</td>`;
      visitasTableBody.appendChild(tr);
    });
  }
}

// 10) Util
function limpiarUI() {
  userInfo.classList.add('hidden');
  loginFormDiv.classList.remove('hidden');
  roleBadge.textContent = '';
  adminSections.forEach(sec => sec.classList.add('hidden'));
  hanSelect.innerHTML = ''; grupoSelect.innerHTML = '';
  han  hanLocalidadInput.value = '';
  personasTableBody.innerHTML = '';
  visitasTableBody.innerHTML = '';
  visitaPersonaSelect.innerHTML = '';
