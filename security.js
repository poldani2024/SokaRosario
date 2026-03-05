(function () {
  const $ = (id) => document.getElementById(id);
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);

  let currentRole = 'Usuario';

  const toArray = (raw) => String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  function dump(data) {
    $('resultBox').textContent = JSON.stringify(data, null, 2);
  }

  function setGuard(isAdmin, role, email) {
    currentRole = role;
    $('guardMsg').textContent = isAdmin
      ? `Acceso habilitado para ${email} (${role}).`
      : `No autorizado. Tu rol actual es ${role}. Solo Admin puede editar seguridad.`;

    $('rolesPanel').classList.toggle('hidden', !isAdmin);
    $('fieldsPanel').classList.toggle('hidden', !isAdmin);
  }

  async function resolveRole(user) {
    const email = (user?.email || '').toLowerCase();
    try {
      const token = await user.getIdTokenResult(true);
      const role = String(token?.claims?.role || '').trim();
      return role || (ADMIN_EMAILS.has(email) ? 'Admin' : 'Usuario');
    } catch {
      return ADMIN_EMAILS.has(email) ? 'Admin' : 'Usuario';
    }
  }

  async function saveRolePolicy(e) {
    e.preventDefault();
    if (currentRole !== 'Admin') return alert('Solo Admin.');

    const targetRole = $('targetRole').value;
    const payload = {
      allowedFields: toArray($('allowedFields').value),
      sameRoleHiddenFields: toArray($('sameRoleHiddenFields').value),
      canViewSameRole: $('canViewSameRole').value === 'true',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
    };

    if (!payload.allowedFields.length) payload.allowedFields = ['*'];

    await db.collection('fieldPolicies').doc(targetRole).set(payload, { merge: true });
    dump({ action: 'setRoleFieldPolicy', targetRole, payload });
  }

  async function saveRoleScope(e) {
    e.preventDefault();
    if (currentRole !== 'Admin') return alert('Solo Admin.');

    const uid = $('uid').value.trim();
    if (!uid) return alert('Ingresá UID.');

    const payload = {
      role: $('role').value,
      scope: {
        subregionIds: toArray($('subregionIds').value),
        cityIds: toArray($('cityIds').value),
        sectorIds: toArray($('sectorIds').value),
        hanIds: toArray($('hanIds').value),
      },
      active: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
    };

    await db.collection('roles').doc(uid).set(payload, { merge: true });
    dump({ action: 'setRole', uid, payload });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.auth || !window.db) {
      $('guardMsg').textContent = 'Firebase no inicializado. Revisá SDKs y firebase.js';
      return;
    }

    $('roleForm').addEventListener('submit', saveRoleScope);
    $('policyForm').addEventListener('submit', saveRolePolicy);

    $('googleLoginBtn').addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try { await auth.signInWithPopup(provider); } catch { await auth.signInWithRedirect(provider); }
    });

    $('logoutBtn').addEventListener('click', async () => {
      await auth.signOut();
    });

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        $('login-form').classList.remove('hidden');
        $('user-info').classList.add('hidden');
        setGuard(false, 'Usuario', '');
        return;
      }

      const email = (user.email || '').toLowerCase();
      const role = await resolveRole(user);
      const isAdmin = role === 'Admin';

      $('user-email').textContent = email;
      $('role-badge').textContent = role;
      $('login-form').classList.add('hidden');
      $('user-info').classList.remove('hidden');

      setGuard(isAdmin, role, email);
    });
  });
})();
