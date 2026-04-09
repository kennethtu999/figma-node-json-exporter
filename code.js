"use strict";
figma.showUI(__html__, { visible: true, width: 800, height: 600 });
const PAGE_OVERLAP_THRESHOLD = 0.3;
let lastPrepareZipRequest = {};
function toRectData(rect) {
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
function getNodeExportBounds(node) {
    const renderBounds = 'absoluteRenderBounds' in node ? node.absoluteRenderBounds : null;
    if (renderBounds) {
        return renderBounds;
    }
    return 'absoluteBoundingBox' in node ? node.absoluteBoundingBox : null;
}
function parseNode(node) {
    const data = {
        id: node.id,
        name: node.name,
        type: node.type,
    };
    if ('x' in node)
        data.x = node.x;
    if ('y' in node)
        data.y = node.y;
    if ('width' in node)
        data.width = node.width;
    if ('height' in node)
        data.height = node.height;
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
        data.children = node.children.map((child) => parseNode(child));
    }
    return data;
}
function isContainerNode(node) {
    return 'children' in node;
}
function getSelectedContainerOrThrow() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('請先選取一個父層容器。');
    }
    if (selection.length !== 1) {
        throw new Error('請只選取一個父層容器。');
    }
    const container = selection[0];
    if (!isContainerNode(container)) {
        throw new Error('目前選取的節點沒有第一層子節點，請改選父層容器。');
    }
    return container;
}
function getSafeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
}
function summarizeTopLevelNodes(container) {
    const frames = [];
    const ignoredNodes = [];
    for (const child of container.children) {
        if (child.type !== 'FRAME') {
            ignoredNodes.push({
                id: child.id,
                name: child.name,
                type: child.type,
                reason: 'top-level node is not a FRAME',
            });
            continue;
        }
        const bounds = toRectData(getNodeExportBounds(child));
        if (!bounds) {
            ignoredNodes.push({
                id: child.id,
                name: child.name,
                type: child.type,
                reason: 'FRAME has no exportable bounds',
            });
            continue;
        }
        frames.push({
            node: child,
            bounds,
        });
    }
    return { frames, ignoredNodes };
}
function getHorizontalOverlapRatio(a, b) {
    const overlapStart = Math.max(a.x, b.x);
    const overlapEnd = Math.min(a.x + a.width, b.x + b.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);
    const narrowerWidth = Math.min(a.width, b.width);
    if (narrowerWidth <= 0) {
        return 0;
    }
    return overlapWidth / narrowerWidth;
}
function groupFramesIntoPages(frames) {
    const sortedFrames = frames.slice().sort((left, right) => {
        if (left.bounds.x !== right.bounds.x) {
            return left.bounds.x - right.bounds.x;
        }
        return left.bounds.y - right.bounds.y;
    });
    const groupedPages = [];
    for (const frame of sortedFrames) {
        const matchedPage = groupedPages.find((pageFrames) => {
            return pageFrames.some((pageFrame) => {
                return getHorizontalOverlapRatio(frame.bounds, pageFrame.bounds) >= PAGE_OVERLAP_THRESHOLD;
            });
        });
        if (matchedPage) {
            matchedPage.push(frame);
            continue;
        }
        groupedPages.push([frame]);
    }
    groupedPages.sort((left, right) => {
        const leftX = Math.min(...left.map((frame) => frame.bounds.x));
        const rightX = Math.min(...right.map((frame) => frame.bounds.x));
        return leftX - rightX;
    });
    groupedPages.forEach((pageFrames) => {
        pageFrames.sort((left, right) => {
            if (left.bounds.y !== right.bounds.y) {
                return left.bounds.y - right.bounds.y;
            }
            return left.bounds.x - right.bounds.x;
        });
    });
    return groupedPages;
}
function roundToTwoDecimals(value) {
    return Math.round(value * 100) / 100;
}
function getRelativeTopLeftMap(frames) {
    const map = new Map();
    if (frames.length === 0) {
        return map;
    }
    const minX = Math.min(...frames.map((frame) => frame.bounds.x));
    const maxX = Math.max(...frames.map((frame) => frame.bounds.x));
    const minY = Math.min(...frames.map((frame) => frame.bounds.y));
    const maxY = Math.max(...frames.map((frame) => frame.bounds.y));
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    frames.forEach((frame) => {
        map.set(frame.node.id, {
            x: xRange > 0 ? roundToTwoDecimals(((frame.bounds.x - minX) / xRange) * 100) : 0,
            y: yRange > 0 ? roundToTwoDecimals(((frame.bounds.y - minY) / yRange) * 100) : 0,
        });
    });
    return map;
}
function analyzeContainer(container) {
    const summary = summarizeTopLevelNodes(container);
    const groupedPages = groupFramesIntoPages(summary.frames);
    const relativeTopLeftMap = getRelativeTopLeftMap(summary.frames);
    const selectionPages = groupedPages.map((pageFrames, pageIndex) => {
        var _a;
        return ({
            pageNumber: pageIndex + 1,
            pageLabel: ((_a = pageFrames[0]) === null || _a === void 0 ? void 0 : _a.node.name) || `Page${String(pageIndex + 1)}`,
            frameNames: Array.from(new Set(pageFrames.map((frame) => frame.node.name))),
            viewCount: pageFrames.length,
            views: pageFrames.map((frame, viewIndex) => ({
                viewNumber: viewIndex + 1,
                frameId: frame.node.id,
                frameName: frame.node.name,
                bounds: frame.bounds,
                relativeTopLeft: relativeTopLeftMap.get(frame.node.id) || { x: 0, y: 0 },
            })),
        });
    });
    return {
        frames: summary.frames,
        ignoredNodes: summary.ignoredNodes,
        groupedPages,
        selectionPages,
    };
}
async function exportFramePng(frame, scale) {
    return frame.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: scale },
    });
}
function buildSelectionInfoMessage() {
    var _a, _b, _c;
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) {
        return {
            type: 'selection-info',
            selectionCount: selection.length,
            firstSelectionName: selection.length > 0 ? selection[0].name : '',
            isContainer: false,
        };
    }
    const firstSelection = selection[0];
    if (!isContainerNode(firstSelection)) {
        return {
            type: 'selection-info',
            selectionCount: selection.length,
            firstSelectionName: firstSelection.name,
            isContainer: false,
        };
    }
    const analysis = analyzeContainer(firstSelection);
    return {
        type: 'selection-info',
        selectionCount: selection.length,
        firstSelectionName: firstSelection.name,
        isContainer: true,
        eligibleFrameCount: analysis.frames.length,
        ignoredNodeCount: analysis.ignoredNodes.length,
        pages: analysis.selectionPages,
        defaultPageNumber: (_a = analysis.selectionPages[0]) === null || _a === void 0 ? void 0 : _a.pageNumber,
        defaultViewNumber: (_c = (_b = analysis.selectionPages[0]) === null || _b === void 0 ? void 0 : _b.views[0]) === null || _c === void 0 ? void 0 : _c.viewNumber,
    };
}
function postSelectionInfo() {
    figma.ui.postMessage(buildSelectionInfoMessage());
}
async function exportNodePng(node, scale) {
    if ('exportAsync' in node && typeof node.exportAsync === 'function') {
        return node.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: scale },
        });
    }
    const bounds = getNodeExportBounds(node);
    if (!bounds) {
        throw new Error(`無法匯出 ${node.name}，因為找不到可用 bounds。`);
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
    }
    finally {
        slice.remove();
    }
}
async function handlePrepareZipRequest() {
    var _a, _b;
    const container = getSelectedContainerOrThrow();
    try {
        figma.notify('正在準備 AI ZIP...');
        figma.ui.postMessage({ type: 'set-loading', isLoading: true });
        const analysis = analyzeContainer(container);
        if (analysis.frames.length === 0) {
            throw new Error('選取的容器第一層沒有可匯出的 FRAME。');
        }
        const containerStructureJson = parseNode(container);
        const containerPngBytes = await exportNodePng(container, 1);
        const frameLookup = new Map();
        analysis.frames.forEach((frame) => {
            frameLookup.set(frame.node.id, frame);
        });
        const overrideMap = new Map();
        (lastPrepareZipRequest.overrides || []).forEach((override) => {
            if (!Number.isInteger(override.pageNumber) || override.pageNumber <= 0) {
                throw new Error(`View ${override.frameId} 的 Page Number 必須是大於 0 的整數。`);
            }
            if (!Number.isInteger(override.viewNumber) || override.viewNumber <= 0) {
                throw new Error(`View ${override.frameId} 的 View Number 必須是大於 0 的整數。`);
            }
            overrideMap.set(override.frameId, {
                pageNumber: override.pageNumber,
                viewNumber: override.viewNumber,
            });
        });
        const duplicateCheck = new Set();
        const assignedViews = analysis.selectionPages.flatMap((page) => {
            return page.views.map((view) => {
                var _a, _b;
                const override = overrideMap.get(view.frameId);
                const assignedPageNumber = (_a = override === null || override === void 0 ? void 0 : override.pageNumber) !== null && _a !== void 0 ? _a : page.pageNumber;
                const assignedViewNumber = (_b = override === null || override === void 0 ? void 0 : override.viewNumber) !== null && _b !== void 0 ? _b : view.viewNumber;
                const duplicateKey = `${String(assignedPageNumber)}:${String(assignedViewNumber)}`;
                if (duplicateCheck.has(duplicateKey)) {
                    throw new Error(`Page${String(assignedPageNumber)} / View${String(assignedViewNumber)} 重複，請調整編號。`);
                }
                duplicateCheck.add(duplicateKey);
                return {
                    pageNumber: assignedPageNumber,
                    viewNumber: assignedViewNumber,
                    pageLabel: page.pageLabel,
                    frameNames: page.frameNames,
                    view,
                    frame: frameLookup.get(view.frameId),
                };
            });
        }).sort((left, right) => {
            if (left.pageNumber !== right.pageNumber) {
                return left.pageNumber - right.pageNumber;
            }
            return left.viewNumber - right.viewNumber;
        });
        const groupedPages = new Map();
        assignedViews.forEach((assignedView) => {
            const pageViews = groupedPages.get(assignedView.pageNumber);
            if (pageViews) {
                pageViews.push(assignedView);
            }
            else {
                groupedPages.set(assignedView.pageNumber, [assignedView]);
            }
        });
        const pages = [];
        for (const pageNumber of Array.from(groupedPages.keys()).sort((left, right) => left - right)) {
            const pageViews = groupedPages.get(pageNumber) || [];
            const views = [];
            for (const assignedView of pageViews) {
                if (!assignedView.frame) {
                    throw new Error(`找不到對應的 FRAME：${assignedView.view.frameId}`);
                }
                const pngBytes = await exportNodePng(assignedView.frame.node, 1);
                views.push({
                    viewNumber: assignedView.viewNumber,
                    frameId: assignedView.frame.node.id,
                    frameName: assignedView.frame.node.name,
                    bounds: assignedView.frame.bounds,
                    relativeTopLeft: assignedView.view.relativeTopLeft,
                    structureJson: parseNode(assignedView.frame.node),
                    pngBytes: Array.from(pngBytes),
                });
            }
            pages.push({
                pageNumber,
                pageLabel: ((_a = pageViews[0]) === null || _a === void 0 ? void 0 : _a.pageLabel) || ((_b = pageViews[0]) === null || _b === void 0 ? void 0 : _b.view.frameName) || `Page${String(pageNumber)}`,
                frameNames: Array.from(new Set(pageViews.flatMap((pageView) => pageView.frameNames))),
                views,
            });
        }
        const message = {
            type: 'prepare-zip-data',
            containerId: container.id,
            containerName: container.name,
            containerStructureJson,
            containerPngBytes: Array.from(containerPngBytes),
            pages,
            ignoredNodes: {
                count: analysis.ignoredNodes.length,
                items: analysis.ignoredNodes,
            },
            fileName: getSafeFileName(container.name),
        };
        figma.ui.postMessage(message);
    }
    catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : '準備 AI ZIP 時發生錯誤。';
        figma.ui.postMessage({ type: 'set-loading', isLoading: false });
        figma.notify(message, { error: true });
    }
}
try {
    getSelectedContainerOrThrow();
    postSelectionInfo();
}
catch (error) {
    const message = error instanceof Error ? error.message : '請先選取一個父層容器。';
    figma.notify(message, { error: true });
    figma.closePlugin();
}
figma.on('selectionchange', () => {
    postSelectionInfo();
});
figma.ui.onmessage = (msg) => {
    if (msg.type === 'prepare-zip') {
        const rawOverrides = Array.isArray(msg.overrides) ? msg.overrides : [];
        lastPrepareZipRequest = {
            overrides: rawOverrides
                .filter((override) => typeof override.frameId === 'string')
                .map((override) => ({
                frameId: String(override.frameId),
                pageNumber: Number(override.pageNumber),
                viewNumber: Number(override.viewNumber),
            })),
        };
        void handlePrepareZipRequest();
    }
    if (msg.type === 'close') {
        figma.closePlugin('✅ 已完成');
    }
    if (msg.type === 'error') {
        const errorMessage = typeof msg.message === 'string' && msg.message.length > 0
            ? msg.message
            : 'AI ZIP 處理過程發生錯誤，請查看 Console。';
        figma.notify(errorMessage, { error: true });
        figma.closePlugin();
    }
};
