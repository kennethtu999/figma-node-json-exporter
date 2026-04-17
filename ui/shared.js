const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      if ((value & 1) === 1) {
        value = 0xedb88320 ^ (value >>> 1);
      } else {
        value >>>= 1;
      }
    }

    table[index] = value >>> 0;
  }

  return table;
})();

export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 3000);
}

export function encodeText(text) {
  return new TextEncoder().encode(text);
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

export function createZipBuilder() {
  const localChunks = [];
  const centralEntries = [];
  let localSize = 0;

  const ZIP16_MAX = 0xffff;
  const ZIP32_MAX = 0xffffffff;

  function addEntry(path, data) {
    if (centralEntries.length >= ZIP16_MAX) {
      throw new Error('ZIP 檔案數量超過格式上限（65535），請減少輸出內容後重試。');
    }

    const nameBytes = encodeText(path);
    const payload = data instanceof Uint8Array ? data : new Uint8Array(data);

    if (payload.length > ZIP32_MAX) {
      throw new Error('單一檔案過大（超過 4GB），目前 ZIP 格式無法處理。');
    }

    const crc = crc32(payload);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, payload.length);
    writeUint32(localView, 22, payload.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, payload);
    centralEntries.push({
      nameBytes,
      crc,
      size: payload.length,
      localHeaderOffset: localSize,
    });
    localSize += localHeader.length + payload.length;

    if (localSize > ZIP32_MAX) {
      throw new Error('ZIP 總大小超過 4GB，請改為較小範圍匯出。');
    }
  }

  function buildBlob() {
    const centralChunks = [];
    let centralSize = 0;

    centralEntries.forEach((entry) => {
      const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);

      writeUint32(centralView, 0, 0x02014b50);
      writeUint16(centralView, 4, 20);
      writeUint16(centralView, 6, 20);
      writeUint16(centralView, 8, 0);
      writeUint16(centralView, 10, 0);
      writeUint16(centralView, 12, 0);
      writeUint16(centralView, 14, 0);
      writeUint32(centralView, 16, entry.crc);
      writeUint32(centralView, 20, entry.size);
      writeUint32(centralView, 24, entry.size);
      writeUint16(centralView, 28, entry.nameBytes.length);
      writeUint16(centralView, 30, 0);
      writeUint16(centralView, 32, 0);
      writeUint16(centralView, 34, 0);
      writeUint16(centralView, 36, 0);
      writeUint32(centralView, 38, 0);
      writeUint32(centralView, 42, entry.localHeaderOffset);
      centralHeader.set(entry.nameBytes, 46);

      centralChunks.push(centralHeader);
      centralSize += centralHeader.length;
    });

    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    writeUint32(endView, 0, 0x06054b50);
    writeUint16(endView, 4, 0);
    writeUint16(endView, 6, 0);
    writeUint16(endView, 8, centralEntries.length);
    writeUint16(endView, 10, centralEntries.length);
    writeUint32(endView, 12, centralSize);
    writeUint32(endView, 16, localSize);
    writeUint16(endView, 20, 0);

    return new Blob(localChunks.concat(centralChunks, [endRecord]), { type: 'application/zip' });
  }

  return {
    addEntry,
    buildBlob,
  };
}

export function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }

  return new Uint8Array(0);
}

export function roundNumber(value) {
  return Math.round(value * 100) / 100;
}

export function getBounds(node) {
  const bounds = node.absoluteRenderBounds || node.absoluteBoundingBox;
  if (bounds) {
    return {
      x: roundNumber(bounds.x),
      y: roundNumber(bounds.y),
      width: roundNumber(bounds.width),
      height: roundNumber(bounds.height),
    };
  }

  if (
    typeof node.x === 'number'
    && typeof node.y === 'number'
    && typeof node.width === 'number'
    && typeof node.height === 'number'
  ) {
    return {
      x: roundNumber(node.x),
      y: roundNumber(node.y),
      width: roundNumber(node.width),
      height: roundNumber(node.height),
    };
  }

  return null;
}

function buildNodePath(pathSegments) {
  return pathSegments.join(' / ');
}

