/**
 * ICO file format parser and writer — TypeScript version
 * Handles 32bpp, 24bpp, 8bpp, 4bpp, 1bpp BMP-embedded ICO frames.
 * PNG-embedded frames are passed through as raw bytes for webview decoding.
 */

export interface IcoFrame {
  width: number;
  height: number;
  bitCount?: number;
  isPng?: boolean;
  /** Raw PNG bytes — only present when isPng === true */
  pngData?: Uint8Array;
  /** RGBA pixel data — only present when isPng === false */
  pixels?: Uint8ClampedArray;
}

export interface IcoWriteFrame {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

/**
 * Parse an ICO file buffer into an array of frames.
 */
export function parseIco(buffer: ArrayBuffer): IcoFrame[] {
  const view = new DataView(buffer);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);

  if (type !== 1) {
    throw new Error('Not a valid ICO file (type field must be 1)');
  }

  const frames: IcoFrame[] = [];

  for (let i = 0; i < count; i++) {
    const entryOffset = 6 + i * 16;
    let width = view.getUint8(entryOffset);
    let height = view.getUint8(entryOffset + 1);
    if (width === 0) { width = 256; }
    if (height === 0) { height = 256; }

    const bitCount = view.getUint16(entryOffset + 6, true);
    const dataSize = view.getUint32(entryOffset + 8, true);
    const dataOffset = view.getUint32(entryOffset + 12, true);

    // Detect PNG signature
    const PNG_SIG = [0x89, 0x50, 0x4e, 0x47];
    const isPng = PNG_SIG.every((b, j) => view.getUint8(dataOffset + j) === b);

    if (isPng) {
      const pngData = new Uint8Array(buffer, dataOffset, dataSize);
      frames.push({ width, height, bitCount, isPng: true, pngData });
    } else {
      const pixels = parseBmpImage(view, dataOffset, width, height);
      frames.push({ width, height, bitCount, isPng: false, pixels });
    }
  }

  return frames;
}

function parseBmpImage(
  view: DataView,
  offset: number,
  width: number,
  height: number
): Uint8ClampedArray {
  const dibHeaderSize = view.getUint32(offset, true);
  const bpp = view.getUint16(offset + 14, true);
  const pixelOffset = offset + dibHeaderSize;
  const pixels = new Uint8ClampedArray(width * height * 4);

  if (bpp === 32) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = pixelOffset + ((height - 1 - y) * width + x) * 4;
        const dst = (y * width + x) * 4;
        pixels[dst]     = view.getUint8(src + 2); // R
        pixels[dst + 1] = view.getUint8(src + 1); // G
        pixels[dst + 2] = view.getUint8(src);     // B
        pixels[dst + 3] = view.getUint8(src + 3); // A
      }
    }
  } else if (bpp === 24) {
    const rowSize = Math.ceil((width * 3) / 4) * 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = pixelOffset + (height - 1 - y) * rowSize + x * 3;
        const dst = (y * width + x) * 4;
        pixels[dst]     = view.getUint8(src + 2);
        pixels[dst + 1] = view.getUint8(src + 1);
        pixels[dst + 2] = view.getUint8(src);
        pixels[dst + 3] = 255;
      }
    }
  } else if (bpp === 8) {
    const palette = readPalette(view, pixelOffset, 256);
    const dataStart = pixelOffset + 256 * 4;
    const rowSize = Math.ceil(width / 4) * 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = view.getUint8(dataStart + (height - 1 - y) * rowSize + x);
        const dst = (y * width + x) * 4;
        [pixels[dst], pixels[dst + 1], pixels[dst + 2], pixels[dst + 3]] = palette[idx];
      }
    }
  } else if (bpp === 4) {
    const palette = readPalette(view, pixelOffset, 16);
    const dataStart = pixelOffset + 16 * 4;
    const rowSize = Math.ceil(width / 8) * 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteVal = view.getUint8(dataStart + (height - 1 - y) * rowSize + Math.floor(x / 2));
        const idx = x % 2 === 0 ? (byteVal >> 4) & 0xf : byteVal & 0xf;
        const dst = (y * width + x) * 4;
        [pixels[dst], pixels[dst + 1], pixels[dst + 2], pixels[dst + 3]] = palette[idx];
      }
    }
  } else if (bpp === 1) {
    const palette = readPalette(view, pixelOffset, 2);
    const dataStart = pixelOffset + 2 * 4;
    const rowSize = Math.ceil(width / 32) * 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteVal = view.getUint8(dataStart + (height - 1 - y) * rowSize + Math.floor(x / 8));
        const bit = (byteVal >> (7 - (x % 8))) & 1;
        const dst = (y * width + x) * 4;
        [pixels[dst], pixels[dst + 1], pixels[dst + 2], pixels[dst + 3]] = palette[bit];
      }
    }
  }
  // Other bpp formats: return transparent pixels (already zeroed)

  return pixels;
}

