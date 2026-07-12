import { open } from 'fs/promises'
import jschardet from 'jschardet'
import iconv from 'iconv-lite'

// Map jschardet detection names -> iconv-lite compatible encoding names
const ENCODING_MAP: Record<string, string> = {
  ascii: 'utf8',
  utf8: 'utf8',
  utf16le: 'utf16le',
  utf16be: 'utf16be',
  windows1252: 'win1252',
  windows1251: 'win1251',
  windows1250: 'win1250',
  gbk: 'gbk',
  gb2312: 'gb2312',
  gbk2312: 'gbk',
  big5: 'big5',
  eucjp: 'euc-jp',
  euckr: 'euc-kr',
  shiftjis: 'shift_jis'
}

export function normalizeEncoding(encoding: string): string {
  const lower = (encoding || 'utf8').toLowerCase().trim()
  if (lower in ENCODING_MAP) return ENCODING_MAP[lower]
  if (iconv.encodingExists(lower)) return lower
  return 'utf8'
}

export async function detectEncoding(filePath: string): Promise<{ encoding: string; confidence: number }> {
  const fileHandle = await open(filePath, 'r')
  const buffer = Buffer.alloc(65536) // 64KB for detection
  const { bytesRead } = await fileHandle.read(buffer, 0, 65536)
  await fileHandle.close()

  const sample = buffer.subarray(0, bytesRead)

  // Check for BOM first (most reliable)
  if (bytesRead >= 3 && sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) {
    return { encoding: 'utf8', confidence: 1.0 }
  }
  if (bytesRead >= 2 && sample[0] === 0xfe && sample[1] === 0xff) {
    return { encoding: 'utf16be', confidence: 1.0 }
  }
  if (bytesRead >= 2 && sample[0] === 0xff && sample[1] === 0xfe) {
    return { encoding: 'utf16le', confidence: 1.0 }
  }

  const detected = jschardet.detect(sample)
  let encoding = detected.encoding?.toLowerCase() || 'utf8'
  const confidence = detected.confidence || 0

  if (encoding in ENCODING_MAP) {
    encoding = ENCODING_MAP[encoding]
  }

  // Low confidence: try heuristics for common CJK encodings
  if (confidence < 0.7) {
    if (hasGbkContent(sample)) {
      return { encoding: 'gbk', confidence: 0.8 }
    }
    if (encoding === 'ascii') {
      encoding = 'utf8'
    }
  }

  return { encoding, confidence }
}

// Decode a complete buffer (byte range aligned to line boundaries) into a string
export function decodeBuffer(buffer: Buffer, encoding: string): string {
  const enc = normalizeEncoding(encoding)
  let buf = buffer
  // Strip UTF-8 BOM if present
  if (enc === 'utf8' && buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.subarray(3)
  }
  if (iconv.encodingExists(enc)) {
    return iconv.decode(buf, enc)
  }
  return buf.toString('utf8')
}

// Create a stateful streaming decoder that correctly handles multi-byte
// characters split across chunk boundaries.
export function createDecoder(encoding: string): { write(chunk: Buffer): string; end(): string } {
  const enc = normalizeEncoding(encoding)
  const decoder = iconv.getDecoder(iconv.encodingExists(enc) ? enc : 'utf8')
  return {
    write: (chunk: Buffer) => decoder.write(chunk),
    end: () => decoder.end() ?? ''
  }
}

function hasGbkContent(buffer: Buffer): boolean {
  for (let i = 0; i < buffer.length - 1; i++) {
    const byte1 = buffer[i]
    const byte2 = buffer[i + 1]
    if (
      (byte1 >= 0x81 && byte1 <= 0xfe && byte2 >= 0x40 && byte2 <= 0xfe && byte2 !== 0x7f) ||
      (byte1 >= 0x81 && byte1 <= 0xa0 && byte2 >= 0x40 && byte2 <= 0xa0)
    ) {
      return true
    }
  }
  return false
}
