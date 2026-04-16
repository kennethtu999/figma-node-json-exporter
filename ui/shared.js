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

  function addEntry(path, data) {
    const nameBytes = encodeText(path);
    const payload = data instanceof Uint8Array ? data : new Uint8Array(data);
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

function toLiteNode(node) {
  const lite = {
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

  if (Array.isArray(node.children) && node.children.length > 0) {
    lite.children = node.children.map((child) => toLiteNode(child));
  }

  return lite;
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

export function buildStructureLite(structureJson, imageMeta, textCount) {
  return {
    format: 'figma-ai-content.v1',
    image: imageMeta,
    stats: {
      rootCount: 1,
      textCount,
    },
    roots: [toLiteNode(structureJson)],
  };
}

export function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function formatRelativeValue(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}
