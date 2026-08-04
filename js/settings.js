document.addEventListener('DOMContentLoaded', () => {
  renderNav('settings');
  const s = getSettings();
  document.getElementById('webAppUrl').value = s.webAppUrl || '';
  document.getElementById('token').value = s.token || '';
  document.getElementById('capacity').value = s.dailyCapacityHours || 8;
  updateStatusBanner();
  renderCategoryManager();
  bindCategoryManagerEvents();

  document.getElementById('testBtn').addEventListener('click', async () => {
    const url = document.getElementById('webAppUrl').value.trim();
    const token = document.getElementById('token').value.trim();
    const resultEl = document.getElementById('testResult');
    if (!url || !token) {
      resultEl.textContent = '請先填入網址與密鑰';
      resultEl.className = 'notice-banner';
      return;
    }
    resultEl.textContent = '測試連線中…';
    resultEl.className = 'notice-banner';
    try {
      const data = await testConnection(url, token);
      const counts = Object.keys(data).map(k => `${k}:${data[k].length}筆`).join('、');
      resultEl.textContent = `✅ 連線成功！目前雲端資料 － ${counts}`;
      resultEl.className = 'notice-banner';
      resultEl.style.background = '#e6f6ea';
      resultEl.style.color = '#1a7f3c';
    } catch (e) {
      resultEl.textContent = '❌ 連線失敗：' + e.message;
      resultEl.className = 'notice-banner';
      resultEl.style.background = '';
      resultEl.style.color = '';
    }
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const webAppUrl = document.getElementById('webAppUrl').value.trim();
    const token = document.getElementById('token').value.trim();
    const dailyCapacityHours = Number(document.getElementById('capacity').value) || 8;
    saveSettings({ webAppUrl, token, dailyCapacityHours });
    toast('設定已儲存');
    updateStatusBanner();
    if (webAppUrl && token) {
      toast('正在同步雲端資料…');
      await initData();
      toast('同步完成');
    }
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!confirm('確定要清除雲端連線設定嗎？（不會刪除雲端試算表裡的資料）')) return;
    saveSettings({});
    document.getElementById('webAppUrl').value = '';
    document.getElementById('token').value = '';
    updateStatusBanner();
    toast('已清除設定');
  });
});

function renderCategoryManager() {
  const el = document.getElementById('categoryManagerList');
  const cats = getCategories();
  el.innerHTML = cats.map((c, i) => `
    <span class="badge ${categoryColor(c)}" style="margin:3px;padding-right:6px">
      ${escapeHtml(c)}
      <span data-idx="${i}" class="cat-del" style="cursor:pointer;margin-left:6px">✕</span>
    </span>
  `).join('');
  el.querySelectorAll('.cat-del').forEach(b => b.addEventListener('click', () => {
    const idx = Number(b.dataset.idx);
    const cats2 = getCategories();
    const name = cats2[idx];
    if (!confirm(`確定要刪除分類「${name}」嗎？已使用這個分類的待辦事項不會被刪除。`)) return;
    cats2.splice(idx, 1);
    saveCategories(cats2);
    renderCategoryManager();
    toast('已刪除分類');
  }));
}

function bindCategoryManagerEvents() {
  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const input = document.getElementById('newCategoryInput');
    const v = input.value.trim();
    if (!v) return;
    const cats = getCategories();
    if (cats.includes(v)) { toast('這個分類已經存在', true); return; }
    cats.push(v);
    saveCategories(cats);
    input.value = '';
    renderCategoryManager();
    toast('已新增分類');
  });
}

function updateStatusBanner() {
  const el = document.getElementById('statusBanner');
  if (isConfigured()) {
    el.textContent = '✅ 目前已設定雲端同步，待辦/專案/行事曆會存到你的 Google 試算表，手機電腦看到同一份資料。';
    el.style.background = '#e6f6ea';
    el.style.color = '#1a7f3c';
  } else {
    el.textContent = '⚠ 尚未設定雲端同步，目前資料只會存在這台裝置的瀏覽器（localStorage），不會跨裝置同步。請依 SETUP_GUIDE.md 完成 Google 試算表設定後，把網址與密鑰填在下方。';
    el.style.background = '';
    el.style.color = '';
  }
}
