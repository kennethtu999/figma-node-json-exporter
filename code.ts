// 開啟一個隱藏的 UI 用來觸發瀏覽器的下載行為
figma.showUI(__html__, { visible: false });

async function extractNodeData() {
  // 1. 取得當前畫面的選取範圍 (Array)
  const selection = figma.currentPage.selection;
  
  // 2. 檢查防呆：如果使用者什麼都沒選，就提示並關閉
  if (selection.length === 0) {
    figma.notify("請先在畫面上選取至少一個物件！", { error: true });
    figma.closePlugin();
    return;
  }

  // 3. 實作「白名單」遞迴解析器
  function parseNode(node: SceneNode): any {
    const data: any = {
      id: node.id,
      name: node.name,
      type: node.type,
    };

    // 提取座標與尺寸
    if ('x' in node) data.x = node.x;
    if ('y' in node) data.y = node.y;
    if ('width' in node) data.width = node.width;
    if ('height' in node) data.height = node.height;

    // 如果是文字節點，提取文字內容
    if (node.type === 'TEXT') {
      data.characters = node.characters;
    }

    // 如果是群組或 Frame，遞迴往下抓取所有子節點
    if ('children' in node) {
      data.children = node.children.map(child => parseNode(child as SceneNode));
    }

    return data;
  }

  try {
    figma.notify("正在解析選取的節點...");
    
    // 4. 解析所有選取的節點
    // 如果只選了一個，就回傳單一物件的 JSON；如果選了多個，則回傳陣列的 JSON
    const extractedData = selection.length === 1 
      ? parseNode(selection[0] as SceneNode) 
      : selection.map(node => parseNode(node as SceneNode));

    // 5. 動態產生檔名 (拿第一個選取節點的名字，並過濾掉不合法的檔案字元)
    const safeName = selection[0].name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const fileName = selection.length === 1 ? safeName : `${safeName}_等多個物件`;

    // 6. 將資料傳送給 UI 端準備下載
    figma.ui.postMessage({ type: 'export-json', data: extractedData, fileName: fileName });
    
  } catch (error) {
    console.error(error);
    figma.notify("解析過程發生錯誤，請查看 Console。");
    figma.closePlugin();
  }
}

// 監聽 UI 端傳來的關閉訊號
figma.ui.onmessage = msg => {
  if (msg.type === 'close') {
    figma.closePlugin("✅ 匯出成功！");
  }
};

extractNodeData();