const CONTAINER_NODE_TYPES = new Set([
  'FRAME',
  'GROUP',
  'INSTANCE',
  'COMPONENT',
  'COMPONENT_SET',
  'BOOLEAN_OPERATION',
]);

const ARTIFACT_PATHS = {
  subtreesDir: 'subtrees',
  componentsPath: 'components.jsonl',
  tokensPath: 'tokens.json',
  layoutBlocksPath: 'layout-blocks.jsonl',
  textGroupsPath: 'text-groups.jsonl',
};

function getNodeDisplayName(node) {
  if (typeof node.name === 'string' && node.name.length > 0) {
    return node.name;
  }

  return node.type;
}

function getTextPreview(node) {
  if (typeof node.characters !== 'string') {
    return undefined;
  }

  const normalized = node.characters.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, 120);
}

function createFileSlug(value) {
  return encodeURIComponent(String(value)).replaceAll('%', '_');
}

function createSubtreeId(nodeId) {
  return 'subtree-' + createFileSlug(nodeId);
}

function createSubtreeRef(subtreeId) {
  return ARTIFACT_PATHS.subtreesDir + '/' + subtreeId + '.json';
}

function createTextGroupId(nodeId) {
  return 'text-group-' + createFileSlug(nodeId);
}

function serializeNodeLiteFields(node) {
  const serialized = {
    id: node.id,
    parentId: node.parentId ?? null,
    path: node.path,
    depth: node.depth,
    childIds: Array.isArray(node.childIds) ? node.childIds : [],
    childCount: Number(node.childCount || 0),
    name: node.name,
    type: node.type,
  };

  if (node.bounds) {
    serialized.bounds = node.bounds;
  }

  if (typeof node.text === 'string' && node.text.length > 0) {
    serialized.text = node.text;
  }

  if (node.textPreview) {
    serialized.textPreview = node.textPreview;
  }

  if (node.style) {
    serialized.style = node.style;
  }

  if (node.layout) {
    serialized.layout = node.layout;
  }

  if (node.layoutItem) {
    serialized.layoutItem = node.layoutItem;
  }

  if (node.textStyle) {
    serialized.textStyle = node.textStyle;
  }

  if (node.component) {
    serialized.component = node.component;
  }

  if (node.subtreeId) {
    serialized.subtreeId = node.subtreeId;
    serialized.subtreeRef = node.subtreeRef;
  }

  return serialized;
}

function toLiteNodeWithContext(node, parentId, pathSegments, depth) {
  const displayName = getNodeDisplayName(node);
  const currentPathSegments = pathSegments.concat(displayName);
  const currentPath = buildNodePath(currentPathSegments);
  const childNodes = Array.isArray(node.children) ? node.children : [];
  const childIds = childNodes.map((child) => child.id);
  const lite = {
    id: node.id,
    parentId: parentId ?? null,
    path: currentPath,
    depth,
    childIds,
    childCount: childIds.length,
    name: node.name,
    type: node.type,
  };

  const bounds = getBounds(node);
  if (bounds) {
    lite.bounds = bounds;
  }

  if (typeof node.characters === 'string' && node.characters.length > 0) {
    lite.text = node.characters;
  }

  const textPreview = getTextPreview(node);
  if (textPreview) {
    lite.textPreview = textPreview;
  }

  if (node.style) {
    lite.style = node.style;
  }

  if (node.layout) {
    lite.layout = node.layout;
  }

  if (node.layoutItem) {
    lite.layoutItem = node.layoutItem;
  }

  if (node.textStyle) {
    lite.textStyle = node.textStyle;
  }

  if (node.component) {
    lite.component = node.component;
  }

  if (childNodes.length > 0) {
    lite.children = childNodes.map((child) => (
      toLiteNodeWithContext(child, node.id, currentPathSegments, depth + 1)
    ));
  }

  return lite;
}

function collectLiteTreeMeta(liteNode, output) {
  let descendantCount = 1;
  let textNodeCount = typeof liteNode.text === 'string' && liteNode.text.length > 0 ? 1 : 0;

  if (Array.isArray(liteNode.children)) {
    liteNode.children.forEach((child) => {
      const childMeta = collectLiteTreeMeta(child, output);
      descendantCount += childMeta.descendantCount;
      textNodeCount += childMeta.textNodeCount;
    });
  }

  const meta = {
    descendantCount,
    textNodeCount,
  };
  output.set(liteNode.id, meta);
  return meta;
}

