import { createReadStream } from 'fs'
import { createDecoder } from './encoding-service'
import { buildMatcher, collectMatches } from '../shared/search-matcher'
import type { GrepMatch, GrepOptions } from '../shared/types'

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
        collectMatches(line, lineNumber, matcher, matches, maxMatches)
        lineBuffer = ''
        start = idx + 1
        if (matches.length >= maxMatches) {
          stream.destroy()
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
