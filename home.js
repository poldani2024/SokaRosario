
// home.js — estado de sesión + gating por rol en Home (enlaces/pétalos)
// Basado en tu home.js actual (IDs de header y gating admin).  // [1](https://cargillonline-my.sharepoint.com/personal/pedro_oldani_cargill_com/Documents/Microsoft%20Copilot%20Chat%20Files/home.js)
(function(){
  const $ = (id) => document.getElementById(id);

  function resolveRole(user){
    if (!user) return Promise.resolve({ role: "Usuario" });
    const email = (user.email ?? "").toLowerCase();
    const ADMINS = new Set(['pedro.l.oldani@gmail.com','pedro.loldani@gmail.com']);
    return user.getIdTokenResult().then(token => {
      const claims = token?.claims ?? {};
      let role = claims.role || (ADMINS.has(email) ? 'Admin' : 'Usuario');
      return { role };
    }).catch(() => ({ role: ADMINS.has(email) ? 'Admin' : 'Usuario' }));
  }

  function gateLinksByRole(role){
    // Seleccionamos por href (no depende de clases, no tocamos HTML)
    const sel = (href) => document.querySelectorAll(`a[href="${href}"]`);

    // Hanes/Grupos: solo Admin
    const isAdmin = role === "Admin";
    sel("hanes.html").forEach(a => a.style.display = isAdmin ? "" : "none");
    sel("grupos.html").forEach(a => a.style.display = isAdmin ? "" : "none");

    // Visitas: Admin + líderes
    const canVisitas = ["Admin","LiderCiudad","LiderSector","LiderHan"].includes(role);
    sel("visitas.html").forEach(a => a.style.display = canVisitas ? "" : "none");

    // Personas: todos (no se toca)
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('login-form');
    const userInfo = $('user-info');
    const emailSpan = $('user-email');
    const roleBadge = $('role-badge');
    const loginBtn = $('googleLoginBtn');
    const logoutBtn = $('logoutBtn');

    auth.getRedirectResult().catch(()=>{});
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const email = (user.email ?? '').toLowerCase();
        const { role } = await resolveRole(user);
        emailSpan.textContent = email;
        roleBadge.textContent = role;

        loginForm.style.display = 'none';
        userInfo.style.display = 'flex';
        gateLinksByRole(role);
      } else {
        loginForm.style.display = 'flex';
        userInfo.style.display = 'none';
        gateLinksByRole("Usuario");
      }
    });

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        const isSafari = /^(?!(chrome|android)).*safari/i.test(navigator.userAgent);
        try { if (isSafari) await auth.signInWithRedirect(provider); else await auth.signInWithPopup(provider); }
        catch { alert('No se pudo iniciar sesión. Intentá de nuevo.'); }
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => { await auth.signOut(); });
    }
  });
})();
