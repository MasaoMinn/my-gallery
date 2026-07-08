export type ImageDimensions = {
  width: number;
  height: number;
};

const textDecoder = new TextDecoder("ascii");

export function readImageDimensions(input: ArrayBuffer): ImageDimensions | null {
  if (input.byteLength < 10) {
    return null;
  }

  const view = new DataView(input);

  if (isPng(view)) {
    return {
      width: view.getUint32(16),
      height: view.getUint32(20)
    };
  }

  if (isGif(view)) {
    return {
      width: view.getUint16(6, true),
      height: view.getUint16(8, true)
    };
  }

  if (isJpeg(view)) {
    return readJpegDimensions(view);
  }

  if (isWebp(view)) {
    return readWebpDimensions(view);
  }

  return null;
}

function isPng(view: DataView): boolean {
  return (
    view.byteLength >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a &&
    readAscii(view, 12, 4) === "IHDR"
  );
}

function isGif(view: DataView): boolean {
  return view.byteLength >= 10 && ["GIF87a", "GIF89a"].includes(readAscii(view, 0, 6));
}

function isJpeg(view: DataView): boolean {
  return view.byteLength > 4 && view.getUint16(0) === 0xffd8;
}

function isWebp(view: DataView): boolean {
  return (
    view.byteLength >= 16 &&
    readAscii(view, 0, 4) === "RIFF" &&
    readAscii(view, 8, 4) === "WEBP"
  );
}

function readJpegDimensions(view: DataView): ImageDimensions | null {
  let offset = 2;

  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    let marker = view.getUint8(offset + 1);
    while (marker === 0xff && offset + 2 < view.byteLength) {
      offset += 1;
      marker = view.getUint8(offset + 1);
    }

    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }

    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > view.byteLength) {
      return null;
    }

    if (isStartOfFrame(marker)) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
}

function isStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readWebpDimensions(view: DataView): ImageDimensions | null {
  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const chunkType = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;

    if (dataOffset + chunkSize > view.byteLength) {
      return null;
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: 1 + readUint24(view, dataOffset + 4),
        height: 1 + readUint24(view, dataOffset + 7)
      };
    }

    if (chunkType === "VP8L" && chunkSize >= 5 && view.getUint8(dataOffset) === 0x2f) {
      const b1 = view.getUint8(dataOffset + 1);
      const b2 = view.getUint8(dataOffset + 2);
      const b3 = view.getUint8(dataOffset + 3);
      const b4 = view.getUint8(dataOffset + 4);

      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      };
    }

    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      view.getUint8(dataOffset + 3) === 0x9d &&
      view.getUint8(dataOffset + 4) === 0x01 &&
      view.getUint8(dataOffset + 5) === 0x2a
    ) {
      return {
        width: view.getUint16(dataOffset + 6, true) & 0x3fff,
        height: view.getUint16(dataOffset + 8, true) & 0x3fff
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

function readUint24(view: DataView, offset: number): number {
  return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
}

function readAscii(view: DataView, offset: number, length: number): string {
  return textDecoder.decode(new Uint8Array(view.buffer, view.byteOffset + offset, length));
}
