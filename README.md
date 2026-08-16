# AI Experience Lab

給「人工智慧技術與商業應用」課程使用的無程式碼 AI 體驗網站。專案採用 **Vite + Vanilla JavaScript**，學員只需要使用瀏覽器，不需要撰寫 Python 或 JavaScript。

## 目前包含的三個 Lab

### Lab 01 — 手寫數字辨識
- 單一數字模式：在 Canvas 寫 0–9，顯示 AI 預測與 0–9 機率。
- 多數字模式：例如寫 `2 0 2 6`，網站先利用數字間的空白切割，再逐一辨識並組合。
- 使用 ONNX Model Zoo 的預訓練 MNIST CNN（mnist-8），不進行自行訓練。
- 會顯示送入模型前的 28×28 正規化影像，方便教學說明 preprocessing。

> 多數字模式是教學版 segmentation：數字之間請保留明顯空白。若筆畫彼此接觸，切割可能失敗，這本身也可以作為模型／前處理限制的討論素材。

### Lab 02 — 圖片辨識
- 上傳 JPG / PNG / WEBP。
- 使用 TensorFlow.js MobileNet 預訓練模型。
- 顯示 Top-5 ImageNet 分類與信心值。
- 目前只做 **Image Classification**，不包含 Object Detection。

### Lab 03 — NLP 評論情緒分析
- 單筆評論：輸入文字後分析情緒。
- Excel / CSV 批次：讀取評論欄位後逐筆分析。
- 使用 Transformers.js + `Xenova/distilbert-base-multilingual-cased-sentiments-student`。
- 模型原生輸出：Positive / Neutral / Negative。
- 提供統計 Dashboard、分布圖、逐筆結果與結果 Excel 下載。
- `public/samples/reviews_sample.xlsx` 提供可直接測試的範例資料。

---

# 1. 執行環境

建議先安裝：

- **Visual Studio Code**
- **Node.js 22 LTS 或更新版本**
- npm（安裝 Node.js 時會一起安裝）

Vite 8 需要 Node.js 20.19+ 或 22.12+。

在 VS Code 終端確認：

```powershell
node -v
npm -v
```

---

# 2. 在 VS Code 執行

## Step 1 — 解壓縮專案

將 `ai-experience-lab.zip` 解壓縮，例如：

```text
C:\Users\USER\Documents\ai-experience-lab
```

在 VS Code 選擇：

```text
File → Open Folder → ai-experience-lab
```

## Step 2 — 安裝全部套件

在 VS Code Terminal 執行：

```powershell
npm install
```

`package.json` 已經列好全部依賴，所以通常 **只需要這一行**。

本專案會安裝：

- `@tensorflow/tfjs`
- `@tensorflow-models/mobilenet`
- `onnxruntime-web`
- `@huggingface/transformers`
- `chart.js`
- `xlsx` / SheetJS CE
- `vite`

## Step 3 — 啟動網站

```powershell
npm run dev
```

終端通常會出現類似：

```text
Local: http://localhost:5173/
```

按住 Ctrl 點網址，或在瀏覽器輸入該網址。

---

# 3. 其他常用指令

## 建立正式版本

```powershell
npm run build
```

Vite 會產生：

```text
dist/
```

此資料夾就是之後可部署到靜態網站服務的版本。

## 本機預覽正式版本

```powershell
npm run preview
```

---

# 4. 重要：第一次使用模型需要網路

本專案沒有 Backend，也沒有 API Key。AI inference 都在使用者瀏覽器中執行，但預訓練模型權重並沒有全部封裝在 ZIP 內，因此第一次開啟各 Lab 時會從模型來源下載權重：

- MNIST：ONNX Model Zoo `mnist-8` 預訓練 CNN（透過 ONNX Runtime Web 執行）。
- MobileNet：TensorFlow.js 預訓練 MobileNet 權重。
- NLP：Hugging Face Transformers.js ONNX 模型。

瀏覽器之後可能會快取模型，但正式上課前仍建議：

1. 使用教室實際網路環境測試一次三個 Lab。
2. 讓瀏覽器事先載入模型。
3. NLP 模型檔較大，第一次載入會明顯比 MNIST / MobileNet 慢。

---

# 5. Excel 評論格式

最簡單的格式：

| ID | Comment |
|---|---|
| 1 | 服務很好，下次還會再來。 |
| 2 | 等了一個小時，非常失望。 |

網站讀取 Excel 後會讓你選擇哪一欄是評論文字，因此欄位名稱不一定要叫 `Comment`。

為避免工作坊期間單一電腦批次推論時間過長，目前一次最多分析 300 筆非空評論。可在：

```text
src/pages-sentiment.js
```

修改：

```js
const MAX_BATCH_ROWS = 300;
```

---

# 6. 專案結構

```text
ai-experience-lab/
├── index.html
├── package.json
├── README.md
├── public/
│   └── samples/
│       └── reviews_sample.xlsx
└── src/
    ├── main.js
    ├── style.css
    ├── ui.js
    ├── pages-home.js
    ├── pages-handwriting.js
    ├── pages-image.js
    └── pages-sentiment.js
```

---

# 7. 模型與教學定位

## MNIST

目前使用 ONNX Model Zoo 的 `mnist-8` 預訓練 CNN，透過 ONNX Runtime Web 在瀏覽器推論。此模型的 Model Zoo 文件列出的 top-1 error 為 1.1%。網站另加入裁切、等比例縮放與筆畫質心置中，以讓手寫輸入更接近 MNIST 格式。教學流程為：

```text
手寫 → 前處理 → 模型 → 0–9 機率 → 預測
```

## MobileNet

MobileNet 是預訓練 ImageNet image classifier，因此只能從模型既有的 ImageNet 類別中選擇答案。若上傳非常特殊、抽象或不在 ImageNet 類別中的圖片，模型仍然會強迫選出「最像的類別」。這正好可以作為課堂討論。

## NLP

目前 NLP 採 multilingual sentiment model，原生類別為：

```text
positive / neutral / negative
```

因此網站沒有把中性評論硬塞進正評或負評。對於反諷、混合情緒、台灣網路用語與領域特定語境，模型仍可能出錯，可用來討論 training data、context 與 model limitation。

---

# 8. 如果 npm install 發生問題

先確認 Node.js：

```powershell
node -v
```

建議 Node.js 22.12 以上。

如果曾經安裝失敗，可以刪除依賴後重裝：

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
```

再執行：

```powershell
npm run dev
```

---

## 教學使用提醒

這些預訓練模型適合作為課堂體驗與概念展示，不應把輸出視為正式商業決策、品質判定或客戶評價的唯一依據。
