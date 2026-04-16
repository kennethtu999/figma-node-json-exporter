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

type RectData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RelativePoint = {
  x: number;
  y: number;
};

type TextLabelCandidate = {
  text: string;
  area: number;
  y: number;
  x: number;
};

type PageTitleCandidate = {
  text: string;
  bounds: RectData;
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

type IgnoredNodeSummary = {
  id: string;
  name: string;
  type: SceneNode['type'];
  reason: string;
};

type CoverageIssueSummary = {
  frameId: string;
  frameName: string;
  reason: string;
};

type FrameCandidate = {
  node: SceneNode;
  bounds: RectData;
};

type ExportViewPayload = {
  viewNumber: number;
  frameId: string;
  frameName: string;
  bounds: RectData;
  relativeTopLeft: RelativePoint;
  structureJson: ParsedNode;
  pngBytes: Uint8Array;
};

type ExportPagePayload = {
  pageNumber: number;
  pageLabel: string;
  frameNames: string[];
  views: ExportViewPayload[];
};

type SelectionViewSummary = {
  viewNumber: number;
  frameId: string;
  frameName: string;
  bounds: RectData;
  relativeTopLeft: RelativePoint;
  primaryTextLabel?: string;
};

type SelectionPageSummary = {
  pageNumber: number;
  pageLabel: string;
  frameNames: string[];
  viewCount: number;
  views: SelectionViewSummary[];
};

type SelectionInfoMessage = {
  type: 'selection-info';
  selectionCount: number;
  firstSelectionName: string;
  isContainer: boolean;
  eligibleFrameCount?: number;
  ignoredNodeCount?: number;
  coverageIssueCount?: number;
  pages?: SelectionPageSummary[];
  defaultPageNumber?: number;
  defaultViewNumber?: number;
};

type ExportMode = 'paged' | 'all-in-one';

type PrepareZipStartMessage = {
  type: 'prepare-zip-start';
  exportMode: ExportMode;
  containerId: string;
  containerName: string;
  ignoredNodes: {
    count: number;
    items: IgnoredNodeSummary[];
  };
  fileName: string;
  totalPages: number;
};

type PrepareZipPageMessage = {
  type: 'prepare-zip-page';
  exportMode: 'paged';
  page: ExportPagePayload;
  pageIndex: number;
  totalPages: number;
};

type PrepareZipCompleteMessage = {
  type: 'prepare-zip-complete';
  exportMode: ExportMode;
  containerId: string;
  containerName: string;
  containerStructureJson?: ParsedNode;
  containerPngBytes?: Uint8Array;
  pages?: ExportPagePayload[];
};

type SceneNodeWithChildren = SceneNode & ChildrenMixin;

type ContainerAnalysis = {
  frames: FrameCandidate[];
  ignoredNodes: IgnoredNodeSummary[];
  coverageIssues: CoverageIssueSummary[];
  groupedPages: FrameCandidate[][];
  selectionPages: SelectionPageSummary[];
};

type PrepareZipSelection = {
  exportMode?: ExportMode;
  overrides?: Array<{
    frameId: string;
    pageNumber: number;
    viewNumber: number;
  }>;
};

let lastPrepareZipRequest: PrepareZipSelection = {};

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

function normalizeTextLabel(text: string, maxLength = 60): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`
    : normalized;
}

function shouldIgnorePrimaryTextLabel(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return IGNORED_PRIMARY_TEXT_LABEL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function getTextLabelCandidate(node: SceneNode): TextLabelCandidate | null {
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
    y: bounds?.y ?? Number.POSITIVE_INFINITY,
    x: bounds?.x ?? Number.POSITIVE_INFINITY,
  };
}

function pickBetterTextLabelCandidate(
  current: TextLabelCandidate | null,
  next: TextLabelCandidate | null,
): TextLabelCandidate | null {
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

function findPrimaryTextLabelCandidate(node: SceneNode): TextLabelCandidate | null {
  let bestCandidate = getTextLabelCandidate(node);

  if ('children' in node) {
    node.children.forEach((child) => {
      bestCandidate = pickBetterTextLabelCandidate(bestCandidate, findPrimaryTextLabelCandidate(child as SceneNode));
    });
  }

  return bestCandidate;
}

function findPrimaryTextLabel(node: SceneNode): string | undefined {
  return findPrimaryTextLabelCandidate(node)?.text;
}

function getSingleLineText(node: SceneNode): string | null {
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

function getSingleLinePageTitle(node: SceneNode): string | null {
  const textCandidates: Array<{ text: string; bounds: RectData | null }> = [];

  function walk(currentNode: SceneNode) {
    const text = getSingleLineText(currentNode);
    if (text) {
      textCandidates.push({
        text,
        bounds: toRectData(getNodeExportBounds(currentNode)) ?? null,
      });
    }

    if ('children' in currentNode) {
      currentNode.children.forEach((child) => {
        walk(child as SceneNode);
      });
    }
  }

  walk(node);

  const orderedTexts = textCandidates
    .sort((left, right) => {
      const leftY = left.bounds?.y ?? Number.POSITIVE_INFINITY;
      const rightY = right.bounds?.y ?? Number.POSITIVE_INFINITY;
      if (leftY !== rightY) {
        return leftY - rightY;
      }

      const leftX = left.bounds?.x ?? Number.POSITIVE_INFINITY;
      const rightX = right.bounds?.x ?? Number.POSITIVE_INFINITY;
      return leftX - rightX;
    })
    .map((candidate) => candidate.text)
    .filter((text, index, array) => array.indexOf(text) === index);

  return orderedTexts.length > 0 ? orderedTexts.join(' ') : null;
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

function isContainerNode(node: SceneNode): node is SceneNodeWithChildren {
  return 'children' in node;
}

function getSelectedContainerOrThrow(): SceneNodeWithChildren {
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

function getSafeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
}

function getNormalizedTextLines(node: SceneNode): string[] {
  const lines: string[] = [];

  function walk(currentNode: SceneNode) {
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
        walk(child as SceneNode);
      });
    }
  }

  walk(node);

  return lines.filter((line, index, items) => items.indexOf(line) === index);
}

function countDescendants(node: SceneNode): number {
  if (!('children' in node)) {
    return 0;
  }

  return node.children.reduce((sum, child) => {
    return sum + 1 + countDescendants(child as SceneNode);
  }, 0);
}

function countTextNodes(node: SceneNode): number {
  let count = node.type === 'TEXT' ? 1 : 0;

  if ('children' in node) {
    node.children.forEach((child) => {
      count += countTextNodes(child as SceneNode);
    });
  }

  return count;
}

function isLabelLikeNode(node: SceneNode, bounds: RectData, containerBounds: RectData | null): boolean {
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

function isPageCandidateNode(node: SceneNode, bounds: RectData): boolean {
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

function summarizeTopLevelNodes(container: SceneNodeWithChildren): {
  frames: FrameCandidate[];
  ignoredNodes: IgnoredNodeSummary[];
  pageTitleCandidates: PageTitleCandidate[];
} {
  const frames: FrameCandidate[] = [];
  const ignoredNodes: IgnoredNodeSummary[] = [];
  const pageTitleCandidates: PageTitleCandidate[] = [];
  const containerBounds = toRectData(getNodeExportBounds(container)) ?? null;

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

    if (isLabelLikeNode(child as SceneNode, bounds, containerBounds)) {
      const pageTitle = getSingleLinePageTitle(child as SceneNode);
      if (pageTitle) {
        pageTitleCandidates.push({
          text: pageTitle,
          bounds,
        });
      } else {
        ignoredNodes.push({
          id: child.id,
          name: child.name,
          type: child.type,
          reason: 'top-level node matched LABEL rule but had no usable single-line text',
        });
      }
      continue;
    }

    if (!isPageCandidateNode(child as SceneNode, bounds)) {
      ignoredNodes.push({
        id: child.id,
        name: child.name,
        type: child.type,
        reason: 'top-level node did not meet PAGE/VIEW candidate size or complexity thresholds',
      });
      continue;
    }

    frames.push({
      node: child as SceneNode,
      bounds,
    });
  }

  return { frames, ignoredNodes, pageTitleCandidates };
}

function getHorizontalOverlapRatio(a: RectData, b: RectData): number {
  const overlapStart = Math.max(a.x, b.x);
  const overlapEnd = Math.min(a.x + a.width, b.x + b.width);
  const overlapWidth = Math.max(0, overlapEnd - overlapStart);
  const narrowerWidth = Math.min(a.width, b.width);

  if (narrowerWidth <= 0) {
    return 0;
  }

  return overlapWidth / narrowerWidth;
}

function getPageBounds(frames: FrameCandidate[]): RectData | null {
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

function getPageTitleForBounds(pageBounds: RectData | null, candidates: PageTitleCandidate[]): string | undefined {
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

  return matchedCandidate?.candidate.text;
}

function groupFramesIntoPages(frames: FrameCandidate[]): FrameCandidate[][] {
  const sortedFrames = frames.slice().sort((left, right) => {
    if (left.bounds.y !== right.bounds.y) {
      return left.bounds.y - right.bounds.y;
    }

    return left.bounds.x - right.bounds.x;
  });

  const groupedPages: Array<{
    root: FrameCandidate;
    frames: FrameCandidate[];
  }> = [];

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

function auditGroupedPages(
  frames: FrameCandidate[],
  groupedPages: FrameCandidate[][],
): {
  groupedPages: FrameCandidate[][];
  coverageIssues: CoverageIssueSummary[];
} {
  const frameCountMap = new Map<string, number>();
  groupedPages.forEach((pageFrames) => {
    pageFrames.forEach((frame) => {
      frameCountMap.set(frame.node.id, (frameCountMap.get(frame.node.id) || 0) + 1);
    });
  });

  const normalizedGroups = groupedPages.map((pageFrames) => pageFrames.slice());
  const coverageIssues: CoverageIssueSummary[] = [];

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

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function getRelativeTopLeftMap(frames: FrameCandidate[]): Map<string, RelativePoint> {
  const map = new Map<string, RelativePoint>();
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

function analyzeContainer(container: SceneNodeWithChildren): ContainerAnalysis {
  const summary = summarizeTopLevelNodes(container);
  const groupedPageResult = auditGroupedPages(summary.frames, groupFramesIntoPages(summary.frames));
  const groupedPages = groupedPageResult.groupedPages;
  const relativeTopLeftMap = getRelativeTopLeftMap(summary.frames);
  const selectionPages = groupedPages.map((pageFrames, pageIndex) => ({
    pageNumber: pageIndex + 1,
    pageLabel: getPageTitleForBounds(getPageBounds(pageFrames), summary.pageTitleCandidates)
      || pageFrames[0]?.node.name
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
  }));

  return {
    frames: summary.frames,
    ignoredNodes: summary.ignoredNodes,
    coverageIssues: groupedPageResult.coverageIssues,
    groupedPages,
    selectionPages,
  };
}

function buildSelectionInfoMessage(): SelectionInfoMessage {
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
    defaultPageNumber: analysis.selectionPages[0]?.pageNumber,
    defaultViewNumber: analysis.selectionPages[0]?.views[0]?.viewNumber,
  };
}

function postSelectionInfo() {
  figma.ui.postMessage(buildSelectionInfoMessage());
}

async function exportNodePng(node: SceneNode, scale: number): Promise<Uint8Array> {
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
  } finally {
    slice.remove();
  }
}

type AssignedView = {
  pageNumber: number;
  viewNumber: number;
  pageLabel: string;
  frameNames: string[];
  view: SelectionViewSummary;
  frame: FrameCandidate;
};

type AssignedPage = {
  pageNumber: number;
  pageLabel: string;
  frameNames: string[];
  views: AssignedView[];
};

function collectAssignedPages(analysis: ContainerAnalysis): AssignedPage[] {
  const frameLookup = new Map<string, FrameCandidate>();
  analysis.frames.forEach((frame) => {
    frameLookup.set(frame.node.id, frame);
  });

  const overrideMap = new Map<string, { pageNumber: number; viewNumber: number }>();
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

  const duplicateCheck = new Set<string>();
  const assignedViews = analysis.selectionPages.flatMap((page) => {
    return page.views.map((view) => {
      const override = overrideMap.get(view.frameId);
      const assignedPageNumber = override?.pageNumber ?? page.pageNumber;
      const assignedViewNumber = override?.viewNumber ?? view.viewNumber;
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

  const groupedPages = new Map<number, AssignedView[]>();
  assignedViews.forEach((assignedView) => {
    const pageViews = groupedPages.get(assignedView.pageNumber);
    if (pageViews) {
      pageViews.push(assignedView);
    } else {
      groupedPages.set(assignedView.pageNumber, [assignedView]);
    }
  });

  return Array.from(groupedPages.keys())
    .sort((left, right) => left - right)
    .map((pageNumber) => {
      const pageViews = groupedPages.get(pageNumber) || [];
      return {
        pageNumber,
        pageLabel: pageViews[0]?.pageLabel || pageViews[0]?.view.frameName || `Page${String(pageNumber)}`,
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
    const startMessage: PrepareZipStartMessage = {
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
      const completeMessage: PrepareZipCompleteMessage = {
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

      const views: ExportViewPayload[] = [];
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

      const pageMessage: PrepareZipPageMessage = {
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

    const completeMessage: PrepareZipCompleteMessage = {
      type: 'prepare-zip-complete',
      exportMode,
      containerId: container.id,
      containerName: container.name,
    };

    figma.ui.postMessage(completeMessage);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '準備 AI ZIP 時發生錯誤。';
    figma.ui.postMessage({ type: 'set-loading', isLoading: false });
    figma.notify(message, { error: true });
  }
}

try {
  getSelectedContainerOrThrow();
  postSelectionInfo();
} catch (error) {
  const message = error instanceof Error ? error.message : '請先選取一個父層容器。';
  figma.notify(message, { error: true });
  figma.closePlugin();
}

figma.on('selectionchange', () => {
  postSelectionInfo();
});

figma.ui.onmessage = (msg) => {
  if (msg.type === 'prepare-zip') {
    const rawOverrides = Array.isArray(msg.overrides) ? msg.overrides as Array<Record<string, unknown>> : [];
    const rawExportMode = msg.exportMode === 'all-in-one' ? 'all-in-one' : 'paged';
    lastPrepareZipRequest = {
      exportMode: rawExportMode,
      overrides: rawOverrides
          .filter((override) => typeof override.frameId === 'string')
          .map((override) => ({
            frameId: String(override.frameId),
            pageNumber: Number(override.pageNumber),
            viewNumber: Number(override.viewNumber),
          }))
        ,
    };
    void handlePrepareZipRequest();
  }

  if (msg.type === 'close') {
    figma.closePlugin('✅ 已完成');
  }

  if (msg.type === 'error') {
    const errorMessage =
      typeof msg.message === 'string' && msg.message.length > 0
        ? msg.message
        : 'AI ZIP 處理過程發生錯誤，請查看 Console。';
    figma.notify(errorMessage, { error: true });
    figma.closePlugin();
  }
};
