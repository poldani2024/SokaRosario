/* home.js — dashboard moderno + visibilidad por rol */
(function () {
  const $ = (id) => document.getElementById(id);
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);
  const INVITES_COLLECTION = 'userInvites';
  const STORAGE_KEYS = { hanes: 'soka_hanes', personas: 'soka_personas', stats: 'soka_estadisticas_mensuales' };
  const DIVISION_ORDER = ['DS', 'DD', 'DJM', 'DJF', 'MH', 'Sin división'];
  let divisionDonutChart = null;

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', !!hidden);
  }


  function setAuthenticatedUi(isAuthenticated) {
    setHidden(document.querySelector('main.dashboard'), !isAuthenticated);
    setHidden(document.querySelector('.top-links'), !isAuthenticated);
    setHidden(document.querySelector('#controlBoard'), !isAuthenticated);
  }

  function loadLs(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function normalizeDivision(raw) {
    const v = String(raw || '').trim().toUpperCase();
    return DIVISION_ORDER.includes(v) ? v : 'Sin división';
  }

  function hasAnyCheck(entry) {
    return ['han', 'zadankai', 'filosofiaAccion', 'humanismoSoka', 'zaimu'].some((k) => !!entry?.[k]);
  }

  async function loadDashboardCollections() {
    const result = { hanes: [], personas: [], stats: [] };
    if (window.db) {
      try {
        const [hanesSnap, personasSnap, statsSnap] = await Promise.all([
          db.collection('hanes').get(),
          db.collection('personas').get(),
          db.collection('monthlyStats').get().catch(() => ({ docs: [] })),
        ]);
        result.hanes = hanesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        result.personas = personasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        result.stats = statsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        localStorage.setItem(STORAGE_KEYS.hanes, JSON.stringify(result.hanes));
        localStorage.setItem(STORAGE_KEYS.personas, JSON.stringify(result.personas));
      } catch (err) {
        console.warn('[home] no se pudieron cargar colecciones para tablero:', err);
      }
    }

    if (!result.hanes.length) result.hanes = loadLs(STORAGE_KEYS.hanes, []);
    if (!result.personas.length) result.personas = loadLs(STORAGE_KEYS.personas, []);
    if (!result.stats.length) result.stats = Object.values(loadLs(STORAGE_KEYS.stats, {}));
    return result;
  }

  function latestStatsPeriod(statsList) {
    if (!Array.isArray(statsList) || !statsList.length) return null;
    return statsList.reduce((latest, row) => {
      const y = Number(row?.year || 0);
      const m = Number(row?.month || 0);
      const value = (y * 100) + m;
      if (!latest || value > latest.value) return { year: y, month: m, value };
      return latest;
    }, null);
  }

  function computeDivisionSummary({ personas, stats }) {
    const totalsByDivision = {};
    (personas || []).forEach((p) => {
      const div = normalizeDivision(p?.division);
      totalsByDivision[div] = (totalsByDivision[div] || 0) + 1;
    });

    const period = latestStatsPeriod(stats);
    const activeIds = new Set();
    if (period) {
      (stats || [])
        .filter((s) => Number(s?.year) === period.year && Number(s?.month) === period.month)
        .forEach((snapshot) => {
          (snapshot?.entries || []).forEach((entry) => {
            if (!hasAnyCheck(entry)) return;
            if (entry?.personId) activeIds.add(entry.personId);
          });
        });
    }

    const activeByDivision = {};
    (personas || []).forEach((p) => {
      if (!p?.id || !activeIds.has(p.id)) return;
      const div = normalizeDivision(p?.division);
      activeByDivision[div] = (activeByDivision[div] || 0) + 1;
    });

    const divisions = Array.from(new Set([...Object.keys(totalsByDivision), ...Object.keys(activeByDivision), ...DIVISION_ORDER]));
    divisions.sort((a, b) => DIVISION_ORDER.indexOf(a) - DIVISION_ORDER.indexOf(b));

    return {
      rows: divisions.map((division) => ({
        division,
        total: totalsByDivision[division] || 0,
        active: activeByDivision[division] || 0,
      })),
      period,
    };
  }

  function renderDashboard(summary, totals) {
    $('kpiHanes').textContent = String(totals.hanes || 0);
    $('kpiMiembros').textContent = String(totals.miembros || 0);
    $('kpiPeriodoActivo').textContent = summary.period
      ? `Activos calculados desde Estadísticas ${summary.period.month}/${summary.period.year}`
      : 'Sin datos de Estadísticas para calcular activos';

    const tbody = $('divisionSummaryTable')?.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = '';
      summary.rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.division}</td><td>${row.total}</td><td>${row.active}</td>`;
        tbody.appendChild(tr);
      });
    }

    const canvas = $('divisionDonut');
    if (!canvas || !window.Chart) return;
    const labels = summary.rows.map((row) => row.division);
    const data = summary.rows.map((row) => row.total);
    if (divisionDonutChart) divisionDonutChart.destroy();
    divisionDonutChart = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#1d4ed8', '#0ea5e9', '#14b8a6', '#a855f7', '#f97316', '#94a3b8'],
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
        },
      }
    });
  }

  async function refreshControlBoard() {
    const { hanes, personas, stats } = await loadDashboardCollections();
    const summary = computeDivisionSummary({ personas, stats });
    renderDashboard(summary, { hanes: hanes.length, miembros: personas.length });
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
    refreshControlBoard().catch((err) => console.warn('[home] tablero no disponible:', err));
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

    const signedEmail = (user.email || '').toLowerCase();
    const invitedEmail = inviteEmail;
    if (invitedEmail && invitedEmail !== signedEmail) {
      alert('Ingresaste con un email distinto al invitado. Cerrá sesión e ingresá con el email correcto.');
      return;
    }

    let ref = null;
    let snap = null;
    if (inviteId) {
      ref = db.collection(INVITES_COLLECTION).doc(inviteId);
      snap = await ref.get();
    }

    if (!snap?.exists) {
      const emailSnap = await db.collection(INVITES_COLLECTION)
        .where('email', '==', signedEmail)
        .limit(5)
        .get()
        .catch(() => ({ docs: [] }));
      if (!emailSnap.docs?.length) return;
      const ordered = emailSnap.docs
        .map((d) => ({ id: d.id, data: d.data() || {} }))
        .sort((a, b) => {
          const aMs = a.data?.createdAt?.toMillis?.() || 0;
          const bMs = b.data?.createdAt?.toMillis?.() || 0;
          return bMs - aMs;
        });
      snap = emailSnap.docs.find((d) => ['pending', 'confirmed', 'accepted'].includes(String(d.data()?.status || '').toLowerCase()))
        || (ordered[0] ? emailSnap.docs.find((d) => d.id === ordered[0].id) : null);
      if (!snap) return;
      ref = db.collection(INVITES_COLLECTION).doc(snap.id);
    }
    const data = snap.data() || {};
    if ((data.email || '').toLowerCase() !== signedEmail) return;

    const inviteStatus = String(data.status || '').toLowerCase();
    const isConfirmed = inviteStatus === 'confirmed' || inviteStatus === 'accepted';
    if (!isConfirmed) {
      await ref.set({
        status: 'confirmed',
        confirmedByUid: user.uid,
        confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
        confirmedEmail: signedEmail,
      }, { merge: true });
    }

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
