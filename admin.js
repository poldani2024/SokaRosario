
// admin.js — header de sesión y gating admin
(function(){
  const $ = (id) => document.getElementById(id);
  const show = (el) => { if (el) el.classList.remove('hidden'); };
  const hide = (el) => { if (el) el.classList.add('hidden'); };

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('login-form');
    const userInfo  = $('user-info');
    const emailSpan = $('user-email');
    const roleBadge = $('role-badge');
    const loginBtn  = $('googleLoginBtn');
    const logoutBtn = $('logoutBtn');
    const adminNotice = $('admin-notice');
    const secHanes = $('hanes');
    const secGrupos = $('grupos');

    auth.getRedirectResult().catch(() => {});

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const email = (user.email||'').toLowerCase();
        const ADMINS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);
        let isAdmin = ADMINS.has(email);
        try {
          const token = await user.getIdTokenResult();
          if (token?.claims?.admin === true) isAdmin = true;
        } catch {}

        emailSpan.textContent = email;
        roleBadge.textContent = isAdmin ? 'Admin' : 'Usuario';
        hide(loginForm);
        show(userInfo);

        if (isAdmin) {
          hide(adminNotice);
          if (secHanes)  show(secHanes);
          if (secGrupos) show(secGrupos);
        } else {
          show(adminNotice);
          if (secHanes)  hide(secHanes);
          if (secGrupos) hide(secGrupos);
        }
      } else {
        show(loginForm);
        hide(userInfo);
        show(adminNotice);
        if (secHanes)  hide(secHanes);
        if (secGrupos) hide(secGrupos);
      }
    });

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        try {
          if (isSafari) await auth.signInWithRedirect(provider);
          else await auth.signInWithPopup(provider);
        } catch (e) {
          alert('No se pudo iniciar sesión. Intentá de nuevo.');
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => { await auth.signOut(); });
    }
  });
})();
