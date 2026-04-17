# EXPORT JSON Agent Notes

## Source Of Truth

- `README.md` 是專案對外與對內的主文件，描述目前最終狀態
- `AGENTS.md` 是 AI agent 接手時必須遵守的維護規則
- 若兩者有衝突，以 `README.md` 為準，並立即同步 `AGENTS.md`

AI agent 開始工作前請依序閱讀：

1. `README.md`
2. `AGENTS.md`
3. `code.ts`
4. `ui.template.html`
5. `ui/app.js`
6. `ui/pages.js`
7. `ui/exporters.js`
8. `ui/shared.js`

## Mandatory Completion Rule

每一位 AI agent 在「完成任何一次任務」後，都必須做以下檢查，這是完成條件的一部分，不可省略：

1. 重新檢查 `README.md` 與 `AGENTS.md` 是否仍然準確描述目前程式狀態
2. 若任何行為、限制、輸出格式、schema、檔案結構、建置方式、維護規則有變動，必須在同一回合同步更新兩份文件
3. 文件只描述「目前最終狀態」，不要保留變更歷程、修復過程、暫時方案、版本演進敘事
4. 不可在程式已變動的情況下跳過文件同步

若本次任務沒有造成任何文件內容失真，也必須做過上述核對後才能結束。

## Current UI Architecture

- `ui.html` 是 build 產物，提供 Figma `figma.showUI(__html__)` 載入
- `ui.template.html` 是 UI HTML/CSS 樣板，保留 `<!-- BUILD:UI_SCRIPT -->` 佔位
- `ui/shared.js`、`ui/pages.js`、`ui/exporters.js`、`ui/app.js` 是實際維護的 UI 模組原始碼
- `scripts/build-ui.js` 會把 UI 模組串成 inline script，重新產生 `ui.html`
- 不要直接手改產出的 `ui.html` 邏輯；要改 UI 行為請修改 `ui.template.html` 或 `ui/*.js`

## ZIP README Rules

- ZIP 根目錄的 `README.md` 由 `ui/exporters.js` 的 `createExportReadmeMarkdown()` 生成
- `Page/View` 與 `All in one` 模式都必須輸出對應模式的 AI agent 使用說明
- ZIP README 必須包含：
  - 建議閱讀順序
  - 主要檔案用途
  - AI agent 建議流程
  - 大 JSON 使用原則
- README 文案要明確引導 AI agent 不要把整份 `structure-lite.json` / `structure.json` 直接貼進 prompt，而是先定位再局部取用
- README 文案要把 `structure-index.json` 當成預設檢索入口，再引導回 `subtrees/<subtreeId>.json`、task-specific sidecar 與 `structure-lite.json` / `structure.json`
- README 文案要明確寫出 v4 default 預設不輸出 `nodes/<id>.json`
- README 文案要明確說明最終視覺比對以匯出的 `image.png` 為準
- README 文案要明確要求 agent 開始處理前，先對 ZIP 內所有 `.json` 做 format，再開始分析
- README 文案要提供可直接在 macOS 執行的 `find + jq` 一行指令
- README 文案要明確說明 `.jsonl` 不可做 pretty format
- 若調整 ZIP README 的內容結構或使用指引，`README.md` 與 `AGENTS.md` 必須一起同步

## Schema Anchor Rules

- 所有主要入口都必須保留 `format` 欄位（manifest / page / index / lite / subtree / tokens）
- `format` 是 schema 錨點，缺少時會提高 AI 解析歧義與 prompt 成本
- 若調整任何入口 schema，需同步檢查 `format` 版本字串與對應文件描述

## structure-lite.json Rules

- `structure-lite.json` 目前格式版本為 `figma-ai-content.v4`
- schema 分成兩段生成：
  - `code.ts` 的 `parseNode()` 收集原始節點 metadata
  - `ui/shared.js` 的 `buildStructureArtifacts()` / `toLiteNodeWithContext()` 輸出 lite schema
- lite node 必須保留 agent 檢索欄位：
  - `id`
  - `parentId`
  - `path`
  - `depth`
  - `childIds`
  - `childCount`
  - `textPreview`
  - `subtreeId`
  - `subtreeRef`
- 若調整 `structure-lite.json` 欄位，`code.ts`、`ui/shared.js`、`README.md`、`AGENTS.md` 必須一起同步
- `textStyle.segments` 只在文字樣式有切段時輸出
- 讀取 `variantProperties` / `componentPropertyReferences` 必須防呆；遇到損壞的 Figma component set 時應降級略過 metadata，而不是讓整體匯出失敗

## structure-index.json Rules

- `structure-index.json` 目前格式版本為 `figma-ai-index.v2`
- `structure-index.json` 是 AI agent 的預設檢索入口，必須比對應的 `structure-lite.json` / `structure.json` 更輕量
- index entry 在有分區塊時必須提供 `subtreeId` / `subtreeRef`
- index entry 只保留定位欄位與 component 摘要，不應重複輸出完整 `style` / `layout` / `children`
- `Page/View` 模式的每個 view 目錄與 `All in one` 根目錄都必須輸出 `structure-index.json`

## Subtree Rules

- v4 default 輸出不包含 `nodes/<id>.json`
- 單一 node 細節查詢應優先走 `structure-index.json` 定位，再用 `jq` 等工具從 `structure-lite.json` / `structure.json` 局部抽取
- v3 之後每個 subtree 都必須輸出 `subtrees/<subtreeId>.json`
- subtree 允許在遇到更深一層已切出的 subtree 時輸出 pruned placeholder，避免單一 subtree 再膨脹成接近完整樹
- subtree 切分目前採 heuristic 規則，若調整切分策略，`README.md` 與 `AGENTS.md` 必須一起同步

## Task Sidecar Rules

- `components.jsonl`
  - 收集帶有 component metadata 的節點摘要
- `tokens.json`
  - 彙總 color / typography / spacing / radius / effect / stroke token
- `layout-blocks.jsonl`
  - 收集可能作為 section / block 的容器摘要
- `text-groups.jsonl`
  - 依容器聚合文字集合
- 這些 sidecar 是 agent-first artifact；若調整輸出欄位或用途，`README.md` 與 `AGENTS.md` 必須一起同步

## Required Verification

修改程式、schema、UI、輸出內容或建置流程後，至少執行：

```bash
npm run build:ui
npm run build
npm run lint
```

若改到匯出內容，應再實測：

- `Page/View`
- `All in one`
- 大型容器案例
