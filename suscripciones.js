
// suscripciones.js — Registro de suscripción a la revista por Han/persona/trimestre
(function () {
  const $ = (id) => document.getElementById(id);
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);
  const VIEW_ROLES = ['Admin', 'SubRegion', 'LiderCiudad', 'LiderSector', 'LiderHan', 'Canillita'];
  const SCOPED_ROLES = ['LiderHan', 'Canillita'];

  let currentRole = 'Usuario';
  let roleHanIds = [];
  let hanes = [];
  let anchorMonth = '';
  let monthsById = {}; // { 'YYYY-MM': price }
  let trimesters = []; // [{ index, slots: ['YYYY-MM'|null, ...] }]
  let personas = [];
  let subsMap = {}; // { personaId: { 'YYYY-MM': { quantity, unitPrice, amount } } }

  function isValidMonthKey(key) { return /^\d{4}-\d{2}$/.test(String(key ?? '')); }

  function monthLabel(key, abbr) {
    if (!isValidMonthKey(key)) return '(sin configurar)';
    const [y, m] = key.split('-').map(Number);
    return `${(abbr ? MONTH_ABBR : MONTH_NAMES)[m - 1]} ${y}`;
  }

  function monthDiff(fromKey, toKey) {
    const [fy, fm] = fromKey.split('-').map(Number);
    const [ty, tm] = toKey.split('-').map(Number);
    return (ty * 12 + (tm - 1)) - (fy * 12 + (fm - 1));
  }

  function toArr(v) { return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []; }

  function personaLabel(p) {
    return `${p.lastName ?? ''}, ${p.firstName ?? ''}`.replace(/^,\s*/, '').trim() || '(sin nombre)';
  }

  function normalizeText(v) {
    return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  async function resolveRole(user) {
    if (!user) return { role: 'Usuario', hanIds: [] };
    const email = (user.email || '').toLowerCase();
    let role = ADMIN_EMAILS.has(email) ? 'Admin' : 'Usuario';
    let hanIds = [];
    try {
      const token = await user.getIdTokenResult();
      const claims = token?.claims ?? {};
      if (typeof claims.role === 'string' && claims.role.trim()) role = claims.role.trim();
      hanIds = toArr(claims.hanIds);
    } catch (err) { console.warn('[suscripciones] claims', err?.message || err); }
    try {
      const snap = await db.collection('roles').doc(user.uid).get();
      if (snap.exists) {
        const rd = snap.data() || {};
        if (typeof rd.role === 'string' && rd.role.trim()) role = rd.role.trim();
        const scope = rd.scope || {};
        const docHanIds = toArr(scope.hanIds || rd.hanIds);
        if (docHanIds.length) hanIds = docHanIds;
      }
    } catch (err) { console.warn('[suscripciones] roles/{uid}', err?.message || err); }
    if (ADMIN_EMAILS.has(email)) role = 'Admin';
    return { role, hanIds };
  }

  function canSeeSuscripciones(role) { return VIEW_ROLES.includes(role); }
  function canEditHan(role, hanId) {
    if (role === 'Admin') return true;
    if (role === 'Canillita') return roleHanIds.includes(hanId);
    return false;
  }

  async function loadConfig() {
    const [metaSnap, monthsSnap] = await Promise.all([
      db.collection('subscriptionConfig').doc('meta').get(),
      db.collection('subscriptionMonths').get()
    ]);
    anchorMonth = metaSnap.exists ? String(metaSnap.data()?.anchorMonth || '') : '';
    monthsById = {};
    monthsSnap.docs.forEach((d) => {
      if (isValidMonthKey(d.id)) monthsById[d.id] = Number(d.data()?.price ?? 0);
    });

    trimesters = [];
    if (isValidMonthKey(anchorMonth)) {
      const byIndex = {};
      Object.keys(monthsById).forEach((key) => {
        const diff = monthDiff(anchorMonth, key);
        if (diff < 0) return;
        const index = Math.floor(diff / 3);
        const pos = diff % 3;
        if (!byIndex[index]) byIndex[index] = [null, null, null];
        byIndex[index][pos] = key;
      });
      trimesters = Object.keys(byIndex)
        .map((k) => Number(k))
        .sort((a, b) => a - b)
        .map((index) => ({ index, slots: byIndex[index] }));
    }
  }

  function trimesterLabel(t) {
    const parts = t.slots.map((s) => monthLabel(s, true));
    return `Trimestre ${t.index + 1} — ${parts.join('/')}`;
  }

  async function loadHanes() {
    const snap = await db.collection('hanes').get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (SCOPED_ROLES.includes(currentRole)) {
      return all.filter((h) => roleHanIds.includes(h.id));
    }
    return all;
  }

  function populateHanSelect() {
    const sel = $('hanSelect');
    const current = sel.value;
    sel.innerHTML = '';
    if (!hanes.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '(sin Hanes asignados)';
      sel.appendChild(opt);
      return;
    }
    hanes.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.name || h.id;
      sel.appendChild(opt);
    });
    if (current && hanes.some((h) => h.id === current)) sel.value = current;
  }

  function populateTrimestreSelect() {
    const sel = $('trimestreSelect');
    const current = sel.value;
    sel.innerHTML = '';
    if (!trimesters.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '(sin trimestres configurados)';
      sel.appendChild(opt);
      return;
    }
    trimesters.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = String(t.index);
      opt.textContent = trimesterLabel(t);
      sel.appendChild(opt);
    });
    if (current && trimesters.some((t) => String(t.index) === current)) sel.value = current;
    else sel.value = String(trimesters[trimesters.length - 1].index);
  }

  function currentTrimester() {
    const idx = Number($('trimestreSelect')?.value ?? '');
    return trimesters.find((t) => t.index === idx) || null;
  }

  async function loadPersonasForHan(hanId) {
    if (!hanId) return [];
    const snap = await db.collection('personas').where('hanId', '==', hanId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function loadSubscriptions(hanId, monthKeys) {
    const map = {};
    const queries = monthKeys.filter(Boolean).map((month) =>
      db.collection('subscriptions').where('hanId', '==', hanId).where('month', '==', month).get()
    );
    const results = await Promise.all(queries);
    results.forEach((snap) => {
      snap.docs.forEach((d) => {
        const data = d.data() || {};
        const personaId = data.personaId;
        if (!personaId) return;
        if (!map[personaId]) map[personaId] = {};
        map[personaId][data.month] = {
          quantity: Number(data.quantity ?? (data.paid ? 1 : 0)),
          unitPrice: Number(data.unitPrice ?? data.amount ?? 0),
          amount: Number(data.amount ?? 0)
        };
      });
    });
    return map;
  }

  async function refreshTable() {
    const hanId = $('hanSelect')?.value ?? '';
    const t = currentTrimester();
    const tbody = $('suscripcionesTable')?.querySelector('tbody');
    const table = $('suscripcionesTable');
    if (!tbody) return;

    $('mes1Header').textContent = t ? monthLabel(t.slots[0]) : 'Mes 1';
    $('mes2Header').textContent = t ? monthLabel(t.slots[1]) : 'Mes 2';
    $('mes3Header').textContent = t ? monthLabel(t.slots[2]) : 'Mes 3';

    if (!hanId || !t) {
      tbody.innerHTML = '';
      $('suscripcionesEmpty')?.classList.remove('hidden');
      if (table) table.classList.add('hidden');
      return;
    }

    personas = await loadPersonasForHan(hanId);
    subsMap = await loadSubscriptions(hanId, t.slots);
    renderTable();
  }

  function renderTable() {
    const hanId = $('hanSelect')?.value ?? '';
    const t = currentTrimester();
    const tbody = $('suscripcionesTable')?.querySelector('tbody');
    const table = $('suscripcionesTable');
    if (!tbody || !t) return;

    const editable = canEditHan(currentRole, hanId);
    $('readOnlyNote')?.classList.toggle('hidden', editable);

    const q = normalizeText($('personaSearch')?.value ?? '');
    const estadoQ = $('estadoFilter')?.value ?? '';

    const filtered = personas.filter((p) => {
      const label = normalizeText(`${p.firstName ?? ''} ${p.lastName ?? ''}`);
      const okSearch = !q || label.includes(q);
      const okEstado = !estadoQ || (p.status ?? '') === estadoQ;
      return okSearch && okEstado;
    }).sort((a, b) => personaLabel(a).localeCompare(personaLabel(b), 'es'));

    tbody.innerHTML = '';
    $('suscripcionesEmpty')?.classList.toggle('hidden', filtered.length > 0);
    if (table) table.classList.toggle('hidden', filtered.length === 0);

    filtered.forEach((p) => {
      const tr = document.createElement('tr');
      tr.dataset.personaId = p.id;

      const tdName = document.createElement('td');
      tdName.textContent = personaLabel(p);

      const tdEstado = document.createElement('td');
      tdEstado.textContent = p.status || '';

      const personaSubs = subsMap[p.id] || {};
      const cells = t.slots.map((month) => {
        const td = document.createElement('td');
        if (!month) { td.textContent = '—'; return td; }
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '1';
        input.dataset.month = month;
        input.value = String(personaSubs[month]?.quantity ?? 0);
        input.disabled = !editable;
        input.title = 'Cantidad de suscripciones ese mes (0 = no suscribió)';
        td.appendChild(input);
        return td;
      });

      const tdBonus = document.createElement('td');
      const allSlotsConfigured = t.slots.every(Boolean);
      const allPaid = allSlotsConfigured && t.slots.every((m) => (personaSubs[m]?.quantity ?? 0) > 0);
      tdBonus.textContent = allSlotsConfigured ? (allPaid ? 'Sí' : 'No') : '—';
      if (allPaid) tdBonus.style.fontWeight = 'bold';

      tr.append(tdName, tdEstado, ...cells, tdBonus);
      tbody.appendChild(tr);
    });
  }

  async function updateCantidad(personaId, month, rawQuantity) {
    const hanId = $('hanSelect')?.value ?? '';
    if (!hanId || !month) return;
    if (!canEditHan(currentRole, hanId)) return alert('Tu rol no puede registrar pagos para este Han.');
    const quantity = Math.max(0, Math.floor(Number(rawQuantity) || 0));
    const unitPrice = Number(monthsById[month] ?? 0);
    const amount = quantity * unitPrice;
    const user = auth.currentUser;
    try {
      await db.collection('subscriptions').doc(`${personaId}__${month}`).set({
        personaId,
        hanId,
        month,
        quantity,
        unitPrice,
        amount,
        registeredBy: user?.uid || '',
        registeredByEmail: (user?.email || '').toLowerCase(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (!subsMap[personaId]) subsMap[personaId] = {};
      subsMap[personaId][month] = { quantity, unitPrice, amount };
      renderTable();
    } catch (err) {
      console.error('[suscripciones] guardar cantidad', err);
      alert('No se pudo guardar el registro. Probá de nuevo.');
    }
  }

  async function onHanOrTrimestreChange() {
    try { await refreshTable(); }
    catch (err) { console.error('[suscripciones] refreshTable', err); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('login-form'); const userInfo = $('user-info');
    const emailSpan = $('user-email'); const roleBadge = $('role-badge');
    const loginBtn = $('googleLoginBtn'); const logoutBtn = $('logoutBtn');

    auth.getRedirectResult().catch(() => {});
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        loginForm?.classList.remove('hidden');
        userInfo?.classList.add('hidden');
        $('accessGuard')?.classList.add('hidden');
        $('suscripcionesPanel')?.classList.add('hidden');
        return;
      }

      const resolved = await resolveRole(user);
      currentRole = resolved.role;
      roleHanIds = resolved.hanIds;

      const email = (user.email ?? '').toLowerCase();
      if (emailSpan) emailSpan.textContent = email;
      if (roleBadge) roleBadge.textContent = currentRole;
      loginForm?.classList.add('hidden');
      userInfo?.classList.remove('hidden');

      const allowed = canSeeSuscripciones(currentRole);
      $('accessGuard')?.classList.toggle('hidden', allowed);
      $('suscripcionesPanel')?.classList.toggle('hidden', !allowed);
      if (!allowed) return;

      try {
        await loadConfig();
        hanes = await loadHanes();
        populateHanSelect();
        populateTrimestreSelect();
        await refreshTable();
      } catch (err) { console.error('[suscripciones] init', err); }
    });

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        const isSafari = /^(?!(chrome|android)).*safari/i.test(navigator.userAgent);
        try { if (isSafari) await auth.signInWithRedirect(provider); else await auth.signInWithPopup(provider); }
        catch { alert('No se pudo iniciar sesión. Intentá de nuevo.'); }
      });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await auth.signOut(); });

    $('hanSelect')?.addEventListener('change', onHanOrTrimestreChange);
    $('trimestreSelect')?.addEventListener('change', onHanOrTrimestreChange);
    $('personaSearch')?.addEventListener('input', renderTable);
    $('estadoFilter')?.addEventListener('change', renderTable);

    $('suscripcionesTable')?.querySelector('tbody')?.addEventListener('change', (e) => {
      const input = e.target.closest('input[type="number"][data-month]');
      if (!input) return;
      const tr = input.closest('tr[data-persona-id]');
      const personaId = tr?.dataset.personaId;
      if (!personaId) return;
      updateCantidad(personaId, input.dataset.month, input.value);
    });
  });
})();
