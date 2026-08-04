/* 資料存取層：呼叫 Google Apps Script Web App，並用 localStorage 做本機快取 */

const SETTINGS_KEY = 'workos_settings';
const CACHE_KEY = 'workos_cache';

const DB = { Tasks: [], Projects: [], CalendarEvents: [], WeeklyReviews: [], ChecklistItems: [] };

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch (e) { return {}; }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function isConfigured() {
  const s = getSettings();
  return !!(s.webAppUrl && s.token);
}

function loadCacheIntoDB() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cache) Object.assign(DB, cache);
  } catch (e) { /* ignore */ }
}

function saveDBToCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(DB));
}

async function callApi(method, action, payload) {
  const s = getSettings();
  if (!s.webAppUrl || !s.token) throw new Error('尚未設定雲端同步網址與密鑰');
  if (method === 'GET') {
    const url = new URL(s.webAppUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('token', s.token);
    Object.keys(payload || {}).forEach(k => url.searchParams.set(k, payload[k]));
    const res = await fetch(url.toString(), { method: 'GET' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '未知錯誤');
    return json.data;
  } else {
    const body = Object.assign({ action, token: s.token }, payload || {});
    const res = await fetch(s.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 避免瀏覽器送出 CORS 預檢請求
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '未知錯誤');
    return json.data;
  }
}

async function testConnection(webAppUrl, token) {
  const url = new URL(webAppUrl);
  url.searchParams.set('action', 'listAll');
  url.searchParams.set('token', token);
  const res = await fetch(url.toString(), { method: 'GET' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || '連線失敗');
  return json.data;
}

/** 開頁時呼叫：先用本機快取立刻畫面，再背景抓最新資料 */
async function initData() {
  loadCacheIntoDB();
  if (!isConfigured()) return false;
  try {
    const data = await callApi('GET', 'listAll');
    Object.assign(DB, data);
    saveDBToCache();
    return true;
  } catch (e) {
    console.warn('同步失敗，使用本機快取', e);
    toast('雲端同步失敗，顯示上次快取資料', true);
    return false;
  }
}

// ---------- CRUD 包裝 ----------
// 尚未設定雲端同步時，改用純本機 localStorage 模式，讓網頁在完成 Google 設定前也能先用起來。

const LOCAL_ID_PREFIX = { Tasks: 'T', Projects: 'P', CalendarEvents: 'C', WeeklyReviews: 'W', ChecklistItems: 'Q' };

function localNextId(sheet) {
  const prefix = LOCAL_ID_PREFIX[sheet];
  let max = 0;
  (DB[sheet] || []).forEach(r => {
    const n = parseInt(String(r.id || '').replace(prefix, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return prefix + String(max + 1).padStart(4, '0');
}

async function apiCreate(sheet, data) {
  if (!isConfigured()) {
    const row = Object.assign({ id: localNextId(sheet), createdAt: new Date().toISOString() }, data);
    DB[sheet].push(row);
    saveDBToCache();
    return row;
  }
  const row = await callApi('POST', 'create', { sheet, data });
  DB[sheet].push(row);
  saveDBToCache();
  return row;
}

async function apiUpdate(sheet, id, data) {
  if (!isConfigured()) {
    const idx = DB[sheet].findIndex(r => r.id === id);
    if (idx === -1) throw new Error('找不到資料 id=' + id);
    DB[sheet][idx] = Object.assign({}, DB[sheet][idx], data);
    saveDBToCache();
    return DB[sheet][idx];
  }
  const row = await callApi('POST', 'update', { sheet, id, data });
  const idx = DB[sheet].findIndex(r => r.id === id);
  if (idx !== -1) DB[sheet][idx] = row;
  saveDBToCache();
  return row;
}

async function apiDelete(sheet, id) {
  if (!isConfigured()) {
    DB[sheet] = DB[sheet].filter(r => r.id !== id);
    saveDBToCache();
    return;
  }
  await callApi('POST', 'delete', { sheet, id });
  DB[sheet] = DB[sheet].filter(r => r.id !== id);
  saveDBToCache();
}

async function syncCalendarEventToGoogle(id) {
  const row = await callApi('POST', 'syncCalendarEvent', { id });
  const idx = DB.CalendarEvents.findIndex(r => r.id === id);
  if (idx !== -1) DB.CalendarEvents[idx] = row;
  saveDBToCache();
  return row;
}

async function unsyncCalendarEventFromGoogle(id) {
  const row = await callApi('POST', 'unsyncCalendarEvent', { id });
  const idx = DB.CalendarEvents.findIndex(r => r.id === id);
  if (idx !== -1) DB.CalendarEvents[idx].googleEventId = '';
  saveDBToCache();
  return row;
}

// ---------- 共用查詢彙整（Dashboard / 每週回顧共用，不另存清單） ----------

/** 設定裡的分類清單 + 資料裡實際出現過但尚未加入清單的分類（跨裝置容錯） */
function getAllCategories() {
  const configured = getCategories();
  const used = new Set((DB.Tasks || []).map(t => t.category).filter(Boolean));
  const extra = [...used].filter(c => !configured.includes(c));
  return [...configured, ...extra];
}

function getTaskById(id) {
  return DB.Tasks.find(t => t.id === id);
}

function getProjectById(id) {
  return DB.Projects.find(p => p.id === id);
}

function getTodayMIT() {
  const t = todayStr();
  return DB.Tasks.filter(x => x.mitDate === t).slice(0, 3);
}

function getTodayEvents() {
  const t = todayStr();
  return DB.CalendarEvents.filter(e => e.date === t)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function getTodayTodos() {
  const t = todayStr();
  const scheduledTaskIds = new Set(getTodayEvents().filter(e => e.taskId).map(e => e.taskId));
  return DB.Tasks.filter(x => x.status !== '完成' && ((x.dueDate && x.dueDate <= t) || scheduledTaskIds.has(x.id)));
}

function getWaitingTasks() {
  return DB.Tasks.filter(x => x.status === '等待');
}

function getTodayCompleted() {
  const t = todayStr();
  return DB.Tasks.filter(x => x.completedDate === t);
}

function getProjectProgress(project) {
  if (project.useManualProgress) return Number(project.progressOverride) || 0;
  const tasks = DB.Tasks.filter(t => t.projectId === project.id);
  if (tasks.length === 0) return 0;
  const done = tasks.filter(t => t.status === '完成').length;
  return Math.round((done / tasks.length) * 100);
}

/** 檢查某事件是否跟同一天其他事件時段重疊，回傳重疊事件陣列 */
function detectConflicts(event, excludeId) {
  return DB.CalendarEvents.filter(e =>
    e.date === event.date &&
    e.id !== excludeId &&
    e.startTime && e.endTime && event.startTime && event.endTime &&
    rangesOverlap(event.startTime, event.endTime, e.startTime, e.endTime)
  );
}

function getDayTotalHours(dateStr) {
  return DB.CalendarEvents.filter(e => e.date === dateStr && e.startTime && e.endTime)
    .reduce((sum, e) => sum + (timeToMinutes(e.endTime) - timeToMinutes(e.startTime)) / 60, 0);
}

function getWeekRange(weekStart) {
  return { start: weekStart, end: addDays(weekStart, 6) };
}

function getWeeklyStats(weekStart) {
  const { start, end } = getWeekRange(weekStart);
  const completed = DB.Tasks.filter(t => t.completedDate && t.completedDate >= start && t.completedDate <= end);
  const incomplete = DB.Tasks.filter(t => t.status !== '完成' && t.dueDate && t.dueDate < start);
  const nextWeekStart = addDays(start, 7);
  const nextWeekEnd = addDays(start, 13);
  const nextWeekFocusSuggestion = DB.Tasks.filter(t =>
    t.status !== '完成' && t.dueDate && t.dueDate >= nextWeekStart && t.dueDate <= nextWeekEnd && t.priority === '高'
  );
  return { start, end, completed, incomplete, nextWeekFocusSuggestion };
}
