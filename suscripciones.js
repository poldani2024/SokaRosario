
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
  let subsMap = {}; // { personaId: { 'YYYY-MM': { quantity, paymentStatus, unitPrice, amount } } }

  function formatMoney(n) {
    return `$${Number(n || 0).toLocaleString('es-AR')}`;
  }

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
        const quantity = Number(data.quantity ?? (data.paid ? 1 : 0));
        map[personaId][data.month] = {
          quantity,
          paymentStatus: ['S', 'N', 'C'].includes(data.paymentStatus) ? data.paymentStatus : (quantity > 0 ? 'S' : 'N'),
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

    const totals = [0, 0, 0];

    filtered.forEach((p) => {
      const tr = document.createElement('tr');
      tr.dataset.personaId = p.id;

      const tdName = document.createElement('td');
      tdName.textContent = personaLabel(p);

      const tdEstado = document.createElement('td');
      tdEstado.textContent = p.status || '';

      const personaSubs = subsMap[p.id] || {};
      const cells = t.slots.map((month, slotIdx) => {
        const td = document.createElement('td');
        if (!month) { td.textContent = '—'; return td; }
        const entry = personaSubs[month] || { quantity: 0, paymentStatus: 'N', amount: 0 };
        totals[slotIdx] += entry.amount;

        const wrap = document.createElement('div');
        wrap.className = 'mes-cell';

        const pagoSelect = document.createElement('select');
        pagoSelect.dataset.month = month;
        pagoSelect.dataset.field = 'pago';
        [['S', 'S'], ['N', 'N'], ['C', 'C']].forEach(([value, label]) => {
          const opt = document.createElement('option');
          opt.value = value; opt.textContent = label;
          if (entry.paymentStatus === value) opt.selected = true;
          pagoSelect.appendChild(opt);
        });
        pagoSelect.disabled = !editable;
        pagoSelect.title = 'S = pagó la persona, N = no pagó, C = lo pagó el Canillita';

        const cantidadInput = document.createElement('input');
        cantidadInput.type = 'number';
        cantidadInput.min = '0';
        cantidadInput.step = '1';
        cantidadInput.dataset.month = month;
        cantidadInput.dataset.field = 'cantidad';
        cantidadInput.value = String(entry.quantity);
        cantidadInput.disabled = !editable || entry.paymentStatus === 'N';
        cantidadInput.title = 'Cantidad de suscripciones ese mes';

        const valorSpan = document.createElement('span');
        valorSpan.className = 'valor';
        valorSpan.textContent = formatMoney(entry.amount);

        wrap.append(pagoSelect, cantidadInput, valorSpan);
        td.appendChild(wrap);
        return td;
      });

      const tdBonus = document.createElement('td');
      const allSlotsConfigured = t.slots.every(Boolean);
      const allPaid = allSlotsConfigured && t.slots.every((m) => (personaSubs[m]?.paymentStatus ?? 'N') !== 'N');
      tdBonus.textContent = allSlotsConfigured ? (allPaid ? 'Sí' : 'No') : '—';
      if (allPaid) tdBonus.style.fontWeight = 'bold';

      tr.append(tdName, tdEstado, ...cells, tdBonus);
      tbody.appendChild(tr);
    });

    renderFooterTotals(t, totals);
  }

  function renderFooterTotals(t, totals) {
    const tfoot = $('suscripcionesTable')?.querySelector('tfoot');
    if (!tfoot) return;
    tfoot.innerHTML = '';
    if (!t) return;
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.textContent = 'Total del Han';
    tdLabel.colSpan = 2;
    tr.appendChild(tdLabel);
    t.slots.forEach((month, idx) => {
      const td = document.createElement('td');
      td.textContent = month ? formatMoney(totals[idx]) : '—';
      tr.appendChild(td);
    });
    const tdEmpty = document.createElement('td');
    tr.appendChild(tdEmpty);
    tfoot.appendChild(tr);
  }

  async function updateCelda(personaId, month, field, rawValue) {
    const hanId = $('hanSelect')?.value ?? '';
    if (!hanId || !month) return;
    if (!canEditHan(currentRole, hanId)) return alert('Tu rol no puede registrar pagos para este Han.');

    const current = subsMap[personaId]?.[month] || { quantity: 0, paymentStatus: 'N' };
    let quantity = current.quantity;
    let paymentStatus = current.paymentStatus;

    if (field === 'pago') {
      paymentStatus = ['S', 'N', 'C'].includes(rawValue) ? rawValue : 'N';
      if (paymentStatus === 'N') quantity = 0;
      else if (quantity <= 0) quantity = 1;
    } else {
      quantity = Math.max(0, Math.floor(Number(rawValue) || 0));
      if (quantity === 0) paymentStatus = 'N';
      else if (paymentStatus === 'N') paymentStatus = 'S';
    }

    const unitPrice = Number(monthsById[month] ?? 0);
    const amount = quantity * unitPrice;
    const user = auth.currentUser;
    try {
      await db.collection('subscriptions').doc(`${personaId}__${month}`).set({
        personaId,
        hanId,
        month,
        quantity,
        paymentStatus,
        unitPrice,
        amount,
        registeredBy: user?.uid || '',
        registeredByEmail: (user?.email || '').toLowerCase(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (!subsMap[personaId]) subsMap[personaId] = {};
      subsMap[personaId][month] = { quantity, paymentStatus, unitPrice, amount };
      renderTable();
    } catch (err) {
      console.error('[suscripciones] guardar celda', err);
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
      const el = e.target.closest('[data-month][data-field]');
      if (!el) return;
      const tr = el.closest('tr[data-persona-id]');
      const personaId = tr?.dataset.personaId;
      if (!personaId) return;
      updateCelda(personaId, el.dataset.month, el.dataset.field, el.value);
    });
  });
})();
