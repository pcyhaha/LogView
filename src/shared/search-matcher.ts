import type { GrepOptions, GrepMatch } from './types'

export type SearchScope = 'page' | 'file'

// Pure, dependency-free matching helpers shared by the main process
// (full-file grep) and the renderer (current-page in-memory search).

export function buildMatcher(
  opts: GrepOptions
): (text: string) => Array<{ start: number; end: number }> {
  let regex: RegExp
  if (opts.regex) {
    try {
      regex = new RegExp(opts.pattern, opts.caseSensitive ? 'g' : 'gi')
    } catch {
      // Invalid regex: fall back to literal
      return literalMatcher(opts.pattern, opts.caseSensitive, opts.wholeWord)
    }
  } else {
    return literalMatcher(opts.pattern, opts.caseSensitive, opts.wholeWord)
  }

  return (text: string) => {
    const result: Array<{ start: number; end: number }> = []
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex++
        continue
      }
      result.push({ start: m.index, end: m.index + m[0].length })
      if (!regex.global) break
    }
    return result
  }
}

export function literalMatcher(
  pattern: string,
  caseSensitive: boolean,
  wholeWord: boolean
): (text: string) => Array<{ start: number; end: number }> {
  const needle = caseSensitive ? pattern : pattern.toLowerCase()
  const flags = caseSensitive ? 'g' : 'gi'
  let regex: RegExp | null = null
  if (wholeWord) {
    const escaped = escapeRegExp(pattern)
    regex = new RegExp(`\\b${escaped}\\b`, flags)
  }

  return (text: string) => {
    const result: Array<{ start: number; end: number }> = []
    if (regex) {
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      const searchText = caseSensitive ? text : text // regex flags already handle case
      while ((m = regex.exec(searchText)) !== null) {
        result.push({ start: m.index, end: m.index + m[0].length })
        if (!regex.global) break
      }
      return result
    }
    const haystack = caseSensitive ? text : text.toLowerCase()
    let from = 0
    let idx: number
    while ((idx = haystack.indexOf(needle, from)) !== -1) {
      result.push({ start: idx, end: idx + needle.length })
      from = idx + needle.length
    }
    return result
  }
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function collectMatches(
  line: string,
  lineNumber: number,
  matcher: (text: string) => Array<{ start: number; end: number }>,
  matches: GrepMatch[],
  maxMatches: number
): void {
  const hits = matcher(line)
  for (const hit of hits) {
    if (matches.length >= maxMatches) return
    matches.push({
      lineNumber,
      lineContent: line,
      matchStart: hit.start,
      matchEnd: hit.end
    })
  }
}

// Search an already-loaded array of lines in memory (current-page search).
// `startLine` is the 0-based file line number of lines[0].
export function searchLines(
  lines: string[],
  startLine: number,
  opts: GrepOptions,
  maxMatches = 100000
): GrepMatch[] {
  const matcher = buildMatcher(opts)
  const matches: GrepMatch[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = startLine + i + 1
    collectMatches(line, lineNumber, matcher, matches, maxMatches)
    if (matches.length >= maxMatches) break
  }
  return matches
}
