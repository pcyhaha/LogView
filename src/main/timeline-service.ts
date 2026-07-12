import { createReadStream } from 'fs'
import { createDecoder } from './encoding-service'
import type { TimelineResult, TimelineBucket } from '../shared/types'

interface TimelineParams {
  filePath: string
  encoding: string
  buckets?: number
  maxLines?: number
}

const TS_PATTERNS: RegExp[] = [
  // 2024-07-10T18:20:01.123Z / 2024-07-10 18:20:01+08:00
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?/,
  // 2024/07/10 18:20:01.123
  /\d{4}\/\d{2}\/\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?/,
  // 10/Jul/2024:18:20:01
  /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/
]

function extractTimestamp(line: string): number | null {
  const trimmed = line.trimStart()
  for (const pattern of TS_PATTERNS) {
    const m = trimmed.match(pattern)
    if (m) {
      const ms = Date.parse(m[0])
      if (!isNaN(ms)) return ms
    }
  }
  return null
}

export async function buildTimeline(params: TimelineParams): Promise<TimelineResult> {
  const { filePath, encoding } = params
  const bucketCount = params.buckets ?? 80
  const maxLines = params.maxLines ?? 5_000_000

  const decoder = createDecoder(encoding)
  const times: Array<{ ms: number; line: number }> = []

  let lineNumber = 0
  let lineBuffer = ''
  let sawContent = false

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: 8 * 1024 * 1024 })
    stream.on('data', (chunk) => {
      sawContent = true
      const text = decoder.write(chunk as Buffer)
      let start = 0
      let idx: number
      while ((idx = text.indexOf('\n', start)) !== -1) {
        let line = lineBuffer + text.slice(start, idx)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        lineNumber++
        const ms = extractTimestamp(line)
        if (ms !== null) times.push({ ms, line: lineNumber })
        lineBuffer = ''
        start = idx + 1
        if (lineNumber >= maxLines) {
          stream.destroy()
          break
        }
      }
      lineBuffer += text.slice(start)
    })
    stream.on('end', () => {
      const tail = decoder.end()
      lineBuffer += tail
      if (lineBuffer.length > 0 || sawContent) {
        lineNumber++
        const ms = extractTimestamp(lineBuffer)
        if (ms !== null) times.push({ ms, line: lineNumber })
      }
      resolve()
    })
    stream.on('error', reject)
  })

  const totalLines = lineNumber
  if (times.length < 2) {
    return { buckets: [], minMs: 0, maxMs: 0, parsedLines: times.length, totalLines }
  }

  times.sort((a, b) => a.ms - b.ms)
  const minMs = times[0].ms
  const maxMs = times[times.length - 1].ms
  const span = maxMs - minMs
  if (span <= 0) {
    return {
      buckets: [
        { startMs: minMs, endMs: maxMs, count: times.length, sampleLineNumber: times[0].line }
      ],
      minMs,
      maxMs,
      parsedLines: times.length,
      totalLines
    }
  }

  const buckets: TimelineBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    startMs: minMs + (span * i) / bucketCount,
    endMs: minMs + (span * (i + 1)) / bucketCount,
    count: 0,
    sampleLineNumber: -1
  }))

  for (const t of times) {
    let idx = Math.floor(((t.ms - minMs) / span) * bucketCount)
    if (idx < 0) idx = 0
    if (idx >= bucketCount) idx = bucketCount - 1
    buckets[idx].count++
    if (buckets[idx].sampleLineNumber === -1) buckets[idx].sampleLineNumber = t.line
  }

  // Propagate a representative line number backward so every bucket has one
  let lastLine = -1
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].sampleLineNumber !== -1) lastLine = buckets[i].sampleLineNumber
    else buckets[i].sampleLineNumber = lastLine
  }

  return { buckets, minMs, maxMs, parsedLines: times.length, totalLines }
}
