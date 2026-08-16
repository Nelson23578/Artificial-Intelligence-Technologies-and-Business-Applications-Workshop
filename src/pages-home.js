import { shell } from './ui.js';

export function renderHome(root) {
  root.innerHTML = shell(`
    <section class="home-intro">
      <span class="page-kicker">AI EXPERIENCE LAB</span>
      <h1>人工智慧技術與商業應用</h1>
      <p>選擇一個工作坊開始體驗。</p>
    </section>

    <section class="lab-grid" aria-label="AI 工作坊">
      <a class="lab-card" href="#/handwriting">
        <div class="lab-number">LAB 01</div>
        <div class="lab-icon">✍️</div>
        <h2>手寫數字辨識</h2>
        <p>在畫布上寫一個或多個數字，讓 AI 進行辨識。</p>
        <span class="card-arrow">開始體驗 →</span>
      </a>

      <a class="lab-card" href="#/image">
        <div class="lab-number">LAB 02</div>
        <div class="lab-icon">🖼️</div>
        <h2>圖片辨識</h2>
        <p>上傳一張圖片，查看 AI 的分類結果與信心值。</p>
        <span class="card-arrow">開始體驗 →</span>
      </a>

      <a class="lab-card" href="#/sentiment">
        <div class="lab-number">LAB 03</div>
        <div class="lab-icon">💬</div>
        <h2>NLP 評論分析</h2>
        <p>輸入評論或上傳 Excel，分析正向、負向與中性評論。</p>
        <span class="card-arrow">開始體驗 →</span>
      </a>
    </section>
  `);
}
