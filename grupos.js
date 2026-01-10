
(function () {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEYS = { grupos: 'soka_grupos' };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  let grupos = [];
  let editGrupoId = null;

  function loadGruposLS() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.grupos) ?? '[]'); } catch { return []; } }
  function saveGruposLS(list){ localStorage.setItem(STORAGE_KEYS.grupos, JSON.stringify(list ?? [])); }

  async function loadGruposFS() { if (!window.db) return null; const snap = await db.collection('grupos').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  async function saveGrupoFS({ id, name, leader }) {
    if (!window.db) return null; const coll = db.collection('grupos');
    if (id) { await coll.doc(id).set({ name, leader }, { merge: true }); return id; }
    const docRef = await coll.add({ name, leader }); return docRef.id;
  }
  async function deleteGrupoFS(id){ if (!window.db) return null; await db.collection('grupos').doc(id).delete(); return true; }

  function renderEmptyState(list) {
    const empty = $('gruposEmpty'); const table = $('gruposTable');
    const hasData = Array.isArray(list) && list.length > 0;
    if (empty) empty.classList.toggle('hidden', hasData);
    if (table) table.classList.toggle('hidden', !hasData);
  }

  async function loadAndRenderGrupos() {
    try { const fsList = await loadGruposFS(); grupos = Array.isArray(fsList) ? fsList : loadGruposLS(); if (Array.isArray(fsList)) saveGruposLS(grupos); }
    catch (err) { console.warn('[grupos] Firestore no disponible, usando localStorage.', err); grupos = loadGruposLS(); }
    renderGruposTable();
  }

  function renderGruposTable() {
    const tbody = $('gruposTable')?.querySelector('tbody'); if (!tbody) return;
    const q = ($('grupoSearch')?.value ?? '').toLowerCase().trim();
    const filtered = (grupos ?? []).filter(g => { const txt = `${g.name ?? ''} ${g.leader ?? ''}`.toLowerCase(); return !q || txt.includes(q); });

    renderEmptyState(filtered);
    tbody.innerHTML = '';
    filtered.forEach(g => {
      const tr = document.createElement('tr'); tr.dataset.id = g.id;
      tr.innerHTML = `
        <td>${g.name ?? ''}</td>
        <td>${g.leader ?? ''}</td>
        <td class="actions">
          <button data-action="edit" data-id="${g.id}">Editar</button>
          <button data-action="delete" data-id="${g.id}">Eliminar</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function formValues(){ return { name: $('grupoNameInput')?.value?.trim() ?? '', leader: $('grupoLeaderInput')?.value?.trim() ?? '' }; }
  function clearForm(){ ['grupoNameInput','grupoLeaderInput'].forEach(id => { const el=$(id); if(el) el.value=''; }); editGrupoId=null; $('grupoSaveBtn')?.textContent && ($('grupoSaveBtn').textContent='Guardar Grupo'); }

  async function onSaveGrupo() {
    if (!window.auth?.currentUser) { alert('Ingresá con Google primero.'); return; }
    const vals = formValues(); if (!vals.name) { alert('Ingresá el nombre del Grupo.'); $('grupoNameInput')?.focus(); return; }
    try {
      let savedId = null; if (window.db) savedId = await saveGrupoFS({ id: editGrupoId, ...vals });
      if (!savedId) { let list = loadGruposLS(); if (editGrupoId) {
          const i = list.findIndex(g => g.id === editGrupoId);
          if (i >= 0) list[i] = { ...list[i], ...vals }; else list.push({ id: editGrupoId, ...vals });
        } else { list.push({ id: uid(), ...vals }); editGrupoId = list[list.length - 1].id; }
        saveGruposLS(list);
      }
      await loadAndRenderGrupos(); clearForm(); alert('Grupo guardado ✅');
    } catch (err) { console.error('[grupos] Error al guardar', err); alert('No se pudo guardar el Grupo.'); }
  }
  function onCancelEdit(){ clearForm(); }

  function onEditGrupo(id) {
    const g = (grupos ?? []).find(x => x.id === id); if (!g) return; editGrupoId = id;
    $('grupoNameInput').value   = g.name   ?? '';
    $('grupoLeaderInput').value = g.leader ?? '';
    $('grupoSaveBtn').textContent = 'Actualizar Grupo';
  }
  async function onDeleteGrupo(id) {
    if (!confirm('¿Eliminar este Grupo?')) return;
    try { if (window.db) await deleteGrupoFS(id); const list = loadGruposLS().filter(g => g.id !== id); saveGruposLS(list); await loadAndRenderGrupos(); }
    catch (err) { console.error('[grupos] Error al eliminar', err); alert('No se pudo eliminar el Grupo.'); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAndRenderGrupos(); $('grupoSearch')?.addEventListener('input', renderGruposTable);
    $('grupoSaveBtn') ?.addEventListener('click', onSaveGrupo);
    $('grupoCancelBtn')?.addEventListener('click', onCancelEdit);

    const tbody = $('gruposTable')?.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (btn) { const id = btn.dataset.id; const action = btn.dataset.action; if (action === 'edit') onEditGrupo(id); if (action === 'delete') onDeleteGrupo(id); return; }
        const tr = e.target.closest('tr[data-id]'); if (tr?.dataset?.id) onEditGrupo(tr.dataset.id);
      });
    }
  });
})();
