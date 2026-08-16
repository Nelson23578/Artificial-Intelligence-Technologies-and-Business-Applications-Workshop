import * as ort from 'onnxruntime-web';
import { shell, percent } from './ui.js';

const MNIST_MODEL_URL = 'https://huggingface.co/onnxmodelzoo/mnist-8/resolve/main/mnist-8.onnx';
const ORT_VERSION = '1.27.0';
let mnistModelPromise = null;

function loadMnistModel() {
  if (!mnistModelPromise) {
    // GitHub Pages does not provide cross-origin isolation, so keep WASM single-threaded.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
    mnistModelPromise = ort.InferenceSession.create(MNIST_MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }
  return mnistModelPromise;
}

export function renderHandwriting(root) {
  root.innerHTML = shell(`
    <section class="lab-header">
      <span class="page-kicker"> Workshop 01 · HANDWRITING</span>
      <h1>手寫數字辨識</h1>
      <p>選擇單一或多數字模式，在畫布上書寫後按「AI 辨識」。</p>
    </section>

    <section class="workspace two-col">
      <div class="panel">
        <div class="panel-head">
          <h2>手寫畫布</h2>
          <div class="segmented" role="tablist">
            <button class="segment active" data-mode="single">單一數字</button>
            <button class="segment" data-mode="multi">多個數字</button>
          </div>
        </div>

        <div class="canvas-wrap">
          <canvas id="digit-canvas" width="720" height="280" aria-label="手寫數字畫布"></canvas>
          <div id="canvas-hint" class="canvas-hint">請寫一個 0–9 的數字</div>
        </div>
        <p id="multi-tip" class="helper hidden">多數字請保留間距，例如「2 0 2 6」。</p>
        <div class="button-row">
          <button id="clear-digit" class="btn ghost">清除</button>
          <button id="predict-digit" class="btn primary">AI 辨識</button>
        </div>
        <div id="digit-status" class="status info">第一次辨識時會載入模型。</div>
      </div>

      <div class="panel result-panel">
        <div class="panel-head"><h2>辨識結果</h2></div>
        <div id="digit-empty" class="empty-state">
          <div class="empty-icon">✍️</div>
          <b>尚未辨識</b>
          <span>寫完數字後按「AI 辨識」。</span>
        </div>
        <div id="single-result" class="hidden"></div>
        <div id="multi-result" class="hidden"></div>
      </div>
    </section>
  `, { active: 'handwriting' });

  setupHandwriting();
}

function setupHandwriting() {
  const canvas = document.querySelector('#digit-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const hint = document.querySelector('#canvas-hint');
  const status = document.querySelector('#digit-status');
  const multiTip = document.querySelector('#multi-tip');
  let mode = 'single';
  let drawing = false;
  let hasInk = false;

  const resetCanvas = () => {
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 24;
    hasInk = false;
    hint.classList.remove('hidden');
    hideResults();
    status.className = 'status info';
    status.textContent = '第一次辨識時會載入模型。';
  };

  resetCanvas();

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    hasInk = true;
    hint.classList.add('hidden');
    canvas.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pointFromEvent(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  const stopDrawing = () => { drawing = false; };
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);

  document.querySelector('#clear-digit').addEventListener('click', resetCanvas);

  document.querySelectorAll('.segment[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      document.querySelectorAll('.segment[data-mode]').forEach((b) => b.classList.toggle('active', b === button));
      hint.textContent = mode === 'single' ? '請寫一個 0–9 的數字' : '請寫多個數字，例如 2026';
      multiTip.classList.toggle('hidden', mode !== 'multi');
      resetCanvas();
    });
  });

  document.querySelector('#predict-digit').addEventListener('click', async () => {
    if (!hasInk) {
      status.className = 'status warning';
      status.textContent = '請先在畫布上寫數字。';
      return;
    }

    try {
      status.className = 'status loading';
      status.textContent = '正在載入模型…';
      const model = await loadMnistModel();
      status.textContent = '模型已載入，正在辨識…';

      if (mode === 'single') {
        const box = findInkBoundingBox(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (!box) throw new Error('找不到可辨識的筆畫');
        const result = await predictBox(model, canvas, box);
        showSingleResult(result);
      } else {
        const boxes = segmentDigits(canvas);
        if (!boxes.length) throw new Error('找不到可辨識的數字');
        if (boxes.length > 12) throw new Error('偵測到太多區塊，請讓數字筆畫連續並稍微拉開間距');
        const results = [];
        for (const box of boxes) results.push(await predictBox(model, canvas, box));
        showMultiResult(results);
      }

      status.className = 'status success';
      status.textContent = '辨識完成。';
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = `辨識失敗：${error.message || error}`;
    }
  });
}

function hideResults() {
  document.querySelector('#digit-empty')?.classList.remove('hidden');
  document.querySelector('#single-result')?.classList.add('hidden');
  document.querySelector('#multi-result')?.classList.add('hidden');
}

