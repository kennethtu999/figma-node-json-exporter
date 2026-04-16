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

## structure-lite.json Rules

- `structure-lite.json` 目前格式版本為 `figma-ai-content.v2`
- schema 分成兩段生成：
  - `code.ts` 的 `parseNode()` 收集原始節點 metadata
  - `ui/shared.js` 的 `buildStructureLite()` / `toLiteNode()` 輸出 lite schema
- 若調整 `structure-lite.json` 欄位，`code.ts`、`ui/shared.js`、`README.md`、`AGENTS.md` 必須一起同步
- `textStyle.segments` 只在文字樣式有切段時輸出
- 讀取 `variantProperties` / `componentPropertyReferences` 必須防呆；遇到損壞的 Figma component set 時應降級略過 metadata，而不是讓整體匯出失敗

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
