export interface FileMetadata {
  filePath: string
  fileName: string
  fileSize: number
  encoding: string
  encodingConfidence: number
  totalLines: number
  lastModified: number
  isIndexingComplete: boolean
}

export interface PageData {
  lines: string[]
  startLine: number
  endLine: number
  pageIndex: number
  totalPages: number
}

export interface FileTab {
  id: string
  filePath: string
  fileName: string
  encoding: string
  totalLines: number
  currentPage: number
  isTailing: boolean
  isIndexingComplete: boolean
}

export interface GrepMatch {
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

export interface GrepOptions {
  pattern: string
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
}

export interface GrepResult {
  matches: GrepMatch[]
  totalCount: number
  pattern: string
  isPartial: boolean
}

export interface ColoringRule {
  id: string
  name: string
  regex: string
  bgColor: string
  fgColor: string
  scope: 'fullLine' | 'matchOnly'
  enabled: boolean
}

export interface Bookmark {
  id: string
  fileId: string
  lineNumber: number
  label: string
  createdAt: number
}

export interface TimelineEntry {
  lineNumber: number
  timestamp: Date
  rawMatch: string
}

export interface TimelineBucket {
  startMs: number
  endMs: number
  count: number
  sampleLineNumber: number
}

export interface TimelineResult {
  buckets: TimelineBucket[]
  minMs: number
  maxMs: number
  parsedLines: number
  totalLines: number
}

export interface AppSettings {
  pageSize: number
  theme: 'dark' | 'light'
  coloringRules: ColoringRule[]
  recentFiles: string[]
}
