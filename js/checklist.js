const CHECKLIST_STATUSES = ['待處理', '待回覆', '已完成'];
let currentChecklistStatus = '全部';
let editingChecklistId = null;

document.addEventListener('DOMContentLoaded', async () => {
  renderNav('checklist');
  document.getElementById('f_status').innerHTML = CHECKLIST_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('');
  buildStatusTabs();
  bindEvents();
  render();
  await initData();
  render();
});

function checklistStatusColor(s) {
  return { 待處理: 'badge-gray', 待回覆: 'badge-orange', 已完成: 'badge-green' }[s] || 'badge-gray';
}

function buildStatusTabs() {
  const el = document.getElementById('statusTabs');
  const tabs = ['全部', ...CHECKLIST_STATUSES];
  el.innerHTML = tabs.map(s => `<div class="tab ${s === currentChecklistStatus ? 'active' : ''}" data-s="${s}">${s}</div>`).join('');
  el.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    currentChecklistStatus = t.dataset.s;
    buildStatusTabs();
    render();
  }));
}

function bindEvents() {
  document.getElementById('addBtn').addEventListener('click', () => openModal());
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('checklistModal').addEventListener('click', (e) => { if (e.target.id === 'checklistModal') closeModal(); });
  document.getElementById('checklistForm').addEventListener('submit', onSubmit);
}

function render() {
  let list = DB.ChecklistItems.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (currentChecklistStatus !== '全部') list = list.filter(i => i.status === currentChecklistStatus);
  const el = document.getElementById('checklistList');
  if (list.length === 0) { el.innerHTML = '<div class="empty-state">還沒有查核項目，點右上角新增</div>'; return; }
  el.innerHTML = list.map(itemHtml).join('');
  bindListEvents(el);
}

function itemHtml(i) {
  return `
    <div class="card item-card">
      <div class="item-card-top">
        <div>
          <div class="item-title">${escapeHtml(i.product || '（未填商品）')}</div>
          <div class="item-meta" style="margin-top:4px">
            <span class="badge badge-gray">門市：${escapeHtml(i.store || '未填')}</span>
          </div>
        </div>
      </div>
      ${i.note ? `<div style="font-size:13px;color:var(--text-dim);white-space:pre-wrap">${escapeHtml(i.note)}</div>` : ''}
      <div class="tabs" style="align-self:flex-start">
        ${CHECKLIST_STATUSES.map(s => `<div class="tab ${i.status === s ? 'active' : ''}" data-act="setstatus" data-status="${s}" data-id="${i.id}">${s}</div>`).join('')}
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" data-act="edit" data-id="${i.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-act="delete" data-id="${i.id}">刪除</button>
      </div>
    </div>
  `;
}

function bindListEvents(el) {
  el.querySelectorAll('[data-act="setstatus"]').forEach(b => b.addEventListener('click', async () => {
    try {
      await apiUpdate('ChecklistItems', b.dataset.id, { status: b.dataset.status });
      render();
    } catch (e) { toast('更新失敗：' + e.message, true); }
  }));
  el.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.id)));
  el.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('確定要刪除這筆查核項目嗎？')) return;
    try { await apiDelete('ChecklistItems', b.dataset.id); render(); toast('已刪除'); }
    catch (e) { toast('刪除失敗：' + e.message, true); }
  }));
}

function openModal(id) {
  editingChecklistId = id || null;
  const i = id ? DB.ChecklistItems.find(x => x.id === id) : {};
  document.getElementById('modalTitle').textContent = id ? '編輯查核項目' : '新增查核項目';
  document.getElementById('f_product').value = i.product || '';
  document.getElementById('f_store').value = i.store || '';
  document.getElementById('f_note').value = i.note || '';
  document.getElementById('f_status').value = i.status || '待處理';
  document.getElementById('checklistModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('checklistModal').classList.add('hidden'); }

async function onSubmit(e) {
  e.preventDefault();
  const data = {
    product: document.getElementById('f_product').value.trim(),
    store: document.getElementById('f_store').value.trim(),
    note: document.getElementById('f_note').value.trim(),
    status: document.getElementById('f_status').value
  };
  if (!data.product) { toast('請輸入商品', true); return; }
  try {
    if (editingChecklistId) await apiUpdate('ChecklistItems', editingChecklistId, data);
    else await apiCreate('ChecklistItems', data);
    closeModal();
    render();
    toast('已儲存');
  } catch (err) { toast('儲存失敗：' + err.message, true); }
}
