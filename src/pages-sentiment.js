import { pipeline } from '@huggingface/transformers';
import * as XLSX from 'xlsx';
import Chart from 'chart.js/auto';
import { shell, percent, escapeHtml } from './ui.js';

const SENTIMENT_MODEL = 'Xenova/distilbert-base-multilingual-cased-sentiments-student';
const MAX_BATCH_ROWS = 300;
let sentimentPipelinePromise = null;

function loadSentimentPipeline() {
  if (!sentimentPipelinePromise) {
    sentimentPipelinePromise = pipeline('text-classification', SENTIMENT_MODEL);
  }
  return sentimentPipelinePromise;
}

export function renderSentiment(root) {
  root.innerHTML = shell(`
    <section class="lab-header">
      <span class="page-kicker">Workshop 03 · NLP SENTIMENT</span>
      <h1>NLP 評論情感分析</h1>
      <p>輸入單筆評論，或上傳 Excel / CSV 進行批次分析。</p>
    </section>

    <section class="workspace">
      <div class="panel">
        <div class="panel-head">
          <h2>評論分析</h2>
          <div class="segmented">
            <button class="segment active" data-sentiment-mode="single">單筆評論</button>
            <button class="segment" data-sentiment-mode="excel">Excel 批次</button>
          </div>
        </div>

        <div id="single-sentiment-pane">
          <label class="field-label" for="review-input">輸入評論</label>
          <textarea id="review-input" rows="6" placeholder="例如：產品很好用，客服也非常有耐心，下次還會再購買。"></textarea>
          <div class="button-row right"><button id="analyze-review" class="btn primary">分析評論</button></div>
          <div id="sentiment-status" class="status info">第一次分析時會載入模型。</div>
          <div id="sentiment-single-result" class="hidden"></div>
        </div>

        <div id="excel-sentiment-pane" class="hidden">
          <label class="upload-zone excel-zone" for="excel-file">
            <input id="excel-file" type="file" accept=".xlsx,.xls,.csv" hidden>
            <div>
              <div class="upload-icon">＋</div>
              <b>上傳評論 Excel / CSV</b>
              <span>第一列需包含欄位名稱</span>
            </div>
          </label>
          <div class="sample-link-row"><a class="text-link" href="./samples/reviews_sample.xlsx" download>下載範例 Excel</a></div>

          <div id="excel-config" class="excel-config hidden">
            <div class="field-row">
              <label><span>評論文字欄位</span><select id="text-column"></select></label>
              <div><span class="field-caption">資料筆數</span><strong id="excel-row-count">0</strong></div>
            </div>
            <div class="button-row">
              <button id="clear-excel" class="btn ghost">清除檔案</button>
              <button id="analyze-excel" class="btn primary">開始批次分析</button>
            </div>
          </div>

          <div id="excel-status" class="status info">單次最多分析 ${MAX_BATCH_ROWS} 筆非空評論。</div>
          <div id="batch-progress" class="progress-wrap hidden"><div class="progress-head"><span>分析中</span><b id="progress-text">0 / 0</b></div><div class="progress-track"><i id="progress-bar"></i></div></div>
          <div id="batch-results" class="hidden"></div>
        </div>
      </div>
    </section>
  `, { active: 'sentiment' });

  setupSentimentLab();
}