function isSubtreeCandidate(liteNode, meta) {
  if (!CONTAINER_NODE_TYPES.has(liteNode.type) || !liteNode.bounds || liteNode.childCount === 0) {
    return false;
  }

  if (liteNode.depth === 0) {
    return false;
  }

  if (liteNode.depth <= 1) {
    return true;
  }

  if (liteNode.depth > 7) {
    return false;
  }

  if (liteNode.layout && (liteNode.childCount >= 2 || meta.textNodeCount >= 2)) {
    return true;
  }

  if (liteNode.childCount >= 8) {
    return true;
  }

  if (meta.descendantCount >= 24) {
    return true;
  }

  if (meta.textNodeCount >= 6) {
    return true;
  }

  return false;
}

function selectSubtreeRootIds(liteRoot, metaMap) {
  const selected = new Set();

  function walk(node) {
    const meta = metaMap.get(node.id);
    if (meta && isSubtreeCandidate(node, meta)) {
      selected.add(node.id);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => {
        walk(child);
      });
    }
  }

  walk(liteRoot);

  if (!selected.size && Array.isArray(liteRoot.children)) {
    liteRoot.children.forEach((child) => {
      selected.add(child.id);
    });
  }

  return selected;
}

function addUniqueExample(examples, detail) {
  if (!detail) {
    return;
  }

  const exampleKey = detail.subtreeRef || detail.id || detail.path;
  if (!exampleKey) {
    return;
  }

  if (examples.some((item) => (item.subtreeRef || item.id || item.path) === exampleKey)) {
    return;
  }

  if (examples.length >= 5) {
    return;
  }

  examples.push(detail);
}

function incrementTokenBucket(bucket, key, baseToken, example) {
  const existing = bucket.get(key);
  if (existing) {
    existing.usageCount += 1;
    addUniqueExample(existing.examples, example);
    return;
  }

  bucket.set(key, {
    ...baseToken,
    usageCount: 1,
    examples: example ? [example] : [],
  });
}

