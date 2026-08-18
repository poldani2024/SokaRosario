
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
  let monthLocks = {}; // { 'YYYY-MM': true si el mes del Han está cerrado }

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
    sel.innerHTML = '<option value="">Seleccionar Han...</option>';
    if (!hanes.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '(sin Hanes asignados)';
      sel.innerHTML = '';
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

  function populateNewPersonaOptions() {
    const hanSelect = $('nuevaPersonaHan');
    const localidadSelect = $('nuevaPersonaLocalidad');
    if (hanSelect) {
      hanSelect.innerHTML = '<option value="">Seleccionar...</option>';
      hanes.forEach((h) => hanSelect.add(new Option(h.name || h.id, h.id)));
    }
    if (localidadSelect) {
      const localidades = new Set();
      hanes.forEach((h) => { if (h.city) localidades.add(String(h.city).trim()); });
      personas.forEach((p) => { if (p.city) localidades.add(String(p.city).trim()); });
      localidadSelect.innerHTML = '<option value="">Seleccionar...</option>';
      Array.from(localidades).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))
        .forEach((city) => localidadSelect.add(new Option(city, city)));
    }
  }

  function toggleNewPersonaForm(show) {
    const form = $('nuevaPersonaForm');
    const modal = $('nuevaPersonaModal');
    if (!form || !modal) return;
    modal.classList.toggle('hidden', !show);
    if (show) {
      populateNewPersonaOptions();
      const needsHan = !$('hanSelect')?.value;
      $('nuevaPersonaHanField')?.classList.toggle('hidden', !needsHan);
      if ($('nuevaPersonaHan')) $('nuevaPersonaHan').required = needsHan;
      const selectedHan = hanes.find((h) => h.id === $('hanSelect')?.value);
      if (selectedHan?.city && $('nuevaPersonaLocalidad')) $('nuevaPersonaLocalidad').value = selectedHan.city;
      $('nuevaPersonaNombre')?.focus();
    } else {
      form.reset();
      if ($('nuevaPersonaMensaje')) $('nuevaPersonaMensaje').textContent = '';
    }
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
          amount: Number(data.amount ?? 0),
          delivered: data.delivered === true,
          comment: String(data.comment ?? '')
        };
      });
    });
    return map;
  }

  async function loadMonthLocks(hanId, monthKeys) {
    const map = {};
    const refs = monthKeys.filter(Boolean).map((month) =>
      db.collection('subscriptionMonthLocks').doc(`${hanId}__${month}`).get()
    );
    const snapshots = await Promise.all(refs);
    snapshots.forEach((snap) => {
      if (snap.exists && snap.data()?.closed === true) map[snap.data().month] = true;
    });
    return map;
  }

  function renderMonthHeader(id, month, editable) {
    const th = $(id);
    if (!th) return;
    th.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'mes-header';
    const label = document.createElement('span');
    label.textContent = month ? monthLabel(month) : 'Mes';
    wrap.appendChild(label);
    if (month) {
      const closed = monthLocks[month] === true;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mes-lock-btn${closed ? ' cerrado' : ''}`;
      button.dataset.action = 'month-lock';
      button.dataset.month = month;
      button.textContent = closed ? '🔒 Cerrado' : '🔓 Abierto';
      button.title = closed ? 'Abrir este mes para permitir modificaciones' : 'Cerrar este mes para evitar modificaciones';
      button.disabled = !editable;
      wrap.appendChild(button);
    }
    th.appendChild(wrap);
  }

  async function refreshTable() {
    const hanId = $('hanSelect')?.value ?? '';
    const t = currentTrimester();
    const tbody = $('suscripcionesTable')?.querySelector('tbody');
    const table = $('suscripcionesTable');
    if (!tbody) return;

    const canAdd = currentRole === 'Admin' || (currentRole === 'Canillita' && hanes.some((h) => canEditHan(currentRole, h.id)));
    $('mostrarNuevaPersonaBtn')?.classList.toggle('hidden', !canAdd);

    if (!hanId || !t) {
      monthLocks = {};
      renderMonthHeader('mes1Header', t?.slots[0], false);
      renderMonthHeader('mes2Header', t?.slots[1], false);
      renderMonthHeader('mes3Header', t?.slots[2], false);
      tbody.innerHTML = '';
      $('suscripcionesEmpty')?.classList.remove('hidden');
      if (table) table.classList.add('hidden');
      return;
    }

    [personas, subsMap, monthLocks] = await Promise.all([
      loadPersonasForHan(hanId),
      loadSubscriptions(hanId, t.slots),
      loadMonthLocks(hanId, t.slots)
    ]);
    populateNewPersonaOptions();
    renderTable();
  }

  async function createPersona(e) {
    e.preventDefault();
    let hanId = $('hanSelect')?.value || '';
    if (!hanId) hanId = $('nuevaPersonaHan')?.value || '';
    if (!hanId) {
      $('nuevaPersonaHanField')?.classList.remove('hidden');
      if ($('nuevaPersonaHan')) $('nuevaPersonaHan').required = true;
      return alert('Seleccioná el Han al que pertenece la persona.');
    }
    if (!canEditHan(currentRole, hanId)) return alert('Tu rol no puede agregar personas a este Han.');

    const han = hanes.find((h) => h.id === hanId);
    const firstName = $('nuevaPersonaNombre')?.value.trim() || '';
    const lastName = $('nuevaPersonaApellido')?.value.trim() || '';
    if (!firstName || !lastName) return alert('Completá el nombre y el apellido.');

    const button = $('confirmarNuevaPersonaBtn');
    const message = $('nuevaPersonaMensaje');
    if (button) button.disabled = true;
    if (message) message.textContent = 'Guardando persona...';
    try {
      const user = auth.currentUser;
      const ref = db.collection('personas').doc();
      const nueva = {
        firstName,
        lastName,
        address: $('nuevaPersonaDomicilio')?.value.trim() || '',
        city: $('nuevaPersonaLocalidad')?.value || '',
        division: $('nuevaPersonaDivision')?.value || '',
        status: $('nuevaPersonaEstado')?.value || 'Miembro',
        hanId,
        hanName: han?.name || '',
        hanCity: han?.city || '',
        hanSector: han?.sector || '',
        uid: user?.uid || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await ref.set(nueva);
      if ($('hanSelect') && $('hanSelect').value !== hanId) $('hanSelect').value = hanId;
      toggleNewPersonaForm(false);
      await refreshTable();
      alert('Persona agregada correctamente.');
    } catch (err) {
      console.error('[suscripciones] crear persona', err);
      if (message) message.textContent = 'No se pudo guardar la persona.';
      alert('No se pudo guardar la persona. Probá de nuevo.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderTable() {
    const hanId = $('hanSelect')?.value ?? '';
    const t = currentTrimester();
    const tbody = $('suscripcionesTable')?.querySelector('tbody');
    const table = $('suscripcionesTable');
    if (!tbody || !t) return;

    const editable = canEditHan(currentRole, hanId);
    renderMonthHeader('mes1Header', t.slots[0], editable);
    renderMonthHeader('mes2Header', t.slots[1], editable);
    renderMonthHeader('mes3Header', t.slots[2], editable);
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
        const entry = personaSubs[month] || { quantity: 0, paymentStatus: 'N', amount: 0, delivered: false, comment: '' };
        const monthClosed = monthLocks[month] === true;
        totals[slotIdx] += entry.amount;
        td.classList.toggle('revista-entregada', entry.delivered);
        td.classList.toggle('mes-cerrado', monthClosed);

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
        pagoSelect.disabled = !editable || monthClosed;
        pagoSelect.title = 'S = pagó la persona, N = no pagó, C = lo pagó el Canillita';

        const cantidadInput = document.createElement('input');
        cantidadInput.type = 'number';
        cantidadInput.min = '0';
        cantidadInput.step = '1';
        cantidadInput.dataset.month = month;
        cantidadInput.dataset.field = 'cantidad';
        cantidadInput.value = String(entry.quantity);
        cantidadInput.disabled = !editable || monthClosed || entry.paymentStatus === 'N';
        cantidadInput.title = 'Cantidad de suscripciones ese mes';

        const valorSpan = document.createElement('span');
        valorSpan.className = 'valor';
        valorSpan.textContent = formatMoney(entry.amount);

        const entregaBtn = document.createElement('button');
        entregaBtn.type = 'button';
        entregaBtn.className = 'entrega-btn';
        entregaBtn.dataset.action = 'delivery';
        entregaBtn.dataset.month = month;
        entregaBtn.setAttribute('aria-pressed', String(entry.delivered));
        entregaBtn.setAttribute('aria-label', entry.delivered ? 'Marcar revista como no entregada' : 'Marcar revista como entregada');
        entregaBtn.title = entry.delivered ? 'Revista entregada. Presioná para desmarcar.' : 'Marcar revista como entregada';
        entregaBtn.textContent = entry.delivered ? '✓📖' : '📖';
        entregaBtn.disabled = !editable || monthClosed || entry.paymentStatus === 'N' || entry.quantity <= 0;

        const comentarioBtn = document.createElement('button');
        comentarioBtn.type = 'button';
        comentarioBtn.className = `comentario-btn${entry.comment.trim() ? ' con-comentario' : ''}`;
        comentarioBtn.dataset.action = 'comment';
        comentarioBtn.dataset.month = month;
        comentarioBtn.setAttribute('aria-label', entry.comment.trim() ? 'Ver o editar comentario' : 'Agregar comentario');
        comentarioBtn.title = entry.comment.trim() ? `Comentario: ${entry.comment}` : 'Agregar comentario';
        comentarioBtn.textContent = '💬';

        wrap.append(pagoSelect, cantidadInput, valorSpan, entregaBtn, comentarioBtn);
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
    if (monthLocks[month]) return alert('Este mes está cerrado. Abrilo antes de realizar modificaciones.');

    const current = subsMap[personaId]?.[month] || { quantity: 0, paymentStatus: 'N' };
    let quantity = current.quantity;
    let paymentStatus = current.paymentStatus;
    let delivered = current.delivered === true;
    const comment = String(current.comment ?? '');

    if (field === 'pago') {
      paymentStatus = ['S', 'N', 'C'].includes(rawValue) ? rawValue : 'N';
      if (paymentStatus === 'N') { quantity = 0; delivered = false; }
      else if (quantity <= 0) quantity = 1;
    } else {
      quantity = Math.max(0, Math.floor(Number(rawValue) || 0));
      if (quantity === 0) { paymentStatus = 'N'; delivered = false; }
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
        delivered,
        registeredBy: user?.uid || '',
        registeredByEmail: (user?.email || '').toLowerCase(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (!subsMap[personaId]) subsMap[personaId] = {};
      subsMap[personaId][month] = { quantity, paymentStatus, unitPrice, amount, delivered, comment };
      renderTable();
    } catch (err) {
      console.error('[suscripciones] guardar celda', err);
      alert('No se pudo guardar el registro. Probá de nuevo.');
    }
  }

  async function toggleDelivery(personaId, month, button) {
    const hanId = $('hanSelect')?.value ?? '';
    if (!hanId || !month) return;
    if (!canEditHan(currentRole, hanId)) return alert('Tu rol no puede registrar entregas para este Han.');
    if (monthLocks[month]) return alert('Este mes está cerrado. Abrilo antes de modificar la entrega.');

    const current = subsMap[personaId]?.[month];
    if (!current || current.paymentStatus === 'N' || current.quantity <= 0) {
      return alert('Primero registrá el pago y la cantidad de revistas de este mes.');
    }

    const delivered = current.delivered !== true;
    const user = auth.currentUser;
    if (button) button.disabled = true;
    try {
      await db.collection('subscriptions').doc(`${personaId}__${month}`).set({
        personaId,
        hanId,
        month,
        delivered,
        deliveredAt: delivered ? firebase.firestore.FieldValue.serverTimestamp() : null,
        deliveredBy: delivered ? (user?.uid || '') : '',
        deliveredByEmail: delivered ? (user?.email || '').toLowerCase() : '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      current.delivered = delivered;
      renderTable();
    } catch (err) {
      console.error('[suscripciones] registrar entrega', err);
      alert('No se pudo actualizar la entrega. Probá de nuevo.');
      if (button) button.disabled = false;
    }
  }

  async function editComment(personaId, month) {
    const hanId = $('hanSelect')?.value ?? '';
    if (!hanId || !month) return;
    const current = subsMap[personaId]?.[month] || { comment: '' };
    const existing = String(current.comment ?? '');

    if (!canEditHan(currentRole, hanId)) {
      return alert(existing || 'Esta celda no tiene comentarios.');
    }
    if (monthLocks[month]) return alert(existing || 'Esta celda no tiene comentarios.');

    const result = prompt('Comentario de la suscripción del mes (dejalo vacío para eliminarlo):', existing);
    if (result === null) return;
    const comment = result.trim();
    if (comment.length > 1000) return alert('El comentario no puede superar los 1000 caracteres.');

    const user = auth.currentUser;
    try {
      await db.collection('subscriptions').doc(`${personaId}__${month}`).set({
        personaId,
        hanId,
        month,
        comment,
        commentUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        commentUpdatedBy: user?.uid || '',
        commentUpdatedByEmail: (user?.email || '').toLowerCase(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      if (!subsMap[personaId]) subsMap[personaId] = {};
      subsMap[personaId][month] = { ...(subsMap[personaId][month] || {}), comment };
      renderTable();
    } catch (err) {
      console.error('[suscripciones] guardar comentario', err);
      alert('No se pudo guardar el comentario. Probá de nuevo.');
    }
  }

  async function toggleMonthLock(month, button) {
    const hanId = $('hanSelect')?.value ?? '';
    if (!hanId || !month) return;
    if (!canEditHan(currentRole, hanId)) return alert('Tu rol no puede cerrar o abrir meses para este Han.');
    const closed = monthLocks[month] !== true;
    const action = closed ? 'cerrar' : 'abrir';
    if (!confirm(`¿Querés ${action} ${monthLabel(month)} para este Han?`)) return;
    if (button) button.disabled = true;
    const user = auth.currentUser;
    try {
      await db.collection('subscriptionMonthLocks').doc(`${hanId}__${month}`).set({
        hanId,
        month,
        closed,
        updatedBy: user?.uid || '',
        updatedByEmail: (user?.email || '').toLowerCase(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      monthLocks[month] = closed;
      renderTable();
    } catch (err) {
      console.error('[suscripciones] cerrar/abrir mes', err);
      alert('No se pudo cambiar el estado del mes. Probá de nuevo.');
      if (button) button.disabled = false;
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
        populateNewPersonaOptions();
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
    $('mostrarNuevaPersonaBtn')?.addEventListener('click', () => toggleNewPersonaForm(true));
    $('cancelarNuevaPersonaBtn')?.addEventListener('click', () => toggleNewPersonaForm(false));
    $('nuevaPersonaForm')?.addEventListener('submit', createPersona);
    $('nuevaPersonaHan')?.addEventListener('change', (e) => {
      const han = hanes.find((h) => h.id === e.target.value);
      if (han?.city && $('nuevaPersonaLocalidad')) $('nuevaPersonaLocalidad').value = han.city;
    });
    $('nuevaPersonaModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) toggleNewPersonaForm(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('nuevaPersonaModal')?.classList.contains('hidden')) toggleNewPersonaForm(false);
    });

    $('suscripcionesTable')?.querySelector('tbody')?.addEventListener('change', (e) => {
      const el = e.target.closest('[data-month][data-field]');
      if (!el) return;
      const tr = el.closest('tr[data-persona-id]');
      const personaId = tr?.dataset.personaId;
      if (!personaId) return;
      updateCelda(personaId, el.dataset.month, el.dataset.field, el.value);
    });
    $('suscripcionesTable')?.querySelector('tbody')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action][data-month]');
      if (!button) return;
      const personaId = button.closest('tr[data-persona-id]')?.dataset.personaId;
      if (!personaId) return;
      if (button.dataset.action === 'delivery') toggleDelivery(personaId, button.dataset.month, button);
      if (button.dataset.action === 'comment') editComment(personaId, button.dataset.month);
    });
    $('suscripcionesTable')?.querySelector('thead')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action="month-lock"][data-month]');
      if (button) toggleMonthLock(button.dataset.month, button);
    });
  });
})();
