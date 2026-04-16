import {
  buildStructureLite,
  buildTextsJsonl,
  countTextEntries,
  createZipBuilder,
  encodeText,
  escapeHtml,
  formatRelativeValue,
  loadImageFromBytes,
  toUint8Array,
} from './shared.js';
import { createPageName, createViewName } from './pages.js';

function createPagedIndexHtml(payload, manifestPages, totalViewCount) {
  const pageSections = manifestPages.map((page) => {
    const viewsHtml = page.views.map((view) => {
      const bounds = view.bounds || {};
      const relativeTopLeft = view.relativeTopLeft || {};
      const imagePath = escapeHtml(view.path + '/image.png');
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

  const modeSpecific = mode === 'paged'
    ? [
      '## 建議閱讀順序',
      '1. manifest.json',
      '2. index.html',
      '3. pages/PageX/page.json',
      '4. pages/PageX/views/PageX-ViewY/{structure-lite.json,texts.jsonl,image.png}',
      '',
      '## 匯出摘要',
      '- page count: ' + String(pageCount),
      '- view count: ' + String(totalViewCount),
    ]
    : [
      '## 建議閱讀順序',
      '1. structure.json',
      '2. image.png',
      '3. index.html',
      '',
      '## 匯出摘要',
      '- page count: ' + String(pageCount),
      '- view count: ' + String(totalViewCount),
    ];

  return [
    header,
    '',
    '這份 README 會說明此 ZIP 的模式與檔案用途，方便離線交接。',
    '',
    '## 基本資訊',
    ...summary,
    '',
    ...modeSpecific,
    '',
    '## 主要檔案用途',
    '- index.html: 快速視覺預覽',
    '- structure-lite.json: 給 AI/前端生成的精簡語意結構（Page/View）',
    '- texts.jsonl: 文字索引（保留 id）',
    '- structure.json: 完整結構（All in one）',
  ].join('\n');
}

async function buildViewBundle(viewPayload) {
  const sourcePngBytes = toUint8Array(viewPayload.pngBytes);
  const sourceImage = await loadImageFromBytes(sourcePngBytes);
  const textsJsonl = buildTextsJsonl(viewPayload.structureJson);
  const textCount = countTextEntries(textsJsonl);
  const imageMeta = {
    path: 'image.png',
    width: sourceImage.width,
    height: sourceImage.height,
    sourceScale: 1,
  };
  const structureLite = buildStructureLite(viewPayload.structureJson, imageMeta, textCount);

  return {
    imageMeta,
    structureLite,
    textsJsonl,
    textCount,
    imageWidth: sourceImage.width,
    imageHeight: sourceImage.height,
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

    session.zipBuilder.addEntry(
      viewDir + '/structure-lite.json',
      encodeText(JSON.stringify(viewBundle.structureLite, null, 2)),
    );
    session.zipBuilder.addEntry(
      viewDir + '/texts.jsonl',
      encodeText(viewBundle.textsJsonl),
    );
    session.zipBuilder.addEntry(viewDir + '/image.png', viewBundle.imageBytes);

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
    encodeText(JSON.stringify(pageJson, null, 2)),
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

export function finalizePagedZipSession(session) {
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

  return {
    blob: session.zipBuilder.buildBlob(),
    fileName: 'figma-ai-pack-' + session.fileName + '.zip',
    pageCount: session.manifestPages.length,
    totalViewCount: session.totalViewCount,
  };
}

export async function buildAllInOneZipPayload(payload) {
  const containerPngBytes = toUint8Array(payload.containerPngBytes);
  const containerImage = await loadImageFromBytes(containerPngBytes);
  const allInOneJson = {
    format: 'figma-ai-all-in-one.v1',
    source: {
      id: payload.containerId,
      name: payload.containerName,
    },
    image: {
      path: 'image.png',
      width: containerImage.width,
      height: containerImage.height,
      sourceScale: 1,
    },
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
  zipBuilder.addEntry('structure.json', encodeText(JSON.stringify(allInOneJson, null, 2)));
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
