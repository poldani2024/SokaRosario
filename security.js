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
  let selectedUserUid = '';
  let selectedManageUid = '';
  let usersCache = [];
  let bootstrapped = false;

  function dump(data) {
    $('resultBox').textContent = JSON.stringify(data, null, 2);
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function slugId(name) {
    return normalizeText(name)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function appBaseUrl() {
    const path = window.location.pathname || '/';
    return `${window.location.origin}${path.slice(0, path.lastIndexOf('/') + 1)}`;
  }

  function buildInviteUrl(inviteId, email) {
    return `${appBaseUrl()}index.html?invite=${encodeURIComponent(inviteId)}&email=${encodeURIComponent(email)}`;
  }

  async function createUserInvite(e) {
    e.preventDefault();
    if (currentRole !== 'Admin') return alert('Solo Admin.');

    const firstName = normalizeText($('newUserFirstName').value);
    const lastName = normalizeText($('newUserLastName').value);
    const email = normalizeText($('newUserEmail').value).toLowerCase();
    if (!firstName || !lastName || !email) return alert('Completá nombre, apellido y email.');

    const payload = {
      firstName,
      lastName,
      email,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser?.uid || null,
      invitedByEmail: (auth.currentUser?.email || '').toLowerCase(),
    };

    const ref = await db.collection('userInvites').add(payload);
    const inviteLink = buildInviteUrl(ref.id, email);
    await ref.set({ inviteLink }, { merge: true });

    $('inviteLinkOut').value = inviteLink;
    dump({ action: 'createInvite', inviteId: ref.id, inviteLink, payload });
    await loadPendingInvites();
  }


  function formatInviteDate(value) {
    try {
      if (!value) return '';
      if (typeof value?.toDate === 'function') return value.toDate().toLocaleString('es-AR');
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('es-AR');
    } catch {
      return '';
    }
  }

  async function loadPendingInvites() {
    const box = $('pendingInvitesList');
    if (!box) return;

    const snap = await db.collection('userInvites').where('status', '==', 'pending').get().catch(() => ({ docs: [] }));
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => {
        const ta = (a.createdAt && typeof a.createdAt.toMillis === 'function') ? a.createdAt.toMillis() : 0;
        const tb = (b.createdAt && typeof b.createdAt.toMillis === 'function') ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

    box.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('span');
      empty.className = 'tag';
      empty.textContent = 'No hay invitaciones pendientes.';
      box.appendChild(empty);
      return;
    }

    items.forEach((inv) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      const fullName = `${inv.firstName || ''} ${inv.lastName || ''}`.trim() || '(sin nombre)';
      const email = inv.email || '(sin email)';
      const when = formatInviteDate(inv.createdAt);
      tag.textContent = when ? `${fullName} — ${email} · invitado ${when}` : `${fullName} — ${email}`;
      box.appendChild(tag);
    });
  }

  async function copyInviteLink() {
    const value = $('inviteLinkOut').value.trim();
    if (!value) return alert('Primero generá un link.');
    try {
      await navigator.clipboard.writeText(value);
      alert('Link copiado al portapapeles.');
    } catch {
      $('inviteLinkOut').focus();
      $('inviteLinkOut').select();
      document.execCommand('copy');
      alert('Link copiado.');
    }
  }

  function setGuard(isAdmin, role, email) {
    currentRole = role;
    $('guardMsg').textContent = isAdmin
      ? `Acceso habilitado para ${email} (${role}).`
      : `No autorizado. Tu rol actual es ${role}. Solo Admin puede editar seguridad.`;

    $('masterPanel').classList.toggle('hidden', !isAdmin);
    $('rolesPanel').classList.toggle('hidden', !isAdmin);
    $('fieldsPanel').classList.toggle('hidden', !isAdmin);
    $('onboardingPanel').classList.toggle('hidden', !isAdmin);
    $('usersPanel').classList.toggle('hidden', !isAdmin);
  }

  const SCOPE_LIST_IDS = new Set(['subregionIds', 'cityIds', 'sectorIds', 'hanIds']);

  function syncSelectAllState(container) {
    const selectAll = container.querySelector('input[data-select-all="true"]');
    if (!selectAll) return;
    const items = Array.from(container.querySelectorAll('input[type="checkbox"]:not([data-select-all="true"])'));
    if (!items.length) {
      selectAll.checked = false;
      return;
    }
    selectAll.checked = items.every((el) => el.checked);
  }

  function renderCheckboxGroup(containerId, options) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';

    const enableSelectAll = SCOPE_LIST_IDS.has(containerId);
    if (enableSelectAll) {
      const allLabel = document.createElement('label');
      allLabel.className = 'check-item';

      const allInput = document.createElement('input');
      allInput.type = 'checkbox';
      allInput.id = `${containerId}__all`;
      allInput.dataset.selectAll = 'true';

      const allSpan = document.createElement('span');
      allSpan.textContent = 'Seleccionar todos';
      allSpan.className = 'check-text';

      allLabel.appendChild(allInput);
      allLabel.appendChild(allSpan);
      container.appendChild(allLabel);

      allInput.addEventListener('change', () => {
        container.querySelectorAll('input[type="checkbox"]:not([data-select-all="true"])').forEach((input) => {
          input.checked = allInput.checked;
        });
      });
    }

    options.forEach((opt) => {
      const id = `${containerId}_${String(opt.value).replace(/[^a-z0-9_-]/gi, '_')}`;
      const label = document.createElement('label');
      label.className = 'check-item';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.value = String(opt.value);
      if (enableSelectAll) {
        input.addEventListener('change', () => syncSelectAllState(container));
      }

      const span = document.createElement('span');
      span.textContent = opt.label;
      span.className = 'check-text';

      label.appendChild(input);
      label.appendChild(span);
      container.appendChild(label);
    });

    if (enableSelectAll) syncSelectAllState(container);
  }

  function getCheckedValues(containerId) {
    const container = $(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked:not([data-select-all="true"])')).map((el) => el.value);
  }

  function setCheckedValues(containerId, values) {
    const set = new Set((values || []).map(String));
    const container = $(containerId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]:not([data-select-all="true"])').forEach((input) => {
      input.checked = set.has(input.value);
    });
    syncSelectAllState(container);
  }

  function renderTags(containerId, values) {
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = '';
    values.forEach((v) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = v;
      box.appendChild(tag);
    });
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

  function formatDate(value) {
    try {
      if (!value) return '';
      if (typeof value?.toDate === 'function') return value.toDate().toLocaleDateString('es-AR');
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-AR');
    } catch {
      return '';
    }
  }

  function resetUserEditForm() {
    selectedManageUid = '';
    $('editUserId').value = '';
    $('editUserFirstName').value = '';
    $('editUserLastName').value = '';
    $('editUserEmail').value = '';
    $('editUserPhone').value = '';
    $('editUserStatus').value = 'Activo';
  }

  function populateUserEditForm(uid) {
    const u = usersCache.find((x) => x.id === uid);
    if (!u) {
      resetUserEditForm();
      return;
    }
    selectedManageUid = uid;
    $('editUserId').value = uid;
    $('editUserFirstName').value = u.firstName || '';
    $('editUserLastName').value = u.lastName || '';
    $('editUserEmail').value = u.email || '';
    $('editUserPhone').value = u.phone || '';
    $('editUserStatus').value = u.status === 'Inactivo' ? 'Inactivo' : 'Activo';
  }

  function renderUsersTable() {
    const tbody = $('usersTable')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    usersCache.forEach((u) => {
      const tr = document.createElement('tr');
      tr.dataset.uid = u.id;
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.firstName || ''}</td>
        <td>${u.lastName || ''}</td>
        <td>${u.email || ''}</td>
        <td>${u.phone || ''}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>${formatDate(u.updatedAt)}</td>
        <td>${u.status || 'Activo'}</td>
        <td>
          <button type="button" data-action="edit-user" data-uid="${u.id}" class="secondary">Editar</button>
          <button type="button" data-action="toggle-user" data-uid="${u.id}" class="secondary">${u.status === 'Inactivo' ? 'Activar' : 'Inactivar'}</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  async function loadUsers() {
    const [usersSnap, roleSnap] = await Promise.all([
      db.collection('users').get().catch(() => ({ docs: [] })),
      db.collection('roles').get(),
    ]);

    const userMap = new Map();
    usersCache = usersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

    usersCache.forEach((u) => {
      const uid = normalizeText(u.id || u.uid);
      if (!uid) return;
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || '(sin nombre)';
      const email = u.email ? ` — ${u.email}` : '';
      const status = u.status === 'Inactivo' ? ' [Inactivo]' : '';
      userMap.set(uid, { value: uid, label: `${name}${email}${status}` });
    });

    roleSnap.docs.forEach((doc) => {
      const uid = normalizeText(doc.id);
      if (!uid || userMap.has(uid)) return;
      userMap.set(uid, { value: uid, label: `Usuario sin perfil (${uid.slice(0, 6)}…)` });
    });

    const select = $('userSelect');
    select.innerHTML = '<option value="">Seleccionar usuario registrado...</option>';
    Array.from(userMap.values())
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
      .forEach((u) => {
        const opt = document.createElement('option');
        opt.value = u.value;
        opt.textContent = u.label;
        select.appendChild(opt);
      });

    renderUsersTable();
  }

  async function saveUserFromAdmin(e) {
    e.preventDefault();
    if (currentRole !== 'Admin') return alert('Solo Admin.');
    const uid = selectedManageUid || normalizeText($('editUserId').value);
    if (!uid) return alert('Seleccioná un usuario de la grilla.');

    const payload = {
      uid,
      firstName: normalizeText($('editUserFirstName').value),
      lastName: normalizeText($('editUserLastName').value),
      email: normalizeText($('editUserEmail').value).toLowerCase(),
      phone: normalizeText($('editUserPhone').value),
      status: $('editUserStatus').value === 'Inactivo' ? 'Inactivo' : 'Activo',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
    };

    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    await ref.set(payload, { merge: true });
    await loadUsers();
    populateUserEditForm(uid);
    dump({ action: 'saveUser', uid, payload });
  }

  async function toggleUserStatus(uid) {
    if (currentRole !== 'Admin') return alert('Solo Admin.');
    const user = usersCache.find((u) => u.id === uid);
    if (!user) return;
    const nextStatus = user.status === 'Inactivo' ? 'Activo' : 'Inactivo';
    await db.collection('users').doc(uid).set({
      status: nextStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
    }, { merge: true });

    await loadUsers();
    if (selectedManageUid === uid) populateUserEditForm(uid);
    dump({ action: 'toggleUserStatus', uid, status: nextStatus });
  }

  async function readMasterCollection(collectionName) {
    const snap = await db.collection(collectionName).orderBy('name').get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  async function loadMasterDataAndScopeOptions() {
    const [subregionsMaster, citiesMaster, sectorsMaster, hanSnap, roleSnap] = await Promise.all([
      readMasterCollection('subregiones').catch(() => []),
      readMasterCollection('ciudades').catch(() => []),
      readMasterCollection('sectores').catch(() => []),
      db.collection('hanes').get().catch(() => ({ docs: [] })),
      db.collection('roles').get().catch(() => ({ docs: [] })),
    ]);

    const subregions = new Set(subregionsMaster.map((x) => normalizeText(x.id || x.name)).filter(Boolean));
    const cities = new Set(citiesMaster.map((x) => normalizeText(x.id || x.name)).filter(Boolean));
    const sectors = new Set(sectorsMaster.map((x) => normalizeText(x.id || x.name)).filter(Boolean));
    const hanes = [];

    hanSnap.docs.forEach((doc) => {
      const h = doc.data() || {};
      const id = normalizeText(doc.id || h.id);
      const name = normalizeText(h.name || h.nombre || id);
      const city = normalizeText(h.city || h.ciudad);
      const sector = normalizeText(h.sector);
      const subregion = normalizeText(h.subregionId || h.subregion);

      if (subregion) subregions.add(subregion);
      if (city) cities.add(city);
      if (sector) sectors.add(sector);
      if (id) hanes.push({ value: id, label: name || id });
    });

    roleSnap.docs.forEach((doc) => {
      const scope = (doc.data() || {}).scope || {};
      (scope.subregionIds || []).forEach((x) => subregions.add(String(x)));
      (scope.cityIds || []).forEach((x) => cities.add(String(x)));
      (scope.sectorIds || []).forEach((x) => sectors.add(String(x)));
      (scope.hanIds || []).forEach((x) => {
        const id = String(x);
        if (!hanes.some((h) => h.value === id)) hanes.push({ value: id, label: id });
      });
    });

    renderTags('subregionList', Array.from(subregions).sort());
    renderTags('cityList', Array.from(cities).sort());
    renderTags('sectorList', Array.from(sectors).sort());

    renderCheckboxGroup('subregionIds', Array.from(subregions).sort().map((x) => ({ value: x, label: x })));
    renderCheckboxGroup('cityIds', Array.from(cities).sort().map((x) => ({ value: x, label: x })));
    renderCheckboxGroup('sectorIds', Array.from(sectors).sort().map((x) => ({ value: x, label: x })));
    renderCheckboxGroup('hanIds', hanes.sort((a, b) => a.label.localeCompare(b.label, 'es')));
  }

  function loadFieldOptions() {
    const options = PERSONA_FIELDS.map((f) => ({ value: f.key, label: `${f.label} (${f.key})` }));
    renderCheckboxGroup('allowedFields', options);
    renderCheckboxGroup('sameRoleHiddenFields', options);
  }

  async function loadRoleDoc(uid) {
    if (!uid) {
      $('role').value = 'Usuario';
      setCheckedValues('subregionIds', []);
      setCheckedValues('cityIds', []);
      setCheckedValues('sectorIds', []);
      setCheckedValues('hanIds', []);
      return;
    }

    const snap = await db.collection('roles').doc(uid).get();

    if (!snap.exists) {
      $('role').value = 'Usuario';
      setCheckedValues('subregionIds', []);
      setCheckedValues('cityIds', []);
      setCheckedValues('sectorIds', []);
      setCheckedValues('hanIds', []);
      return;
    }

    const data = snap.data() || {};
    const scope = data.scope || {};
    $('role').value = data.role || 'Usuario';
    setCheckedValues('subregionIds', scope.subregionIds || []);
    setCheckedValues('cityIds', scope.cityIds || []);
    setCheckedValues('sectorIds', scope.sectorIds || []);
    setCheckedValues('hanIds', scope.hanIds || []);
  }

  async function loadFieldPolicy(role) {
    if (!role) return;
    const snap = await db.collection('fieldPolicies').doc(role).get();
    if (!snap.exists) {
      setCheckedValues('allowedFields', []);
      setCheckedValues('sameRoleHiddenFields', ['realizaZaimu']);
      $('canViewSameRole').value = 'true';
      return;
    }

    const data = snap.data() || {};
    setCheckedValues('allowedFields', data.allowedFields || []);
    setCheckedValues('sameRoleHiddenFields', data.sameRoleHiddenFields || []);
    $('canViewSameRole').value = data.canViewSameRole === false ? 'false' : 'true';
  }

  async function saveMasterItem(collectionName, inputId) {
    if (currentRole !== 'Admin') return alert('Solo Admin.');

    const name = normalizeText($(inputId).value);
    if (!name) return;

    const docId = slugId(name) || `${Date.now()}`;
    await db.collection(collectionName).doc(docId).set({
      name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
    }, { merge: true });

    $(inputId).value = '';
    await loadMasterDataAndScopeOptions();
    dump({ action: 'saveMasterItem', collectionName, name, docId });
  }

  async function saveRolePolicy(e) {
    e.preventDefault();
    if (currentRole !== 'Admin') return alert('Solo Admin.');

    const targetRole = $('targetRole').value;
    const payload = {
      allowedFields: getCheckedValues('allowedFields'),
      sameRoleHiddenFields: getCheckedValues('sameRoleHiddenFields'),
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

    const uid = selectedUserUid || String($('userSelect').value || '').trim();
    if (!uid) return alert('Seleccioná un usuario.');

    const payload = {
      role: $('role').value,
      scope: {
        subregionIds: getCheckedValues('subregionIds'),
        cityIds: getCheckedValues('cityIds'),
        sectorIds: getCheckedValues('sectorIds'),
        hanIds: getCheckedValues('hanIds'),
      },
      active: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null,
    };

    await db.collection('roles').doc(uid).set(payload, { merge: true });
    dump({ action: 'setRole', uid, payload });
    await loadUsers();
  }

  async function bootstrapData() {
    await loadUsers();
    await loadMasterDataAndScopeOptions();
    loadFieldOptions();
    await loadPendingInvites();
    resetUserEditForm();

    $('userSelect').addEventListener('change', async (e) => {
      const uid = String(e.target.value || '').trim();
      selectedUserUid = uid;
      await loadRoleDoc(uid);
    });


    $('usersTable')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const uid = String(btn.dataset.uid || '').trim();
      if (!uid) return;
      const action = btn.dataset.action;
      if (action === 'edit-user') {
        populateUserEditForm(uid);
      } else if (action === 'toggle-user') {
        await toggleUserStatus(uid);
      }
    });

    $('userEditForm').addEventListener('submit', saveUserFromAdmin);
    $('userEditClearBtn').addEventListener('click', () => resetUserEditForm());

    selectedUserUid = String($('userSelect').value || '').trim();
    await loadRoleDoc(selectedUserUid);

    $('targetRole').addEventListener('change', async (e) => {
      await loadFieldPolicy(e.target.value);
    });

    $('subregionForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveMasterItem('subregiones', 'subregionName');
    });

    $('cityForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveMasterItem('ciudades', 'cityName');
    });

    $('sectorForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveMasterItem('sectores', 'sectorName');
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
    $('onboardingForm').addEventListener('submit', createUserInvite);
    $('copyInviteBtn').addEventListener('click', copyInviteLink);

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
