figma.showUI(__html__, { visible: true, width: 380, height: 340 });

type RectData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ParsedNode = {
  id: string;
  name: string;
  type: SceneNode['type'];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  absoluteBoundingBox?: RectData;
  absoluteRenderBounds?: RectData;
  characters?: string;
  children?: ParsedNode[];
};

function toRectData(rect: Rect | null | undefined): RectData | undefined {
  if (!rect) {
    return undefined;
  }

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function getNodeExportBounds(node: SceneNode): Rect | null {
  const renderBounds = 'absoluteRenderBounds' in node ? node.absoluteRenderBounds : null;
  if (renderBounds) {
    return renderBounds;
  }

  return 'absoluteBoundingBox' in node ? node.absoluteBoundingBox : null;
}

function getSelectionBounds(selection: readonly SceneNode[]): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasBounds = false;

  for (const node of selection) {
    const bounds = getNodeExportBounds(node);
    if (!bounds) {
      continue;
    }

    hasBounds = true;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  if (!hasBounds) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function parseNode(node: SceneNode): ParsedNode {
  const data: ParsedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if ('x' in node) data.x = node.x;
  if ('y' in node) data.y = node.y;
  if ('width' in node) data.width = node.width;
  if ('height' in node) data.height = node.height;

  const absoluteBoundingBox = 'absoluteBoundingBox' in node ? toRectData(node.absoluteBoundingBox) : undefined;
  if (absoluteBoundingBox) {
    data.absoluteBoundingBox = absoluteBoundingBox;
  }

  const absoluteRenderBounds = 'absoluteRenderBounds' in node ? toRectData(node.absoluteRenderBounds) : undefined;
  if (absoluteRenderBounds) {
    data.absoluteRenderBounds = absoluteRenderBounds;
  }

  if (node.type === 'TEXT') {
    data.characters = node.characters;
  }

  if ('children' in node) {
    data.children = node.children.map((child) => parseNode(child as SceneNode));
  }

  return data;
}

function getSelectionOrThrow(): readonly SceneNode[] {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error("請先在畫面上選取至少一個物件！");
  }

  return selection;
}

function getSafeFileName(selection: readonly SceneNode[]): string {
  const safeName = selection[0].name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  return selection.length === 1 ? safeName : safeName + "_等多個物件";
}

function postSelectionInfo() {
  const selection = figma.currentPage.selection;

  figma.ui.postMessage({
    type: 'selection-info',
    selectionCount: selection.length,
    firstSelectionName: selection.length > 0 ? selection[0].name : '',
  });
}

async function exportPng(selection: readonly SceneNode[], scale: number): Promise<Uint8Array> {
  if (selection.length === 1) {
    return (selection[0] as ExportMixin).exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
  }

  const bounds = getSelectionBounds(selection);
  if (!bounds) {
    throw new Error('無法取得選取範圍，請確認節點可見並且可匯出。');
  }

  const slice = figma.createSlice();
  slice.name = '__ai_zip_export_range__';
  slice.x = bounds.x;
  slice.y = bounds.y;
  figma.currentPage.appendChild(slice);
  slice.resize(Math.max(bounds.width, 1), Math.max(bounds.height, 1));

  try {
    return await slice.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
  } finally {
    slice.remove();
  }
}

async function handlePrepareZipRequest() {
  const selection = getSelectionOrThrow();

  try {
    figma.notify("正在準備 AI ZIP...");
    figma.ui.postMessage({ type: 'set-loading', isLoading: true });

    const structureJson = selection.length === 1
      ? parseNode(selection[0] as SceneNode)
      : selection.map((node) => parseNode(node as SceneNode));
    const tilePngBytes = await exportPng(selection, 1);
    const fileName = getSafeFileName(selection);

    figma.ui.postMessage({
      type: 'prepare-zip-data',
      structureJson,
      tilePngBytes: Array.from(tilePngBytes),
      fileName,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "準備 AI ZIP 時發生錯誤。";
    figma.ui.postMessage({ type: 'set-loading', isLoading: false });
    figma.notify(message, { error: true });
  }
}

try {
  getSelectionOrThrow();
  postSelectionInfo();
} catch (error) {
  const message = error instanceof Error ? error.message : "請先在畫面上選取至少一個物件！";
  figma.notify(message, { error: true });
  figma.closePlugin();
}

figma.on('selectionchange', () => {
  postSelectionInfo();
});

figma.ui.onmessage = (msg) => {
  if (msg.type === 'prepare-zip') {
    void handlePrepareZipRequest();
  }

  if (msg.type === 'close') {
    figma.closePlugin("✅ 已完成");
  }

  if (msg.type === 'error') {
    const errorMessage =
      typeof msg.message === 'string' && msg.message.length > 0
        ? msg.message
        : "AI ZIP 處理過程發生錯誤，請查看 Console。";
    figma.notify(errorMessage, { error: true });
    figma.closePlugin();
  }
};
