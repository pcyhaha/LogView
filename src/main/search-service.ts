import { createReadStream } from 'fs'
import { createDecoder } from './encoding-service'
import { buildMatcher, buildTestMatcher, collectMatches } from '../shared/search-matcher'
import type { GrepMatch, GrepOptions, FilterLine, FilterResult, FilterMode } from '../shared/types'

interface GrepParams {
  filePath: string
  pattern: string
  encoding: string
  options?: Partial<GrepOptions>
  maxMatches?: number
}

interface GrepResult {
  matches: GrepMatch[]
  totalCount: number
}

export async function grepFile(params: GrepParams): Promise<GrepResult> {
  const { filePath, pattern, encoding } = params
  const opts: GrepOptions = {
    pattern,
    caseSensitive: params.options?.caseSensitive ?? false,
    wholeWord: params.options?.wholeWord ?? false,
    regex: params.options?.regex ?? false
  }
  const maxMatches = params.maxMatches ?? 20000

  if (!pattern) return { matches: [], totalCount: 0 }

  const matcher = buildMatcher(opts)

  const decoder = createDecoder(encoding)
  const matches: GrepMatch[] = []
  let lineNumber = 0
  let lineBuffer = ''
  let sawContent = false

  await new Promise<void>((resolve, reject) => {
    // 1MB 块比 8MB 块的单次同步处理时间短，事件循环（IPC/窗口事件）
    // 能在块之间得到更频繁的调度机会。
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 })
    stream.on('data', (chunk) => {
      sawContent = true
      const text = decoder.write(chunk as Buffer)
      let start = 0
      let idx: number
      while ((idx = text.indexOf('\n', start)) !== -1) {
        let line = lineBuffer + text.slice(start, idx)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        lineNumber++
        collectMatches(line, lineNumber, matcher, matches, maxMatches)
        lineBuffer = ''
        start = idx + 1
        if (matches.length >= maxMatches) {
          // destroy() 只触发 'close' 不触发 'end'，必须在此处 resolve，
          // 否则达到上限时整个搜索会永久挂起。
          stream.destroy()
          resolve()
          return
        }
      }
      lineBuffer += text.slice(start)
    })
    stream.on('end', () => {
      const tail = decoder.end()
      lineBuffer += tail
      if (lineBuffer.length > 0 || sawContent) {
        let line = lineBuffer
        if (line.endsWith('\r')) line = line.slice(0, -1)
        lineNumber++
        collectMatches(line, lineNumber, matcher, matches, maxMatches)
      }
      resolve()
    })
    stream.on('error', reject)
  })

  return { matches, totalCount: matches.length }
}

interface FilterParams {
  filePath: string
  pattern: string
  encoding: string
  mode: FilterMode
  options?: Partial<GrepOptions>
  maxLines?: number
}

// View-level filter: scan the whole file and return the lines that DO match
// (`include`) or do NOT match (`exclude`) the pattern. Unlike grep, this keeps
// the full line content (not just match spans) so the result can be rendered
// as a standalone filtered view. Streamed with a decoder for multi-byte safety.
export async function filterFile(params: FilterParams): Promise<FilterResult> {
  const { filePath, pattern, encoding } = params
  const opts: GrepOptions = {
    pattern,
    caseSensitive: params.options?.caseSensitive ?? false,
    wholeWord: params.options?.wholeWord ?? false,
    regex: params.options?.regex ?? false
  }
  const maxLines = params.maxLines ?? 100000

  if (!pattern) return { lines: [], totalCount: 0, truncated: false }

  // 过滤只需要"是否命中"，用首命中即返回的测试器，不为布尔值收集全部匹配
  const matcher = buildTestMatcher(opts)
  const decoder = createDecoder(encoding)
  const lines: FilterLine[] = []
  let truncated = false
  let lineNumber = 0
  let lineBuffer = ''
  let sawContent = false

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 })
    stream.on('data', (chunk) => {
      sawContent = true
      const text = decoder.write(chunk as Buffer)
      let start = 0
      let idx: number
      while ((idx = text.indexOf('\n', start)) !== -1) {
        let line = lineBuffer + text.slice(start, idx)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        lineNumber++
        const matched = matcher(line)
        if (params.mode === 'exclude' ? !matched : matched) {
          if (lines.length >= maxLines) {
            truncated = true
            // destroy() 只触发 'close' 不触发 'end'，必须在此处 resolve，
            // 否则达到上限时整个过滤会永久挂起。
            stream.destroy()
            resolve()
            return
          }
          lines.push({ lineNumber, content: line })
        }
        lineBuffer = ''
        start = idx + 1
      }
      lineBuffer += text.slice(start)
    })
    stream.on('end', () => {
      const tail = decoder.end()
      lineBuffer += tail
      if (lineBuffer.length > 0 || sawContent) {
        let line = lineBuffer
        if (line.endsWith('\r')) line = line.slice(0, -1)
        lineNumber++
        const matched = matcher(line)
        if (params.mode === 'exclude' ? !matched : matched) {
          if (lines.length >= maxLines) {
            truncated = true
          } else {
            lines.push({ lineNumber, content: line })
          }
        }
      }
      resolve()
    })
    stream.on('error', reject)
  })

  return { lines, totalCount: lines.length, truncated }
}
