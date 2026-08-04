/* 行事曆提醒：定期檢查是否有事件到了提醒時間，跳出右下角提醒卡片 + 瀏覽器通知。
   限制：只在這個網頁的分頁還開著時才會檢查，分頁關閉後不會提醒。 */

const REMINDER_FIRED_KEY = 'workos_fired_reminders';
const REMINDER_CHECK_INTERVAL_MS = 20000;

function getFiredReminders() {
  try { return new Set(JSON.parse(localStorage.getItem(REMINDER_FIRED_KEY)) || []); }
  catch (e) { return new Set(); }
}

function saveFiredReminders(set) {
  localStorage.setItem(REMINDER_FIRED_KEY, JSON.stringify([...set].slice(-500)));
}

function clearFiredReminder(id) {
  const set = getFiredReminders();
  if (set.delete(id)) saveFiredReminders(set);
}

function getReminderContainer() {
  let c = document.getElementById('reminder-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'reminder-container';
    document.body.appendChild(c);
  }
  return c;
}

function showReminderPopup(ev) {
  const box = document.createElement('div');
  box.className = 'reminder-popup';
  box.innerHTML = `
    <button class="reminder-popup-close">✕</button>
    <div class="reminder-popup-title">⏰ 行事曆提醒</div>
    <div class="reminder-popup-body">${escapeHtml(ev.title)}（${ev.date} ${ev.startTime || ''}）</div>
  `;
  getReminderContainer().appendChild(box);
  box.querySelector('.reminder-popup-close').addEventListener('click', () => box.remove());
  setTimeout(() => box.remove(), 60000);

  if (window.Notification && Notification.permission === 'granted') {
    try {
      new Notification('⏰ ' + ev.title, { body: `${ev.date} ${ev.startTime || ''} 開始` });
    } catch (e) { /* 部分瀏覽器環境不支援，忽略即可 */ }
  }
}

function checkReminders() {
  if (typeof DB === 'undefined' || !Array.isArray(DB.CalendarEvents)) return;
  const fired = getFiredReminders();
  const now = new Date();
  let changed = false;
  DB.CalendarEvents.forEach(ev => {
    if (!ev.reminder || !ev.date || !ev.startTime || fired.has(ev.id)) return;
    const eventTime = new Date(`${ev.date}T${ev.startTime}:00`);
    if (isNaN(eventTime.getTime())) return;
    const minutesBefore = Number(ev.reminderMinutesBefore) || 0;
    const remindAt = new Date(eventTime.getTime() - minutesBefore * 60000);
    if (now >= remindAt && now <= eventTime) {
      showReminderPopup(ev);
      fired.add(ev.id);
      changed = true;
    }
  });
  if (changed) saveFiredReminders(fired);
}

function initReminders() {
  if (window.Notification && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  checkReminders();
  setInterval(checkReminders, REMINDER_CHECK_INTERVAL_MS);
}

document.addEventListener('DOMContentLoaded', () => {
  // 稍微延遲，讓 initData() 有機會先把 DB 填好
  setTimeout(initReminders, 1000);
});