function colorToHex(color) {
  if (!color) {
    return null;
  }

  const rgb = [color.r, color.g, color.b].map((channel) => {
    return Math.max(0, Math.min(255, Math.round(Number(channel || 0) * 255)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  });
  const alpha = Math.max(0, Math.min(255, Math.round(Number(color.a ?? 1) * 255)));

  if (alpha < 255) {
    rgb.push(alpha.toString(16).padStart(2, '0').toUpperCase());
  }

  return '#' + rgb.join('');
}

function normalizeMetric(metric) {
  if (!metric || metric === 'mixed') {
    return undefined;
  }

  return {
    unit: metric.unit,
    value: typeof metric.value === 'number' ? roundNumber(metric.value) : undefined,
  };
}

function addPaintTokens(paints, sourceKind, tokenState, example) {
  if (!Array.isArray(paints)) {
    return;
  }

  paints.forEach((paint) => {
    if (!paint || paint.visible === false || paint.type !== 'SOLID' || !paint.color) {
      return;
    }

    const value = colorToHex(paint.color);
    if (!value) {
      return;
    }

    const key = JSON.stringify({
      sourceKind,
      value,
      blendMode: paint.blendMode || '',
    });

    incrementTokenBucket(tokenState.colors, key, {
      kind: sourceKind,
      value,
      blendMode: paint.blendMode,
    }, example);
  });
}

function collectTokensFromNode(node, tokenState, detail) {
  if (node.style) {
    addPaintTokens(node.style.fills, 'fill', tokenState, detail);
    addPaintTokens(node.style.strokes, 'stroke', tokenState, detail);

    if (typeof node.style.strokeWeight === 'number') {
      const color = Array.isArray(node.style.strokes)
        ? colorToHex(node.style.strokes.find((paint) => paint?.type === 'SOLID' && paint.color)?.color)
        : null;
      const key = JSON.stringify({
        strokeWeight: roundNumber(node.style.strokeWeight),
        strokeAlign: node.style.strokeAlign || '',
        color: color || '',
      });
      incrementTokenBucket(tokenState.strokes, key, {
        strokeWeight: roundNumber(node.style.strokeWeight),
        strokeAlign: node.style.strokeAlign,
        color,
      }, detail);
    }

    if (typeof node.style.cornerRadius === 'number') {
      const radiusValue = roundNumber(node.style.cornerRadius);
      incrementTokenBucket(tokenState.radii, 'cornerRadius:' + String(radiusValue), {
        type: 'cornerRadius',
        value: radiusValue,
      }, detail);
    }

    if (Array.isArray(node.style.cornerRadii) && node.style.cornerRadii.length > 0) {
      const radii = node.style.cornerRadii.map((value) => roundNumber(value));
      incrementTokenBucket(tokenState.radii, 'cornerRadii:' + JSON.stringify(radii), {
        type: 'cornerRadii',
        value: radii,
      }, detail);
    }

    if (Array.isArray(node.style.effects)) {
      node.style.effects.forEach((effect) => {
        const key = JSON.stringify({
          type: effect.type,
          radius: typeof effect.radius === 'number' ? roundNumber(effect.radius) : null,
          color: colorToHex(effect.color),
          offset: effect.offset || null,
          spread: typeof effect.spread === 'number' ? roundNumber(effect.spread) : null,
        });
        incrementTokenBucket(tokenState.effects, key, {
          type: effect.type,
          radius: typeof effect.radius === 'number' ? roundNumber(effect.radius) : undefined,
          color: colorToHex(effect.color),
          offset: effect.offset,
          spread: typeof effect.spread === 'number' ? roundNumber(effect.spread) : undefined,
        }, detail);

        if (effect.color) {
          incrementTokenBucket(tokenState.colors, 'effect:' + key, {
            kind: 'effect',
            value: colorToHex(effect.color),
            effectType: effect.type,
          }, detail);
        }
      });
    }
  }

  if (node.layout) {
    if (typeof node.layout.itemSpacing === 'number') {
      const value = roundNumber(node.layout.itemSpacing);
      incrementTokenBucket(tokenState.spacing, 'itemSpacing:' + String(value), {
        kind: 'itemSpacing',
        value,
      }, detail);
    }

    if (typeof node.layout.counterAxisSpacing === 'number') {
      const value = roundNumber(node.layout.counterAxisSpacing);
      incrementTokenBucket(tokenState.spacing, 'counterAxisSpacing:' + String(value), {
        kind: 'counterAxisSpacing',
        value,
      }, detail);
    }

    if (node.layout.padding) {
      Object.entries(node.layout.padding).forEach(([side, rawValue]) => {
        if (typeof rawValue !== 'number') {
          return;
        }

        const value = roundNumber(rawValue);
        incrementTokenBucket(tokenState.spacing, 'padding:' + side + ':' + String(value), {
          kind: 'padding-' + side,
          value,
        }, detail);
      });
    }
  }

  if (node.textStyle) {
    const metricLineHeight = normalizeMetric(node.textStyle.lineHeight);
    const metricLetterSpacing = normalizeMetric(node.textStyle.letterSpacing);
    const token = {
      fontFamily: typeof node.textStyle.fontFamily === 'string' ? node.textStyle.fontFamily : undefined,
      fontStyle: typeof node.textStyle.fontStyle === 'string' ? node.textStyle.fontStyle : undefined,
      fontSize: typeof node.textStyle.fontSize === 'number' ? roundNumber(node.textStyle.fontSize) : undefined,
      lineHeight: metricLineHeight,
      letterSpacing: metricLetterSpacing,
      textCase: node.textStyle.textCase && node.textStyle.textCase !== 'mixed' ? node.textStyle.textCase : undefined,
      textDecoration: node.textStyle.textDecoration && node.textStyle.textDecoration !== 'mixed'
        ? node.textStyle.textDecoration
        : undefined,
    };
    const key = JSON.stringify(token);
    incrementTokenBucket(tokenState.typography, key, token, detail);

    if (Array.isArray(node.textStyle.segments)) {
      node.textStyle.segments.forEach((segment) => {
        addPaintTokens(segment.fills, 'text-fill', tokenState, detail);
      });
    }
  }
}

function sortByUsage(collection) {
  return Array.from(collection.values()).sort((left, right) => {
    if (right.usageCount !== left.usageCount) {
      return right.usageCount - left.usageCount;
    }

    return JSON.stringify(left).localeCompare(JSON.stringify(right));
  });
}

function createEmptyTokenState() {
  return {
    colors: new Map(),
    typography: new Map(),
    radii: new Map(),
    spacing: new Map(),
    effects: new Map(),
    strokes: new Map(),
  };
}

function isLayoutBlockNode(node, meta) {
  if (!node.bounds || typeof node.text === 'string' || node.childCount === 0) {
    return false;
  }

  if (node.layout) {
    return true;
  }

  if (!CONTAINER_NODE_TYPES.has(node.type)) {
    return false;
  }

  return node.childCount >= 3 || meta.descendantCount >= 12 || meta.textNodeCount >= 3;
}

function isTextGroupContainer(node, meta) {
  if (!CONTAINER_NODE_TYPES.has(node.type) || node.childCount === 0) {
    return false;
  }

  return Boolean(node.layout) || node.childCount >= 2 || meta.textNodeCount >= 2;
}

function findTextGroupContainer(ancestors, metaMap) {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    const meta = metaMap.get(ancestor.id);
    if (meta && isTextGroupContainer(ancestor, meta)) {
      return ancestor;
    }
  }

  return ancestors[ancestors.length - 1] || null;
}

function createSubtreePlaceholder(node) {
  return {
    id: node.id,
    parentId: node.parentId ?? null,
    path: node.path,
    depth: node.depth,
    name: node.name,
    type: node.type,
    subtreeId: node.subtreeId,
    subtreeRef: node.subtreeRef,
    childCount: node.childCount,
    childIds: Array.isArray(node.childIds) ? node.childIds : [],
    textPreview: node.textPreview,
    bounds: node.bounds,
    pruned: true,
    note: 'Nested subtree omitted. Load subtreeRef for the focused subtree.',
  };
}

function createSubtreeNode(node, currentSubtreeId) {
  const subtreeNode = serializeNodeLiteFields(node);

  if (Array.isArray(node.children) && node.children.length > 0) {
    subtreeNode.children = node.children.map((child) => {
      if (child.subtreeId && child.subtreeId !== currentSubtreeId) {
        return createSubtreePlaceholder(child);
      }

      return createSubtreeNode(child, currentSubtreeId);
    });
  }

  return subtreeNode;
}

function buildSubtreeFiles(subtreeRootIds, liteNodeMap, metaMap, imageMeta) {
  return Array.from(subtreeRootIds).map((rootId) => {
    const node = liteNodeMap.get(rootId);
    const meta = metaMap.get(rootId);
    const subtreeId = node.subtreeId;
    return {
      path: node.subtreeRef,
      data: {
        format: 'figma-ai-subtree.v1',
        image: imageMeta,
        subtreeId,
        subtreeRef: node.subtreeRef,
        rootId: node.id,
        rootPath: node.path,
        stats: {
          nodeCount: meta?.descendantCount ?? 1,
          textCount: meta?.textNodeCount ?? 0,
          depth: node.depth,
        },
        root: createSubtreeNode(node, subtreeId),
      },
    };
  });
}

function serializeJsonlEntries(entries) {
  return entries.map((entry) => JSON.stringify(entry)).join('\n');
}

function enrichLiteTreeAndCollectArtifacts(liteRoot, metaMap, subtreeRootIds) {
  const subtreeRootSet = new Set(subtreeRootIds);
  const liteNodeMap = new Map();
  const tokenState = createEmptyTokenState();
  const componentEntries = [];
  const layoutBlockEntries = [];
  const textGroupMap = new Map();

  function walk(node, currentSubtreeRootId, ancestors) {
    const activeSubtreeRootId = subtreeRootSet.has(node.id) ? node.id : currentSubtreeRootId;
    const subtreeId = activeSubtreeRootId ? createSubtreeId(activeSubtreeRootId) : null;
    const subtreeRef = subtreeId ? createSubtreeRef(subtreeId) : null;

    if (subtreeId) {
      node.subtreeId = subtreeId;
      node.subtreeRef = subtreeRef;
    }

    liteNodeMap.set(node.id, node);

    const meta = metaMap.get(node.id);
    const detail = {
      id: node.id,
      name: node.name,
      path: node.path,
      subtreeId: subtreeId ?? null,
      subtreeRef: subtreeRef ?? null,
    };

    collectTokensFromNode(node, tokenState, detail);

    if (node.component) {
      componentEntries.push({
        format: 'figma-ai-components.v1',
        id: node.id,
        name: node.name,
        type: node.type,
        path: node.path,
        depth: node.depth,
        subtreeId,
        subtreeRef,
        bounds: node.bounds,
        component: node.component,
        childCount: node.childCount,
        descendantCount: meta?.descendantCount ?? 1,
        textNodeCount: meta?.textNodeCount ?? 0,
      });
    }

    if (meta && isLayoutBlockNode(node, meta)) {
      layoutBlockEntries.push({
        format: 'figma-ai-layout-blocks.v1',
        id: node.id,
        name: node.name,
        type: node.type,
        path: node.path,
        depth: node.depth,
        subtreeId,
        subtreeRef,
        bounds: node.bounds,
        childCount: node.childCount,
        descendantCount: meta.descendantCount,
        textNodeCount: meta.textNodeCount,
        layout: node.layout,
        component: node.component
          ? { kind: node.component.kind, name: node.component.name }
          : undefined,
      });
    }

    if (typeof node.text === 'string' && node.text.length > 0) {
      const container = findTextGroupContainer(ancestors, metaMap) || node;
      const containerSubtreeId = container.subtreeId ?? subtreeId;
      const groupKey = container.id;
      if (!textGroupMap.has(groupKey)) {
        textGroupMap.set(groupKey, {
          format: 'figma-ai-text-groups.v1',
          groupId: createTextGroupId(container.id),
          containerId: container.id,
          containerName: container.name,
          containerType: container.type,
          containerPath: container.path,
          subtreeId: containerSubtreeId ?? null,
          subtreeRef: container.subtreeRef ?? null,
          textCount: 0,
          texts: [],
        });
      }

      const group = textGroupMap.get(groupKey);
      group.textCount += 1;
      group.texts.push({
        id: node.id,
        name: node.name,
        text: node.text,
        path: node.path,
        bounds: node.bounds,
        subtreeId: subtreeId ?? null,
        subtreeRef: subtreeRef ?? null,
      });
    }

    const nextAncestors = ancestors.concat(node);
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => {
        walk(child, activeSubtreeRootId, nextAncestors);
      });
    }
  }

  walk(liteRoot, null, []);

  const textGroups = Array.from(textGroupMap.values()).sort((left, right) => {
    if (right.textCount !== left.textCount) {
      return right.textCount - left.textCount;
    }

    return left.containerPath.localeCompare(right.containerPath);
  });

  return {
    liteNodeMap,
    componentEntries,
    layoutBlockEntries,
    textGroups,
    tokens: {
      format: 'figma-ai-tokens.v1',
      stats: {
        colorCount: tokenState.colors.size,
        typographyCount: tokenState.typography.size,
        radiusCount: tokenState.radii.size,
        spacingCount: tokenState.spacing.size,
        effectCount: tokenState.effects.size,
        strokeCount: tokenState.strokes.size,
      },
      colors: sortByUsage(tokenState.colors),
      typography: sortByUsage(tokenState.typography),
      radii: sortByUsage(tokenState.radii),
      spacing: sortByUsage(tokenState.spacing),
      effects: sortByUsage(tokenState.effects),
      strokes: sortByUsage(tokenState.strokes),
    },
  };
}

