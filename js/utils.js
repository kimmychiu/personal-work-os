/* 共用工具函式 */

const DEFAULT_CATEGORIES = ['系統需求', 'Excel', 'AI', '行政', '學習'];
const CATEGORY_PALETTE = ['badge-purple', 'badge-green', 'badge-blue', 'badge-orange', 'badge-teal', 'badge-red', 'badge-gray'];
const PRIORITIES = ['高', '中', '低'];
const STATUSES = ['未開始', '進行中', '等待', '完成'];
const EVENT_TYPES = ['工作時段', '會議', '提醒', '其他'];
const REMINDER_OPTIONS = [
  { value: 0, label: '準時提醒' },
  { value: 5, label: '提前 5 分鐘' },
  { value: 10, label: '提前 10 分鐘' },
  { value: 15, label: '提前 15 分鐘' },
  { value: 30, label: '提前 30 分鐘' },
  { value: 60, label: '提前 1 小時' }
];

/** 使用者自訂的待辦分類（主項目），存在本機瀏覽器 */
function getCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem('workos_categories'));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (e) { /* ignore */ }
  return DEFAULT_CATEGORIES.slice();
}

function saveCategories(list) {
  localStorage.setItem('workos_categories', JSON.stringify(list));
}

function todayStr() {
  return formatDate(new Date());
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function weekdayLabel(dateStr) {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr + 'T00:00:00');
  return labels[d.getDay()];
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // 週一為起始
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function priorityColor(p) {
  return { 高: 'badge-red', 中: 'badge-orange', 低: 'badge-gray' }[p] || 'badge-gray';
}

function statusColor(s) {
  return { 未開始: 'badge-gray', 進行中: 'badge-blue', 等待: 'badge-orange', 完成: 'badge-green' }[s] || 'badge-gray';
}

function categoryColor(c) {
  const idx = getCategories().indexOf(c);
  if (idx === -1) return 'badge-gray';
  return CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
}

function toast(msg, isError) {
  let el = document.getElementById('workos-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'workos-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'workos-toast show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'workos-toast'; }, 3000);
}
