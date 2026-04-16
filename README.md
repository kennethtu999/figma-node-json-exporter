# Figma AI ZIP Exporter

這個 plugin 會把 Figma 中選取的單一父層容器整理成適合 AI 與前端程式處理的 ZIP。

## Output Modes

### `Page/View`

- 依第一層 `FRAME` 的位置切成多個 page / view
- 每個 view 輸出：
  - `image.png`
  - `structure-lite.json`
  - `texts.jsonl`
- 每個 page 額外輸出 `page.json`
- ZIP 根目錄輸出：
  - `manifest.json`
  - `index.html`
  - `README.md`

### `All in one`

- 整個容器輸出：
  - `image.png`
  - `structure.json`
  - `index.html`
  - `README.md`

## `structure-lite.json`

`structure-lite.json` 目前格式版本為 `figma-ai-content.v2`。

它是給 AI 與前端使用的精簡語意樹，重點是保留足夠的結構、樣式、文字與 component 資訊，用來：

- 產生 Vue component tree
- 推 auto layout / flex 結構
- 重建主要外觀 CSS
- 重建 typography / color token
- 搭配 `texts.jsonl` / `image.png` 做內容與畫面對照

### Top-level Fields

- `format`
- `image`
  - `path`
  - `width`
  - `height`
  - `sourceScale`
- `stats`
  - `rootCount`
  - `textCount`
- `roots`

### Node Fields

每個 node 可能包含：

- `type`
- `name`
- `bounds`
- `text`
- `style`
- `layout`
- `layoutItem`
- `textStyle`
- `component`
- `children`

### `style`

- `visible`
- `opacity`
- `blendMode`
- `clipsContent`
- `fills`
- `strokes`
- `strokeWeight`
- `strokeAlign`
- `strokeCap`
- `strokeJoin`
- `strokeDashes`
- `cornerRadius`
- `cornerRadii`
- `effects`

### `layout`

- `mode`
- `wrap`
- `sizingHorizontal`
- `sizingVertical`
- `primaryAxisSizing`
- `counterAxisSizing`
- `primaryAxisAlign`
- `counterAxisAlign`
- `counterAxisAlignContent`
- `itemSpacing`
- `counterAxisSpacing`
- `itemReverseZIndex`
- `strokesIncludedInLayout`
- `padding`

### `layoutItem`

- `align`
- `grow`
- `positioning`
- `sizingHorizontal`
- `sizingVertical`

### `textStyle`

- `fontFamily`
- `fontStyle`
- `fontSize`
- `lineHeight`
- `letterSpacing`
- `textCase`
- `textDecoration`
- `textAlignHorizontal`
- `textAlignVertical`
- `paragraphSpacing`
- `paragraphIndent`
- `segments`

### `component`

- `kind`
- `name`
- `variantProperties`
- `componentPropertyReferences`

## Other Exported Files

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
它保留整個容器的 parsed tree，適合做較完整的 debug / fallback 分析。

## Current Constraints

- `structure-lite.json` 不是完整 debug dump
- 不會保留所有 Figma 專用欄位
- 不會保留完整 constraint / variable binding / interaction schema
- `textStyle.segments` 只在文字樣式有切段時輸出
- `component` 目前不主動讀取 instance 的 main component 詳細資料
- 讀取 `variantProperties` / `componentPropertyReferences` 時採防呆模式；若 Figma 文件中的 component set 有錯，匯出會略過該 metadata，而不是整體失敗

## Usage

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

## Development

安裝依賴：

```bash
npm install
```

編譯：

```bash
npm run build
```

只重建 UI：

```bash
npm run build:ui
```

檢查：

```bash
npm run lint
```

## Key Files

- `code.ts`
  - plugin 主邏輯
  - selection analysis
  - raw parsed tree
  - export stream
- `ui.template.html`
  - UI HTML/CSS 樣板
- `ui.html`
  - build 產物
  - 提供 Figma `figma.showUI(__html__)` 載入
- `ui/app.js`
  - UI 入口
  - DOM 綁定
  - plugin message / 使用者互動流程
- `ui/pages.js`
  - Page/View 狀態管理
  - 重排與編號邏輯
- `ui/exporters.js`
  - ZIP session
  - `Page/View` / `All in one` 輸出組裝
- `ui/shared.js`
  - 共用工具
  - ZIP builder
  - `structure-lite.json` build
- `scripts/build-ui.js`
  - 將 `ui/*.js` 模組串成 inline script
  - 重新產生 `ui.html`

## Documentation Rule

`README.md` 與 `AGENTS.md` 必須永遠描述目前最終狀態。

未來任何 AI agent 完成任務後，都必須重新檢查並同步更新這兩份文件；文件不得保留歷程敘述、修復過程、暫時方案或版本演進描述。
