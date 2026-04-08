# Figma AI ZIP Exporter

這個 plugin 會把 Figma 中選取的單一父層容器整理成適合程式處理與 AI AGENT 引用的 ZIP。  
目前支援兩種輸出模式：

- `Page/View`：依第一層 `FRAME` 的版面位置切成多個 page，每個 view 各輸出 1 張完整圖片與對應 JSON。
- `All in one`：整個容器只輸出 1 份 JSON + 1 張完整圖片，不做切頁。

專案目前直接保留根目錄的 `code.js` 編譯結果。下載整個專案後，可以直接用根目錄的 `manifest.json` 載入 plugin，不一定要先自行 build。

## 環境建置

本專案使用 TypeScript 開發。

1. 安裝 [Node.js](https://nodejs.org/en/download/)
2. 進入 plugin 目錄後安裝依賴：

```bash
npm install
```

## 編譯

在 `EXPORT JSON` 目錄下執行：

```bash
npm run build
```

執行後會更新：

- `code.js`

開發時可用：

```bash
npm run watch
```

## 在 Figma 中如何使用

1. 在 Figma 中選取一個父層容器，例如一個 section 或 frame 群組的上層節點。
2. 執行 plugin。
3. Plugin 會先分析該容器的第一層子節點，列出偵測到的 `Page / View`。
4. 你可以在畫面上逐筆調整每個 view 的 `Page Number` 與 `View Number`。
5. 選擇輸出模式後下載 ZIP。

注意事項：

- 只能選取一個父層容器。
- 只分析該容器的第一層子節點。
- 第一層中只有 `FRAME` 會被當成可匯出的畫面。
- 像 `Flow Page Mark`、`Artboard Header`、標題、說明等非 `FRAME` 第一層節點都會被忽略。


## AI AGENT 如何使用
可直接把下面這段提供給 AI / LLM：

```text
figma 輸出有兩種模式。

1. Page/View 模式
- 先讀 manifest.json
- pages[] 是 page / view 對照表
- 每個 view 會有 frameName、bounds、relativeTopLeft、path
- 再依 path 讀該 view 的 structure.json、structure-lite.json、texts.jsonl、image.png

2. All in one 模式
- 先讀根目錄 structure.json
- pages[] 是 page / view 對照表
- structure 是整個容器的完整節點樹
- image.png 是整體畫面

欄位重點
- pages：切頁結果與 view 對照
- ignoredNodes：哪些第一層節點被排除，以及原因
- structure.json：完整節點樹
- structure-lite.json：精簡樹，適合先快速理解
- texts.jsonl：純文字抽取結果
- image.png：視覺對照圖
```