function toIndexEntry(liteNode, meta) {
  const entry = {
    id: liteNode.id,
    parentId: liteNode.parentId,
    path: liteNode.path,
    type: liteNode.type,
    name: liteNode.name,
    depth: liteNode.depth,
    childCount: liteNode.childCount,
    descendantCount: meta?.descendantCount ?? 1,
    textNodeCount: meta?.textNodeCount ?? (typeof liteNode.text === 'string' && liteNode.text.length > 0 ? 1 : 0),
    hasText: typeof liteNode.text === 'string' && liteNode.text.length > 0,
  };

  if (liteNode.bounds) {
    entry.bounds = liteNode.bounds;
  }

  if (liteNode.textPreview) {
    entry.textPreview = liteNode.textPreview;
  }

  if (liteNode.component) {
    entry.component = {
      kind: liteNode.component.kind,
      name: liteNode.component.name,
    };
  }

  if (liteNode.subtreeId) {
    entry.subtreeId = liteNode.subtreeId;
    entry.subtreeRef = liteNode.subtreeRef;
  }

  return entry;
}

function collectStructureIndexEntries(liteNode, metaMap, output) {
  output.push(toIndexEntry(liteNode, metaMap.get(liteNode.id)));

  if (Array.isArray(liteNode.children)) {
    liteNode.children.forEach((child) => {
      collectStructureIndexEntries(child, metaMap, output);
    });
  }
}

