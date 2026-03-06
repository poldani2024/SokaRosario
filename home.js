/* home.js — dashboard moderno + visibilidad por rol */
(function () {
  const $ = (id) => document.getElementById(id);
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', !!hidden);
  }

  function applySignedOut() {
    setHidden($('login-form'), false);
    setHidden($('user-info'), true);
    applyRoleUi('Usuario');
  }

  function applySignedInUser(user, role) {
    $('user-email').textContent = (user.email || '').toLowerCase();
    $('role-badge').textContent = role;
    setHidden($('login-form'), true);
    setHidden($('user-info'), false);
    applyRoleUi(role);
  }

  function applyRoleUi(role) {
    const isAdmin = role === 'Admin';
    const canVisitas = ['Admin', 'LiderCiudad', 'LiderSector', 'LiderHan'].includes(role);

    document.querySelectorAll('[data-feature="hanes"], [data-feature="grupos"], .admin-only').forEach((el) => {
      setHidden(el, !isAdmin);
    });

    document.querySelectorAll('[data-feature="visitas"]').forEach((el) => {
      setHidden(el, !canVisitas);
    });
  }

  async function resolveRole(user) {
    if (!user) return 'Usuario';

    try {
      const token = await user.getIdTokenResult();
      const claimRole = String(token?.claims?.role || '').trim();
      if (claimRole) return claimRole;
    } catch (err) {
      console.warn('[home] no se pudo leer claims:', err?.message || err);
    }

    const email = (user.email || '').toLowerCase();
    return ADMIN_EMAILS.has(email) ? 'Admin' : 'Usuario';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = $('googleLoginBtn');
    const logoutBtn = $('logoutBtn');

    if (!window.auth) {
      console.warn('[home] auth no está listo');
      return;
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        const ua = navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua);
        const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');

        try {
          if (isIOS || isSafari) await auth.signInWithRedirect(provider);
          else await auth.signInWithPopup(provider);
        } catch (e) {
          alert('No se pudo iniciar sesión. Intentá nuevamente.');
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
      });
    }

    auth.getRedirectResult().catch(() => {});

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        applySignedOut();
        return;
      }

      const role = await resolveRole(user);
      applySignedInUser(user, role);
    });
  });
})();
