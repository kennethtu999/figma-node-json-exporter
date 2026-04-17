# Figma AI ZIP Exporter

這個 plugin 會把 Figma 中選取的單一父層容器整理成適合 AI 與前端程式處理的 ZIP。

## Output Modes

### `Page/View`

- 依第一層 `FRAME` 的位置切成多個 page / view
- 每個 view 輸出：
  - `image.png`
  - `structure-index.json`
  - `structure-lite.json`
  - `subtrees/<subtreeId>.json`
  - `components.jsonl`
  - `tokens.json`
  - `layout-blocks.jsonl`
  - `text-groups.jsonl`
  - `texts.jsonl`
- 每個 page 額外輸出 `page.json`
- ZIP 根目錄輸出：
  - `manifest.json`
  - `index.html`
  - `README.md`（包含檔案用途與 AI agent 建議閱讀流程）

### `All in one`

- 整個容器輸出：
  - `image.png`
  - `structure-index.json`
  - `structure.json`
  - `subtrees/<subtreeId>.json`
  - `components.jsonl`
  - `tokens.json`
  - `layout-blocks.jsonl`
  - `text-groups.jsonl`
  - `index.html`
  - `README.md`（包含檔案用途與 AI agent 建議閱讀流程）

## Schema Anchor Rule

- 所有主要入口都必須保留 `format` 欄位（manifest / page / index / lite / subtree / tokens）
- `format` 是低成本高回報的 schema 錨點，能降低 AI 解析歧義與誤讀風險

## ZIP README Preflight Rule

- ZIP README 必須要求 agent 在開始處理前，先對當前輸出目錄內所有 `.json` 做 format
- ZIP README 必須提供可直接在 macOS 執行的 `find + jq` 一行指令，例如：`find . -type f -name "*.json" -print0 | while IFS= read -r -d "" file; do tmp="${file}.tmp"; jq -S . "$file" > "$tmp" && mv "$tmp" "$file"; done`
- ZIP README 必須明確說明 `.jsonl` 不能做 pretty format，避免破壞一行一筆的資料結構

## `structure-lite.json`

`structure-lite.json` 目前格式版本為 `figma-ai-content.v4`。

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
  - `subtreeCount`
- `artifacts`
  - `subtreesDir`
  - `componentsPath`
  - `tokensPath`
  - `layoutBlocksPath`
  - `textGroupsPath`
- `roots`

### Node Fields

每個 node 可能包含：

- `id`
- `parentId`
- `path`
- `depth`
- `childIds`
- `childCount`
- `type`
- `name`
- `bounds`
- `text`
- `textPreview`
- `style`
- `layout`
- `layoutItem`
- `textStyle`
- `component`
- `children`
- `subtreeId`
- `subtreeRef`

## `structure-index.json`

`structure-index.json` 目前格式版本為 `figma-ai-index.v2`。

它是給 AI agent 先做檢索與定位的輕量索引，避免一開始就讀完整的 `structure-lite.json` 或 `structure.json`。

### Top-level Fields

- `format`
- `image`
- `stats`
  - `rootCount`
  - `textCount`
  - `nodeCount`
  - `subtreeCount`
- `artifacts`
  - `subtreesDir`
  - `componentsPath`
  - `tokensPath`
  - `layoutBlocksPath`
  - `textGroupsPath`
- `entries`

### Entry Fields

每筆 entry 可能包含：

- `id`
- `parentId`
- `path`
- `type`
- `name`
- `depth`
- `bounds`
- `childCount`
- `descendantCount`
- `textNodeCount`
- `hasText`
- `textPreview`
- `subtreeId`
- `subtreeRef`
- `component`
  - `kind`
  - `name`

## `subtrees/<subtreeId>.json`

`subtrees/<subtreeId>.json` 目前格式版本為 `figma-ai-subtree.v1`。

它是區塊級結構切片，適合局部分析、局部 codegen 與區塊比對。

每個檔案包含：

- `format`
- `image`
- `subtreeId`
- `subtreeRef`
- `rootId`
- `rootPath`
- `stats`
  - `nodeCount`
  - `textCount`
  - `depth`
