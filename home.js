
// home.js — estado de sesión y visibilidad admin en Home
(function(){
  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('login-form');
    const userInfo  = $('user-info');
    const emailSpan = $('user-email');
    const roleBadge = $('role-badge');
    const loginBtn  = $('googleLoginBtn');
    const logoutBtn = $('logoutBtn');

    auth.getRedirectResult().catch(() => {});

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const email = (user.email || '').toLowerCase();
        const ADMINS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);
        let isAdmin = ADMINS.has(email);
        try {
          const token = await user.getIdTokenResult();
          if (token?.claims?.admin === true) isAdmin = true;
        } catch {}

        emailSpan.textContent = email;
        roleBadge.textContent = isAdmin ? 'Admin' : 'Usuario';
        loginForm.style.display = 'none';
        userInfo.style.display  = 'flex';

        // Mostrar pétalos/enlaces admin
        const adminEls = document.querySelectorAll('.admin-only-link');
        adminEls.forEach(el => {
          if (isAdmin) {
            el.classList.remove('admin-only-link');
            el.removeAttribute('style');
            el.style.display = 'inline';
          } else {
            el.classList.add('admin-only-link');
            el.style.display = 'none';
          }
        });
      } else {
        loginForm.style.display = 'flex';
        userInfo.style.display  = 'none';
        document.querySelectorAll('.admin-only-link').forEach(el => el.style.display = 'none');
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
``
