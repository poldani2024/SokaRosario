(function () {
  const $ = (id) => document.getElementById(id);
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);

  const PERSONA_FIELDS = [
    { key: 'firstName', label: 'Nombre' },
    { key: 'lastName', label: 'Apellido' },
    { key: 'birthDate', label: 'Fecha de Nacimiento' },
    { key: 'address', label: 'Domicilio' },
    { key: 'city', label: 'Localidad' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Estado' },
    { key: 'hanId', label: 'Han (ID)' },
    { key: 'hanName', label: 'Han (Nombre)' },
    { key: 'hanCity', label: 'Han (Localidad)' },
    { key: 'hanSector', label: 'Han (Sector)' },
    { key: 'grupoId', label: 'Grupo (ID)' },
    { key: 'grupoName', label: 'Grupo (Nombre)' },
    { key: 'frecuenciaSemanal', label: 'Reuniones semanales' },
    { key: 'frecuenciaZadankai', label: 'Zadankai' },
    { key: 'suscriptoHumanismoSoka', label: 'Suscripto a Humanismo Soka' },
    { key: 'realizaZaimu', label: 'Realiza Zaimu' },
    { key: 'comentarios', label: 'Comentarios' },
  ];

  let currentRole = 'Usuario';
  let bootstrapped = false;

  function dump(data) {
    $('resultBox').textContent = JSON.stringify(data, null, 2);
  }

  function selectedValues(selectId) {
    const sel = $(selectId);
    if (!sel) return [];
    return Array.from(sel.selectedOptions).map((o) => o.value).filter(Boolean);
  }

  function setSelectedValues(selectId, values) {
    const set = new Set((values || []).map(String));
    const sel = $(selectId);
    if (!sel) return;
    Array.from(sel.options).forEach((opt) => {
      opt.selected = set.has(opt.value);
    });
  }

  function fillOptions(selectId, options, placeholder = '') {
    const sel = $(selectId);
    if (!sel) return;

    const multiple = sel.hasAttribute('multiple');
    sel.innerHTML = '';

    if (!multiple && placeholder) {
      const p = document.createElement('option');
      p.value = '';
      p.textContent = placeholder;
      sel.appendChild(p);
    }

    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = String(opt.value);
      o.textContent = opt.label;
      sel.appendChild(o);
    });
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

  async function loadUsers() {
    const peopleSnap = await db.collection('personas').get();
    const roleSnap = await db.collection('roles').get();

    const userMap = new Map();

    peopleSnap.docs.forEach((doc) => {
      const p = doc.data() || {};
      const uid = String(p.uid || doc.id || '').trim();
      if (!uid) return;
      const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || '(sin nombre)';
      const email = p.email ? ` — ${p.email}` : '';
      userMap.set(uid, { value: uid, label: `${name}${email} [${uid}]` });
    });

    roleSnap.docs.forEach((doc) => {
      const uid = String(doc.id || '').trim();
      if (!uid || userMap.has(uid)) return;
      userMap.set(uid, { value: uid, label: `UID ${uid}` });
    });

    const options = Array.from(userMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
    fillOptions('userSelect', options, 'Seleccionar usuario...');
  }

  async function loadScopeOptions() {
    const hanSnap = await db.collection('hanes').get();
    const roleSnap = await db.collection('roles').get();

    const subregions = new Set();
    const cities = new Set();
    const sectors = new Set();
    const hanes = [];

    hanSnap.docs.forEach((doc) => {
      const h = doc.data() || {};
      const id = String(doc.id || h.id || '').trim();
      const name = String(h.name || h.nombre || id || '').trim();
      const city = String(h.city || h.ciudad || '').trim();
      const sector = String(h.sector || '').trim();
      const subregion = String(h.subregionId || h.subregion || '').trim();

      if (subregion) subregions.add(subregion);
      if (city) cities.add(city);
      if (sector) sectors.add(sector);
      if (id) hanes.push({ value: id, label: `${name || id} (${id})` });
    });

    roleSnap.docs.forEach((doc) => {
      const r = doc.data() || {};
      const s = r.scope || {};
      (s.subregionIds || []).forEach((x) => subregions.add(String(x)));
      (s.cityIds || []).forEach((x) => cities.add(String(x)));
      (s.sectorIds || []).forEach((x) => sectors.add(String(x)));
      (s.hanIds || []).forEach((x) => {
        const id = String(x);
        if (!hanes.some((h) => h.value === id)) hanes.push({ value: id, label: id });
      });
    });

    fillOptions('subregionIds', Array.from(subregions).sort().map((x) => ({ value: x, label: x })));
    fillOptions('cityIds', Array.from(cities).sort().map((x) => ({ value: x, label: x })));
    fillOptions('sectorIds', Array.from(sectors).sort().map((x) => ({ value: x, label: x })));
    fillOptions('hanIds', hanes.sort((a, b) => a.label.localeCompare(b.label, 'es')));
  }

  function loadFieldOptions() {
    const options = PERSONA_FIELDS.map((f) => ({ value: f.key, label: `${f.label} (${f.key})` }));
    fillOptions('allowedFields', options);
    fillOptions('sameRoleHiddenFields', options);
  }

  async function loadRoleDoc(uid) {
    if (!uid) return;
    const snap = await db.collection('roles').doc(uid).get();

    if (!snap.exists) {
      $('role').value = 'Usuario';
      setSelectedValues('subregionIds', []);
      setSelectedValues('cityIds', []);
      setSelectedValues('sectorIds', []);
      setSelectedValues('hanIds', []);
      return;
    }

    const data = snap.data() || {};
    const scope = data.scope || {};
    $('role').value = data.role || 'Usuario';
    setSelectedValues('subregionIds', scope.subregionIds || []);
    setSelectedValues('cityIds', scope.cityIds || []);
    setSelectedValues('sectorIds', scope.sectorIds || []);
    setSelectedValues('hanIds', scope.hanIds || []);
  }

  async function loadFieldPolicy(role) {
    if (!role) return;
    const snap = await db.collection('fieldPolicies').doc(role).get();
    if (!snap.exists) {
      setSelectedValues('allowedFields', []);
      setSelectedValues('sameRoleHiddenFields', ['realizaZaimu']);
      $('canViewSameRole').value = 'true';
      return;
    }

    const data = snap.data() || {};
    setSelectedValues('allowedFields', data.allowedFields || []);
    setSelectedValues('sameRoleHiddenFields', data.sameRoleHiddenFields || []);
    $('canViewSameRole').value = data.canViewSameRole === false ? 'false' : 'true';
  }

  async function saveRolePolicy(e) {
    e.preventDefault();
    if (currentRole !== 'Admin') return alert('Solo Admin.');

    const targetRole = $('targetRole').value;
    const payload = {
      allowedFields: selectedValues('allowedFields'),
      sameRoleHiddenFields: selectedValues('sameRoleHiddenFields'),
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
    if (!uid) return alert('Seleccioná un usuario.');

    const payload = {
      role: $('role').value,
      scope: {
        subregionIds: selectedValues('subregionIds'),
        cityIds: selectedValues('cityIds'),
        sectorIds: selectedValues('sectorIds'),
        hanIds: selectedValues('hanIds'),
      },
      active: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
    };

    await db.collection('roles').doc(uid).set(payload, { merge: true });
    dump({ action: 'setRole', uid, payload });
  }

  async function bootstrapData() {
    await loadUsers();
    await loadScopeOptions();
    loadFieldOptions();

    $('userSelect').addEventListener('change', async (e) => {
      const uid = e.target.value || '';
      $('uid').value = uid;
      await loadRoleDoc(uid);
    });

    $('targetRole').addEventListener('change', async (e) => {
      await loadFieldPolicy(e.target.value);
    });

    await loadFieldPolicy($('targetRole').value);
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
      if (isAdmin && !bootstrapped) {
        await bootstrapData();
        bootstrapped = true;
      }
    });
  });
})();
