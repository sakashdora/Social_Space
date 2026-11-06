/**
 * src/utils/mediaProcessor.js
 *
 * Dependency-free media checks that run inside the Worker:
 *   - sniffMediaType: identifies the real container from magic bytes (the client MIME type is never trusted)
 *   - stripImageMetadata: removes EXIF / XMP / comment segments from JPEG, PNG and WebP
 *   - readMp4Duration: reads the movie duration from an MP4 / MOV `mvhd` box
 *
 * Video transcoding and thumbnail extraction need ffmpeg and are not available
 * on Workers. Those uploads are stored as-is (see README, "Media limits").
 */

const ascii = (bytes, start, length) => String.fromCharCode(...bytes.subarray(start, start + length));

/**
 * @param {Uint8Array} bytes
 * @returns {{ kind: "IMAGE"|"VIDEO"|"AUDIO", ext: string, mime: string } | null}
 */
export function sniffMediaType(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "IMAGE", ext: ".jpg", mime: "image/jpeg" };
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return { kind: "IMAGE", ext: ".png", mime: "image/png" };
  if (ascii(bytes, 0, 3) === "GIF") return { kind: "IMAGE", ext: ".gif", mime: "image/gif" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return { kind: "IMAGE", ext: ".webp", mime: "image/webp" };
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "qt  ") return { kind: "VIDEO", ext: ".mov", mime: "video/quicktime" };
    if (brand === "M4A " || brand === "M4B ") return { kind: "AUDIO", ext: ".m4a", mime: "audio/mp4" };
    return { kind: "VIDEO", ext: ".mp4", mime: "video/mp4" };
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { kind: "VIDEO", ext: ".webm", mime: "video/webm" };
  if (ascii(bytes, 0, 4) === "OggS") return { kind: "AUDIO", ext: ".ogg", mime: "audio/ogg" };
  return null;
}

function stripJpeg(bytes) {
  const out = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xda) {
      // Start of scan: the entropy-coded data follows and is copied unchanged.
      out.push(bytes.subarray(offset));
      return Buffer.concat(out);
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return null;
    // Keep APP0 (JFIF) and APP14 (Adobe colour transform); drop EXIF/XMP/ICC-style APPn and comments.
    const keepApp = marker === 0xe0 || marker === 0xee;
    const isAppOrComment = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isAppOrComment || keepApp) out.push(bytes.subarray(offset, end));
    offset = end;
  }
  return null;
}

function stripPng(bytes) {
  const drop = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  const out = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    if (!drop.has(type)) out.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") return Buffer.concat(out);
  }
  return null;
}

function stripWebp(bytes) {
  const drop = new Set(["EXIF", "XMP "]);
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    const end = offset + 8 + size + (size % 2);
    if (end > bytes.length + 1) return null;
    if (!drop.has(type)) chunks.push(bytes.subarray(offset, Math.min(end, bytes.length)));
    offset = end;
  }
  const body = Buffer.concat([Buffer.from("WEBP"), ...chunks]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

/**
 * Returns a copy of the image without metadata segments, or null when the bytes
 * do not parse as the claimed format (the caller rejects the upload).
 * @param {Uint8Array} bytes
 * @param {string} mime
 * @returns {Buffer | null}
 */
export function stripImageMetadata(bytes, mime) {
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/jpeg") return stripJpeg(input);
  if (mime === "image/png") return stripPng(input);
  if (mime === "image/webp") return stripWebp(input);
  if (mime === "image/gif") return input; // GIF comment extensions are rare; kept as uploaded
  return null;
}

/**
 * Reads the movie duration from an MP4/MOV file by walking the box tree.
 * Returns null when the structure cannot be parsed (the upload is then rejected).
 * @param {Uint8Array} bytes
 * @returns {number | null} seconds
 */
export function readMp4Duration(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const findBox = (start, end, type) => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      const boxType = ascii(bytes, offset + 4, 4);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > end) return null;
        size = Number(view.getBigUint64(offset + 8));
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < header || offset + size > end) return null;
      if (boxType === type) return { start: offset + header, end: offset + size };
      offset += size;
    }
    return null;
  };

  const moov = findBox(0, bytes.length, "moov");
  if (!moov) return null;
  const mvhd = findBox(moov.start, moov.end, "mvhd");
  if (!mvhd) return null;
  const version = bytes[mvhd.start];
  let timescale;
  let duration;
  if (version === 1) {
    timescale = view.getUint32(mvhd.start + 4 + 16);
    duration = Number(view.getBigUint64(mvhd.start + 4 + 20));
  } else {
    timescale = view.getUint32(mvhd.start + 4 + 8);
    duration = view.getUint32(mvhd.start + 4 + 12);
  }
  if (!timescale || !Number.isFinite(duration)) return null;
  return duration / timescale;
}

/** Product limits: free accounts 60 s, premium 600 s. */
export function maxDurationSeconds(isPremium) {
  return isPremium ? 600 : 60;
}
