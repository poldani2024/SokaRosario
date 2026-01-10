
<script>
/* auth-ui.js — Header común de login */
(function(){
  const $ = (id) => document.getElementById(id);
  const setHidden = (el, hidden) => { if (!el) return; el.classList.toggle('hidden', hidden); };
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };

  function applySignedInUser(user) {
    const email = (user?.email || '').toLowerCase();
    text('user-email', email);
    // Podés setear el rol si lo tenés en storage (opcional):
    try {
      const s = JSON.parse(localStorage.getItem('soka_session') || 'null');
      text('role-badge', s?.role || '');
    } catch {}
    setHidden($('login-form'), true);
    setHidden($('user-info'), false);
  }

  function applySignedOut() {
    text('user-email', '');
    text('role-badge', '');
    setHidden($('login-form'), false);
    setHidden($('user-info'), true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.auth || typeof window.auth.onAuthStateChanged !== 'function') {
      console.warn('[auth-ui] auth no está listo. ¿Están cargados los SDKs antes de firebase.js?');
      return;
    }

    // Detectores robustos para popup/redirect:
    const ua = navigator.userAgent.toLowerCase();
    const isIOS    = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');

    const loginBtn = $('googleLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          if (isIOS || isSafari) {
            await auth.signInWithRedirect(provider);
          } else {
            await auth.signInWithPopup(provider);
          }
        } catch (e) {
          console.error('[auth-ui] error en login', e);
          alert('No se pudo iniciar sesión. Intentá nuevamente.');
        }
      });
    }

    auth.onAuthStateChanged(user => {
      if (user) applySignedInUser(user); else applySignedOut();
    });

    // Consolidación de redirect (para Safari/iOS)
    auth.getRedirectResult()
      .then(result => { if (result && result.user) applySignedInUser(result.user); })
      .catch(err => console.error('[auth-ui] getRedirectResult error:', err));
  });
})();
</script>
