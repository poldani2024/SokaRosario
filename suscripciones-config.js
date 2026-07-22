
// suscripciones-config.js — Config del ciclo trimestral y costo mensual (solo Admin)
(function () {
  const $ = (id) => document.getElementById(id);
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);

  let currentRole = 'Usuario';
  let anchorMonth = '';
  let months = []; // [{ id: 'YYYY-MM', price: number }]

  function isValidMonthKey(key) { return /^\d{4}-\d{2}$/.test(String(key ?? '')); }

  function monthLabel(key) {
    if (!isValidMonthKey(key)) return '';
    const [y, m] = key.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  function addMonthsToKey(key, n) {
    const [y, m] = key.split('-').map(Number);
    const total = (y * 12 + (m - 1)) + n;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${String(nm).padStart(2, '0')}`;
  }

  function monthDiff(fromKey, toKey) {
    const [fy, fm] = fromKey.split('-').map(Number);
    const [ty, tm] = toKey.split('-').map(Number);
    return (ty * 12 + (tm - 1)) - (fy * 12 + (fm - 1));
  }

  function trimesterPositionLabel(key) {
    if (!isValidMonthKey(anchorMonth) || !isValidMonthKey(key)) return '';
    const diff = monthDiff(anchorMonth, key);
    if (diff < 0) return '';
    const pos = ((diff % 3) + 3) % 3;
    if (pos === 2) return 'Mes 3 (+ Humanismo Soka)';
    return `Mes ${pos + 1}`;
  }

  async function resolveRole(user) {
    if (!user) return 'Usuario';
    const email = (user.email || '').toLowerCase();
    let role = ADMIN_EMAILS.has(email) ? 'Admin' : 'Usuario';
    try {
      const token = await user.getIdTokenResult();
      const claimRole = String(token?.claims?.role || '').trim();
      if (claimRole) role = claimRole;
    } catch (err) { console.warn('[suscripciones-config] claims', err?.message || err); }
    try {
      const snap = await db.collection('roles').doc(user.uid).get();
      if (snap.exists) {
        const docRole = String(snap.data()?.role || '').trim();
        if (docRole) role = docRole;
      }
    } catch (err) { console.warn('[suscripciones-config] roles/{uid}', err?.message || err); }
    if (ADMIN_EMAILS.has(email)) role = 'Admin';
    return role;
  }

  async function loadAnchorMonth() {
    const snap = await db.collection('subscriptionConfig').doc('meta').get();
    anchorMonth = snap.exists ? String(snap.data()?.anchorMonth || '') : '';
    $('anchorMonthInput').value = anchorMonth;
  }

  async function loadMonths() {
    const snap = await db.collection('subscriptionMonths').get();
    months = snap.docs
      .map((d) => ({ id: d.id, price: Number(d.data()?.price ?? 0) }))
      .filter((m) => isValidMonthKey(m.id))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  function renderMonthsTable() {
    const tbody = $('mesesTable')?.querySelector('tbody');
    if (!tbody) return;
    const empty = $('mesesEmpty');
    if (empty) empty.classList.toggle('hidden', months.length > 0);
    tbody.innerHTML = '';
    months.forEach((m) => {
      const tr = document.createElement('tr');
      tr.dataset.id = m.id;

      const tdMes = document.createElement('td');
      tdMes.textContent = `${monthLabel(m.id)} (${m.id})`;

      const tdPos = document.createElement('td');
      tdPos.textContent = trimesterPositionLabel(m.id);

      const tdPrice = document.createElement('td');
      const priceInput = document.createElement('input');
      priceInput.type = 'number';
      priceInput.min = '0';
      priceInput.step = '0.01';
      priceInput.value = String(m.price);
      priceInput.disabled = currentRole !== 'Admin';
      tdPrice.appendChild(priceInput);

      const tdActions = document.createElement('td');
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Guardar';
      saveBtn.className = 'secondary';
      saveBtn.disabled = currentRole !== 'Admin';
      saveBtn.addEventListener('click', () => saveMonthPrice(m.id, priceInput.value));
      tdActions.appendChild(saveBtn);

      tr.append(tdMes, tdPos, tdPrice, tdActions);
      tbody.appendChild(tr);
    });
  }

  async function saveMonthPrice(monthId, rawPrice) {
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) return alert('Ingresá un costo válido.');
    try {
      await db.collection('subscriptionMonths').doc(monthId).set({
        price,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.currentUser?.email || auth.currentUser?.uid || ''
      }, { merge: true });
      await loadMonths();
      renderMonthsTable();
    } catch (err) {
      console.error('[suscripciones-config] guardar mes', err);
      alert('No se pudo guardar el costo del mes.');
    }
  }

  async function addNextMonth() {
    if (!isValidMonthKey(anchorMonth)) return alert('Guardá primero el mes de inicio del ciclo.');
    const lastMonth = months.length ? months[months.length - 1].id : addMonthsToKey(anchorMonth, -1);
    const nextMonth = addMonthsToKey(lastMonth, 1);
    const lastPrice = months.length ? months[months.length - 1].price : 0;
    try {
      await db.collection('subscriptionMonths').doc(nextMonth).set({
        price: lastPrice,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.currentUser?.email || auth.currentUser?.uid || ''
      }, { merge: true });
      await loadMonths();
      renderMonthsTable();
    } catch (err) {
      console.error('[suscripciones-config] agregar mes', err);
      alert('No se pudo agregar el mes.');
    }
  }

  async function saveAnchorMonth() {
    const value = $('anchorMonthInput')?.value ?? '';
    if (!isValidMonthKey(value)) return alert('Elegí un mes válido.');
    try {
      await db.collection('subscriptionConfig').doc('meta').set({
        anchorMonth: value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.currentUser?.email || auth.currentUser?.uid || ''
      }, { merge: true });
      anchorMonth = value;
      $('anchorMsg').textContent = 'Guardado.';
      renderMonthsTable();
    } catch (err) {
      console.error('[suscripciones-config] guardar ancla', err);
      alert('No se pudo guardar el mes de inicio.');
    }
  }

  async function refreshAll() {
    await loadAnchorMonth();
    await loadMonths();
    renderMonthsTable();
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
        $('adminGuard')?.classList.add('hidden');
        $('cicloPanel')?.classList.add('hidden');
        $('mesesPanel')?.classList.add('hidden');
        return;
      }

      currentRole = await resolveRole(user);
      const email = (user.email ?? '').toLowerCase();
      if (emailSpan) emailSpan.textContent = email;
      if (roleBadge) roleBadge.textContent = currentRole;
      loginForm?.classList.add('hidden');
      userInfo?.classList.remove('hidden');

      const isAdmin = currentRole === 'Admin';
      $('adminGuard')?.classList.toggle('hidden', isAdmin);
      $('cicloPanel')?.classList.toggle('hidden', !isAdmin);
      $('mesesPanel')?.classList.toggle('hidden', !isAdmin);

      if (isAdmin) {
        try { await refreshAll(); }
        catch (err) { console.error('[suscripciones-config] refresh', err); }
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
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await auth.signOut(); });

    $('saveAnchorBtn')?.addEventListener('click', saveAnchorMonth);
    $('addMonthBtn')?.addEventListener('click', addNextMonth);
  });
})();
