import { buildAllInOneZipPayload, appendPagedZipPage, createZipSession, finalizePagedZipSession } from './exporters.js';
import { createPageName, createPageStore, createViewName } from './pages.js';
import { downloadBlob, escapeHtml, formatRelativeValue, normalizeInteger } from './shared.js';

const selectionInfo = document.getElementById('selection-info');
const closeButton = document.getElementById('close-button');
const prepareButton = document.getElementById('prepare-button');
const statusBox = document.getElementById('status');
const pickerNote = document.getElementById('picker-note');
const pagesListContent = document.getElementById('pages-list-content');
const exportModeInputs = Array.from(document.querySelectorAll('input[name="export-mode"]'));

const pageStore = createPageStore();
let activeZipSession = null;

function setLoading(isLoading, message) {
  closeButton.disabled = isLoading;
  prepareButton.disabled = isLoading;
  prepareButton.textContent = isLoading ? '整理中...' : '準備下載';

  if (message) {
    statusBox.textContent = message;
    statusBox.classList.add('is-visible');
  } else if (!isLoading) {
    statusBox.classList.remove('is-visible');
  }
}

function renderPagesList() {
  const currentPages = pageStore.getPages();

  if (!currentPages.length) {
    pagesListContent.textContent = '目前沒有可用的 Page / View。';
    return;
  }

  const items = currentPages.map((page) => {
    const pageTitle = escapeHtml(
      page.pageLabel
      || (Array.isArray(page.frameNames) ? page.frameNames[0] : '')
      || createPageName(page.pageNumber),
    );
    const frameNames = Array.isArray(page.frameNames) && page.frameNames.length
      ? '<div class="view-frame-names">Frame Names: ' + escapeHtml(page.frameNames.join(' / ')) + '</div>'
      : '';
    const views = page.views
      .map((view) => {
        const relativeX = formatRelativeValue(view.relativeTopLeft?.x);
        const relativeY = formatRelativeValue(view.relativeTopLeft?.y);
        const primaryTextLabel = typeof view.primaryTextLabel === 'string' && view.primaryTextLabel.length > 0
          ? '<div class="view-primary-text">' + escapeHtml(view.primaryTextLabel) + '</div>'
          : '';

        return ''
          + '<div class="view-card" data-frame-id="' + escapeHtml(view.frameId) + '">'
          + '<div class="view-head">'
          + '<strong>' + escapeHtml(createViewName(page.pageNumber, view.viewNumber)) + '</strong>'
          + '<span class="view-name">' + escapeHtml(view.frameName) + '</span>'
          + '</div>'
          + primaryTextLabel
          + '<div class="view-coords">左上相對座標 x=' + relativeX + ', y=' + relativeY + '</div>'
          + '<div class="view-controls">'
          + '<label><span>Page Number</span><input class="page-override-input" type="number" min="1" step="1" value="' + String(page.pageNumber) + '" /></label>'
          + '<label><span>View Number</span><input class="view-override-input" type="number" min="1" step="1" value="' + String(view.viewNumber) + '" /></label>'
          + '</div>'
          + '</div>';
      })
      .join('');

    return ''
      + '<div class="page-group">'
      + '<div class="page-group-title"><strong>' + createPageName(page.pageNumber) + '</strong> - ' + pageTitle + '</div>'
      + frameNames
      + '<div class="view-list">' + views + '</div>'
      + '</div>';
  }).join('');

  pagesListContent.innerHTML = items;
}

function updatePickerSummary() {
  const currentPages = pageStore.getPages();

  if (!currentPages.length) {
    pickerNote.textContent = '目前沒有可用的 Page / View。';
    return;
  }

  const totalViews = currentPages.reduce((sum, page) => sum + (page.viewCount || page.views.length || 0), 0);
  pickerNote.textContent =
    '目前共 ' + String(currentPages.length) + ' 個 Page、' + String(totalViews) + ' 個 View，下載時會全部一起匯出。';
}

function rerenderPageState() {
  renderPagesList();
  updatePickerSummary();
}

function clearSelectionState(message) {
  selectionInfo.textContent = message;
  pageStore.clearPages();
  rerenderPageState();
}

function getSelectedExportMode() {
  return exportModeInputs.find((input) => input.checked)?.value || 'paged';
}

function handleSelectionInfoMessage(msg) {
  if (msg.selectionCount === 0) {
    clearSelectionState('目前沒有選取任何物件，請先選一個父層容器。');
    return;
  }

  if (msg.selectionCount !== 1) {
    clearSelectionState('目前選取 ' + String(msg.selectionCount) + ' 個物件，請只保留一個父層容器。');
    return;
  }

  if (!msg.isContainer) {
    clearSelectionState('目前選取：' + msg.firstSelectionName + '。這不是可分析的父層容器。');
    return;
  }

  const coverageNotice = Number(msg.coverageIssueCount || 0) > 0
    ? '，另外偵測到 ' + String(msg.coverageIssueCount || 0) + ' 個第一層 FRAME 分組異常，已自動補成獨立頁面或標記檢查。'
    : '';

  selectionInfo.textContent =
    '目前選取：' + msg.firstSelectionName
    + '。第一層會匯出 ' + String(msg.eligibleFrameCount || 0) + ' 個 FRAME'
    + '，忽略 ' + String(msg.ignoredNodeCount || 0) + ' 個非頁面節點。'
    + coverageNotice;

  pageStore.setPages(pageStore.cloneSelectionPages(msg.pages));
  rerenderPageState();
}