function findInkBoundingBox(imageData, threshold = 35) {
  const { width, height, data } = imageData;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = data[i];
      if (v > threshold) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function segmentDigits(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = image;
  const active = new Array(width).fill(false);

  for (let x = 0; x < width; x++) {
    let ink = 0;
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4] > 35) ink++;
    }
    active[x] = ink >= 2;
  }

  const rawRuns = [];
  let start = -1;
  for (let x = 0; x <= width; x++) {
    if (x < width && active[x] && start < 0) start = x;
    if ((x === width || !active[x]) && start >= 0) {
      rawRuns.push([start, x - 1]);
      start = -1;
    }
  }

  // Small gaps often come from lifting the pen within the same digit; merge them.
  const merged = [];
  const maxInternalGap = 10;
  for (const run of rawRuns) {
    const last = merged.at(-1);
    if (last && run[0] - last[1] - 1 <= maxInternalGap) last[1] = run[1];
    else merged.push([...run]);
  }

  return merged
    .map(([x1, x2]) => {
      let minY = height, maxY = -1;
      for (let x = x1; x <= x2; x++) {
        for (let y = 0; y < height; y++) {
          if (data[(y * width + x) * 4] > 35) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      const pad = 6;
      return {
        x: Math.max(0, x1 - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(width - Math.max(0, x1 - pad), (x2 - x1 + 1) + pad * 2),
        h: Math.min(height - Math.max(0, minY - pad), (maxY - minY + 1) + pad * 2),
      };
    })
    .filter((b) => b.w >= 8 && b.h >= 15);
}

async function predictBox(model, sourceCanvas, box) {
  const normalized = normalizeDigit(sourceCanvas, box);
  const pixels = normalized.getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, 28, 28).data;

  const input = new Float32Array(28 * 28);
  for (let i = 0; i < input.length; i++) input[i] = pixels[i * 4] / 255;

  const inputTensor = new ort.Tensor('float32', input, [1, 1, 28, 28]);
  const feeds = { [model.inputNames[0]]: inputTensor };
  const outputMap = await model.run(feeds);
  const logits = Array.from(outputMap[model.outputNames[0]].data);
  const probs = softmax(logits);
  const digit = probs.indexOf(Math.max(...probs));

  return { digit, confidence: probs[digit], probs, preview: normalized.toDataURL('image/png') };
}

function softmax(values) {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function normalizeDigit(sourceCanvas, box) {
  // MNIST examples are 28×28 grayscale, black background / white foreground.
  // First fit the written digit into a 20×20 area while preserving aspect ratio.
  const stage = document.createElement('canvas');
  stage.width = 28; stage.height = 28;
  const sctx = stage.getContext('2d', { willReadFrequently: true });
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, 28, 28);

  const target = 20;
  const scale = Math.min(target / box.w, target / box.h);
  const dw = Math.max(1, box.w * scale);
  const dh = Math.max(1, box.h * scale);
  const dx = (28 - dw) / 2;
  const dy = (28 - dh) / 2;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(sourceCanvas, box.x, box.y, box.w, box.h, dx, dy, dw, dh);

  // MNIST digits are approximately centered by their ink mass rather than only
  // by the rectangular bounding box. Shift the resized digit to its center of mass.
  const image = sctx.getImageData(0, 0, 28, 28);
  let mass = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const value = image.data[(y * 28 + x) * 4] / 255;
      mass += value;
      sumX += x * value;
      sumY += y * value;
    }
  }

  if (!mass) return stage;
  const cx = sumX / mass;
  const cy = sumY / mass;
  const shiftX = Math.round(13.5 - cx);
  const shiftY = Math.round(13.5 - cy);

  const out = document.createElement('canvas');
  out.width = 28; out.height = 28;
  const octx = out.getContext('2d');
  octx.fillStyle = '#000';
  octx.fillRect(0, 0, 28, 28);
  octx.drawImage(stage, shiftX, shiftY);
  return out;
}

function showSingleResult(result) {
  document.querySelector('#digit-empty').classList.add('hidden');
  document.querySelector('#multi-result').classList.add('hidden');
  const el = document.querySelector('#single-result');
  el.classList.remove('hidden');
  const ranked = result.probs.map((p, i) => ({ digit: i, p })).sort((a, b) => b.p - a.p);
  el.innerHTML = `
    <div class="prediction-hero">
      <img class="digit-preview" src="${result.preview}" alt="正規化後的 28×28 數字">
      <div><span>AI Prediction</span><strong>${result.digit}</strong><b>${percent(result.confidence)}</b></div>
    </div>
    <div class="prob-list">
      ${ranked.map((r) => `<div class="prob-row"><span>${r.digit}</span><div><i style="width:${Math.max(1, r.p * 100)}%"></i></div><b>${percent(r.p)}</b></div>`).join('')}
    </div>
  `;
}

function showMultiResult(results) {
  document.querySelector('#digit-empty').classList.add('hidden');
  document.querySelector('#single-result').classList.add('hidden');
  const el = document.querySelector('#multi-result');
  el.classList.remove('hidden');
  const number = results.map((r) => r.digit).join('');
  el.innerHTML = `
    <div class="multi-number"><span>AI Prediction</span><strong>${number}</strong></div>
    <div class="digit-chip-grid">
      ${results.map((r, i) => `<div class="digit-chip"><img src="${r.preview}" alt="第 ${i + 1} 個數字"><div><span>#${i + 1}</span><b>${r.digit}</b><small>${percent(r.confidence)}</small></div></div>`).join('')}
    </div>
  `;
}
