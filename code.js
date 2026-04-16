"use strict";
figma.showUI(__html__, { visible: true, width: 800, height: 600 });
const PAGE_OVERLAP_THRESHOLD = 0.3;
const PAGE_TITLE_MAX_VERTICAL_GAP = 160;
const MIN_PAGE_CANDIDATE_HEIGHT = 240;
const MIN_PAGE_CANDIDATE_HEIGHT_TO_WIDTH_RATIO = 0.18;
const MIN_PAGE_CANDIDATE_DESCENDANT_COUNT = 12;
const MIN_PAGE_CANDIDATE_TEXT_NODE_COUNT = 6;
const IGNORED_PRIMARY_TEXT_LABEL_PREFIXES = [
    'deposits are insured by pdic up to ₱1 million per depositor',
];
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
function normalizeTextLabel(text, maxLength = 60) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '';
    }
    return normalized.length > maxLength
        ? `${normalized.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`
        : normalized;
}
function shouldIgnorePrimaryTextLabel(text) {
    const normalized = text.trim().toLowerCase();
    return IGNORED_PRIMARY_TEXT_LABEL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
function getTextLabelCandidate(node) {
    var _a, _b;
    if (node.type !== 'TEXT') {
        return null;
    }
    const normalizedText = normalizeTextLabel(node.characters);
    if (!normalizedText || shouldIgnorePrimaryTextLabel(normalizedText)) {
        return null;
    }
    const bounds = getNodeExportBounds(node);
    const area = bounds ? bounds.width * bounds.height : 0;
    return {
        text: normalizedText,
        area,
        y: (_a = bounds === null || bounds === void 0 ? void 0 : bounds.y) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY,
        x: (_b = bounds === null || bounds === void 0 ? void 0 : bounds.x) !== null && _b !== void 0 ? _b : Number.POSITIVE_INFINITY,
    };
}
function pickBetterTextLabelCandidate(current, next) {
    if (!next) {
        return current;
    }
    if (!current) {
        return next;
    }
    if (next.area !== current.area) {
        return next.area > current.area ? next : current;
    }
    if (next.y !== current.y) {
        return next.y < current.y ? next : current;
    }
    if (next.x !== current.x) {
        return next.x < current.x ? next : current;
    }
    return current;
}
function findPrimaryTextLabelCandidate(node) {
    let bestCandidate = getTextLabelCandidate(node);
    if ('children' in node) {
        node.children.forEach((child) => {
            bestCandidate = pickBetterTextLabelCandidate(bestCandidate, findPrimaryTextLabelCandidate(child));
        });
    }
    return bestCandidate;
}
function findPrimaryTextLabel(node) {
    var _a;
    return (_a = findPrimaryTextLabelCandidate(node)) === null || _a === void 0 ? void 0 : _a.text;
}
function getSingleLineText(node) {
    if (node.type !== 'TEXT') {
        return null;
    }
    const lines = node.characters
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (lines.length !== 1) {
        return null;
    }
    const normalizedText = normalizeTextLabel(lines[0], 80);
    if (!normalizedText || shouldIgnorePrimaryTextLabel(normalizedText)) {
        return null;
    }
    return normalizedText;
}
function getSingleLinePageTitle(node) {
    const textCandidates = [];
    function walk(currentNode) {
        var _a;
        const text = getSingleLineText(currentNode);
        if (text) {
            textCandidates.push({
                text,
                bounds: (_a = toRectData(getNodeExportBounds(currentNode))) !== null && _a !== void 0 ? _a : null,
            });
        }
        if ('children' in currentNode) {
            currentNode.children.forEach((child) => {
                walk(child);
            });
        }
    }
    walk(node);
    const orderedTexts = textCandidates
        .sort((left, right) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const leftY = (_b = (_a = left.bounds) === null || _a === void 0 ? void 0 : _a.y) !== null && _b !== void 0 ? _b : Number.POSITIVE_INFINITY;
        const rightY = (_d = (_c = right.bounds) === null || _c === void 0 ? void 0 : _c.y) !== null && _d !== void 0 ? _d : Number.POSITIVE_INFINITY;
        if (leftY !== rightY) {
            return leftY - rightY;
        }
        const leftX = (_f = (_e = left.bounds) === null || _e === void 0 ? void 0 : _e.x) !== null && _f !== void 0 ? _f : Number.POSITIVE_INFINITY;
        const rightX = (_h = (_g = right.bounds) === null || _g === void 0 ? void 0 : _g.x) !== null && _h !== void 0 ? _h : Number.POSITIVE_INFINITY;
        return leftX - rightX;
    })
        .map((candidate) => candidate.text)
        .filter((text, index, array) => array.indexOf(text) === index);
    return orderedTexts.length > 0 ? orderedTexts.join(' ') : null;
}
function isMixed(value) {
    return value === figma.mixed;
}
function serializeNumberOrMixed(value) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    return isMixed(value) ? 'mixed' : value;
}
function serializeEnumOrMixed(value) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    return isMixed(value) ? 'mixed' : value;
}
function serializeColor(color, opacity = 1) {
    const alpha = 'a' in color ? color.a : opacity;
    return {
        r: roundToTwoDecimals(color.r),
        g: roundToTwoDecimals(color.g),
        b: roundToTwoDecimals(color.b),
        a: roundToTwoDecimals(alpha),
    };
}
function serializePaint(paint) {
    var _a;
    const serialized = {
        type: paint.type,
    };
    if ('visible' in paint && typeof paint.visible === 'boolean') {
        serialized.visible = paint.visible;
    }
    if ('opacity' in paint && typeof paint.opacity === 'number') {
        serialized.opacity = roundToTwoDecimals(paint.opacity);
    }
    if ('blendMode' in paint && typeof paint.blendMode === 'string') {
        serialized.blendMode = paint.blendMode;
    }
    if ('color' in paint && paint.color) {
        serialized.color = serializeColor(paint.color, typeof paint.opacity === 'number' ? paint.opacity : 1);
    }
    if ('gradientStops' in paint && Array.isArray(paint.gradientStops)) {
        serialized.gradientStops = paint.gradientStops.map((stop) => ({
            position: roundToTwoDecimals(stop.position),
            color: serializeColor(stop.color),
        }));
    }
    if ('scaleMode' in paint && typeof paint.scaleMode === 'string') {
        serialized.scaleMode = paint.scaleMode;
    }
    if ('imageHash' in paint) {
        serialized.imageHash = (_a = paint.imageHash) !== null && _a !== void 0 ? _a : null;
    }
    return serialized;
}
function serializePaints(paints) {
    if (typeof paints === 'undefined') {
        return undefined;
    }
    if (isMixed(paints)) {
        return 'mixed';
    }
    return paints.map((paint) => serializePaint(paint));
}
function serializeEffect(effect) {
    const serialized = {
        type: effect.type,
        visible: effect.visible,
    };
    if ('radius' in effect && typeof effect.radius === 'number') {
        serialized.radius = roundToTwoDecimals(effect.radius);
    }
    if ('color' in effect && effect.color) {
        serialized.color = serializeColor(effect.color);
    }
    if ('offset' in effect && effect.offset) {
        serialized.offset = {
            x: roundToTwoDecimals(effect.offset.x),
            y: roundToTwoDecimals(effect.offset.y),
        };
    }
    if ('spread' in effect && typeof effect.spread === 'number') {
        serialized.spread = roundToTwoDecimals(effect.spread);
    }
    if ('blendMode' in effect && typeof effect.blendMode === 'string') {
        serialized.blendMode = effect.blendMode;
    }
    if ('showShadowBehindNode' in effect && typeof effect.showShadowBehindNode === 'boolean') {
        serialized.showShadowBehindNode = effect.showShadowBehindNode;
    }
    return serialized;
}
function getNodeStyle(node) {
    const style = {};
    if ('opacity' in node && typeof node.opacity === 'number') {
        style.opacity = roundToTwoDecimals(node.opacity);
    }
    if ('blendMode' in node && typeof node.blendMode === 'string') {
        style.blendMode = node.blendMode;
    }
    if ('visible' in node && typeof node.visible === 'boolean') {
        style.visible = node.visible;
    }
    if ('clipsContent' in node && typeof node.clipsContent === 'boolean') {
        style.clipsContent = node.clipsContent;
    }
    if ('fills' in node) {
        style.fills = serializePaints(node.fills);
    }
    if ('strokes' in node) {
        style.strokes = serializePaints(node.strokes);
    }
    if ('strokeWeight' in node) {
        style.strokeWeight = serializeNumberOrMixed(node.strokeWeight);
    }
    if ('strokeAlign' in node) {
        style.strokeAlign = serializeEnumOrMixed(node.strokeAlign);
    }
    if ('strokeCap' in node) {
        style.strokeCap = serializeEnumOrMixed(node.strokeCap);
    }
    if ('strokeJoin' in node) {
        style.strokeJoin = serializeEnumOrMixed(node.strokeJoin);
    }
    if ('dashPattern' in node && Array.isArray(node.dashPattern) && node.dashPattern.length > 0) {
        style.strokeDashes = node.dashPattern.map((value) => roundToTwoDecimals(value));
    }
    if ('cornerRadius' in node) {
        style.cornerRadius = serializeNumberOrMixed(node.cornerRadius);
    }
    if ('topLeftRadius' in node
        && 'topRightRadius' in node
        && 'bottomRightRadius' in node
        && 'bottomLeftRadius' in node) {
        style.cornerRadii = [
            roundToTwoDecimals(node.topLeftRadius),
            roundToTwoDecimals(node.topRightRadius),
            roundToTwoDecimals(node.bottomRightRadius),
            roundToTwoDecimals(node.bottomLeftRadius),
        ];
    }
    if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0) {
        style.effects = node.effects.map((effect) => serializeEffect(effect));
    }
    return Object.keys(style).length > 0 ? style : undefined;
}
function getNodeLayout(node) {
    if (!('layoutMode' in node)) {
        return undefined;
    }
    const layout = {
        mode: node.layoutMode,
    };
    if ('layoutWrap' in node) {
        layout.wrap = node.layoutWrap;
    }
    if ('layoutSizingHorizontal' in node) {
        layout.sizingHorizontal = node.layoutSizingHorizontal;
    }
    if ('layoutSizingVertical' in node) {
        layout.sizingVertical = node.layoutSizingVertical;
    }
    if (node.layoutMode !== 'NONE' && node.layoutMode !== 'GRID') {
        layout.primaryAxisSizing = node.primaryAxisSizingMode;
        layout.counterAxisSizing = node.counterAxisSizingMode;
        layout.primaryAxisAlign = node.primaryAxisAlignItems;
        layout.counterAxisAlign = node.counterAxisAlignItems;
        layout.counterAxisAlignContent = node.counterAxisAlignContent;
        layout.itemSpacing = roundToTwoDecimals(node.itemSpacing);
        if (typeof node.counterAxisSpacing === 'number') {
            layout.counterAxisSpacing = roundToTwoDecimals(node.counterAxisSpacing);
        }
        layout.itemReverseZIndex = node.itemReverseZIndex;
        layout.strokesIncludedInLayout = node.strokesIncludedInLayout;
        layout.padding = {
            top: roundToTwoDecimals(node.paddingTop),
            right: roundToTwoDecimals(node.paddingRight),
            bottom: roundToTwoDecimals(node.paddingBottom),
            left: roundToTwoDecimals(node.paddingLeft),
        };
    }
    return layout;
}
function getNodeLayoutItem(node) {
    if (!('layoutAlign' in node)) {
        return undefined;
    }
    const layoutItem = {
        align: node.layoutAlign,
        grow: roundToTwoDecimals(node.layoutGrow),
        positioning: node.layoutPositioning,
    };
    if ('layoutSizingHorizontal' in node) {
        layoutItem.sizingHorizontal = node.layoutSizingHorizontal;
    }
    if ('layoutSizingVertical' in node) {
        layoutItem.sizingVertical = node.layoutSizingVertical;
    }
    return Object.values(layoutItem).some((value) => typeof value !== 'undefined') ? layoutItem : undefined;
}
function serializeTextMetric(metric) {
    if (isMixed(metric)) {
        return 'mixed';
    }
    const serialized = {
        unit: metric.unit,
    };
    if ('value' in metric && typeof metric.value === 'number') {
        serialized.value = roundToTwoDecimals(metric.value);
    }
    return serialized;
}
function serializeFontName(fontName) {
    if (isMixed(fontName)) {
        return {
            fontFamily: 'mixed',
            fontStyle: 'mixed',
        };
    }
    return {
        fontFamily: fontName.family,
        fontStyle: fontName.style,
    };
}
function getTextSegments(node) {
    const segments = node.getStyledTextSegments([
        'fontName',
        'fontSize',
        'lineHeight',
        'letterSpacing',
        'textCase',
        'textDecoration',
        'fills',
    ]);
    if (segments.length <= 1) {
        return undefined;
    }
    return segments.map((segment) => {
        const fontInfo = serializeFontName(segment.fontName);
        const lineHeight = serializeTextMetric(segment.lineHeight);
        const letterSpacing = serializeTextMetric(segment.letterSpacing);
        return {
            start: segment.start,
            end: segment.end,
            text: segment.characters,
            fontFamily: typeof fontInfo.fontFamily === 'string' && fontInfo.fontFamily !== 'mixed'
                ? fontInfo.fontFamily
                : undefined,
            fontStyle: typeof fontInfo.fontStyle === 'string' && fontInfo.fontStyle !== 'mixed'
                ? fontInfo.fontStyle
                : undefined,
            fontSize: typeof segment.fontSize === 'number' ? roundToTwoDecimals(segment.fontSize) : undefined,
            lineHeight: lineHeight === 'mixed' ? undefined : lineHeight,
            letterSpacing: letterSpacing === 'mixed' ? undefined : letterSpacing,
            textCase: segment.textCase,
            textDecoration: segment.textDecoration,
            fills: serializePaints(segment.fills),
        };
    });
}
function getNodeTextStyle(node) {
    if (node.type !== 'TEXT') {
        return undefined;
    }
    const fontInfo = serializeFontName(node.fontName);
    const textStyle = {
        fontFamily: fontInfo.fontFamily,
        fontStyle: fontInfo.fontStyle,
        fontSize: serializeNumberOrMixed(node.fontSize),
        lineHeight: serializeTextMetric(node.lineHeight),
        letterSpacing: serializeTextMetric(node.letterSpacing),
        textCase: serializeEnumOrMixed(node.textCase),
        textDecoration: serializeEnumOrMixed(node.textDecoration),
        textAlignHorizontal: node.textAlignHorizontal,
        textAlignVertical: node.textAlignVertical,
        paragraphSpacing: roundToTwoDecimals(node.paragraphSpacing),
        paragraphIndent: roundToTwoDecimals(node.paragraphIndent),
        segments: getTextSegments(node),
    };
    return textStyle;
}
function readVariantProperties(node) {
    try {
        const variantProperties = node.variantProperties;
        return variantProperties
            ? Object.fromEntries(Object.entries(variantProperties))
            : undefined;
    }
    catch (_error) {
        void _error;
        // Figma may throw here when the backing component set/variant graph has document errors.
        return undefined;
    }
}
function readComponentPropertyReferences(node) {
    if (!('componentPropertyReferences' in node)) {
        return undefined;
    }
    try {
        const references = node.componentPropertyReferences;
        return references
            ? Object.fromEntries(Object.entries(references).map(([key, value]) => [key, String(value)]))
            : undefined;
    }
    catch (_error) {
        void _error;
        return undefined;
    }
}
function getNodeComponent(node) {
    if (node.type === 'INSTANCE') {
        const variantProperties = readVariantProperties(node);
        return {
            kind: variantProperties && Object.keys(variantProperties).length > 0 ? 'VARIANT' : 'INSTANCE',
            name: node.name,
            variantProperties,
        };
    }
    if (node.type === 'COMPONENT') {
        const variantProperties = readVariantProperties(node);
        return {
            kind: variantProperties && Object.keys(variantProperties).length > 0 ? 'VARIANT' : 'COMPONENT',
            name: node.name,
            variantProperties,
        };
    }
    if (node.type === 'COMPONENT_SET') {
        return {
            kind: 'COMPONENT_SET',
            name: node.name,
        };
    }
    const componentPropertyReferences = readComponentPropertyReferences(node);
    if (componentPropertyReferences) {
        return {
            kind: 'FRAME',
            name: node.name,
            componentPropertyReferences,
        };
    }
    return undefined;
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
    const style = getNodeStyle(node);
    if (style) {
        data.style = style;
    }
    const layout = getNodeLayout(node);
    if (layout) {
        data.layout = layout;
    }
    const layoutItem = getNodeLayoutItem(node);
    if (layoutItem) {
        data.layoutItem = layoutItem;
    }
    const textStyle = getNodeTextStyle(node);
    if (textStyle) {
        data.textStyle = textStyle;
    }
    const component = getNodeComponent(node);
    if (component) {
        data.component = component;
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
function getNormalizedTextLines(node) {
    const lines = [];
    function walk(currentNode) {
        if (currentNode.type === 'TEXT') {
            currentNode.characters
                .split(/\r?\n/)
                .map((line) => normalizeTextLabel(line, 80))
                .filter((line) => line.length > 0)
                .forEach((line) => {
                lines.push(line);
            });
        }
        if ('children' in currentNode) {
            currentNode.children.forEach((child) => {
                walk(child);
            });
        }
    }
    walk(node);
    return lines.filter((line, index, items) => items.indexOf(line) === index);
}
function countDescendants(node) {
    if (!('children' in node)) {
        return 0;
    }
    return node.children.reduce((sum, child) => {
        return sum + 1 + countDescendants(child);
    }, 0);
}
function countTextNodes(node) {
    let count = node.type === 'TEXT' ? 1 : 0;
    if ('children' in node) {
        node.children.forEach((child) => {
            count += countTextNodes(child);
        });
    }
    return count;
}
function isLabelLikeNode(node, bounds, containerBounds) {
    const textLines = getNormalizedTextLines(node);
    const descendantCount = countDescendants(node);
    const textNodeCount = countTextNodes(node);
    const containerArea = containerBounds ? containerBounds.width * containerBounds.height : 0;
    const areaRatio = containerArea > 0 ? (bounds.width * bounds.height) / containerArea : 0;
    return textLines.length === 1
        && textNodeCount > 0
        && descendantCount <= 24
        && areaRatio <= 0.015;
}
function isPageCandidateNode(node, bounds) {
    const descendantCount = countDescendants(node);
    const textNodeCount = countTextNodes(node);
    const heightToWidthRatio = bounds.width > 0 ? bounds.height / bounds.width : 0;
    if (bounds.height < MIN_PAGE_CANDIDATE_HEIGHT) {
        return false;
    }
    if (heightToWidthRatio >= MIN_PAGE_CANDIDATE_HEIGHT_TO_WIDTH_RATIO) {
        return true;
    }
    return descendantCount >= MIN_PAGE_CANDIDATE_DESCENDANT_COUNT
        || textNodeCount >= MIN_PAGE_CANDIDATE_TEXT_NODE_COUNT
        || node.type === 'FRAME';
}
function summarizeTopLevelNodes(container) {
    var _a;
    const frames = [];
    const ignoredNodes = [];
    const pageTitleCandidates = [];
    const containerBounds = (_a = toRectData(getNodeExportBounds(container))) !== null && _a !== void 0 ? _a : null;
    for (const child of container.children) {
        const bounds = toRectData(getNodeExportBounds(child));
        if (!bounds) {
            ignoredNodes.push({
                id: child.id,
                name: child.name,
                type: child.type,
                reason: 'top-level node has no exportable bounds',
            });
            continue;
        }
        if (isLabelLikeNode(child, bounds, containerBounds)) {
            const pageTitle = getSingleLinePageTitle(child);
            if (pageTitle) {
                pageTitleCandidates.push({
                    text: pageTitle,
                    bounds,
                });
            }
            else {
                ignoredNodes.push({
                    id: child.id,
                    name: child.name,
                    type: child.type,
                    reason: 'top-level node matched LABEL rule but had no usable single-line text',
                });
            }
            continue;
        }
        if (!isPageCandidateNode(child, bounds)) {
            ignoredNodes.push({
                id: child.id,
                name: child.name,
                type: child.type,
                reason: 'top-level node did not meet PAGE/VIEW candidate size or complexity thresholds',
            });
            continue;
        }
        frames.push({
            node: child,
            bounds,
        });
    }
    return { frames, ignoredNodes, pageTitleCandidates };
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
function getPageBounds(frames) {
    if (frames.length === 0) {
        return null;
    }
    const minX = Math.min(...frames.map((frame) => frame.bounds.x));
    const minY = Math.min(...frames.map((frame) => frame.bounds.y));
    const maxX = Math.max(...frames.map((frame) => frame.bounds.x + frame.bounds.width));
    const maxY = Math.max(...frames.map((frame) => frame.bounds.y + frame.bounds.height));
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}
function getPageTitleForBounds(pageBounds, candidates) {
    if (!pageBounds) {
        return undefined;
    }
    const matchedCandidate = candidates
        .map((candidate) => {
        const verticalGap = pageBounds.y - (candidate.bounds.y + candidate.bounds.height);
        return {
            candidate,
            verticalGap,
            overlapRatio: getHorizontalOverlapRatio(pageBounds, candidate.bounds),
        };
    })
        .filter(({ verticalGap, overlapRatio }) => {
        return verticalGap >= 0
            && verticalGap <= PAGE_TITLE_MAX_VERTICAL_GAP
            && overlapRatio >= PAGE_OVERLAP_THRESHOLD;
    })
        .sort((left, right) => {
        if (left.candidate.bounds.width !== right.candidate.bounds.width) {
            return right.candidate.bounds.width - left.candidate.bounds.width;
        }
        if (left.verticalGap !== right.verticalGap) {
            return left.verticalGap - right.verticalGap;
        }
        return right.candidate.bounds.y - left.candidate.bounds.y;
    })[0];
    return matchedCandidate === null || matchedCandidate === void 0 ? void 0 : matchedCandidate.candidate.text;
}
function groupFramesIntoPages(frames) {
    const sortedFrames = frames.slice().sort((left, right) => {
        if (left.bounds.y !== right.bounds.y) {
            return left.bounds.y - right.bounds.y;
        }
        return left.bounds.x - right.bounds.x;
    });
    const groupedPages = [];
    for (const frame of sortedFrames) {
        const matchedPage = groupedPages
            .map((page) => {
            const overlapRatio = getHorizontalOverlapRatio(frame.bounds, page.root.bounds);
            const verticalOffset = frame.bounds.y - page.root.bounds.y;
            return {
                page,
                overlapRatio,
                verticalOffset,
            };
        })
            .filter(({ overlapRatio, verticalOffset }) => {
            return overlapRatio >= PAGE_OVERLAP_THRESHOLD && verticalOffset >= 0;
        })
            .sort((left, right) => {
            if (left.verticalOffset !== right.verticalOffset) {
                return left.verticalOffset - right.verticalOffset;
            }
            if (left.overlapRatio !== right.overlapRatio) {
                return right.overlapRatio - left.overlapRatio;
            }
            return left.page.root.bounds.x - right.page.root.bounds.x;
        })[0];
        if (matchedPage) {
            matchedPage.page.frames.push(frame);
            continue;
        }
        groupedPages.push({
            root: frame,
            frames: [frame],
        });
    }
    groupedPages.sort((left, right) => {
        if (left.root.bounds.x !== right.root.bounds.x) {
            return left.root.bounds.x - right.root.bounds.x;
        }
        return left.root.bounds.y - right.root.bounds.y;
    });
    groupedPages.forEach((page) => {
        page.frames.sort((left, right) => {
            if (left.bounds.y !== right.bounds.y) {
                return left.bounds.y - right.bounds.y;
            }
            return left.bounds.x - right.bounds.x;
        });
    });
    return groupedPages.map((page) => page.frames);
}
function auditGroupedPages(frames, groupedPages) {
    const frameCountMap = new Map();
    groupedPages.forEach((pageFrames) => {
        pageFrames.forEach((frame) => {
            frameCountMap.set(frame.node.id, (frameCountMap.get(frame.node.id) || 0) + 1);
        });
    });
    const normalizedGroups = groupedPages.map((pageFrames) => pageFrames.slice());
    const coverageIssues = [];
    frames.forEach((frame) => {
        const groupedCount = frameCountMap.get(frame.node.id) || 0;
        if (groupedCount === 0) {
            normalizedGroups.push([frame]);
            coverageIssues.push({
                frameId: frame.node.id,
                frameName: frame.node.name,
                reason: 'top-level FRAME was not assigned to any PAGE/VIEW group and was exported as a standalone page',
            });
            return;
        }
        if (groupedCount > 1) {
            coverageIssues.push({
                frameId: frame.node.id,
                frameName: frame.node.name,
                reason: 'top-level FRAME was assigned to multiple PAGE/VIEW groups',
            });
        }
    });
    normalizedGroups.sort((left, right) => {
        const leftX = Math.min(...left.map((frame) => frame.bounds.x));
        const rightX = Math.min(...right.map((frame) => frame.bounds.x));
        return leftX - rightX;
    });
    normalizedGroups.forEach((pageFrames) => {
        pageFrames.sort((left, right) => {
            if (left.bounds.y !== right.bounds.y) {
                return left.bounds.y - right.bounds.y;
            }
            return left.bounds.x - right.bounds.x;
        });
    });
    return {
        groupedPages: normalizedGroups,
        coverageIssues,
    };
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
    const groupedPageResult = auditGroupedPages(summary.frames, groupFramesIntoPages(summary.frames));
    const groupedPages = groupedPageResult.groupedPages;
    const relativeTopLeftMap = getRelativeTopLeftMap(summary.frames);
    const selectionPages = groupedPages.map((pageFrames, pageIndex) => {
        var _a;
        return ({
            pageNumber: pageIndex + 1,
            pageLabel: getPageTitleForBounds(getPageBounds(pageFrames), summary.pageTitleCandidates)
                || ((_a = pageFrames[0]) === null || _a === void 0 ? void 0 : _a.node.name)
                || `Page${String(pageIndex + 1)}`,
            frameNames: Array.from(new Set(pageFrames.map((frame) => frame.node.name))),
            viewCount: pageFrames.length,
            views: pageFrames.map((frame, viewIndex) => ({
                viewNumber: viewIndex + 1,
                frameId: frame.node.id,
                frameName: frame.node.name,
                bounds: frame.bounds,
                relativeTopLeft: relativeTopLeftMap.get(frame.node.id) || { x: 0, y: 0 },
                primaryTextLabel: findPrimaryTextLabel(frame.node),
            })),
        });
    });
    return {
        frames: summary.frames,
        ignoredNodes: summary.ignoredNodes,
        coverageIssues: groupedPageResult.coverageIssues,
        groupedPages,
        selectionPages,
    };
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
        coverageIssueCount: analysis.coverageIssues.length,
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
function collectAssignedPages(analysis) {
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
            const frame = frameLookup.get(view.frameId);
            if (!frame) {
                throw new Error(`找不到對應的 FRAME：${view.frameId}`);
            }
            return {
                pageNumber: assignedPageNumber,
                viewNumber: assignedViewNumber,
                pageLabel: page.pageLabel,
                frameNames: page.frameNames,
                view,
                frame,
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
    return Array.from(groupedPages.keys())
        .sort((left, right) => left - right)
        .map((pageNumber) => {
        var _a, _b;
        const pageViews = groupedPages.get(pageNumber) || [];
        return {
            pageNumber,
            pageLabel: ((_a = pageViews[0]) === null || _a === void 0 ? void 0 : _a.pageLabel) || ((_b = pageViews[0]) === null || _b === void 0 ? void 0 : _b.view.frameName) || `Page${String(pageNumber)}`,
            frameNames: Array.from(new Set(pageViews.flatMap((pageView) => pageView.frameNames))),
            views: pageViews,
        };
    });
}
async function handlePrepareZipRequest() {
    const container = getSelectedContainerOrThrow();
    try {
        const exportMode = lastPrepareZipRequest.exportMode || 'paged';
        figma.notify('正在準備 AI ZIP...');
        figma.ui.postMessage({
            type: 'set-loading',
            isLoading: true,
            message: exportMode === 'all-in-one' ? '正在準備 All in one 原始資料...' : '正在分析 Page/View 並串流資料...',
        });
        const analysis = analyzeContainer(container);
        if (analysis.frames.length === 0) {
            throw new Error('選取的容器第一層沒有可匯出的 FRAME。');
        }
        const assignedPages = collectAssignedPages(analysis);
        const startMessage = {
            type: 'prepare-zip-start',
            exportMode,
            containerId: container.id,
            containerName: container.name,
            ignoredNodes: {
                count: analysis.ignoredNodes.length,
                items: analysis.ignoredNodes,
            },
            fileName: getSafeFileName(container.name),
            totalPages: assignedPages.length,
        };
        figma.ui.postMessage(startMessage);
        if (exportMode === 'all-in-one') {
            const completeMessage = {
                type: 'prepare-zip-complete',
                exportMode,
                containerId: container.id,
                containerName: container.name,
                containerStructureJson: parseNode(container),
                containerPngBytes: await exportNodePng(container, 1),
                pages: assignedPages.map((page) => ({
                    pageNumber: page.pageNumber,
                    pageLabel: page.pageLabel,
                    frameNames: page.frameNames,
                    views: page.views.map((assignedView) => ({
                        viewNumber: assignedView.viewNumber,
                        frameId: assignedView.frame.node.id,
                        frameName: assignedView.frame.node.name,
                        bounds: assignedView.frame.bounds,
                        relativeTopLeft: assignedView.view.relativeTopLeft,
                        structureJson: parseNode(assignedView.frame.node),
                        pngBytes: new Uint8Array(0),
                    })),
                })),
            };
            figma.ui.postMessage(completeMessage);
            return;
        }
        for (let pageIndex = 0; pageIndex < assignedPages.length; pageIndex += 1) {
            const assignedPage = assignedPages[pageIndex];
            figma.ui.postMessage({
                type: 'set-loading',
                isLoading: true,
                message: `正在準備 Page${String(assignedPage.pageNumber)}（${String(pageIndex + 1)}/${String(assignedPages.length)}）...`,
            });
            const views = [];
            for (const assignedView of assignedPage.views) {
                views.push({
                    viewNumber: assignedView.viewNumber,
                    frameId: assignedView.frame.node.id,
                    frameName: assignedView.frame.node.name,
                    bounds: assignedView.frame.bounds,
                    relativeTopLeft: assignedView.view.relativeTopLeft,
                    structureJson: parseNode(assignedView.frame.node),
                    pngBytes: await exportNodePng(assignedView.frame.node, 1),
                });
            }
            const pageMessage = {
                type: 'prepare-zip-page',
                exportMode: 'paged',
                page: {
                    pageNumber: assignedPage.pageNumber,
                    pageLabel: assignedPage.pageLabel,
                    frameNames: assignedPage.frameNames,
                    views,
                },
                pageIndex: pageIndex + 1,
                totalPages: assignedPages.length,
            };
            figma.ui.postMessage(pageMessage);
        }
        const completeMessage = {
            type: 'prepare-zip-complete',
            exportMode,
            containerId: container.id,
            containerName: container.name,
        };
        figma.ui.postMessage(completeMessage);
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
        const rawExportMode = msg.exportMode === 'all-in-one' ? 'all-in-one' : 'paged';
        lastPrepareZipRequest = {
            exportMode: rawExportMode,
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