function setupSentimentLab() {
  let excelRows = [];
  let batchOutput = [];
  let chart = null;

  document.querySelectorAll('[data-sentiment-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.sentimentMode;
      document.querySelectorAll('[data-sentiment-mode]').forEach((b) => b.classList.toggle('active', b === button));
      document.querySelector('#single-sentiment-pane').classList.toggle('hidden', mode !== 'single');
      document.querySelector('#excel-sentiment-pane').classList.toggle('hidden', mode !== 'excel');
    });
  });

  document.querySelector('#analyze-review').addEventListener('click', async () => {
    const text = document.querySelector('#review-input').value.trim();
    const status = document.querySelector('#sentiment-status');
    if (!text) {
      status.className = 'status warning';
      status.textContent = '請先輸入一段評論。';
      return;
    }
    try {
      status.className = 'status loading';
      status.textContent = '正在載入 multilingual Transformer 模型…';
      const classifier = await loadSentimentPipeline();
      status.textContent = '模型已載入，正在分析文字…';
      const output = await classifier(text);
      const result = Array.isArray(output) ? output[0] : output;
      showSingleSentiment(text, result);
      status.className = 'status success';
      status.textContent = '分析完成。';
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = `NLP 分析失敗：${error.message || error}`;
    }
  });

  const excelInput = document.querySelector('#excel-file');
  excelInput.addEventListener('change', async () => {
    const file = excelInput.files?.[0];
    if (!file) return;
    const status = document.querySelector('#excel-status');
    try {
      status.className = 'status loading';
      status.textContent = '正在讀取試算表…';
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      excelRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      if (!excelRows.length) throw new Error('試算表沒有可讀取的資料列');
      const columns = Object.keys(excelRows[0]);
      if (!columns.length) throw new Error('找不到欄位名稱');
      const select = document.querySelector('#text-column');
      select.innerHTML = columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      const preferred = columns.find((c) => /comment|review|評論|留言|內容|text|content/i.test(c));
      if (preferred) select.value = preferred;
      document.querySelector('#excel-row-count').textContent = excelRows.length.toLocaleString();
      document.querySelector('#excel-config').classList.remove('hidden');
      document.querySelector('#batch-results').classList.add('hidden');
      status.className = 'status success';
      status.textContent = `已讀取 ${file.name}。請確認評論文字欄位後開始分析。`;
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = `無法讀取檔案：${error.message || error}`;
    }
  });

  document.querySelector('#clear-excel').addEventListener('click', () => {
    excelInput.value = '';
    excelRows = [];
    batchOutput = [];
    document.querySelector('#excel-config').classList.add('hidden');
    document.querySelector('#batch-results').classList.add('hidden');
    document.querySelector('#batch-progress').classList.add('hidden');
    const status = document.querySelector('#excel-status');
    status.className = 'status info';
    status.textContent = `為了讓課堂操作順暢，單次最多分析 ${MAX_BATCH_ROWS} 筆非空評論。`;
    if (chart) { chart.destroy(); chart = null; }
  });

  document.querySelector('#analyze-excel').addEventListener('click', async () => {
    const column = document.querySelector('#text-column').value;
    const status = document.querySelector('#excel-status');
    const rows = excelRows
      .map((row, index) => ({ index: index + 1, text: String(row[column] ?? '').trim(), source: row }))
      .filter((r) => r.text)
      .slice(0, MAX_BATCH_ROWS);

    if (!rows.length) {
      status.className = 'status warning';
      status.textContent = '選定欄位中沒有非空評論。';
      return;
    }

    try {
      status.className = 'status loading';
      status.textContent = '正在載入 multilingual Transformer 模型…';
      const classifier = await loadSentimentPipeline();
      const progressWrap = document.querySelector('#batch-progress');
      const bar = document.querySelector('#progress-bar');
      const progressText = document.querySelector('#progress-text');
      progressWrap.classList.remove('hidden');
      batchOutput = [];

      for (let i = 0; i < rows.length; i++) {
        const output = await classifier(rows[i].text);
        const result = Array.isArray(output) ? output[0] : output;
        batchOutput.push({
          row: rows[i].index,
          comment: rows[i].text,
          sentiment: normalizeLabel(result.label),
          score: Number(result.score || 0),
        });
        const done = i + 1;
        bar.style.width = `${(done / rows.length) * 100}%`;
        progressText.textContent = `${done} / ${rows.length}`;
        if (done % 5 === 0) await new Promise(requestAnimationFrame);
      }

      status.className = 'status success';
      const truncated = excelRows.length > MAX_BATCH_ROWS ? `（僅分析前 ${MAX_BATCH_ROWS} 筆非空評論）` : '';
      status.textContent = `批次分析完成 ${truncated}`;
      showBatchResults(batchOutput, () => chart, (newChart) => { chart = newChart; });
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = `批次分析失敗：${error.message || error}`;
    }
  });
}

function normalizeLabel(label = '') {
  const l = String(label).toLowerCase();
  if (l.includes('pos')) return 'positive';
  if (l.includes('neg')) return 'negative';
  if (l.includes('neu')) return 'neutral';
  return l || 'unknown';
}

