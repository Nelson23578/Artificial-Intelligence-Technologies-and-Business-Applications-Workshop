import * as mobilenet from '@tensorflow-models/mobilenet';
import '@tensorflow/tfjs';
import { shell, percent } from './ui.js';

let mobileNetPromise = null;
function loadMobileNet() {
  if (!mobileNetPromise) mobileNetPromise = mobilenet.load({ version: 2, alpha: 1.0 });
  return mobileNetPromise;
}

export function renderImageRecognition(root) {
  root.innerHTML = shell(`
    <section class="lab-header">
      <span class="page-kicker">LAB 02 · IMAGE CLASSIFICATION</span>
      <h1>圖片辨識</h1>
      <p>上傳一張 JPG、PNG 或 WEBP 圖片，再按「AI 辨識」查看分類結果。</p>
    </section>

    <section class="workspace two-col">
      <div class="panel">
        <div class="panel-head"><h2>上傳圖片</h2></div>
        <label id="image-drop" class="upload-zone" for="image-file">
          <input id="image-file" type="file" accept="image/*" hidden>
          <div id="upload-placeholder">
            <div class="upload-icon">＋</div>
            <b>點擊選擇或拖曳圖片</b>
            <span>JPG / PNG / WEBP</span>
          </div>
          <img id="image-preview" class="uploaded-image hidden" alt="上傳圖片預覽">
        </label>
        <div class="button-row">
          <button id="reset-image" class="btn ghost">重新選擇</button>
          <button id="analyze-image" class="btn primary" disabled>AI 辨識</button>
        </div>
        <div id="image-status" class="status info">第一次辨識時會載入模型。</div>
      </div>

      <div class="panel result-panel">
        <div class="panel-head"><h2>辨識結果</h2></div>
        <div id="image-empty" class="empty-state">
          <div class="empty-icon">🖼️</div><b>尚未辨識</b><span>上傳圖片後按「AI 辨識」。</span>
        </div>
        <div id="image-result" class="hidden"></div>
      </div>
    </section>
  `, { active: 'image' });

  setupImageLab();
}

function setupImageLab() {
  const input = document.querySelector('#image-file');
  const drop = document.querySelector('#image-drop');
  const preview = document.querySelector('#image-preview');
  const placeholder = document.querySelector('#upload-placeholder');
  const analyze = document.querySelector('#analyze-image');
  const status = document.querySelector('#image-status');
  let objectUrl = null;

  const setFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      status.className = 'status warning';
      status.textContent = '請選擇圖片檔案。';
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    analyze.disabled = false;
    document.querySelector('#image-empty').classList.remove('hidden');
    document.querySelector('#image-result').classList.add('hidden');
    status.className = 'status info';
    status.textContent = `已選擇：${file.name}`;
  };

  input.addEventListener('change', () => setFile(input.files?.[0]));

  ['dragenter', 'dragover'].forEach((eventName) => drop.addEventListener(eventName, (e) => {
    e.preventDefault();
    drop.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((eventName) => drop.addEventListener(eventName, (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
  }));
  drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files?.[0]));

  document.querySelector('#reset-image').addEventListener('click', () => {
    input.value = '';
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    preview.removeAttribute('src');
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    analyze.disabled = true;
    document.querySelector('#image-empty').classList.remove('hidden');
    document.querySelector('#image-result').classList.add('hidden');
    status.className = 'status info';
    status.textContent = '第一次辨識時會載入模型。';
  });

  analyze.addEventListener('click', async () => {
    if (!preview.src) return;
    try {
      status.className = 'status loading';
      status.textContent = '正在載入 MobileNet 預訓練模型…';
      const model = await loadMobileNet();
      status.textContent = '模型已載入，正在分析圖片…';
      const predictions = await model.classify(preview, 5);
      showImageResults(predictions);
      status.className = 'status success';
      status.textContent = '辨識完成。';
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = `圖片辨識失敗：${error.message || error}`;
    }
  });
}

function showImageResults(predictions) {
  document.querySelector('#image-empty').classList.add('hidden');
  const result = document.querySelector('#image-result');
  result.classList.remove('hidden');

  if (!predictions?.length) {
    result.innerHTML = '<div class="status warning">模型沒有回傳分類結果。</div>';
    return;
  }

  const top = predictions[0];
  result.innerHTML = `
    <div class="class-hero">
      <span>AI thinks this is</span>
      <strong>${top.className}</strong>
      <b>${percent(top.probability)}</b>
    </div>
    <div class="rank-list">
      ${predictions.map((p, i) => `
        <div class="rank-row">
          <span class="rank-num">${i + 1}</span>
          <div class="rank-info"><b>${p.className}</b><div><i style="width:${Math.max(2, p.probability * 100)}%"></i></div></div>
          <strong>${percent(p.probability)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}
