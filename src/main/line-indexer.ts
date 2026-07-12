import { createReadStream } from 'fs'
import { stat } from 'fs/promises'

const INITIAL_INDEX_LINES = 100000

interface LineIndex {
  filePath: string
  offsets: BigUint64Array
  totalLines: number
  fileSize: number
  isComplete: boolean
}

const indexCache = new Map<string, LineIndex>()

export async function buildLineIndex(
  filePath: string,
  onProgress?: (indexed: number, total?: number) => void
): Promise<LineIndex> {
  const cached = indexCache.get(filePath)
  if (cached) return cached

  const fileStat = await stat(filePath)
  const fileSize = fileStat.size

  // First pass: count lines and record absolute byte offsets (start of each
  // line) up to INITIAL_INDEX_LINES. Offsets MUST be absolute file positions,
  // otherwise readPage reads the wrong byte range and only a few lines show.
  const initialOffsets: number[] = [0]
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

        if (lineCount <= INITIAL_INDEX_LINES) {
          initialOffsets.push(absoluteOffset)
        }

        // Skip past the newline; the remaining view starts at absoluteOffset
        buf = buf.subarray(nlPos + 1)
        absolutePos = absoluteOffset
      }

      if (!initialResolved && lineCount >= INITIAL_INDEX_LINES) {
        initialResolved = true
        const index = createIndex(filePath, initialOffsets, lineCount, fileSize, false)
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

      const offsets = initialOffsets
      const index = createIndex(filePath, offsets, lineCount, fileSize, true)
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
  offsets: number[],
  totalLines: number,
  fileSize: number,
  isComplete: boolean
): LineIndex {
  const arr = new BigUint64Array(offsets.length)
  for (let i = 0; i < offsets.length; i++) {
    arr[i] = BigInt(offsets[i])
  }
  return { filePath, offsets: arr, totalLines, fileSize, isComplete }
}

export function getLineIndex(filePath: string): LineIndex | undefined {
  return indexCache.get(filePath)
}

export function getLineOffset(filePath: string, lineNumber: number): bigint | undefined {
  const index = indexCache.get(filePath)
  if (!index) return undefined
  // lineNumber is 0-based (0 => first line start).
  if (lineNumber < 0) return undefined
  // Reading up to / past the last line maps to the end of the file.
  if (lineNumber >= index.totalLines) return BigInt(index.fileSize)
  if (lineNumber >= index.offsets.length) return BigInt(index.fileSize)
  return index.offsets[lineNumber]
}

export function invalidateIndex(filePath: string): void {
  indexCache.delete(filePath)
}

export function appendOffsets(filePath: string, newOffsets: number[]): void {
  const index = indexCache.get(filePath)
  if (!index) return

  const oldLen = index.offsets.length
  const newArr = new BigUint64Array(oldLen + newOffsets.length)
  newArr.set(index.offsets)
  for (let i = 0; i < newOffsets.length; i++) {
    newArr[oldLen + i] = BigInt(newOffsets[i])
  }
  index.offsets = newArr
  index.totalLines += newOffsets.length
}