function sentimentMeta(label) {
  if (label === 'positive') return { zh: '正向', icon: '🙂', cls: 'positive' };
  if (label === 'negative') return { zh: '負向', icon: '🙁', cls: 'negative' };
  if (label === 'neutral') return { zh: '中性', icon: '😐', cls: 'neutral' };
  return { zh: label, icon: '•', cls: 'neutral' };
}

function showSingleSentiment(text, rawResult) {
  const label = normalizeLabel(rawResult.label);
  const meta = sentimentMeta(label);
  const el = document.querySelector('#sentiment-single-result');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="sentiment-card ${meta.cls}">
      <div class="sentiment-icon">${meta.icon}</div>
      <div><span>AI Sentiment</span><strong>${meta.zh}</strong><b>Confidence ${percent(rawResult.score)}</b></div>
    </div>
    <blockquote class="review-quote">${escapeHtml(text)}</blockquote>
  `;
}

function showBatchResults(results, getChart, setChart) {
  const counts = { positive: 0, negative: 0, neutral: 0, unknown: 0 };
  results.forEach((r) => { counts[r.sentiment] = (counts[r.sentiment] || 0) + 1; });
  const total = results.length;
  const avg = results.reduce((s, r) => s + r.score, 0) / total;

  const el = document.querySelector('#batch-results');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="dashboard-grid">
      <div class="metric-card"><span>Total Reviews</span><strong>${total}</strong></div>
      <div class="metric-card positive"><span>Positive</span><strong>${counts.positive}</strong><small>${((counts.positive / total) * 100).toFixed(1)}%</small></div>
      <div class="metric-card negative"><span>Negative</span><strong>${counts.negative}</strong><small>${((counts.negative / total) * 100).toFixed(1)}%</small></div>
      <div class="metric-card neutral"><span>Neutral</span><strong>${counts.neutral}</strong><small>${((counts.neutral / total) * 100).toFixed(1)}%</small></div>
    </div>

    <div class="chart-table-grid">
      <div class="chart-card"><h3>Sentiment Distribution</h3><div class="chart-box"><canvas id="sentiment-chart"></canvas></div><div class="confidence-note">平均預測信心：<b>${percent(avg)}</b></div></div>
      <div class="distribution-list">
        ${distributionRow('正向', counts.positive, total, 'positive')}
        ${distributionRow('負向', counts.negative, total, 'negative')}
        ${distributionRow('中性', counts.neutral, total, 'neutral')}
      </div>
    </div>

    <div class="result-table-head"><div><span class="mini-label">DETAILS</span><h3>逐筆分析結果</h3></div><button id="download-results" class="btn ghost small">下載分析結果 Excel</button></div>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>#</th><th>Comment</th><th>Sentiment</th><th>Confidence</th></tr></thead>
        <tbody>${results.map((r) => {
          const m = sentimentMeta(r.sentiment);
          return `<tr><td>${r.row}</td><td>${escapeHtml(r.comment)}</td><td><span class="sentiment-badge ${m.cls}">${m.zh}</span></td><td>${percent(r.score)}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  `;

  const old = getChart();
  if (old) old.destroy();
  const ctx = document.querySelector('#sentiment-chart');
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Negative', 'Neutral'],
      datasets: [{ data: [counts.positive, counts.negative, counts.neutral] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      cutout: '68%',
    },
  });
  setChart(chart);

  document.querySelector('#download-results').addEventListener('click', () => {
    const rows = results.map((r) => ({
      Row: r.row,
      Comment: r.comment,
      Sentiment: sentimentMeta(r.sentiment).zh,
      Confidence: Number((r.score * 100).toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sentiment Results');
    XLSX.writeFile(wb, 'sentiment_analysis_results.xlsx');
  });
}

function distributionRow(label, count, total, cls) {
  const pct = total ? (count / total) * 100 : 0;
  return `<div class="dist-row"><div><span>${label}</span><b>${count} · ${pct.toFixed(1)}%</b></div><div class="dist-track"><i class="${cls}" style="width:${pct}%"></i></div></div>`;
}
