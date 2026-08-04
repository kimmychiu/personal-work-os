let currentWeekStart = getWeekStart(todayStr());

document.addEventListener('DOMContentLoaded', async () => {
  renderNav('review');
  bindEvents();
  render();
  await initData();
  render();
});

function bindEvents() {
  document.getElementById('prevWeekBtn').addEventListener('click', () => { currentWeekStart = addDays(currentWeekStart, -7); render(); });
  document.getElementById('nextWeekBtn').addEventListener('click', () => { currentWeekStart = addDays(currentWeekStart, 7); render(); });
  document.getElementById('thisWeekBtn').addEventListener('click', () => { currentWeekStart = getWeekStart(todayStr()); render(); });
  document.getElementById('saveReviewBtn').addEventListener('click', saveReview);
}

function render() {
  const stats = getWeeklyStats(currentWeekStart);
  document.getElementById('weekLabel').textContent = `${stats.start} ～ ${stats.end}`;

  renderCompleted(stats);
  renderIncomplete(stats);
  renderNextWeekSuggestion(stats);
  renderHistory();

  const existing = DB.WeeklyReviews.find(r => r.weekStart === currentWeekStart);
  document.getElementById('notesField').value = existing ? existing.notes : '';
  if (existing) document.getElementById('nextFocusField').value = existing.nextWeekFocus;
}

function renderCompleted(stats) {
  const el = document.getElementById('completedSection');
  if (stats.completed.length === 0) { el.innerHTML = '<div class="empty-state">本週還沒有完成的事項</div>'; return; }
  const byCat = {};
  stats.completed.forEach(t => { (byCat[t.category] = byCat[t.category] || []).push(t); });
  el.innerHTML = Object.entries(byCat).map(([cat, list]) => `
    <div style="margin-bottom:10px">
      <span class="badge ${categoryColor(cat)}">${cat}</span>
      ${list.map(t => `<div style="padding:4px 0 4px 4px;font-size:13px">✓ ${escapeHtml(t.title)}</div>`).join('')}
    </div>
  `).join('');
}

function renderIncomplete(stats) {
  const el = document.getElementById('incompleteSection');
  if (stats.incomplete.length === 0) { el.innerHTML = '<div class="empty-state">沒有逾期未完成的事項 🎉</div>'; return; }
  el.innerHTML = stats.incomplete.map(t => `
    <div class="item-meta" style="padding:4px 0">
      <span class="badge badge-red">逾期</span>
      <span class="badge ${categoryColor(t.category)}">${t.category}</span>
      ${escapeHtml(t.title)}（到期 ${t.dueDate}）
    </div>
  `).join('');
}

function renderNextWeekSuggestion(stats) {
  const el = document.getElementById('suggestionList');
  if (stats.nextWeekFocusSuggestion.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = '建議重點（高優先級、到期日落在下週）：<br>' +
    stats.nextWeekFocusSuggestion.map(t => `・${escapeHtml(t.title)}`).join('<br>');
  if (!document.getElementById('nextFocusField').value) {
    document.getElementById('nextFocusField').value = stats.nextWeekFocusSuggestion.map(t => `・${t.title}`).join('\n');
  }
}

function renderHistory() {
  const el = document.getElementById('historyList');
  const list = DB.WeeklyReviews.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  if (list.length === 0) { el.innerHTML = '<div class="empty-state">尚無歷史回顧紀錄</div>'; return; }
  el.innerHTML = list.map(r => `
    <details style="margin-bottom:8px">
      <summary style="cursor:pointer;font-size:13px">${r.weekStart} ～ ${r.weekEnd}（完成${r.completedCount}／未完成${r.incompleteCount}）</summary>
      <div style="font-size:13px;padding:8px 4px;white-space:pre-wrap">下週重點：${escapeHtml(r.nextWeekFocus || '（無）')}\n備註：${escapeHtml(r.notes || '（無）')}</div>
    </details>
  `).join('');
}

async function saveReview() {
  const stats = getWeeklyStats(currentWeekStart);
  const data = {
    weekStart: stats.start,
    weekEnd: stats.end,
    completedCount: stats.completed.length,
    incompleteCount: stats.incomplete.length,
    nextWeekFocus: document.getElementById('nextFocusField').value,
    notes: document.getElementById('notesField').value,
    generatedAt: new Date().toISOString()
  };
  const existing = DB.WeeklyReviews.find(r => r.weekStart === currentWeekStart);
  try {
    if (existing) await apiUpdate('WeeklyReviews', existing.id, data);
    else await apiCreate('WeeklyReviews', data);
    toast('本週回顧已儲存');
    render();
  } catch (e) { toast('儲存失敗：' + e.message, true); }
}
