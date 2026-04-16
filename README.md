# Figma AI ZIP Exporter

這個 plugin 會把 Figma 中選取的單一父層容器整理成適合 AI 與前端程式處理的 ZIP。

目前有兩種輸出模式：

- `Page/View`
  - 依第一層 `FRAME` 的位置切成多個 page / view
  - 每個 view 輸出：
    - `image.png`
    - `structure-lite.json`
    - `texts.jsonl`
  - 每個 page 額外輸出 `page.json`
  - ZIP 根目錄輸出 `manifest.json`、`index.html`、`README.md`
- `All in one`
  - 整個容器只輸出：
    - `image.png`
    - `index.html`
    - `README.md`

## 目前版本的重點做法

- `Page/View` 模式不輸出每個 view `structure-lite.json`
- `structure-lite.json` 為 semantic 版
  - 不輸出 `id`
  - 保留 `TEXT / LAYOUT / COMPONENT` 生成 Vue 所需的骨架資訊
  - 已補上高還原 CSS 所需的 `style / textStyle`
  - 會盡量展平無意義 wrapper，減少裝飾性節點噪音
- `All in one` 的 `structure.json` 仍保留較完整的容器樹
  - 目前仍含 `id`
  - 已補上 layout / component metadata
- `texts.jsonl` 仍保留文字抽取結果與 `id`
  - 方便文字索引與後續對照
- ZIP 目前一律 `STORE`
  - 先以穩定下載為優先，不做文字壓縮
- plugin 端有 selection analysis / parsed structure cache
  - 選取不變時可重用分析結果
- UI 端對 paged stream 有 queue 保護
  - 避免 `prepare-zip-complete` 早於 page write 完成造成空 ZIP
- UI 邏輯目前維持在 `ui.html` 內（`<script>`）
  - 以單檔方式配合 Figma plugin 載入流程

## `structure-lite.json` 目前保留哪些資訊

semantic `structure-lite.json` 主要保留：

- `type`
- `name`
  - 只在 root / semantic container / component 節點保留
- `bounds`
- `text`
  - 只在 `TEXT` 節點保留
- `style`
  - `fills`
  - `strokes`
  - `strokeWeight / strokeAlign / strokeCap / strokeJoin / strokeDashes`
  - `cornerRadius / cornerRadii`
  - `effects`
  - `opacity / blendMode / clipsContent`
- `textStyle`
  - `fontFamily / fontStyle / fontWeight / fontSize`
  - `lineHeight / letterSpacing`
  - `textCase / textDecoration`
  - `textAlignHorizontal / textAlignVertical`
  - `paragraphSpacing / paragraphIndent`
  - 混合字級 / 顏色時的 `segments`
- `layout`
  - `mode`
  - `itemSpacing`
  - `padding`
  - `primaryAxisAlign`
  - `counterAxisAlign`
  - `sizingHorizontal`
  - `sizingVertical`
- `layoutItem`
  - `align`
  - `grow`
  - `positioning`
- `component`
  - `kind`
  - `name`
  - `variantProperties`
- `children`

這份 JSON 比較適合：

- 產生 Vue component tree
- 推 layout / flex 結構
- 重建高還原外觀 CSS
- 重建 typography / color token

目前仍有取捨：

- `structure-lite.json` 不是完整 debug dump
- 不會保留所有 Figma 專用欄位
- 如果文字節點本身非常複雜，仍以「可生成」優先，而不是 100% 還原 Figma 內部模型

## 輸出內容說明

### `manifest.json`

整體 page / view 對照表，包含：

- `pageCount`
- `totalViewCount`
- `ignoredNodes`
- `pages`

### `page.json`

單一 page 的摘要資訊，包含：

- `pageNumber`
- `label`
- `frameNames`
- `views`

### `structure-lite.json`

給 AI 與前端生成用途的 semantic 樹。

### `texts.jsonl`

抽出的文字內容索引。每一行是一筆文字節點，包含：

- `id`
- `name`
- `type`
- `text`
- `path`
- `bounds`

### `structure.json`

只在 `All in one` 模式輸出。  
它保留整個容器的 parsed tree，仍適合做較完整的 debug / fallback 分析。

### `README.md` (ZIP 內)

每次匯出的 ZIP 根目錄都會附上一份 `README.md`，方便人或 AI agent 在離線拿到資料時快速理解：

- 這包資料是哪種輸出模式
- 建議閱讀順序
- 主要檔案用途

## 目前已知取捨

- 下載穩定性優先於壓縮率
  - 之前曾嘗試文字壓縮，但在大 JSON 上會卡 UI，已移除
- `structure-lite.json` 現在偏向「可生成」而不是「可回朔」
  - 不再保留 `id`
- `texts.jsonl` 與 `All in one structure.json` 仍保留較多回朔資訊
  - 讓 debug 與 fallback 不至於完全失去對照能力

## 在 Figma 中如何使用

1. 選取一個父層容器
2. 執行 plugin
3. 等待 plugin 分析第一層 `FRAME`
4. 視需要調整每個 view 的 `Page Number / View Number`
5. 選擇輸出模式
6. 下載 ZIP

限制：

- 只能選取一個父層容器
- 只分析該容器的第一層子節點
- 第一層中只有符合條件的 `FRAME` 會被當成可匯出的畫面

## 開發

安裝依賴：

```bash
npm install
```

編譯：

```bash
npm run build
```

檢查：

```bash
npm run lint
```

目前重要檔案：

- `code.ts`
  - plugin 主邏輯
  - selection analysis
  - cache
  - raw parsed tree / export stream
- `ui.html`
  - UI 結構與樣式
  - UI 邏輯
  - semantic `structure-lite` build
  - ZIP write / download
- `AGENTS.md`
  - 給後續 AI agent 快速接手的背景說明
