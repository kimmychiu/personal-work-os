let selectedDate = todayStr();
let editingEventId = null;
let viewMode = 'week'; // 'week' | 'month'

document.addEventListener('DOMContentLoaded', async () => {
  renderNav('calendar');
  bindEvents();
  render();
  await initData();
  render();
});

function bindEvents() {
  document.getElementById('prevWeekBtn').addEventListener('click', () => { selectedDate = addDays(selectedDate, -7); render(); });
  document.getElementById('nextWeekBtn').addEventListener('click', () => { selectedDate = addDays(selectedDate, 7); render(); });
  document.getElementById('prevMonthBtn').addEventListener('click', () => { selectedDate = shiftMonth(selectedDate, -1); render(); });
  document.getElementById('nextMonthBtn').addEventListener('click', () => { selectedDate = shiftMonth(selectedDate, 1); render(); });
  document.getElementById('todayBtn').addEventListener('click', () => { selectedDate = todayStr(); render(); });
  document.getElementById('prevDayBtn').addEventListener('click', () => { selectedDate = addDays(selectedDate, -1); render(); });
  document.getElementById('nextDayBtn').addEventListener('click', () => { selectedDate = addDays(selectedDate, 1); render(); });
  document.getElementById('addEventBtn').addEventListener('click', () => openModal());
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('eventModal').addEventListener('click', (e) => { if (e.target.id === 'eventModal') closeModal(); });
  document.getElementById('eventForm').addEventListener('submit', onSubmit);
  document.querySelectorAll('#calViewTabs .tab').forEach(t => t.addEventListener('click', () => {
    viewMode = t.dataset.mode;
    document.querySelectorAll('#calViewTabs .tab').forEach(x => x.classList.toggle('active', x === t));
    document.getElementById('prevWeekBtn').classList.toggle('hidden', viewMode !== 'week');
    document.getElementById('nextWeekBtn').classList.toggle('hidden', viewMode !== 'week');
    document.getElementById('prevMonthBtn').classList.toggle('hidden', viewMode !== 'month');
    document.getElementById('nextMonthBtn').classList.toggle('hidden', viewMode !== 'month');
    document.getElementById('weekStrip').classList.toggle('hidden', viewMode !== 'week');
    document.getElementById('monthGrid').classList.toggle('hidden', viewMode !== 'month');
    render();
  }));
}

function shiftMonth(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + delta, 1); // 換月時固定停在該月 1 號，避免月底日期溢位
  return formatDate(d);
}

function render() {
  if (viewMode === 'week') renderWeekStrip();
  else renderMonthGrid();
  renderDayHeader();
  renderEventList();
}

function renderWeekStrip() {
  const start = getWeekStart(selectedDate);
  const el = document.getElementById('weekStrip');
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(start, i));
  el.innerHTML = days.map(d => `
    <div class="cal-day-btn ${d === selectedDate ? 'active' : ''}" data-date="${d}">
      <div class="dow">週${weekdayLabel(d)}</div>
      <div class="dom">${Number(d.split('-')[2])}</div>
    </div>
  `).join('');
  el.querySelectorAll('.cal-day-btn').forEach(b => b.addEventListener('click', () => { selectedDate = b.dataset.date; render(); }));
}

function renderMonthGrid() {
  const el = document.getElementById('monthGrid');
  const [y, m] = selectedDate.split('-').map(Number); // m: 1-12
  const firstOfMonth = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDayNum = new Date(y, m, 0).getDate(); // new Date(y, m, 0) = 該月最後一天
  const lastOfMonth = `${y}-${String(m).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
  const gridStart = getWeekStart(firstOfMonth); // 涵蓋整月所需的週一～週日格子範圍
  const gridEnd = addDays(getWeekStart(lastOfMonth), 6);
  const cells = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d);
  const dowLabels = ['一', '二', '三', '四', '五', '六', '日'];
  const dowHtml = dowLabels.map(l => `<div class="cal-month-dow">週${l}</div>`).join('');
  const cellsHtml = cells.map(d => {
    const inMonth = Number(d.split('-')[1]) === m;
    const events = DB.CalendarEvents.filter(e => e.date === d);
    const hasConflict = events.some(e => detectConflicts(e, e.id).length > 0);
    const dots = events.slice(0, 4).map(e => `<span class="dot ${hasConflict ? 'conflict' : ''}"></span>`).join('');
    const more = events.length > 4 ? `<span class="more">+${events.length - 4}</span>` : '';
    return `
      <div class="cal-month-cell ${inMonth ? '' : 'other-month'} ${d === todayStr() ? 'is-today' : ''} ${d === selectedDate ? 'is-selected' : ''}" data-date="${d}">
        <div class="dom">${Number(d.split('-')[2])}</div>
        <div class="dots">${dots}${more}</div>
      </div>
    `;
  }).join('');
  el.innerHTML = dowHtml + cellsHtml;
  el.querySelectorAll('.cal-month-cell').forEach(c => c.addEventListener('click', () => { selectedDate = c.dataset.date; render(); }));
}

function renderDayHeader() {
  document.getElementById('selectedDateLabel').textContent = `${selectedDate}（週${weekdayLabel(selectedDate)}）`;
  const s = getSettings();
  const cap = s.dailyCapacityHours || 8;
  const total = getDayTotalHours(selectedDate);
  const banner = document.getElementById('capacityBanner');
  document.getElementById('dayTotalHours').textContent = total.toFixed(1);
  document.getElementById('dayCapacityHours').textContent = cap;
  if (total > cap) {
    banner.classList.remove('hidden');
    banner.textContent = `⚠ 這天已排 ${total.toFixed(1)} 小時，超過建議上限 ${cap} 小時，考慮挪一些事項到其他天`;
  } else {
    banner.classList.add('hidden');
  }
}

function renderEventList() {
  const events = DB.CalendarEvents.filter(e => e.date === selectedDate)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const el = document.getElementById('eventList');
  if (events.length === 0) { el.innerHTML = '<div class="empty-state">這天還沒有排程，點右上角新增</div>'; return; }
  el.innerHTML = events.map(e => {
    const conflicts = detectConflicts(e, e.id);
    return `
    <div class="cal-event-row" style="flex-wrap:wrap">
      <div class="cal-event-time">${e.startTime || '全天'}${e.endTime ? '–' + e.endTime : ''}</div>
      <div style="flex:1;min-width:180px">
        <div style="font-weight:bold">${escapeHtml(e.title)} ${conflicts.length ? '<span class="badge badge-red">時段衝突</span>' : ''}</div>
        <div class="item-meta">
          <span class="badge badge-gray">${e.type || '其他'}</span>
          ${e.taskId ? `<span class="badge badge-blue">${escapeHtml((getTaskById(e.taskId) || {}).title || '已刪除的工作')}</span>` : ''}
          ${e.googleEventId ? '<span class="badge badge-green">已連動 Google 行事曆</span>' : ''}
          ${e.reminder ? `<span class="badge badge-orange">🔔 ${reminderLabel(e.reminderMinutesBefore)}</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" data-act="sync" data-id="${e.id}">${e.googleEventId ? '取消連動' : '連動 Google'}</button>
        <button class="btn btn-sm" data-act="edit" data-id="${e.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-act="delete" data-id="${e.id}">刪除</button>
      </div>
    </div>`;
  }).join('');
  bindListEvents(el);
}