function readPalette(view: DataView, offset: number, count: number): [number, number, number, number][] {
  const palette: [number, number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    palette.push([
      view.getUint8(offset + i * 4 + 2), // R (stored as BGR)
      view.getUint8(offset + i * 4 + 1), // G
      view.getUint8(offset + i * 4),     // B
      255,
    ]);
  }
  return palette;
}

/**
 * Serialize frames array into a valid ICO file buffer (32bpp RGBA).
 */
export function writeIco(frames: IcoWriteFrame[]): Uint8Array {
  const dibHeaderSize = 40;
  const dirEntrySize = 16;
  const headerSize = 6;

  const imageBuffers: Uint8Array[] = frames.map(f => {
    const { width: w, height: h, pixels } = f;
    const pixDataSize = w * h * 4;
    const andRowSize = Math.ceil(w / 32) * 4;
    const andSize = andRowSize * h;
    const total = dibHeaderSize + pixDataSize + andSize;
    const buf = new Uint8Array(total);
    const dv = new DataView(buf.buffer);

    // BITMAPINFOHEADER
    dv.setUint32(0, dibHeaderSize, true);
    dv.setInt32(4, w, true);
    dv.setInt32(8, h * 2, true);   // height × 2 = XOR + AND masks
    dv.setUint16(12, 1, true);
    dv.setUint16(14, 32, true);
    dv.setUint32(16, 0, true);     // compression = none
    dv.setUint32(20, pixDataSize, true);

    // Pixel data — BGRA, bottom-up
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = (y * w + x) * 4;
        const dst = dibHeaderSize + ((h - 1 - y) * w + x) * 4;
        buf[dst]     = pixels[src + 2]; // B
        buf[dst + 1] = pixels[src + 1]; // G
        buf[dst + 2] = pixels[src];     // R
        buf[dst + 3] = pixels[src + 3]; // A
      }
    }

    // AND mask (1 bit per pixel — set where alpha=0)
    const andOffset = dibHeaderSize + pixDataSize;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] === 0) {
          buf[andOffset + (h - 1 - y) * andRowSize + Math.floor(x / 8)] |= 1 << (7 - (x % 8));
        }
      }
    }

    return buf;
  });

  const totalSize =
    headerSize +
    frames.length * dirEntrySize +
    imageBuffers.reduce((s, b) => s + b.byteLength, 0);

  const output = new Uint8Array(totalSize);
  const dv = new DataView(output.buffer);

  // ICONDIR header
  dv.setUint16(0, 0, true);               // reserved
  dv.setUint16(2, 1, true);               // type = ICO
  dv.setUint16(4, frames.length, true);   // count

  let dataOffset = headerSize + frames.length * dirEntrySize;

  for (let i = 0; i < frames.length; i++) {
    const { width: w, height: h } = frames[i];
    const entryOffset = headerSize + i * dirEntrySize;

    dv.setUint8(entryOffset,     w >= 256 ? 0 : w);
    dv.setUint8(entryOffset + 1, h >= 256 ? 0 : h);
    dv.setUint8(entryOffset + 2, 0);   // color count
    dv.setUint8(entryOffset + 3, 0);   // reserved
    dv.setUint16(entryOffset + 4, 1, true);   // planes
    dv.setUint16(entryOffset + 6, 32, true);  // bpp
    dv.setUint32(entryOffset + 8, imageBuffers[i].byteLength, true);
    dv.setUint32(entryOffset + 12, dataOffset, true);

    output.set(imageBuffers[i], dataOffset);
    dataOffset += imageBuffers[i].byteLength;
  }

  return output;
}
