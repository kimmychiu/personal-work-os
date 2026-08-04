/* 共用導覽列：桌面顯示為側邊欄，手機（CSS 媒體查詢）顯示為底部導覽列 */

const NAV_ITEMS = [
  { key: 'dashboard', href: 'index.html', icon: '🏠', label: '首頁' },
  { key: 'todo', href: 'todo.html', icon: '✅', label: '待辦' },
  { key: 'calendar', href: 'calendar.html', icon: '📅', label: '行事曆' },
  { key: 'projects', href: 'projects.html', icon: '📁', label: '專案' },
  { key: 'review', href: 'review.html', icon: '📊', label: '週回顧' },
  { key: 'checklist', href: 'checklist.html', icon: '🔍', label: '查核表' }
];

function renderNav(activeKey) {
  const mount = document.getElementById('nav-mount');
  if (!mount) return;

  const items = NAV_ITEMS.map(item => `
    <a class="nav-item ${item.key === activeKey ? 'active' : ''}" href="${item.href}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </a>
  `).join('');

  mount.innerHTML = `
    <nav class="app-nav">
      <div class="app-nav-brand">📋 工作管理</div>
      <div class="app-nav-items">${items}</div>
      <a class="nav-item nav-settings ${activeKey === 'settings' ? 'active' : ''}" href="settings.html">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">設定</span>
      </a>
    </nav>
  `;
}
