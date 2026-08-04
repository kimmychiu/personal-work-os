let editingProjectId = null;
let expandedProjectId = null;

document.addEventListener('DOMContentLoaded', async () => {
  renderNav('projects');
  bindEvents();
  render();
  await initData();
  render();
});

function bindEvents() {
  document.getElementById('addBtn').addEventListener('click', () => openModal());
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('projectModal').addEventListener('click', (e) => { if (e.target.id === 'projectModal') closeModal(); });
  document.getElementById('projectForm').addEventListener('submit', onSubmit);
  document.getElementById('f_useManualProgress').addEventListener('change', toggleManualProgress);
}

function toggleManualProgress() {
  document.getElementById('progressOverrideGroup').classList.toggle('hidden', !document.getElementById('f_useManualProgress').checked);
}

function render() {
  const el = document.getElementById('projectList');
  if (DB.Projects.length === 0) { el.innerHTML = '<div class="empty-state">還沒有任何專案，點右上角新增</div>'; return; }
  el.innerHTML = DB.Projects.map(projectCardHtml).join('');
  bindListEvents(el);
}

function projectCardHtml(p) {
  const progress = getProjectProgress(p);
  const tasks = DB.Tasks.filter(t => t.projectId === p.id);
  const expanded = expandedProjectId === p.id;
  return `
    <div class="card" style="grid-column:${expanded ? '1/-1' : 'auto'}">
      <div class="item-card-top">
        <div>
          <div class="item-title" style="font-size:16px">${escapeHtml(p.name)}</div>
          <div class="item-meta" style="margin-top:4px">
            <span class="badge ${categoryColor(p.category)}">${p.category || '未分類'}</span>
            <span class="badge badge-gray">${p.status || '進行中'}</span>
            <span>負責人：${escapeHtml(p.owner || '未填')}</span>
          </div>
        </div>
        <span class="badge badge-blue" style="cursor:pointer" data-act="toggle" data-id="${p.id}">${expanded ? '收合' : '展開'}</span>
      </div>
      <div style="margin:10px 0">
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
        <div class="item-meta" style="margin-top:4px">
          <span>進度 ${progress}%</span>
          ${p.dueDate ? `<span>預計完成 ${p.dueDate}</span>` : ''}
        </div>
      </div>
      ${expanded ? `
        <div class="form-row" style="margin-top:14px">
          <div>
            <div class="section-title" style="font-size:13px">🎯 目標</div>
            <p style="font-size:13px;white-space:pre-wrap;margin:0 0 12px">${escapeHtml(p.goal || '（未填）')}</p>
            <div class="section-title" style="font-size:13px">🚧 阻礙事項</div>
            <p style="font-size:13px;white-space:pre-wrap;margin:0 0 12px">${escapeHtml(p.blockers || '（無）')}</p>
            <div class="section-title" style="font-size:13px">➡️ 下一步行動</div>
            <p style="font-size:13px;white-space:pre-wrap;margin:0">${escapeHtml(p.nextAction || '（未填）')}</p>
          </div>
          <div>
            <div class="section-title" style="font-size:13px">關聯待辦（${tasks.length}）</div>
            ${tasks.length === 0 ? '<div class="empty-state">尚無關聯待辦</div>' :
              tasks.map(t => `<div class="item-meta" style="padding:4px 0"><span class="badge ${statusColor(t.status)}">${t.status}</span> ${escapeHtml(t.title)}</div>`).join('')}
          </div>
        </div>
      ` : ''}
      <div class="item-actions">
        <button class="btn btn-sm" data-act="edit" data-id="${p.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-act="delete" data-id="${p.id}">刪除</button>
      </div>
    </div>
  `;
}

function bindListEvents(el) {
  el.querySelectorAll('[data-act="toggle"]').forEach(b => b.addEventListener('click', () => {
    expandedProjectId = expandedProjectId === b.dataset.id ? null : b.dataset.id;
    render();
  }));
  el.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.id)));
  el.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('確定要刪除這個專案嗎？（不會刪除已連結的待辦事項）')) return;
    try { await apiDelete('Projects', b.dataset.id); render(); toast('已刪除'); }
    catch (e) { toast('刪除失敗：' + e.message, true); }
  }));
}

function openModal(id) {
  editingProjectId = id || null;
  const cats = getAllCategories();
  document.getElementById('f_category').innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  const p = id ? getProjectById(id) : {};
  document.getElementById('modalTitle').textContent = id ? '編輯專案' : '新增專案';
  document.getElementById('f_name').value = p.name || '';
  document.getElementById('f_category').value = p.category || cats[0];
  document.getElementById('f_owner').value = p.owner || '';
  document.getElementById('f_goal').value = p.goal || '';
  document.getElementById('f_startDate').value = p.startDate || '';
  document.getElementById('f_dueDate').value = p.dueDate || '';
  document.getElementById('f_status').value = p.status || '進行中';
  document.getElementById('f_blockers').value = p.blockers || '';
  document.getElementById('f_nextAction').value = p.nextAction || '';
  document.getElementById('f_useManualProgress').checked = !!p.useManualProgress;
  document.getElementById('f_progressOverride').value = p.progressOverride || 0;
  toggleManualProgress();
  document.getElementById('projectModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('projectModal').classList.add('hidden'); }

async function onSubmit(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('f_name').value.trim(),
    category: document.getElementById('f_category').value,
    owner: document.getElementById('f_owner').value.trim(),
    goal: document.getElementById('f_goal').value.trim(),
    startDate: document.getElementById('f_startDate').value,
    dueDate: document.getElementById('f_dueDate').value,
    status: document.getElementById('f_status').value,
    blockers: document.getElementById('f_blockers').value.trim(),
    nextAction: document.getElementById('f_nextAction').value.trim(),
    useManualProgress: document.getElementById('f_useManualProgress').checked,
    progressOverride: Number(document.getElementById('f_progressOverride').value) || 0
  };
  if (!data.name) { toast('請輸入專案名稱', true); return; }
  try {
    if (editingProjectId) await apiUpdate('Projects', editingProjectId, data);
    else await apiCreate('Projects', data);
    closeModal();
    render();
    toast('已儲存');
  } catch (err) { toast('儲存失敗：' + err.message, true); }
}
