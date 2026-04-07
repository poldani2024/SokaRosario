(function () {
  const $ = (id) => document.getElementById(id);
  const ROLES = ['Responsable', 'Vice-Responsable'];
  const ADMIN_EMAILS = new Set(['pedro.l.oldani@gmail.com', 'pedro.loldani@gmail.com']);
  const LS_KEY = 'soka_permisos_piramidales_v1';

  const state = {
    role: 'Usuario',
    personas: [],
    personaFilter: '',
    nodes: {},
    rootId: 'root',
    selectedId: 'root',
    memberUi: {
      selectedIndex: -1,
      mode: 'idle', // idle | editing | deleting
    },
  };

  function uid() {
    return `n_${Math.random().toString(36).slice(2, 9)}`;
  }

  function defaultPolicy() {
    return { field: '', responsable: 'ver_editar', viceResponsable: 'solo_ver', inheritance: 'local' };
  }

  function createNode(name, parentId = null) {
    return {
      id: uid(),
      name,
      parentId,
      children: [],
      members: [],
      policies: [defaultPolicy()],
    };
  }

  function bootTree() {
    const root = {
      id: 'root',
      name: 'Organización',
      parentId: null,
      children: [],
      members: [],
      policies: [defaultPolicy()],
    };
    state.nodes = { root };
    state.rootId = 'root';
    state.selectedId = 'root';

    const region = createNode('Región Litoral', 'root');
    state.nodes[region.id] = region;
    root.children.push(region.id);

    const ciudad = createNode('Rosario Centro', region.id);
    state.nodes[ciudad.id] = ciudad;
    region.children.push(ciudad.id);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.nodes || !parsed?.rootId || !parsed?.selectedId) return false;
      state.nodes = parsed.nodes;
      state.rootId = parsed.rootId;
      state.selectedId = parsed.selectedId;
      return true;
    } catch {
      return false;
    }
  }

  function persistLocal() {
    const payload = {
      nodes: state.nodes,
      rootId: state.rootId,
      selectedId: state.selectedId,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }

  function dump(message, data) {
    $('resultBox').textContent = `${message}\n\n${JSON.stringify(data, null, 2)}`;
  }

  function currentNode() {
    return state.nodes[state.selectedId] || state.nodes[state.rootId];
  }

  function renderTree() {
    const root = state.nodes[state.rootId];
    const host = $('treeContainer');
    host.innerHTML = '';

    function renderNode(nodeId) {
      const node = state.nodes[nodeId];
      const li = document.createElement('li');
      li.className = 'tree-li';

      const btn = document.createElement('button');
      btn.className = `node-btn ${nodeId === state.selectedId ? 'active' : ''}`;
      btn.textContent = node.name;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.selectedId = nodeId;
        renderAll();
      });
      li.appendChild(btn);

      if (node.children.length) {
        const ul = document.createElement('ul');
        ul.className = 'tree-ul';
        node.children.forEach((childId) => ul.appendChild(renderNode(childId)));
        li.appendChild(ul);
      }
      return li;
    }

    const ul = document.createElement('ul');
    ul.className = 'tree-ul';
    ul.appendChild(renderNode(root.id));
    host.appendChild(ul);
  }

  function renderNodeDetail() {
    const node = currentNode();
    $('nodeName').value = node.name || '';
    const parentName = node.parentId ? (state.nodes[node.parentId]?.name || '-') : '(sin padre)';
    $('nodeParent').value = parentName;
  }

  function renderPersonas() {
    const sel = $('personaSelect');
    const q = String(state.personaFilter || '').toLowerCase().trim();
    sel.innerHTML = '';
    const filtered = state.personas.filter((p) => {
      if (!q) return true;
      const text = `${p.name || ''} ${p.email || ''}`.toLowerCase();
      return text.includes(q);
    });

    if (!filtered.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = state.personas.length ? 'Sin resultados para la búsqueda' : 'Sin acceso o sin personas cargadas';
      sel.appendChild(opt);
      return;
    }
    filtered.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.email || 'sin email'})`;
      sel.appendChild(opt);
    });
  }

  function divisionFlags(divisionRaw) {
    const division = String(divisionRaw || '').toLowerCase();
    return {
      ds: division.includes('señor') || division.includes('senor') || division === 'ds',
      dd: division.includes('dama') || division === 'dd',
      djm: division.includes('juvenil masculina') || division.includes('joven masculina') || division === 'djm',
      djs: division.includes('juvenil femenina') || division.includes('joven femenina') || division === 'djs',
    };
  }

  function selectedPersona() {
    const personId = $('personaSelect')?.value;
    if (!personId) return null;
    return state.personas.find((p) => p.id === personId) || null;
  }

  function renderMembers() {
    const node = currentNode();
    const host = $('memberList');
    host.innerHTML = '';

    if (!node.members.length) {
      const p = document.createElement('p');
      p.className = 'mini';
      p.textContent = 'Todavía no hay personas asignadas a este nodo.';
      host.appendChild(p);
      renderMemberMode();
      return;
    }

    const table = document.createElement('table');
    table.className = 'member-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Persona</th><th>Rol</th><th>DS</th><th>DD</th><th>DJM</th><th>DJS</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    node.members.forEach((m, idx) => {
      const tr = document.createElement('tr');
      if (idx === state.memberUi.selectedIndex) tr.classList.add('selected');
      tr.addEventListener('click', () => {
        state.memberUi.selectedIndex = idx;
        renderMembers();
      });
      const flags = m.flags || divisionFlags(m.division);
      [m.name || '-', m.role || '-', flags.ds ? '✓' : '', flags.dd ? '✓' : '', flags.djm ? '✓' : '', flags.djs ? '✓' : '']
        .forEach((value) => {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    host.appendChild(table);
    renderMemberMode();
  }

  function renderMemberMode() {
    const modeMsg = $('memberModeMsg');
    if (!modeMsg) return;
    if (state.memberUi.mode === 'editing') {
      modeMsg.textContent = 'Modo modificación: editá persona/rol y confirmá o cancelá.';
    } else if (state.memberUi.mode === 'deleting') {
      modeMsg.textContent = 'Modo eliminación: confirmá para quitar la línea seleccionada o cancelá.';
    } else {
      modeMsg.textContent = 'Seleccioná una fila para modificar o eliminar.';
    }
    const confirmBtn = $('confirmMemberBtn');
    const cancelBtn = $('cancelMemberBtn');
    confirmBtn?.classList.toggle('hidden', state.memberUi.mode === 'idle');
    cancelBtn?.classList.toggle('hidden', state.memberUi.mode === 'idle');
  }

  function policyPermissionSelect(value, onChange) {
    const sel = document.createElement('select');
    const opts = [
      { value: 'ver_editar', label: 'Ver / Editar' },
      { value: 'solo_ver', label: 'Solo ver' },
      { value: 'sin_acceso', label: 'Sin acceso' },
    ];
    opts.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    });
    sel.value = value || 'sin_acceso';
    sel.addEventListener('change', onChange);
    return sel;
  }

  function renderPolicies() {
    const node = currentNode();
    const tbody = $('policyTable').querySelector('tbody');
    tbody.innerHTML = '';

    node.policies.forEach((p, idx) => {
      const tr = document.createElement('tr');

      const tdField = document.createElement('td');
      const fieldInput = document.createElement('input');
      fieldInput.value = p.field || '';
      fieldInput.placeholder = 'ej: telefono';
      fieldInput.addEventListener('input', (e) => { p.field = e.target.value; });
      tdField.appendChild(fieldInput);

      const tdRes = document.createElement('td');
      tdRes.appendChild(policyPermissionSelect(p.responsable, (e) => { p.responsable = e.target.value; }));

      const tdVice = document.createElement('td');
      tdVice.appendChild(policyPermissionSelect(p.viceResponsable, (e) => { p.viceResponsable = e.target.value; }));

      const tdInh = document.createElement('td');
      const inhSel = document.createElement('select');
      ['local', 'heredado'].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v === 'local' ? 'Local' : 'Heredado';
        inhSel.appendChild(opt);
      });
      inhSel.value = p.inheritance || 'local';
      inhSel.addEventListener('change', (e) => { p.inheritance = e.target.value; });
      tdInh.appendChild(inhSel);

      const tdAct = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'secondary';
      delBtn.textContent = 'Eliminar';
      delBtn.addEventListener('click', () => {
        node.policies.splice(idx, 1);
        if (!node.policies.length) node.policies.push(defaultPolicy());
        renderPolicies();
      });
      tdAct.appendChild(delBtn);

      tr.append(tdField, tdRes, tdVice, tdInh, tdAct);
      tbody.appendChild(tr);
    });
  }

  function addChildNode() {
    const parent = currentNode();
    const name = prompt('Nombre del nuevo nivel hijo:');
    if (!name) return;
    const child = createNode(name.trim(), parent.id);
    state.nodes[child.id] = child;
    parent.children.push(child.id);
    state.selectedId = child.id;
    persistLocal();
    renderAll();
  }

  function renameNode() {
    const node = currentNode();
    const name = prompt('Nuevo nombre del nodo:', node.name || '');
    if (!name) return;
    node.name = name.trim();
    persistLocal();
    renderAll();
  }

  function deleteNode() {
    const node = currentNode();
    if (node.id === state.rootId) {
      alert('No se puede eliminar el nodo raíz.');
      return;
    }
    if (!confirm(`¿Eliminar nodo "${node.name}" y todos sus hijos?`)) return;

    const parent = state.nodes[node.parentId];
    parent.children = parent.children.filter((id) => id !== node.id);

    function erase(id) {
      const n = state.nodes[id];
      n.children.forEach(erase);
      delete state.nodes[id];
    }
    erase(node.id);

    state.selectedId = parent.id;
    persistLocal();
    renderAll();
  }

  async function saveAllToFirestore() {
    if (!window.db) {
      alert('Firestore no está disponible.');
      return;
    }
    await db.collection('securityConfig').doc('piramidePermisos').set({
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      roles: ROLES,
      tree: {
        rootId: state.rootId,
        nodes: state.nodes,
      },
    }, { merge: true });
    dump('Árbol guardado en securityConfig/piramidePermisos', state.nodes);
  }

  function buildMemberFromSelection() {
    const person = selectedPersona();
    const role = $('personaRoleSelect').value;
    if (!ROLES.includes(role)) {
      alert('Rol inválido.');
      return null;
    }
    if (!person) {
      alert('Seleccioná una persona.');
      return null;
    }
    return {
      personId: person.id,
      role,
      name: person.name,
      email: person.email || '',
      division: person.division || '',
      flags: divisionFlags(person.division),
    };
  }

  function addMember() {
    const node = currentNode();
    const member = buildMemberFromSelection();
    if (!member) return;

    const exists = node.members.some((m) => m.personId === member.personId && m.role === member.role);
    if (exists) {
      alert('Esa persona ya está asignada con ese rol en este nodo.');
      return;
    }

    node.members.push(member);
    state.memberUi.selectedIndex = node.members.length - 1;
    state.memberUi.mode = 'idle';
    persistLocal();
    renderMembers();
  }

  function beginEditMember() {
    const node = currentNode();
    const idx = state.memberUi.selectedIndex;
    if (idx < 0 || idx >= node.members.length) {
      alert('Seleccioná una línea para modificar.');
      return;
    }
    const member = node.members[idx];
    state.memberUi.mode = 'editing';
    $('personaRoleSelect').value = member.role || ROLES[0];
    state.personaFilter = member.name || '';
    if ($('personaSearch')) $('personaSearch').value = state.personaFilter;
    renderPersonas();
    if ($('personaSelect')) $('personaSelect').value = member.personId || '';
    renderMemberMode();
  }

  function beginDeleteMember() {
    const node = currentNode();
    const idx = state.memberUi.selectedIndex;
    if (idx < 0 || idx >= node.members.length) {
      alert('Seleccioná una línea para eliminar.');
      return;
    }
    state.memberUi.mode = 'deleting';
    renderMemberMode();
  }

  function cancelMemberAction() {
    state.memberUi.mode = 'idle';
    renderMemberMode();
  }

  function confirmMemberAction() {
    const node = currentNode();
    const idx = state.memberUi.selectedIndex;
    if (idx < 0 || idx >= node.members.length) {
      alert('Seleccioná una línea válida.');
      return;
    }
    if (state.memberUi.mode === 'editing') {
      const member = buildMemberFromSelection();
      if (!member) return;
      node.members[idx] = member;
    } else if (state.memberUi.mode === 'deleting') {
      node.members.splice(idx, 1);
      state.memberUi.selectedIndex = Math.min(idx, node.members.length - 1);
    }
    state.memberUi.mode = 'idle';
    persistLocal();
    renderMembers();
  }

  function bindEvents() {
    $('addChildBtn').addEventListener('click', addChildNode);
    $('renameNodeBtn').addEventListener('click', renameNode);
    $('deleteNodeBtn').addEventListener('click', deleteNode);

    $('personaSearch')?.addEventListener('input', (e) => {
      state.personaFilter = String(e.target.value || '');
      renderPersonas();
    });

    $('addMemberBtn').addEventListener('click', addMember);
    $('editMemberBtn').addEventListener('click', beginEditMember);
    $('deleteMemberBtn').addEventListener('click', beginDeleteMember);
    $('confirmMemberBtn').addEventListener('click', confirmMemberAction);
    $('cancelMemberBtn').addEventListener('click', cancelMemberAction);

    $('addPolicyBtn').addEventListener('click', () => {
      currentNode().policies.push(defaultPolicy());
      renderPolicies();
    });

    $('nodeName').addEventListener('input', (e) => {
      currentNode().name = e.target.value;
      renderTree();
    });

    $('saveNodeBtn').addEventListener('click', () => {
      persistLocal();
      dump(`Nodo "${currentNode().name}" guardado en LocalStorage`, currentNode());
    });

    $('saveAllBtn').addEventListener('click', async () => {
      try {
        persistLocal();
        await saveAllToFirestore();
      } catch (err) {
        dump('Error al guardar árbol completo', { message: err?.message || String(err) });
      }
    });

    $('logoutBtn')?.addEventListener('click', async () => {
      try { await auth.signOut(); } catch {}
    });
  }

  async function loadPersonas() {
    state.personas = [];
    if (!window.db) return { ok: false, reason: 'db_unavailable' };

    try {
      const snap = await db.collection('personas').limit(300).get();
      state.personas = snap.docs.map((doc) => {
        const d = doc.data() || {};
        const name = [d.firstName, d.lastName].filter(Boolean).join(' ').trim() || d.nombreCompleto || doc.id;
        return { id: doc.id, name, email: d.email || '', division: d.division || '' };
      });
      return { ok: true, count: state.personas.length };
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      const permissionDenied = msg.includes('missing or insufficient permissions') || msg.includes('permission-denied');
      return { ok: false, reason: permissionDenied ? 'permission_denied' : 'unknown', message: err?.message || String(err) };
    }
  }

  async function resolveRole(user) {
    if (!user) return 'Usuario';
    const email = String(user.email || '').toLowerCase();

    try {
      const token = await user.getIdTokenResult(true);
      const claimRole = String(token?.claims?.role || '').trim();
      if (claimRole) return claimRole;
    } catch {}

    try {
      if (window.db) {
        const snap = await db.collection('roles').doc(user.uid).get();
        if (snap.exists) {
          const docRole = String(snap.data()?.role || '').trim();
          if (docRole) return docRole;
        }
      }
    } catch {}

    try {
      const sess = JSON.parse(localStorage.getItem('soka_session') || 'null');
      const sessionRole = String(sess?.role || '').trim();
      if (sessionRole) return sessionRole;
    } catch {}

    return ADMIN_EMAILS.has(email) ? 'Admin' : 'Usuario';
  }

  async function init() {
    bindEvents();

    if (!loadState()) bootTree();

    if (!window.auth) {
      $('guardMsg').textContent = 'Auth no disponible.';
      return;
    }

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        $('guardMsg').textContent = 'Debés iniciar sesión para usar esta pantalla.';
        $('mainPanel').classList.add('hidden');
        return;
      }

      state.role = await resolveRole(user);
      const roleBadge = $('role-badge');
      if (roleBadge) roleBadge.textContent = state.role;
      const isAdmin = state.role === 'Admin';
      if (!isAdmin) {
        $('guardMsg').textContent = `Acceso denegado para rol ${state.role}. Solo Admin puede gestionar esta pantalla.`;
        $('mainPanel').classList.add('hidden');
        return;
      }

      $('guardMsg').textContent = 'Acceso habilitado. Configurá nodos, responsables y políticas.';
      $('mainPanel').classList.remove('hidden');
      const personasResult = await loadPersonas();
      if (!personasResult?.ok && personasResult?.reason === 'permission_denied') {
        dump('No hay permisos para leer personas. No se podrán adicionar responsables hasta habilitar rules.', personasResult);
      } else if (!personasResult?.ok && personasResult?.reason !== 'db_unavailable') {
        dump('No se pudieron cargar personas automáticamente.', personasResult);
      }
      renderAll();
    });
  }

  function renderAll() {
    state.memberUi.selectedIndex = -1;
    state.memberUi.mode = 'idle';
    renderTree();
    renderNodeDetail();
    renderPersonas();
    renderMembers();
    renderPolicies();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
