document.addEventListener('DOMContentLoaded', async () => {
  renderNav('dashboard');
  render();
  await initData();
  render();
});

function render() {
  renderDateHeader();
  renderMIT();
  renderTodayEvents();
  renderTodayTodos();
  renderWaiting();
  renderCompleted();
}

function renderDateHeader() {
  const d = new Date();
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  document.getElementById('todayDate').textContent = `${todayStr()}（星期${wd}）`;
}

function renderMIT() {
  const mit = getTodayMIT();
  const el = document.getElementById('mitList');
  const slots = [0, 1, 2].map(i => {
    const t = mit[i];
    if (!t) {
      return `<div class="card" style="border:1px dashed var(--border);box-shadow:none;display:flex;align-items:center;justify-content:center;min-height:90px">
        <a href="todo.html" class="btn btn-sm">+ 選擇今日 MIT</a>
      </div>`;
    }
    return `<div class="card item-card">
      <div class="item-card-top">
        <span class="item-title ${t.status === '完成' ? 'done' : ''}">${escapeHtml(t.title)}</span>
        <span class="badge ${priorityColor(t.priority)}">${t.priority}</span>
      </div>
      <div class="item-meta">
        <span class="badge ${categoryColor(t.category)}">${t.category}</span>
        <span class="badge ${statusColor(t.status)}">${t.status}</span>
      </div>
    </div>`;
  });
  el.innerHTML = slots.join('');
}

function renderTodayEvents() {
  const events = getTodayEvents();
  const el = document.getElementById('todayEvents');
  if (events.length === 0) { el.innerHTML = '<div class="empty-state">今天還沒有排程，前往行事曆新增</div>'; return; }
  el.innerHTML = events.map(e => `
    <div class="cal-event-row">
      <div class="cal-event-time">${e.startTime || '全天'}${e.endTime ? '–' + e.endTime : ''}</div>
      <div>
        <div>${escapeHtml(e.title)}</div>
        <span class="badge badge-gray">${e.type || '其他'}</span>
      </div>
    </div>
  `).join('');
}

function renderTodayTodos() {
  const todos = getTodayTodos();
  const el = document.getElementById('todayTodos');
  if (todos.length === 0) { el.innerHTML = '<div class="empty-state">今天沒有待辦事項 🎉</div>'; return; }
  el.innerHTML = todos.map(taskRowHtml).join('');
  bindTaskRowEvents(el);
}

function renderWaiting() {
  const list = getWaitingTasks();
  const el = document.getElementById('waitingList');
  if (list.length === 0) { el.innerHTML = '<div class="empty-state">目前沒有等待他人回覆的事項</div>'; return; }
  el.innerHTML = list.map(t => `
    <div class="item-card" style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="item-card-top">
        <span class="item-title">${escapeHtml(t.title)}</span>
        <span class="badge ${categoryColor(t.category)}">${t.category}</span>
      </div>
      <div class="item-meta">
        <span>等待對象：${escapeHtml(t.waitingOn || '未填')}</span>
        ${t.waitingSince ? `<span>已等待 ${daysBetween(t.waitingSince, todayStr())} 天</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderCompleted() {
  const list = getTodayCompleted();
  const el = document.getElementById('completedList');
  if (list.length === 0) { el.innerHTML = '<div class="empty-state">今天還沒有完成的事項</div>'; return; }
  el.innerHTML = list.map(t => `
    <div class="item-card-top" style="padding:6px 0">
      <span class="item-title done">${escapeHtml(t.title)}</span>
      <span class="badge ${categoryColor(t.category)}">${t.category}</span>
    </div>
  `).join('');
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function taskRowHtml(t) {
  return `
    <div class="item-card" style="flex-direction:row;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)">
      <span class="checkbox-round ${t.status === '完成' ? 'checked' : ''}" data-id="${t.id}" style="margin-right:10px">${t.status === '完成' ? '✓' : ''}</span>
      <div style="flex:1">
        <div class="item-title ${t.status === '完成' ? 'done' : ''}">${escapeHtml(t.title)}</div>
        <div class="item-meta">
          <span class="badge ${categoryColor(t.category)}">${t.category}</span>
          <span class="badge ${priorityColor(t.priority)}">${t.priority}</span>
          <span class="badge ${statusColor(t.status)}">${t.status}</span>
          ${t.dueDate ? `<span>到期 ${t.dueDate}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function bindTaskRowEvents(container) {
  container.querySelectorAll('.checkbox-round').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id;
      const t = getTaskById(id);
      const done = t.status !== '完成';
      try {
        await apiUpdate('Tasks', id, { status: done ? '完成' : '進行中', completedDate: done ? todayStr() : '' });
        toast(done ? '已完成！' : '已取消完成');
        render();
      } catch (e) { toast('更新失敗：' + e.message, true); }
    });
  });
}
