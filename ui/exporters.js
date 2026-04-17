import {
  buildStructureArtifacts,
  buildTextsJsonl,
  countTextNodes,
  createZipBuilder,
  encodeText,
  escapeHtml,
  formatRelativeValue,
  getBounds,
  toUint8Array,
} from './shared.js';
import { createPageName, createViewName } from './pages.js';

function waitForUiTurn() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

const SUBTREE_YIELD_INTERVAL = 20;

function encodeJson(value, pretty = false) {
  return encodeText(JSON.stringify(value, null, pretty ? 2 : 0));
}

function normalizeImageDimension(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

function createImageMeta(path, bounds) {
  return {
    path,
    width: normalizeImageDimension(bounds?.width),
    height: normalizeImageDimension(bounds?.height),
    sourceScale: 1,
  };
}

function createPagedIndexHtml(payload, manifestPages, totalViewCount) {
  const pageSections = manifestPages.map((page) => {
    const viewsHtml = page.views.map((view) => {
      const bounds = view.bounds || {};
      const relativeTopLeft = view.relativeTopLeft || {};
      const imagePath = escapeHtml(view.path + '/image.png');
      const tokensPath = escapeHtml(view.path + '/tokens.json');
      const componentsPath = escapeHtml(view.path + '/components.jsonl');
      const indexPath = escapeHtml(view.path + '/structure-index.json');
      const litePath = escapeHtml(view.path + '/structure-lite.json');
      const textsPath = escapeHtml(view.path + '/texts.jsonl');

      return ''
        + '<article class="view-card">'
        + '<div class="view-meta">'
        + '<div class="view-title">' + escapeHtml(view.name) + '</div>'
        + '<div class="view-subtitle">' + escapeHtml(view.frameName || '') + '</div>'
        + '<div class="view-lines">'
        + '<div>bounds: x=' + escapeHtml(String(bounds.x ?? 0)) + ', y=' + escapeHtml(String(bounds.y ?? 0))
        + ', w=' + escapeHtml(String(bounds.width ?? 0)) + ', h=' + escapeHtml(String(bounds.height ?? 0)) + '</div>'
        + '<div>relativeTopLeft: x=' + escapeHtml(formatRelativeValue(relativeTopLeft.x))
        + ', y=' + escapeHtml(formatRelativeValue(relativeTopLeft.y)) + '</div>'
        + '</div>'
        + '<div class="view-links">'
        + '<a href="' + imagePath + '">image</a>'
        + '<a href="' + indexPath + '">structure-index</a>'
        + '<a href="' + tokensPath + '">tokens</a>'
        + '<a href="' + componentsPath + '">components</a>'
        + '<a href="' + litePath + '">structure-lite</a>'
        + '<a href="' + textsPath + '">texts</a>'
        + '</div>'
        + '</div>'
        + '<img src="' + imagePath + '" alt="' + escapeHtml(view.name) + '" loading="lazy" />'
        + '</article>';
    }).join('');

    return ''
      + '<section class="page-section">'
      + '<div class="page-head">'
      + '<h2>' + escapeHtml(page.name) + '</h2>'
      + '<div class="page-label">' + escapeHtml(page.label || page.name) + '</div>'
      + '<div class="page-summary">' + escapeHtml(String(page.viewCount)) + ' views</div>'
      + '</div>'
      + '<div class="view-grid">' + viewsHtml + '</div>'
      + '</section>';
  }).join('');

  return ''
    + '<!doctype html>'
    + '<html lang="zh-Hant">'
    + '<head>'
    + '<meta charset="utf-8" />'
    + '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    + '<title>' + escapeHtml(payload.containerName) + ' - Export Index</title>'
    + '<style>'
    + ':root{color-scheme:light;font-family:"SF Pro Text","Noto Sans TC",sans-serif;background:#f6efe3;color:#2d241d;}'
    + '*{box-sizing:border-box;}'
    + 'body{margin:0;padding:32px;background:linear-gradient(180deg,#f8f2e8 0%,#efe3d0 100%);}'
    + 'main{max-width:1400px;margin:0 auto;}'
    + 'h1,h2,p{margin:0;}'
    + '.hero{padding:28px 32px;border-radius:24px;background:rgba(255,255,255,0.72);box-shadow:0 20px 60px rgba(83,57,24,0.12);backdrop-filter:blur(8px);}'
    + '.hero h1{font-size:36px;line-height:1.1;margin-bottom:10px;}'
    + '.hero p{font-size:16px;line-height:1.6;color:#5c4737;}'
    + '.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;}'
    + '.chip{padding:10px 14px;border-radius:999px;background:#fff7ef;border:1px solid rgba(126,86,42,0.16);font-size:14px;}'
    + '.page-section{margin-top:28px;padding:24px;border-radius:24px;background:rgba(255,255,255,0.78);box-shadow:0 14px 40px rgba(83,57,24,0.1);}'
    + '.page-head{display:flex;gap:12px;flex-wrap:wrap;align-items:baseline;margin-bottom:18px;}'
    + '.page-head h2{font-size:24px;}'
    + '.page-label,.page-summary{color:#6b5646;font-size:14px;}'
    + '.view-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;}'
    + '.view-card{display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:18px;background:#fffaf4;border:1px solid rgba(126,86,42,0.12);}'
    + '.view-title{font-size:18px;font-weight:700;}'
    + '.view-subtitle{font-size:14px;color:#7f6147;}'
    + '.view-lines{margin-top:8px;font-size:13px;line-height:1.5;color:#5d4838;}'
    + '.view-links{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;}'
    + '.view-links a{color:#8f5c29;text-decoration:none;font-size:13px;font-weight:600;}'
    + '.view-links a:hover{text-decoration:underline;}'
    + 'img{width:100%;height:auto;border-radius:14px;border:1px solid rgba(126,86,42,0.1);background:#fff;}'
    + '@media (max-width: 720px){body{padding:16px;}.hero,.page-section{padding:18px;}.hero h1{font-size:28px;}}'
    + '</style>'
    + '</head>'
    + '<body>'
    + '<main>'
    + '<section class="hero">'
    + '<h1>' + escapeHtml(payload.containerName) + '</h1>'
    + '<p>這份 index.html 會列出所有 Page/View 的圖片與主要資訊，方便直接用瀏覽器快速檢視。</p>'
    + '<div class="stats">'
    + '<div class="chip">Pages: ' + escapeHtml(String(manifestPages.length)) + '</div>'
    + '<div class="chip">Views: ' + escapeHtml(String(totalViewCount)) + '</div>'
    + '<div class="chip">Ignored top-level nodes: ' + escapeHtml(String(payload.ignoredNodes.count)) + '</div>'
    + '</div>'
    + '</section>'
    + pageSections
    + '</main>'
    + '</body>'
    + '</html>';
}

function createAllInOneIndexHtml(payload) {
  const pageSummary = payload.pages.map((page) => {
    const viewList = page.views.map((view) => {
      return '<li>'
        + escapeHtml(createViewName(page.pageNumber, view.viewNumber))
        + ' - ' + escapeHtml(view.frameName || '')
        + ' (x=' + escapeHtml(formatRelativeValue(view.relativeTopLeft?.x))
        + ', y=' + escapeHtml(formatRelativeValue(view.relativeTopLeft?.y)) + ')'
        + '</li>';
    }).join('');

    return ''
      + '<section class="page-section">'
      + '<h2>' + escapeHtml(createPageName(page.pageNumber)) + ' - ' + escapeHtml(page.pageLabel || '') + '</h2>'
      + '<ul>' + viewList + '</ul>'
      + '</section>';
  }).join('');

  return ''
    + '<!doctype html>'
    + '<html lang="zh-Hant">'
    + '<head>'
    + '<meta charset="utf-8" />'
    + '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    + '<title>' + escapeHtml(payload.containerName) + ' - All in one</title>'
    + '<style>'
    + 'body{margin:0;padding:24px;font-family:"SF Pro Text","Noto Sans TC",sans-serif;background:#f7efe3;color:#2f241c;}'
    + 'main{max-width:1200px;margin:0 auto;}'
    + '.hero,.page-section{background:#fffaf3;border:1px solid rgba(120,84,44,0.12);border-radius:20px;padding:20px;box-shadow:0 12px 30px rgba(80,56,27,0.08);}'
    + '.page-section{margin-top:18px;}'
    + 'img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid rgba(120,84,44,0.12);margin-top:16px;background:#fff;}'
    + 'a{color:#8f5c29;text-decoration:none;font-weight:600;}'
    + 'a:hover{text-decoration:underline;}'
    + 'ul{margin:12px 0 0;padding-left:20px;}'
    + 'li{margin:6px 0;line-height:1.5;}'
    + '</style>'
    + '</head>'
    + '<body>'
    + '<main>'
    + '<section class="hero">'
    + '<h1>' + escapeHtml(payload.containerName) + '</h1>'
    + '<p>這份 ZIP 是 All in one 模式，包含整個容器的 1 份 structure.json 與 1 張 image.png。</p>'
    + '<p><a href="structure-index.json">Open structure-index.json</a></p>'
    + '<p><a href="tokens.json">Open tokens.json</a> · <a href="components.jsonl">Open components.jsonl</a> · <a href="layout-blocks.jsonl">Open layout-blocks.jsonl</a> · <a href="text-groups.jsonl">Open text-groups.jsonl</a></p>'
    + '<p><a href="structure.json">Open structure.json</a></p>'
    + '<img src="image.png" alt="' + escapeHtml(payload.containerName) + '" />'
    + '</section>'
    + pageSummary
    + '</main>'
    + '</body>'
    + '</html>';
}

function createExportReadmeMarkdown(mode, payload, pageCount, totalViewCount) {
  const header = mode === 'paged'
    ? '# Figma AI Pack - Page/View Export'
    : '# Figma AI Pack - All in one Export';

  const summary = [
    '- source container: ' + String(payload.containerName || ''),
    '- mode: ' + (mode === 'paged' ? 'Page/View' : 'All in one'),
    '- exported at: ' + new Date().toISOString(),
  ];

  const preflight = [
    '## 開始前',
    '1. 在開始分析、檢索或產生程式前，先對目前資料夾內所有 `.json` 檔做一次 format。',
    '2. 建議命令：`find . -type f -name "*.json" -print0 | while IFS= read -r -d "" file; do tmp="${file}.tmp"; jq -S . "$file" > "$tmp" && mv "$tmp" "$file"; done`',
    '3. 不要對 `.jsonl` 做 pretty format；`jsonl` 必須維持一行一筆紀錄。',
    '4. 完成 format 後，再依下列閱讀順序與任務流程開始處理。',
  ];

  const modeSpecific = mode === 'paged'
    ? [
      '## 建議閱讀順序',
      '1. manifest.json',
      '2. index.html',
      '3. pages/PageX/page.json',
      '4. pages/PageX/views/PageX-ViewY/{texts.jsonl,image.png}',
      '5. pages/PageX/views/PageX-ViewY/structure-index.json',
      '6. pages/PageX/views/PageX-ViewY/subtrees/<subtreeId>.json',
      '7. pages/PageX/views/PageX-ViewY/{components.jsonl,tokens.json,layout-blocks.jsonl,text-groups.jsonl}',
      '8. pages/PageX/views/PageX-ViewY/structure-lite.json',
      '',
      '## 匯出摘要',
      '- page count: ' + String(pageCount),
      '- view count: ' + String(totalViewCount),
    ]
    : [
      '## 建議閱讀順序',
      '1. index.html',
      '2. image.png',
      '3. structure-index.json',
      '4. subtrees/<subtreeId>.json',
      '5. {components.jsonl,tokens.json,layout-blocks.jsonl,text-groups.jsonl}',
      '6. structure.json',
      '',
      '## 匯出摘要',
      '- page count: ' + String(pageCount),
      '- view count: ' + String(totalViewCount),
    ];

  const filePurpose = mode === 'paged'
    ? [
      '## 主要檔案用途',
      '- manifest.json: 整體 page / view 路由與檔案入口',
      '- page.json: 單一 page 的摘要與 view 清單',
      '- index.html: 快速視覺預覽',
      '- texts.jsonl: 文字索引（保留 id 與 path）',
      '- image.png: 與結構對照的畫面截圖，也是最終視覺比對基準',
      '- structure-index.json: 給 AI agent 先檢索 node / 區塊的輕量索引，適合搭配 jq 使用',
      '- subtrees/<subtreeId>.json: 區塊級結構切片，適合局部分析與生成',
      '- components.jsonl: component / instance 摘要清單',
      '- tokens.json: 顏色、字體、間距、圓角、效果等 token 彙總',
      '- layout-blocks.jsonl: 可能作為 section / block 的容器摘要',
      '- text-groups.jsonl: 依容器分組的文字集合',
      '- structure-lite.json: 給 AI/前端生成的精簡語意結構（Page/View）',
    ]
    : [
      '## 主要檔案用途',
      '- index.html: 快速視覺預覽與 page/view 摘要',
      '- image.png: 整個容器的完整畫面，也是最終視覺比對基準',
      '- structure-index.json: 給 AI agent 先檢索 node / 區塊的輕量索引，適合搭配 jq 使用',
      '- subtrees/<subtreeId>.json: 區塊級結構切片，適合局部分析與生成',
      '- components.jsonl: component / instance 摘要清單',
      '- tokens.json: 顏色、字體、間距、圓角、效果等 token 彙總',
      '- layout-blocks.jsonl: 可能作為 section / block 的容器摘要',
      '- text-groups.jsonl: 依容器分組的文字集合',
      '- structure.json: All in one 的完整結構與 page/view 摘要',
    ];

  const agentWorkflow = mode === 'paged'
    ? [
      '## AI Agent 建議流程',
      '1. 先讀 manifest.json，確認有哪些 page / view 與各自路徑。',
      '2. 再讀目標 pages/PageX/page.json，縮小到要處理的 view。',
      '3. 先用 texts.jsonl 與 image.png 理解文案與畫面對照。',
      '4. 再讀 structure-index.json，用 id / path / type / textPreview 定位目標 node 或區塊。',
      '5. 需要區塊級上下文時讀 subtrees/<subtreeId>.json；任務偏向 component / token / layout / copy 時優先讀對應 sidecar 檔。',
      '6. 需要節點細節時，先用 jq 從 structure-lite.json 局部抽出該 node、祖先鏈與必要兄弟摘要。',
      '7. 只有在需要完整 fallback / 深入樣式脈絡時，再局部查看 structure-lite.json。',
      '8. 產生結果後，最後以 image.png 做視覺比對與驗收。',
      '',
      '## 任務對應檔案',
      '- 找文案、比對文字內容、抽取可翻譯字串：優先讀 texts.jsonl。',
      '- 看畫面區塊、比對視覺位置、人工快速理解：優先讀 image.png 與 index.html。',
      '- 找 node、縮小區塊範圍、決定下一步要讀哪段結構：優先讀 structure-index.json。',
      '- 追某一個 node 的樣式與 metadata：先用 structure-index.json 找 id，再用 jq 從 structure-lite.json 局部抽取。',
      '- 分析某個區塊、做局部生成：優先讀 subtrees/<subtreeId>.json。',
      '- 找重複元件：優先讀 components.jsonl。',
      '- 抽設計 token：優先讀 tokens.json。',
      '- 分析容器切塊：優先讀 layout-blocks.jsonl。',
      '- 比對區塊文案集合：優先讀 text-groups.jsonl。',
      '- 重建完整 layout 脈絡或做 fallback：再讀 structure-lite.json。',
      '- 最終確認生成結果是否貼近設計：回頭比對 image.png。',
      '',
      '## 大 JSON 使用原則',
      '- 不要把整份 structure-lite.json 直接貼進 prompt。',
      '- 此模式預設不輸出 nodes/<id>.json。',
      '- 先用 manifest.json / page.json / texts.jsonl / structure-index.json 定位目標區塊，再優先改讀 subtrees/<subtreeId>.json 或用 jq 查 structure-lite.json。',
      '- 只提供與任務有關的節點、祖先鏈、必要的兄弟節點摘要給模型。',
      '- structure-lite.json 是資料來源，不是 prompt 本體；structure-index.json 才是預設入口，subtree 與 task sidecar 才是預設詳細讀取單位。',
      '- 若 lite 很大，優先用 jq 做條件查詢、切 subtree、抽單一路徑，不要整份展開。',
    ]
    : [
      '## AI Agent 建議流程',
      '1. 先讀 index.html 與 image.png，建立整體畫面與區塊分布的全局認知。',
      '2. 再讀 structure-index.json，用 id / path / type / textPreview 定位 page / view 或某個區塊。',
      '3. 需要區塊結構時讀 subtrees/<subtreeId>.json；任務偏向 component / token / layout / copy 時優先讀對應 sidecar 檔。',
      '4. 若只需 page / view 對照，可先參考 structure.json 內的 pages 摘要。',
      '5. 需要節點細節時，先用 jq 從 structure.json 的 structure 區段局部抽出該 node、祖先鏈與必要兄弟摘要。',
      '6. 只有在需要完整 fallback / debug / 深入結構分析時，再局部查看 structure.json 的 structure 內容。',
      '7. 產生結果後，最後以 image.png 做視覺比對與驗收。',
      '',
      '## 任務對應檔案',
      '- 快速理解整體畫面與章節分布：優先讀 index.html 與 image.png。',
      '- 找 node、縮小區塊範圍、決定下一步要讀哪段結構：優先讀 structure-index.json。',
      '- 追某一個 node 的樣式與 metadata：先用 structure-index.json 找 id，再用 jq 從 structure.json 局部抽取。',
      '- 分析某個區塊、做局部生成：優先讀 subtrees/<subtreeId>.json。',
      '- 找重複元件：優先讀 components.jsonl。',
      '- 抽設計 token：優先讀 tokens.json。',
      '- 分析容器切塊：優先讀 layout-blocks.jsonl。',
      '- 比對區塊文案集合：優先讀 text-groups.jsonl。',
      '- 找 page / view 對照與 frame 摘要：優先讀 structure.json 內的 pages。',
      '- 做完整 debug、容器級結構分析、缺少 Page/View 資料時的 fallback：再讀 structure.json。',
      '- 最終確認生成結果是否貼近設計：回頭比對 image.png。',
      '',
      '## 大 JSON 使用原則',
      '- 不要把整份 structure.json 一次全文餵給模型。',
      '- 此模式預設不輸出 nodes/<id>.json。',
      '- 先從 index.html、image.png、structure-index.json、pages 摘要定位範圍，再優先改讀 subtrees/<subtreeId>.json 或用 jq 查 structure.json。',
      '- structure.json 是完整 fallback / debug 資料，適合檢索後局部使用。',
      '- structure.json 是資料來源，不是 prompt 本體；structure-index.json 才是預設入口，subtree 與 task sidecar 才是預設詳細讀取單位。',
      '- 若 structure.json 很大，優先用 jq 做條件查詢、切 subtree、抽單一路徑，不要整份展開。',
    ];

  return [
    header,
    '',
    '這份 README 會說明此 ZIP 的模式與檔案用途，方便離線交接。',
    '',
    '## 基本資訊',
    ...summary,
    '',
    ...preflight,
    '',
    ...modeSpecific,
    '',
    ...filePurpose,
    '',
    ...agentWorkflow,
  ].join('\n');
}

async function buildViewBundle(viewPayload) {
  const sourcePngBytes = toUint8Array(viewPayload.pngBytes);
  const textsJsonl = buildTextsJsonl(viewPayload.structureJson);
  const textCount = countTextNodes(viewPayload.structureJson);
  const imageMeta = createImageMeta('image.png', viewPayload.bounds);
  const {
    structureLite,
    structureIndex,
    subtrees,
    componentsJsonl,
    tokensJson,
    layoutBlocksJsonl,
    textGroupsJsonl,
  } = buildStructureArtifacts(
    viewPayload.structureJson,
    imageMeta,
    textCount,
  );

  return {
    imageMeta,
    structureLite,
    structureIndex,
    subtrees,
    componentsJsonl,
    tokensJson,
    layoutBlocksJsonl,
    textGroupsJsonl,
    textsJsonl,
    textCount,
    imageWidth: imageMeta.width,
    imageHeight: imageMeta.height,
    imageBytes: sourcePngBytes,
  };
}

export async function appendPagedZipPage(session, page, setLoading) {
  const pageName = createPageName(page.pageNumber);
  const pageDir = 'pages/' + pageName;
  const pageViews = [];

  for (const view of page.views) {
    const viewName = createViewName(page.pageNumber, view.viewNumber);
    const viewDir = pageDir + '/views/' + viewName;

    setLoading(true, '正在整理 ' + pageName + ' / View' + String(view.viewNumber) + '...');

    const viewBundle = await buildViewBundle(view);
    await waitForUiTurn();

    session.zipBuilder.addEntry(viewDir + '/structure-lite.json', encodeJson(viewBundle.structureLite));
    session.zipBuilder.addEntry(viewDir + '/structure-index.json', encodeJson(viewBundle.structureIndex));
    for (let index = 0; index < viewBundle.subtrees.length; index += 1) {
      const entry = viewBundle.subtrees[index];
      session.zipBuilder.addEntry(
        viewDir + '/' + entry.path,
        encodeJson(entry.data),
      );

      if ((index + 1) % SUBTREE_YIELD_INTERVAL === 0) {
        await waitForUiTurn();
      }
    }
    session.zipBuilder.addEntry(
      viewDir + '/texts.jsonl',
      encodeText(viewBundle.textsJsonl),
    );
    session.zipBuilder.addEntry(viewDir + '/components.jsonl', encodeText(viewBundle.componentsJsonl));
    session.zipBuilder.addEntry(viewDir + '/tokens.json', encodeJson(viewBundle.tokensJson));
    session.zipBuilder.addEntry(viewDir + '/layout-blocks.jsonl', encodeText(viewBundle.layoutBlocksJsonl));
    session.zipBuilder.addEntry(viewDir + '/text-groups.jsonl', encodeText(viewBundle.textGroupsJsonl));
    session.zipBuilder.addEntry(viewDir + '/image.png', viewBundle.imageBytes);
    await waitForUiTurn();

    pageViews.push({
      viewNumber: view.viewNumber,
      name: viewName,
      frameId: view.frameId,
      frameName: view.frameName,
      bounds: view.bounds,
      relativeTopLeft: view.relativeTopLeft,
      path: viewDir,
      image: {
        width: viewBundle.imageWidth,
        height: viewBundle.imageHeight,
        path: viewDir + '/image.png',
      },
      textCount: viewBundle.textCount,
    });
  }

  const pageJson = {
    format: 'figma-ai-page.v1',
    source: {
      containerId: session.containerId,
      containerName: session.containerName,
    },
    pageNumber: page.pageNumber,
    name: pageName,
    label: page.pageLabel || (Array.isArray(page.frameNames) ? page.frameNames[0] : '') || pageName,
    viewCount: pageViews.length,
    frameNames: Array.isArray(page.frameNames) && page.frameNames.length
      ? page.frameNames
      : pageViews.map((view) => view.frameName),
    views: pageViews,
  };

  session.zipBuilder.addEntry(
    pageDir + '/page.json',
    encodeJson(pageJson, true),
  );

  session.manifestPages.push({
    pageNumber: page.pageNumber,
    name: pageName,
    label: page.pageLabel || (Array.isArray(page.frameNames) ? page.frameNames[0] : '') || pageName,
    viewCount: pageViews.length,
    frameNames: Array.isArray(page.frameNames) && page.frameNames.length
      ? page.frameNames
      : pageViews.map((view) => view.frameName),
    views: pageViews.map((view) => ({
      viewNumber: view.viewNumber,
      name: view.name,
      frameId: view.frameId,
      frameName: view.frameName,
      bounds: view.bounds,
      relativeTopLeft: view.relativeTopLeft,
      path: view.path,
    })),
  });

  session.totalViewCount += pageViews.length;
  session.receivedPages += 1;
}

export async function finalizePagedZipSession(session, setLoading) {
  if (typeof setLoading === 'function') {
    setLoading(true, '正在整理 ZIP 索引...');
  }

  const manifest = {
    format: 'figma-ai-pack.v2',
    source: {
      id: session.containerId,
      name: session.containerName,
    },
    pageCount: session.manifestPages.length,
    totalViewCount: session.totalViewCount,
    ignoredNodeCount: session.ignoredNodes.count,
    ignoredNodes: session.ignoredNodes.items,
    pages: session.manifestPages,
  };

  session.zipBuilder.addEntry('manifest.json', encodeText(JSON.stringify(manifest, null, 2)));
  session.zipBuilder.addEntry(
    'index.html',
    encodeText(createPagedIndexHtml(session, session.manifestPages, session.totalViewCount)),
  );
  session.zipBuilder.addEntry(
    'README.md',
    encodeText(createExportReadmeMarkdown('paged', session, session.manifestPages.length, session.totalViewCount)),
  );
  await waitForUiTurn();

  if (typeof setLoading === 'function') {
    setLoading(true, '正在組裝 ZIP Blob...');
  }
  await waitForUiTurn();

  return {
    blob: session.zipBuilder.buildBlob(),
    fileName: 'figma-ai-pack-' + session.fileName + '.zip',
    pageCount: session.manifestPages.length,
    totalViewCount: session.totalViewCount,
  };
}

export async function buildAllInOneZipPayload(payload, setLoading) {
  const containerPngBytes = toUint8Array(payload.containerPngBytes);
  const imageMeta = createImageMeta('image.png', getBounds(payload.containerStructureJson));
  const textCount = countTextNodes(payload.containerStructureJson);
  const {
    structureIndex,
    subtrees,
    componentsJsonl,
    tokensJson,
    layoutBlocksJsonl,
    textGroupsJsonl,
  } = buildStructureArtifacts(payload.containerStructureJson, imageMeta, textCount);
  await waitForUiTurn();

  if (typeof setLoading === 'function') {
    setLoading(true, '正在整理 All in one 結構...');
  }

  const allInOneJson = {
    format: 'figma-ai-all-in-one.v1',
    source: {
      id: payload.containerId,
      name: payload.containerName,
    },
    image: imageMeta,
    ignoredNodeCount: payload.ignoredNodes.count,
    ignoredNodes: payload.ignoredNodes.items,
    pages: payload.pages.map((page) => ({
      pageNumber: page.pageNumber,
      pageLabel: page.pageLabel,
      frameNames: page.frameNames,
      views: page.views.map((view) => ({
        viewNumber: view.viewNumber,
        frameId: view.frameId,
        frameName: view.frameName,
        bounds: view.bounds,
        relativeTopLeft: view.relativeTopLeft,
      })),
    })),
    structure: payload.containerStructureJson,
  };

  const zipBuilder = createZipBuilder();
  zipBuilder.addEntry('index.html', encodeText(createAllInOneIndexHtml(payload)));
  zipBuilder.addEntry('structure-index.json', encodeJson(structureIndex));
  for (let index = 0; index < subtrees.length; index += 1) {
    const entry = subtrees[index];
    zipBuilder.addEntry(entry.path, encodeJson(entry.data));
    if ((index + 1) % SUBTREE_YIELD_INTERVAL === 0) {
      await waitForUiTurn();
    }
  }
  await waitForUiTurn();

  if (typeof setLoading === 'function') {
    setLoading(true, '正在組裝 All in one ZIP...');
  }
  await waitForUiTurn();

  zipBuilder.addEntry('components.jsonl', encodeText(componentsJsonl));
  zipBuilder.addEntry('tokens.json', encodeJson(tokensJson));
  zipBuilder.addEntry('layout-blocks.jsonl', encodeText(layoutBlocksJsonl));
  zipBuilder.addEntry('text-groups.jsonl', encodeText(textGroupsJsonl));
  zipBuilder.addEntry('structure.json', encodeJson(allInOneJson));
  zipBuilder.addEntry('image.png', containerPngBytes);
  zipBuilder.addEntry(
    'README.md',
    encodeText(
      createExportReadmeMarkdown(
        'all-in-one',
        payload,
        Array.isArray(payload.pages) ? payload.pages.length : 0,
        Array.isArray(payload.pages)
          ? payload.pages.reduce((sum, page) => sum + (Array.isArray(page.views) ? page.views.length : 0), 0)
          : 0,
      ),
    ),
  );
  await waitForUiTurn();

  return {
    blob: zipBuilder.buildBlob(),
    fileName: 'figma-ai-pack-' + payload.fileName + '-all-in-one.zip',
  };
}

export function createZipSession(msg) {
  return {
    exportMode: msg.exportMode,
    containerId: msg.containerId,
    containerName: msg.containerName,
    ignoredNodes: msg.ignoredNodes,
    fileName: msg.fileName,
    totalPages: Number(msg.totalPages || 0),
    manifestPages: [],
    totalViewCount: 0,
    receivedPages: 0,
    zipBuilder: msg.exportMode === 'paged' ? createZipBuilder() : null,
  };
}
