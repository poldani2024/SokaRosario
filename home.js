// home.js — gating de menú y visibilidad admin usando window.auth
(function(){
  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('login-form');
    const userInfo  = $('user-info');
    const emailSpan = $('user-email');
    const roleBadge = $('role-badge');
    const loginBtn  = $('googleLoginBtn');
    const logoutBtn = $('logoutBtn');
    const adminLink = document.getElementById('adminLink');

    // Consolidar redirect si aplica
    auth.getRedirectResult().catch(() => {});

    // Estado
    auth.onAuthStateChanged((user) => {
      if (user) {
        const email = (user.email||'').toLowerCase();
        const isAdmin = email === 'pedro.l.oldani@gmail.com';
        emailSpan.textContent = email;
        roleBadge.textContent = isAdmin ? 'Admin' : 'Usuario';
        loginForm.style.display = 'none';
        userInfo.style.display  = 'flex';
        // Mostrar opciones admin
        document.querySelectorAll('.admin-only, .admin-only-link').forEach(el => el.style.display = isAdmin ? '' : 'none');
      } else {
        loginForm.style.display = 'flex';
        userInfo.style.display  = 'none';
        document.querySelectorAll('.admin-only, .admin-only-link').forEach(el => el.style.display = 'none');
      }
    });

    // Login
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

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
      });
    }
  });
})();