function collectTextEntries(node, path, output) {
  const currentPath = path.concat(node.name || node.type);

  if (typeof node.characters === 'string' && node.characters.length > 0) {
    output.push({
      id: node.id,
      name: node.name,
      type: node.type,
      text: node.characters,
      path: currentPath.join(' / '),
      bounds: getBounds(node),
    });
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      collectTextEntries(child, currentPath, output);
    });
  }
}

export function buildTextsJsonl(structureJson) {
  const entries = [];
  collectTextEntries(structureJson, [], entries);
  return entries.map((entry) => JSON.stringify(entry)).join('\n');
}

export function countTextEntries(textsJsonl) {
  if (!textsJsonl) {
    return 0;
  }

  return textsJsonl.split('\n').filter((line) => line.length > 0).length;
}

export function countTextNodes(structureJson) {
  let count = 0;

  function walk(node) {
    if (typeof node.characters === 'string' && node.characters.length > 0) {
      count += 1;
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => {
        walk(child);
      });
    }
  }

  walk(structureJson);
  return count;
}

export function loadImageFromBytes(bytes) {
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法載入原始 PNG 影像。'));
    };
    image.src = url;
  });
}

export function buildStructureIndex(liteRoot, imageMeta, textCount, metaMap, subtreeCount) {
  const entries = [];
  collectStructureIndexEntries(liteRoot, metaMap, entries);

  return {
    format: 'figma-ai-index.v2',
    image: imageMeta,
    artifacts: ARTIFACT_PATHS,
    stats: {
      rootCount: 1,
      textCount,
      nodeCount: entries.length,
      subtreeCount,
    },
    entries,
  };
}

