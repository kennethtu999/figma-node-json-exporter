import { normalizeInteger } from './shared.js';

export function createPageName(pageNumber) {
  return 'Page' + String(pageNumber);
}

export function createViewName(pageNumber, viewNumber) {
  return createPageName(pageNumber) + '-View' + String(viewNumber);
}

export function createPageStore() {
  let currentPages = [];
  let pageGroupSequence = 0;

  function getPages() {
    return currentPages;
  }

  function setPages(pages) {
    currentPages = pages;
  }

  function clearPages() {
    currentPages = [];
  }

  function createPageGroupId() {
    pageGroupSequence += 1;
    return 'group-' + String(pageGroupSequence);
  }

  function uniqueStrings(values) {
    const unique = [];
    const seen = new Set();

    values.forEach((value) => {
      if (typeof value !== 'string' || value.length === 0 || seen.has(value)) {
        return;
      }

      seen.add(value);
      unique.push(value);
    });

    return unique;
  }

  function syncPageGroup(page, fallbackLabel) {
    page.frameNames = uniqueStrings(page.views.map((view) => view.frameName));
    page.viewCount = Array.isArray(page.views) ? page.views.length : 0;
    page.pageLabel = page.views[0]?.frameName || fallbackLabel || page.pageLabel || '';
    page.groupId = page.groupId || createPageGroupId();
    return page;
  }

  function renumberViewsInPage(page) {
    page.views.forEach((view, viewIndex) => {
      view.viewNumber = viewIndex + 1;
    });
    syncPageGroup(page, page.pageLabel || page.views[0]?.frameName || '');
  }

  function createPageGroupFromViews(views, pageLabel) {
    return syncPageGroup({
      groupId: createPageGroupId(),
      pageNumber: 0,
      pageLabel: pageLabel || '',
      frameNames: [],
      viewCount: 0,
      views,
    }, pageLabel || '');
  }

  function renumberPageGroups(pages, startIndex) {
    const safeStartIndex = Math.max(0, Math.min(
      typeof startIndex === 'number' ? startIndex : 0,
      Math.max(pages.length - 1, 0),
    ));

    pages.forEach((page, pageIndex) => {
      if (pageIndex < safeStartIndex && Number.isInteger(page.pageNumber) && page.pageNumber > 0) {
        page.viewCount = Array.isArray(page.views) ? page.views.length : 0;
        return;
      }

      page.pageNumber = pageIndex + 1;
      page.viewCount = Array.isArray(page.views) ? page.views.length : 0;
    });
  }

  function cloneSelectionPages(pages) {
    if (!Array.isArray(pages)) {
      return [];
    }

    const clonedPages = pages.map((page, pageIndex) => {
      const views = Array.isArray(page?.views)
        ? page.views.map((view, viewIndex) => ({
          viewNumber: normalizeInteger(view?.viewNumber, viewIndex + 1),
          frameId: typeof view?.frameId === 'string' ? view.frameId : '',
          frameName: typeof view?.frameName === 'string' ? view.frameName : '',
          bounds: view?.bounds || {},
          relativeTopLeft: view?.relativeTopLeft || { x: 0, y: 0 },
          primaryTextLabel: typeof view?.primaryTextLabel === 'string' ? view.primaryTextLabel : '',
        }))
        : [];
      const frameNames = Array.isArray(page?.frameNames) && page.frameNames.length
        ? uniqueStrings(page.frameNames)
        : uniqueStrings(views.map((view) => view.frameName));
      return syncPageGroup({
        groupId: createPageGroupId(),
        pageNumber: pageIndex + 1,
        pageLabel: typeof page?.pageLabel === 'string' ? page.pageLabel : '',
        frameNames,
        viewCount: views.length,
        views,
      }, typeof page?.pageLabel === 'string' ? page.pageLabel : '');
    });

    renumberPageGroups(clonedPages);
    return clonedPages;
  }

  function findViewByFrameId(frameId) {
    for (const page of currentPages) {
      const matchedView = page.views.find((view) => view.frameId === frameId);
      if (matchedView) {
        return matchedView;
      }
    }

    return null;
  }

  function findViewLocation(frameId) {
    for (let pageIndex = 0; pageIndex < currentPages.length; pageIndex += 1) {
      const viewIndex = currentPages[pageIndex].views.findIndex((view) => view.frameId === frameId);
      if (viewIndex >= 0) {
        return {
          pageIndex,
          viewIndex,
          page: currentPages[pageIndex],
          view: currentPages[pageIndex].views[viewIndex],
        };
      }
    }

    return null;
  }

  function relocateViewByPageNumber(frameId, rawPageNumber) {
    const location = findViewLocation(frameId);
    if (!location) {
      return;
    }

    const currentPageNumber = location.page.pageNumber;
    const targetPageNumber = normalizeInteger(rawPageNumber, currentPageNumber);
    if (targetPageNumber === currentPageNumber) {
      return;
    }

    const fallbackLabel = location.page.pageLabel || location.page.views[0]?.frameName || '';
    const [movedView] = location.page.views.splice(location.viewIndex, 1);
    const pageRemoved = location.page.views.length === 0;

    if (pageRemoved) {
      currentPages.splice(location.pageIndex, 1);
    } else {
      renumberViewsInPage(location.page);
    }

    if (targetPageNumber < currentPageNumber) {
      const targetIndex = Math.max(0, Math.min(currentPages.length - 1, targetPageNumber - 1));
      const targetPage = currentPages[targetIndex];
      if (!targetPage) {
        return;
      }

      targetPage.views.push(movedView);
      renumberViewsInPage(targetPage);

      if (pageRemoved) {
        renumberPageGroups(currentPages, location.pageIndex);
      }
      return;
    }

    const standalonePage = createPageGroupFromViews([movedView], movedView.frameName || fallbackLabel);
    renumberViewsInPage(standalonePage);

    const insertIndex = Math.max(0, Math.min(currentPages.length, targetPageNumber - 1));
    currentPages.splice(insertIndex, 0, standalonePage);
    renumberPageGroups(currentPages, insertIndex);
  }

  function updateViewNumber(frameId, rawValue) {
    const view = findViewByFrameId(frameId);
    if (!view) {
      return;
    }

    view.viewNumber = normalizeInteger(rawValue, view.viewNumber);
  }

  function collectOverrides() {
    if (!currentPages.length) {
      return [];
    }

    const seen = new Set();

    return currentPages.flatMap((page) => {
      return page.views.map((view) => {
        const pageNumber = normalizeInteger(page.pageNumber, 1);
        const viewNumber = normalizeInteger(view.viewNumber, 1);
        const duplicateKey = String(pageNumber) + ':' + String(viewNumber);

        if (seen.has(duplicateKey)) {
          throw new Error(`Page${String(pageNumber)} / View${String(viewNumber)} 重複，請調整編號。`);
        }

        seen.add(duplicateKey);

        return {
          frameId: view.frameId,
          pageNumber,
          viewNumber,
        };
      });
    });
  }

  return {
    getPages,
    setPages,
    clearPages,
    cloneSelectionPages,
    findViewByFrameId,
    findViewLocation,
    relocateViewByPageNumber,
    updateViewNumber,
    collectOverrides,
  };
}