async function handlePrepareZipCompleteMessage(msg) {
  if (!activeZipSession) {
    throw new Error('沒有可完成的匯出工作階段。');
  }

  const exportMode = activeZipSession.exportMode;
  setLoading(true, exportMode === 'all-in-one' ? '正在建立 All in one ZIP...' : '正在建立 Page/View ZIP...');

  const zipPayload = exportMode === 'all-in-one'
    ? await buildAllInOneZipPayload({
      ...activeZipSession,
      containerStructureJson: msg.containerStructureJson,
      containerPngBytes: msg.containerPngBytes,
      pages: msg.pages || [],
    })
    : finalizePagedZipSession(activeZipSession);

  downloadBlob(zipPayload.blob, zipPayload.fileName);
  activeZipSession = null;
  setLoading(true, 'ZIP 已觸發下載，正在關閉 plugin...');
  parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
}

closeButton.addEventListener('click', () => {
  parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
});

prepareButton.addEventListener('click', () => {
  const exportMode = getSelectedExportMode();
  setLoading(true, exportMode === 'all-in-one' ? '正在準備 All in one ZIP...' : '正在分析 Page/View 並建立 ZIP...');

  try {
    const overrides = pageStore.collectOverrides();
    parent.postMessage({
      pluginMessage: {
        type: 'prepare-zip',
        exportMode,
        overrides,
      },
    }, '*');
  } catch (error) {
    setLoading(false, '');
    parent.postMessage({
      pluginMessage: {
        type: 'error',
        message: error instanceof Error ? error.message : '匯出編號設定有誤。',
      },
    }, '*');
  }
});

pagesListContent.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const row = target.closest('[data-frame-id]');
  const frameId = row?.getAttribute('data-frame-id') || '';
  if (!frameId) {
    return;
  }

  if (target.classList.contains('page-override-input')) {
    const location = pageStore.findViewLocation(frameId);
    const nextPageNumber = normalizeInteger(target.value, location?.page?.pageNumber || 1);
    target.value = String(nextPageNumber);
    pageStore.relocateViewByPageNumber(frameId, nextPageNumber);
    rerenderPageState();
  }

  if (target.classList.contains('view-override-input')) {
    const view = pageStore.findViewByFrameId(frameId);
    const nextViewNumber = normalizeInteger(target.value, view?.viewNumber || 1);
    target.value = String(nextViewNumber);
    pageStore.updateViewNumber(frameId, nextViewNumber);
    renderPagesList();
  }
});

window.addEventListener('message', async (event) => {
  const msg = event.data.pluginMessage;

  if (!msg) {
    return;
  }

  if (msg.type === 'selection-info') {
    handleSelectionInfoMessage(msg);
  }

  if (msg.type === 'set-loading') {
    setLoading(
      Boolean(msg.isLoading),
      msg.isLoading
        ? (typeof msg.message === 'string' && msg.message.length > 0 ? msg.message : '正在準備原始資料...')
        : '',
    );
  }

  if (msg.type === 'prepare-zip-start') {
    activeZipSession = createZipSession(msg);
    setLoading(
      true,
      msg.exportMode === 'all-in-one'
        ? '正在接收 All in one 原始資料...'
        : '正在接收 Page/View 串流資料...',
    );
  }

  if (msg.type === 'prepare-zip-page') {
    try {
      if (!activeZipSession || activeZipSession.exportMode !== 'paged') {
        throw new Error('目前沒有可用的 Page/View 匯出工作階段。');
      }

      setLoading(true, '正在接收 ' + String(msg.pageIndex) + '/' + String(msg.totalPages) + ' 個 Page...');
      await appendPagedZipPage(activeZipSession, msg.page, setLoading);
    } catch (error) {
      console.error(error);
      activeZipSession = null;
      setLoading(false, '');
      parent.postMessage({
        pluginMessage: {
          type: 'error',
          message: error instanceof Error ? error.message : '處理 Page/View 串流資料時發生錯誤。',
        },
      }, '*');
    }
  }

  if (msg.type === 'prepare-zip-complete') {
    try {
      await handlePrepareZipCompleteMessage(msg);
    } catch (error) {
      console.error(error);
      activeZipSession = null;
      setLoading(false, '');
      parent.postMessage({
        pluginMessage: {
          type: 'error',
          message: error instanceof Error ? error.message : '建立 AI ZIP 時發生錯誤。',
        },
      }, '*');
    }
  }
});

renderPagesList();
updatePickerSummary();