function bindListEvents(el) {
  el.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.id)));
  el.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('確定要刪除這個事件嗎？')) return;
    try { await apiDelete('CalendarEvents', b.dataset.id); render(); toast('已刪除'); }
    catch (e) { toast('刪除失敗：' + e.message, true); }
  }));
  el.querySelectorAll('[data-act="sync"]').forEach(b => b.addEventListener('click', async () => {
    const ev = DB.CalendarEvents.find(x => x.id === b.dataset.id);
    if (!isConfigured()) { toast('請先到設定頁完成 Google 雲端同步設定', true); return; }
    try {
      if (ev.googleEventId) { await unsyncCalendarEventFromGoogle(ev.id); toast('已取消連動'); }
      else { await syncCalendarEventToGoogle(ev.id); toast('已連動到 Google 行事曆'); }
      render();
    } catch (e) { toast('連動失敗：' + e.message, true); }
  }));
}

function reminderLabel(minutes) {
  const opt = REMINDER_OPTIONS.find(o => o.value === Number(minutes));
  return opt ? opt.label : '已設定提醒';
}

function refreshTaskOptions() {
  const sel = document.getElementById('f_taskId');
  sel.innerHTML = '<option value="">（不連結特定工作）</option>' +
    DB.Tasks.filter(t => t.status !== '完成').map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
}

function openModal(id) {
  editingEventId = id || null;
  refreshTaskOptions();
  const e = id ? DB.CalendarEvents.find(x => x.id === id) : {};
  document.getElementById('modalTitle').textContent = id ? '編輯行事曆事件' : '新增行事曆事件';
  document.getElementById('f_date').value = e.date || selectedDate;
  document.getElementById('f_startTime').value = e.startTime || '';
  document.getElementById('f_endTime').value = e.endTime || '';
  document.getElementById('f_title').value = e.title || '';
  document.getElementById('f_type').value = e.type || EVENT_TYPES[0];
  document.getElementById('f_taskId').value = e.taskId || '';
  document.getElementById('f_note').value = e.note || '';
  document.getElementById('f_reminder').checked = !!e.reminder;
  document.getElementById('f_reminderMinutes').value = e.reminderMinutesBefore || 10;
  document.getElementById('reminderMinutesGroup').classList.toggle('hidden', !e.reminder);
  document.getElementById('conflictWarn').classList.add('hidden');
  document.getElementById('eventModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('eventModal').classList.add('hidden'); }

async function onSubmit(ev) {
  ev.preventDefault();
  const data = {
    date: document.getElementById('f_date').value,
    startTime: document.getElementById('f_startTime').value,
    endTime: document.getElementById('f_endTime').value,
    title: document.getElementById('f_title').value.trim(),
    type: document.getElementById('f_type').value,
    taskId: document.getElementById('f_taskId').value,
    note: document.getElementById('f_note').value.trim(),
    reminder: document.getElementById('f_reminder').checked,
    reminderMinutesBefore: Number(document.getElementById('f_reminderMinutes').value) || 10
  };
  if (!data.title || !data.date) { toast('請輸入標題與日期', true); return; }
  const conflicts = detectConflicts(data, editingEventId);
  if (conflicts.length > 0) {
    const warn = document.getElementById('conflictWarn');
    warn.classList.remove('hidden');
    warn.textContent = `⚠ 這個時段跟「${conflicts.map(c => c.title).join('、')}」重疊，仍要儲存嗎？再按一次「儲存」即可送出`;
    if (!warn.dataset.confirmed) { warn.dataset.confirmed = '1'; return; }
  }
  document.getElementById('conflictWarn').dataset.confirmed = '';
  try {
    if (editingEventId) {
      await apiUpdate('CalendarEvents', editingEventId, data);
      clearFiredReminder(editingEventId); // 時間可能改了，重設提醒狀態讓它能再次觸發
    } else {
      await apiCreate('CalendarEvents', data);
    }
    closeModal();
    selectedDate = data.date;
    render();
    toast('已儲存');
  } catch (e) { toast('儲存失敗：' + e.message, true); }
}
