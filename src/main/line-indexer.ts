import { createReadStream } from 'fs'
import { stat } from 'fs/promises'

// Threshold for the early (progressive) resolve that lets the first page show
// quickly while indexing continues in the background. It is NOT a limit on how
// many line offsets we record — every line's offset must be stored, otherwise
// getLineOffset falls back to fileSize for lines past this count and readPage
// would allocate a huge buffer (freeze).
const INITIAL_INDEX_LINES = 100000
const INITIAL_OFFSET_CAPACITY = 1 << 16

interface LineIndex {
  filePath: string
  offsets: Float64Array
  totalLines: number
  fileSize: number
  isComplete: boolean
}

const indexCache = new Map<string, LineIndex>()

// 可增长的行偏移数组。
// 之前用普通 JS 数组收集、结束时逐行 BigInt() 转成 BigUint64Array：
// - BigInt 逐行分配很慢，亿级行时是最大热点；
// - 转换期间新旧两份数据并存，内存峰值翻倍。
// 文件偏移 < 2^53，Float64Array 存 Number 精度完全足够，且容量倍增摊还。
class OffsetBuilder {
  private arr = new Float64Array(INITIAL_OFFSET_CAPACITY)
  private len = 0

  push(value: number): void {
    if (this.len === this.arr.length) {
      const next = new Float64Array(this.arr.length * 2)
      next.set(this.arr)
      this.arr = next
    }
    this.arr[this.len++] = value
  }

  get length(): number {
    return this.len
  }

  // 当前已记录部分的视图（共享底层内存，不复制）
  snapshot(): Float64Array {
    return this.arr.subarray(0, this.len)
  }
}

export async function buildLineIndex(
  filePath: string,
  onProgress?: (indexed: number, total?: number) => void
): Promise<LineIndex> {
  const cached = indexCache.get(filePath)
  if (cached) return cached

  const fileStat = await stat(filePath)
  const fileSize = fileStat.size

  // First pass: count lines and record absolute byte offsets (start of each
  // line). Offsets MUST be absolute file positions, otherwise readPage reads
  // the wrong byte range and only a few lines show.
  const offsets = new OffsetBuilder()
  offsets.push(0)
  let lineCount = 0
  let buf = Buffer.alloc(0)
  let absolutePos = 0 // absolute file byte offset of buf[0]

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 })

    let resolved = false
    let initialResolved = false

    stream.on('data', (chunk) => {
      const data = chunk as Buffer
      buf = Buffer.concat([buf, data])
      // buf[0] still corresponds to absolutePos after concat

      while (true) {
        const nlPos = buf.indexOf(10) // \n
        if (nlPos === -1) break

        lineCount++
        const absoluteOffset = absolutePos + nlPos + 1 // start of next line

        // Record EVERY line's offset (see note above the threshold).
        offsets.push(absoluteOffset)

        // Skip past the newline; the remaining view starts at absoluteOffset
        buf = buf.subarray(nlPos + 1)
        absolutePos = absoluteOffset
      }

      if (!initialResolved && lineCount >= INITIAL_INDEX_LINES) {
        initialResolved = true
        const index = createIndex(filePath, offsets.snapshot(), lineCount, fileSize, false)
        indexCache.set(filePath, index)
        onProgress?.(lineCount, undefined)
        resolve(index)
        resolved = true
      }

      if (lineCount % 500000 === 0) {
        onProgress?.(lineCount, undefined)
      }
    })

    stream.on('end', () => {
      // Handle last line without trailing newline
      if (buf.length > 0) {
        lineCount++
      }

      const index = createIndex(filePath, offsets.snapshot(), lineCount, fileSize, true)
      indexCache.set(filePath, index)
      // Signal completion: pass the final total as `total` so the renderer
      // can mark indexing as finished.
      onProgress?.(lineCount, lineCount)

      if (!resolved) {
        resolve(index)
      }
    })

    stream.on('error', reject)
  })
}

function createIndex(
  filePath: string,
  offsets: Float64Array,
  totalLines: number,
  fileSize: number,
  isComplete: boolean
): LineIndex {
  return { filePath, offsets, totalLines, fileSize, isComplete }
}

export function getLineIndex(filePath: string): LineIndex | undefined {
  return indexCache.get(filePath)
}

export function getLineOffset(filePath: string, lineNumber: number): number | undefined {
  const index = indexCache.get(filePath)
  if (!index) return undefined
  // lineNumber is 0-based (0 => first line start).
  if (lineNumber < 0) return undefined
  // Reading up to / past the last line maps to the end of the file.
  if (lineNumber >= index.totalLines) return index.fileSize
  if (lineNumber >= index.offsets.length) return index.fileSize
  return index.offsets[lineNumber]
}

export function invalidateIndex(filePath: string): void {
  indexCache.delete(filePath)
}
