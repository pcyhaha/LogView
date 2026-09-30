import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { AppSettings, GrepOptions, GrepMatch, FileMetadata, TimelineResult, FilterResult } from '@shared/types'

// Thin typed wrapper around the preload-exposed window.api.
const w = window as unknown as { api: any }

export const apiClient = {
  openFile: (filePath: string): Promise<{ metadata: FileMetadata; page: { lines: string[]; startLine: number; endLine: number } }> =>
    w.api.openFile(filePath),

  readPage: (data: { filePath: string; pageIndex: number; encoding: string; pageSize?: number }) =>
    w.api.readPage(data),

  readLines: (data: { filePath: string; startLine: number; count: number; encoding: string }) =>
    w.api.readLines(data),

  getLineCount: (filePath: string) => w.api.getLineCount(filePath),

  detectEncoding: (filePath: string) => w.api.detectEncoding(filePath),

  startTail: (data: { filePath: string; encoding: string }) => w.api.startTail(data),

  stopTail: (filePath: string) => w.api.stopTail(filePath),

  grepFile: (data: {
    filePath: string
    pattern: string
    encoding: string
    options?: Partial<GrepOptions>
    maxMatches?: number
  }): Promise<{ matches: GrepMatch[]; totalCount: number }> => w.api.grepFile(data),

  filterFile: (data: {
    filePath: string
    pattern: string
    encoding: string
    mode: 'include' | 'exclude'
    options?: Partial<GrepOptions>
    maxLines?: number
  }): Promise<FilterResult> => w.api.filterFile(data),

  exportResults: (data: { filePath: string; matches: GrepMatch[] }) => w.api.exportResults(data),

  buildTimeline: (data: { filePath: string; encoding: string; buckets?: number }): Promise<TimelineResult> =>
    w.api.buildTimeline(data),

  getSettings: (): Promise<AppSettings> => w.api.getSettings(),

  saveSettings: (settings: AppSettings) => w.api.saveSettings(settings),

  getAppMemory: (): Promise<number> => w.api.getAppMemory(),

  openDialog: (): Promise<string[]> => w.api.openDialog(),
  windowAction: (action: string): Promise<void> => w.api.windowAction(action),
  sendMenuEvent: (event: string): void => w.api.sendMenuEvent(event),

  onMenuOpenFiles: (cb: (filePaths: string[]) => void) => w.api.onMenuOpenFiles(cb),
  onMenuFind: (cb: () => void) => w.api.onMenuFind(cb),
  onMenuGotoLine: (cb: () => void) => w.api.onMenuGotoLine(cb),
  onMenuToggleTheme: (cb: () => void) => w.api.onMenuToggleTheme(cb),
  rebuildMenu: () => w.api.rebuildMenu(),
  onTailNewLines: (
    cb: (data: { filePath: string; newLines: string[]; startLineNumber: number; totalLines: number }) => void
  ) => w.api.onTailNewLines(cb),
  onTailFileReset: (cb: (data: { filePath: string }) => void) => w.api.onTailFileReset(cb),
  onIndexingProgress: (
    cb: (data: { filePath: string; indexed: number; total?: number }) => void
  ) => w.api.onIndexingProgress(cb)
}

export { IPC_CHANNELS }