- `root`

若 subtree 內遇到更深一層已被切出的 subtree，該節點會改成 pruned placeholder，並引導回自己的 `subtreeRef`。

## `components.jsonl`

`components.jsonl` 目前格式版本為 `figma-ai-components.v1`。

每一行是一筆帶有 component metadata 的節點摘要，適合：

- 找重複元件
- 看 instance / variant 分布
- 找 component property references

## `tokens.json`

`tokens.json` 目前格式版本為 `figma-ai-tokens.v1`。

它會彙總常見可重用 token，包含：

- `colors`
- `typography`
- `radii`
- `spacing`
- `effects`
- `strokes`

## `layout-blocks.jsonl`

`layout-blocks.jsonl` 目前格式版本為 `figma-ai-layout-blocks.v1`。

每一行是一筆可能可視為 section / block 的容器摘要，適合做：

- layout 分析
- 容器切塊
- 前端 component skeleton 規劃

## `text-groups.jsonl`

`text-groups.jsonl` 目前格式版本為 `figma-ai-text-groups.v1`。

每一行是一組依容器聚合的文字集合，適合做：

- 區塊文案比對
- 翻譯任務
- 文案 QA

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

## ZIP README Behavior

每份輸出的 ZIP 根目錄都會附帶 `README.md`，內容會依輸出模式自動包含：

- 建議閱讀順序
- 主要檔案用途
- AI agent 建議流程
- 大 JSON 的使用原則

對 `Page/View` 模式，README 會引導先讀 `manifest.json` / `page.json` / `texts.jsonl` / `image.png`，最後才局部查看 `structure-lite.json`。

對 `Page/View` 模式，README 會明確寫出此模式預設不輸出 `nodes/<id>.json`，並引導先讀 `structure-index.json` 定位 node / 區塊，再依需要讀 `subtrees/<subtreeId>.json` 與 task-specific sidecar，必要時才用 `jq` 等工具局部查 `structure-lite.json`，最後以 `image.png` 做視覺比對。

對 `All in one` 模式，README 會明確寫出此模式預設不輸出 `nodes/<id>.json`，並引導先讀 `index.html` / `image.png` 建立整體理解，再先看 `structure-index.json`，接著視任務讀 `subtrees/<subtreeId>.json` 與 task-specific sidecar，必要時才用 `jq` 等工具局部查 `structure.json`，最後以 `image.png` 做視覺比對。

## Current Constraints

- `structure-lite.json` 不是完整 debug dump
- `structure-index.json` 是檢索入口，不是完整樣式資料
- `subtrees/<subtreeId>.json` 是區塊級切片，可能會 pruned 掉更深一層已分出的 subtree
- 預設輸出不包含 `nodes/<id>.json`
- 單一 node 細節建議先透過 `structure-index.json` 定位，再用 `jq` 從 `structure-lite.json` / `structure.json` 局部抽取
- 最終視覺比對以匯出的 `image.png` 為準
- 不會保留所有 Figma 專用欄位
- 不會保留完整 constraint / variable binding / interaction schema
- `textStyle.segments` 只在文字樣式有切段時輸出
- `component` 目前不主動讀取 instance 的 main component 詳細資料
- 讀取 `variantProperties` / `componentPropertyReferences` 時採防呆模式；若 Figma 文件中的 component set 有錯，匯出會略過該 metadata，而不是整體失敗
- 目前的 subtree 切分是 heuristics-based，自動依容器深度、childCount、descendantCount、textNodeCount 決定，不保證完全等同設計師的語意分區

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
  - `structure-lite.json` / `structure-index.json` / subtree / task sidecar build
- `scripts/build-ui.js`
  - 將 `ui/*.js` 模組串成 inline script
  - 重新產生 `ui.html`

## Documentation Rule

`README.md` 與 `AGENTS.md` 必須永遠描述目前最終狀態。

未來任何 AI agent 完成任務後，都必須重新檢查並同步更新這兩份文件；文件不得保留歷程敘述、修復過程、暫時方案或版本演進描述。