export function buildStructureArtifacts(structureJson, imageMeta, textCount) {
  const liteRoot = toLiteNodeWithContext(structureJson, null, [], 0);
  const metaMap = new Map();
  collectLiteTreeMeta(liteRoot, metaMap);
  const subtreeRootIds = selectSubtreeRootIds(liteRoot, metaMap);
  const {
    liteNodeMap,
    componentEntries,
    layoutBlockEntries,
    textGroups,
    tokens,
  } = enrichLiteTreeAndCollectArtifacts(liteRoot, metaMap, subtreeRootIds);
  const subtrees = buildSubtreeFiles(subtreeRootIds, liteNodeMap, metaMap, imageMeta);
  const structureIndex = buildStructureIndex(liteRoot, imageMeta, textCount, metaMap, subtrees.length);

  return {
    structureLite: {
      format: 'figma-ai-content.v4',
      image: imageMeta,
      artifacts: ARTIFACT_PATHS,
      stats: {
        rootCount: 1,
        textCount,
        subtreeCount: subtrees.length,
      },
      roots: [liteRoot],
    },
    structureIndex,
    subtrees,
    componentsJsonl: serializeJsonlEntries(componentEntries),
    tokensJson: tokens,
    layoutBlocksJsonl: serializeJsonlEntries(layoutBlockEntries),
    textGroupsJsonl: serializeJsonlEntries(textGroups),
  };
}

export function buildStructureLite(structureJson, imageMeta, textCount) {
  return buildStructureArtifacts(structureJson, imageMeta, textCount).structureLite;
}

export function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function formatRelativeValue(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}
