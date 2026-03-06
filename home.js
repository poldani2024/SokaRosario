/* home.js — dashboard moderno + visibilidad por rol */
(function () {
  const $ = (id) => document.getElementById(id);
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', !!hidden);
  }


  function setAuthenticatedUi(isAuthenticated) {
    setHidden(document.querySelector('main.dashboard'), !isAuthenticated);
    setHidden(document.querySelector('.top-links'), !isAuthenticated);
  }

  function applySignedOut() {
    setHidden($('login-form'), false);
    setHidden($('user-info'), true);
    applyRoleUi('Usuario');
    setAuthenticatedUi(false);
  }

  function applySignedInUser(user, role) {
    $('user-email').textContent = (user.email || '').toLowerCase();
    $('role-badge').textContent = role;
    setHidden($('login-form'), true);
    setHidden($('user-info'), false);
    applyRoleUi(role);
    setAuthenticatedUi(true);
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



  function savePendingInviteFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteId = String(params.get('invite') || '').trim();
      const inviteEmail = String(params.get('email') || '').trim().toLowerCase();
      if (!inviteId) return;
      sessionStorage.setItem('soka_invite_id', inviteId);
      if (inviteEmail) sessionStorage.setItem('soka_invite_email', inviteEmail);
    } catch {}
  }

  function readPendingInvite() {
    const params = new URLSearchParams(window.location.search);
    const inviteId = String(params.get('invite') || sessionStorage.getItem('soka_invite_id') || '').trim();
    const inviteEmail = String(params.get('email') || sessionStorage.getItem('soka_invite_email') || '').trim().toLowerCase();
    return { inviteId, inviteEmail };
  }

  function clearPendingInvite() {
    sessionStorage.removeItem('soka_invite_id');
    sessionStorage.removeItem('soka_invite_email');
  }

  async function processInviteAcceptance(user) {
    if (!window.db || !user) return;
    const { inviteId, inviteEmail } = readPendingInvite();
    if (!inviteId) return;

    const signedEmail = (user.email || '').toLowerCase();
    const invitedEmail = inviteEmail;
    if (invitedEmail && invitedEmail !== signedEmail) {
      alert('Ingresaste con un email distinto al invitado. Cerrá sesión e ingresá con el email correcto.');
      return;
    }

    const ref = db.collection('userInvites').doc(inviteId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (String(data.status || '') === 'accepted') return;
    if ((data.email || '').toLowerCase() !== signedEmail) return;

    await ref.set({
      status: 'accepted',
      acceptedByUid: user.uid,
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
      acceptedEmail: signedEmail,
    }, { merge: true });

    const userRef = db.collection('users').doc(user.uid);
    const userSnap = await userRef.get();
    const userPayload = {
      uid: user.uid,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: signedEmail,
      phone: (userSnap.data()?.phone || ''),
      status: (userSnap.data()?.status || 'Activo'),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (!userSnap.exists) userPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await userRef.set(userPayload, { merge: true });

    clearPendingInvite();
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, '', cleanUrl);
    alert('Tu usuario de acceso fue confirmado correctamente. Un administrador debe asignarte rol y alcance.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    savePendingInviteFromUrl();
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

      try {
        await processInviteAcceptance(user);
      } catch (err) {
        console.error('[invite] no se pudo confirmar invitación:', err);
      }
      const role = await resolveRole(user);
      applySignedInUser(user, role);
    });
  });
})();
