// app (2).js — usa 'auth' global definido en firebase (1).js

// Helpers mínimos de UI
const $ = (id) => document.getElementById(id);
const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle('hidden', !!hidden); };
const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };

// Estado
let currentUser = null; // { email, displayName, uid }
let currentRole = 'Usuario';

// Admins
const ADMIN_EMAILS = ['pedro.l.oldani@gmail.com'];

// Init
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = $('googleLoginBtn');
  const logoutBtn = $('logoutBtn');

  // Consolidar resultado de redirect si aplica
  auth.getRedirectResult()
    .then(res => {
      console.log('[Auth] getRedirectResult user?', !!res.user);
      if (res.user) applySignedInUser(res.user);
      if (loginBtn) loginBtn.disabled = false;
    })
    .catch(err => {
      console.warn('[Auth] getRedirectResult ERROR:', err?.code || err?.message || err);
      if (loginBtn) loginBtn.disabled = false;
    });

  // Listener de estado global
  auth.onAuthStateChanged((user) => {
    console.log('[Auth] onAuthStateChanged fired. user:', !!user);
    if (user) applySignedInUser(user); else applySignedOut();
  });

  // Botón login
  if (loginBtn) {
    let isSigningIn = false;
    loginBtn.addEventListener('click', async () => {
      if (isSigningIn) return;
      isSigningIn = true;
      loginBtn.disabled = true;

      const provider = new firebase.auth.GoogleAuthProvider();
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      try {
        console.log('[Auth] Iniciando login via', isSafari ? 'redirect' : 'popup');
        if (isSafari) {
          await auth.signInWithRedirect(provider);
        } else {
          const res = await auth.signInWithPopup(provider);
          console.log('[Auth] Popup OK:', res.user?.email);
        }
      } catch (e) {
        console.error('[Auth] Login error:', e);
        alert('No se pudo iniciar sesión con Google. Probá nuevamente.');
        loginBtn.disabled = false;
        isSigningIn = false;
      }
    });
  }

  // Botón logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await auth.signOut();
      console.log('[Auth] Sesión cerrada');
    });
  }
});

// UI handlers
function applySignedInUser(user) {
  currentUser = user;
  const email = (user.email || '').toLowerCase();
  const role = ADMIN_EMAILS.includes(email) ? 'Admin' : 'Usuario';
  currentRole = role;

  text('user-email', email);
  text('role-badge', role);
  setHidden($('login-form'), true);
  setHidden($('user-info'), false);

  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', role !== 'Admin'));
}

function applySignedOut() {
  currentUser = null;
  currentRole = 'Usuario';
  text('user-email', '');
  text('role-badge', '');
  setHidden($('login-form'), false);
  setHidden($('user-info'), true);
  document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
}
