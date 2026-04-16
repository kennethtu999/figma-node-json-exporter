# EXPORT JSON Agent Notes

## 先讀文件

為避免重覆維護與內容分叉，專案背景、輸出格式、已知取捨請以 `README.md` 為主文件。

AI agent 開始工作前請依序閱讀：

1. `README.md`
2. `AGENTS.md`
3. `code.ts`
4. `ui.html`

若 `AGENTS.md` 與 `README.md` 有衝突，以 `README.md` 為準，並補一次文件同步。

## AI Agent 維護責任

如果 AI agent 做了「重要變更」，必須在同一個 PR/提交中更新 `AGENTS.md` 或 `README.md`（必要時兩者都更新）。

重要變更包含：

- 輸出 ZIP 結構改動（檔名、路徑、模式行為）
- 匯出資料 schema 改動（例如 `structure-lite.json` 欄位）
- 匯出穩定性策略改動（stream queue、壓縮策略、錯誤處理）
- 使用流程或限制改動（選取規則、模式說明）

文件更新要求：

- `README.md`：更新「對使用者與開發者有影響」的行為、格式與使用方式
- `AGENTS.md`：更新「AI 接手必須知道」的規範、決策與維護守則
- 若有修改輸出內容，需明確核對：
	- `Page/View` 每個 view 是否僅輸出 `structure-lite.json` / `texts.jsonl` / `image.png`
	- ZIP 根目錄是否包含 `README.md`

## 變更驗證

每次改動後至少執行：

```bash
npm run build
npm run lint
```

若改到匯出內容，請加測：

- `Page/View`
- `All in one`
- 大型容器案例
