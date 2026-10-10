import type { AppSettings, GrepOptions, GrepMatch, TimelineResult, FilterResult } from '../shared/types'

export interface Api {
  openFile: (
    filePath: string
  ) => Promise<{
    metadata: {
      filePath: string
      fileName: string
      fileSize: number
      encoding: string
      encodingConfidence: number
      totalLines: number
      lastModified: number
      isIndexingComplete: boolean
    }
    page: {
      lines: string[]
      startLine: number
      endLine: number
    }
  }>

  readPage: (data: {
    filePath: string
    pageIndex: number
    encoding: string
    pageSize?: number
  }) => Promise<{
    lines: string[]
    startLine: number
    endLine: number
    totalPages: number
  }>

  readLines: (data: {
    filePath: string
    startLine: number
    count: number
    encoding: string
  }) => Promise<{
    lines: string[]
    startLine: number
    count: number
  }>

  getLineCount: (filePath: string) => Promise<number>
  detectEncoding: (filePath: string) => Promise<{ encoding: string; confidence: number }>
  closeFile: (filePath: string) => Promise<{ success: boolean }>

  startTail: (data: { filePath: string; encoding: string }) => Promise<{ success: boolean }>
  stopTail: (filePath: string) => Promise<{ success: boolean }>

  grepFile: (data: {
    filePath: string
    pattern: string
    encoding: string
    options?: Partial<GrepOptions>
    maxMatches?: number
  }) => Promise<{
    matches: GrepMatch[]
    totalCount: number
  }>

  filterFile: (data: {
    filePath: string
    pattern: string
    encoding: string
    mode: 'include' | 'exclude'
    options?: Partial<GrepOptions>
    maxLines?: number
  }) => Promise<FilterResult>

  exportResults: (data: {
    filePath: string
    matches: GrepMatch[]
  }) => Promise<{ success: boolean; canceled?: boolean; outputPath?: string }>

  buildTimeline: (data: {
    filePath: string
    encoding: string
    buckets?: number
  }) => Promise<TimelineResult>

  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>

  getAppMemory: () => Promise<number>

  // Custom (in-renderer) menu support
  openDialog: () => Promise<string[]>
  windowAction: (action: string) => Promise<void>
  sendMenuEvent: (event: string) => void

  onMenuOpenFiles: (callback: (filePaths: string[]) => void) => void
  onMenuFind: (callback: () => void) => void
  onMenuGotoLine: (callback: () => void) => void
  onMenuToggleTheme: (callback: () => void) => void
  rebuildMenu: () => void

  onTailNewLines: (
    callback: (data: {
      filePath: string
      newLines: string[]
      startLineNumber: number
      totalLines: number
    }) => void
  ) => void
  onTailFileReset: (callback: (data: { filePath: string }) => void) => void

  onIndexingProgress: (
    callback: (data: { filePath: string; indexed: number; total?: number }) => void
  ) => void
}

declare global {
  interface Window {
    api: Api
  }
}
