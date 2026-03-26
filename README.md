# Figma Node to JSON Exporter

將選取的 Figma 節點直接匯出成輕量化 JSON 檔案，完美避開 API Rate Limit 與大型檔案的 OOM（記憶體不足）問題。

## 🛠️ 環境建置 (首次設定)

本專案使用 TypeScript 開發。請依序執行以下步驟：

1. **安裝 Node.js** 請至 [Node.js 官網](https://nodejs.org/en/download/) 下載並安裝。

2. **安裝 TypeScript** 打開終端機 (Terminal)，執行以下指令進行全域安裝：
   ```bash
   npm install -g typescript
   ```

3. **安裝 Figma API 型別定義** 將終端機路徑切換至本專案資料夾，執行：
   ```bash
   npm install --save-dev @figma/plugin-typings
   ```

---

## 💻 編譯與執行

強烈建議使用 **[Visual Studio Code](https://code.visualstudio.com/)** 來開啟此專案：

1. 用 VS Code 開啟本專案資料夾。
2. 啟動自動編譯：  
   點擊上方選單 **Terminal > Run Build Task...**，然後選擇 **npm: watch**。
3. *完成！現在只要你修改並儲存 `code.ts`，VS Code 就會自動幫你產生 Figma 看得懂的 `code.js`。*

---

## 🚀 如何在 Figma 中使用

1. 打開 Figma 進入你的設計檔。
2. 在畫面上**選取一個或多個你要匯出的節點**。
3. 點擊左上角 Figma 選單：  
   **Plugins > Development > [你的 Plugin 名稱]**
4. 執行後，瀏覽器會自動下載對應的 JSON 檔案。
