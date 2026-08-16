export function shell(content, options = {}) {
  const { active = '' } = options;
  return `
    <header class="topbar">
      <a class="brand" href="#/home" aria-label="回到首頁">
        <span class="brand-mark">AI</span>
        <span>
          <strong>AI Experience Lab</strong>
          <small>人工智慧技術與商業應用</small>
        </span>
      </a>
      <nav class="nav-links" aria-label="工作坊導覽">
        ${navLink('handwriting', '手寫辨識', active)}
        ${navLink('image', '圖片辨識', active)}
        ${navLink('sentiment', 'NLP 分析', active)}
      </nav>
    </header>
    <main>${content}</main>
  `;
}

function navLink(key, label, active) {
  return `<a class="nav-link ${active === key ? 'active' : ''}" href="#/${key}">${label}</a>`;
}

export function statusBox(message, tone = 'info') {
  return `<div class="status ${tone}">${message}</div>`;
}

export function percent(n) {
  return `${(Number(n || 0) * 100).toFixed(1)}%`;
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
