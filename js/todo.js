let currentCategory = '全部';
let currentStatus = '全部';
let currentSort = 'dueDate';
let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  renderNav('todo');
  buildCategoryTabs();
  buildStatusFilter();
  bindFormEvents();
  renderList();
  await initData();
  buildCategoryTabs();
  renderList();
  refreshProjectOptions();
});

function buildCategoryTabs() {
  const el = document.getElementById('categoryTabs');
  const cats = ['全部', ...getAllCategories()];
  el.innerHTML = cats.map(c => `<div class="tab ${c === currentCategory ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</div>`).join('');
  el.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    currentCategory = t.dataset.cat;
    buildCategoryTabs();
    renderList();
  }));
}

function buildStatusFilter() {
  const sel = document.getElementById('statusFilter');
  sel.innerHTML = ['全部', ...STATUSES].map(s => `<option value="${s}">${s}</option>`).join('');
  sel.addEventListener('change', () => { currentStatus = sel.value; renderList(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { currentSort = e.target.value; renderList(); });
  document.getElementById('addBtn').addEventListener('click', () => openModal());
}

function getFiltered() {
  let list = DB.Tasks.slice();
  if (currentCategory !== '全部') list = list.filter(t => t.category === currentCategory);
  if (currentStatus !== '全部') list = list.filter(t => t.status === currentStatus);
  const sorters = {
    dueDate: (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
    priority: (a, b) => ({ 高: 0, 中: 1, 低: 2 }[a.priority] - { 高: 0, 中: 1, 低: 2 }[b.priority]),
    createdAt: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  };
  list.sort(sorters[currentSort]);
  return list;
}

function renderList() {
  const list = getFiltered();
  const el = document.getElementById('todoList');
  if (list.length === 0) { el.innerHTML = '<div class="empty-state">沒有符合條件的待辦事項</div>'; return; }
  el.innerHTML = list.map(t => `
    <div class="card item-card">
      <div class="item-card-top">
        <div style="display:flex;gap:10px;align-items:flex-start;flex:1">
          <span class="checkbox-round ${t.status === '完成' ? 'checked' : ''}" data-act="toggle" data-id="${t.id}">${t.status === '完成' ? '✓' : ''}</span>
          <div>
            <div class="item-title ${t.status === '完成' ? 'done' : ''}">${escapeHtml(t.title)}</div>
            <div class="item-meta">
              <span class="badge ${categoryColor(t.category)}">${t.category}</span>
              <span class="badge ${priorityColor(t.priority)}">${t.priority}</span>
              <span class="badge ${statusColor(t.status)}">${t.status}</span>
              ${t.dueDate ? `<span>到期 ${t.dueDate}</span>` : ''}
              ${t.estimatedHours ? `<span>預估 ${t.estimatedHours}h</span>` : ''}
              ${t.projectId ? `<span class="badge badge-purple">${escapeHtml((getProjectById(t.projectId) || {}).name || '未知專案')}</span>` : ''}
            </div>
            ${t.status === '等待' ? `<div class="item-meta" style="margin-top:4px"><span>等待對象：${escapeHtml(t.waitingOn || '未填')}</span></div>` : ''}
          </div>
        </div>
        <span class="badge ${t.mitDate === todayStr() ? 'badge-blue' : 'badge-gray'}" style="cursor:pointer" data-act="mit" data-id="${t.id}">${t.mitDate === todayStr() ? '★ 今日MIT' : '設為MIT'}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" data-act="edit" data-id="${t.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-act="delete" data-id="${t.id}">刪除</button>
      </div>
    </div>
  `).join('');
  bindListEvents(el);
}

function bindListEvents(el) {
  el.querySelectorAll('[data-act="toggle"]').forEach(b => b.addEventListener('click', async () => {
    const t = getTaskById(b.dataset.id);
    const done = t.status !== '完成';
    try {
      await apiUpdate('Tasks', t.id, { status: done ? '完成' : '進行中', completedDate: done ? todayStr() : '' });
      renderList();
    } catch (e) { toast('更新失敗：' + e.message, true); }
  }));
  el.querySelectorAll('[data-act="mit"]').forEach(b => b.addEventListener('click', async () => {
    const t = getTaskById(b.dataset.id);
    const isMit = t.mitDate === todayStr();
    if (!isMit && getTodayMIT().length >= 3) { toast('今日 MIT 已滿 3 件，請先取消一件', true); return; }
    try {
      await apiUpdate('Tasks', t.id, { mitDate: isMit ? '' : todayStr() });
      renderList();
      toast(isMit ? '已取消 MIT' : '已設為今日 MIT');
    } catch (e) { toast('更新失敗：' + e.message, true); }
  }));
  el.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.id)));
  el.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('確定要刪除這個待辦事項嗎？')) return;
    try { await apiDelete('Tasks', b.dataset.id); renderList(); toast('已刪除'); }
    catch (e) { toast('刪除失敗：' + e.message, true); }
  }));
}

function refreshProjectOptions() {
  const sel = document.getElementById('f_projectId');
  sel.innerHTML = '<option value="">（不屬於特定專案）</option>' +
    DB.Projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

function openModal(id) {
  editingId = id || null;
  refreshProjectOptions();
  const cats = getAllCategories();
  document.getElementById('f_category').innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  const t = id ? getTaskById(id) : {};
  document.getElementById('modalTitle').textContent = id ? '編輯待辦事項' : '新增待辦事項';
  document.getElementById('f_title').value = t.title || '';
  document.getElementById('f_category').value = t.category || cats[0];
  document.getElementById('f_projectId').value = t.projectId || '';
  document.getElementById('f_priority').value = t.priority || '中';
  document.getElementById('f_status').value = t.status || '未開始';
  document.getElementById('f_dueDate').value = t.dueDate || '';
  document.getElementById('f_estimatedHours').value = t.estimatedHours || '';
  document.getElementById('f_waitingOn').value = t.waitingOn || '';
  document.getElementById('f_note').value = t.note || '';
  toggleWaitingField();
  document.getElementById('todoModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('todoModal').classList.add('hidden'); }

function toggleWaitingField() {
  const show = document.getElementById('f_status').value === '等待';
  document.getElementById('waitingGroup').classList.toggle('hidden', !show);
}

function bindFormEvents() {
  document.getElementById('f_status').addEventListener('change', toggleWaitingField);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('todoModal').addEventListener('click', (e) => { if (e.target.id === 'todoModal') closeModal(); });
  document.getElementById('todoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('f_status').value;
    const prevTask = editingId ? getTaskById(editingId) : null;
    const data = {
      title: document.getElementById('f_title').value.trim(),
      category: document.getElementById('f_category').value,
      projectId: document.getElementById('f_projectId').value,
      priority: document.getElementById('f_priority').value,
      status,
      dueDate: document.getElementById('f_dueDate').value,
      estimatedHours: Number(document.getElementById('f_estimatedHours').value) || 0,
      waitingOn: status === '等待' ? document.getElementById('f_waitingOn').value.trim() : '',
      waitingSince: status === '等待' ? ((prevTask && prevTask.status === '等待') ? prevTask.waitingSince : todayStr()) : '',
      note: document.getElementById('f_note').value.trim(),
      completedDate: status === '完成' ? (prevTask && prevTask.completedDate) || todayStr() : ''
    };
    if (!data.title) { toast('請輸入標題', true); return; }
    try {
      if (editingId) await apiUpdate('Tasks', editingId, data);
      else await apiCreate('Tasks', data);
      closeModal();
      renderList();
      toast('已儲存');
    } catch (e) { toast('儲存失敗：' + e.message, true); }
  });
}
