import { ipcMain, IpcMainInvokeEvent, dialog, app, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { openFile, readPage, readLines, getLineCount } from './file-service'
import { buildLineIndex } from './line-indexer'
import { detectEncoding } from './encoding-service'
import { grepFile } from './search-service'
import { buildTimeline } from './timeline-service'
import { startTail, stopTail } from './tail-service'
import {
  getSettings,
  saveSettings,
  addRecentFile
} from './settings-service'
import type { GrepOptions, GrepMatch } from '../shared/types'

// Kept so window-level actions (reload, zoom, fullscreen, quit, open dialog)
// can target the live BrowserWindow from the in-renderer custom menu.
let mainWindowRef: BrowserWindow | null = null

export function registerIpcHandlers(mainWindow: BrowserWindow | null): void {
  mainWindowRef = mainWindow
  // ---- File operations ----
  ipcMain.handle(
    IPC_CHANNELS.OPEN_FILE,
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      const result = await openFile(filePath, (indexed, total) => {
        _event.sender.send(IPC_CHANNELS.INDEXING_PROGRESS, { filePath, indexed, total })
      })
      addRecentFile(filePath)
      return result
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.READ_PAGE,
    async (
      _event,
      data: { filePath: string; pageIndex: number; encoding: string; pageSize?: number }
    ) => {
      return await readPage(data.filePath, data.pageIndex, data.encoding, data.pageSize)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.READ_LINES,
    async (
      _event,
      data: { filePath: string; startLine: number; count: number; encoding: string }
    ) => {
      return await readLines(data.filePath, data.startLine, data.count, data.encoding)
    }
  )

  ipcMain.handle(IPC_CHANNELS.GET_LINE_COUNT, async (_event, filePath: string) => {
    return await getLineCount(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.DETECT_ENCODING, async (_event, filePath: string) => {
    return await detectEncoding(filePath)
  })

  // ---- Tail mode ----
  ipcMain.handle(IPC_CHANNELS.START_TAIL, async (event, data: { filePath: string; encoding: string }) => {
    return await startTail(event.sender, data.filePath, data.encoding)
  })

  ipcMain.handle(IPC_CHANNELS.STOP_TAIL, async (_event, filePath: string) => {
    return await stopTail(filePath)
  })

  // ---- Runtime memory ----
  // Sum the working-set size of every Electron process (main, renderer, GPU,
  // utility, etc.) so the status bar reflects total app memory usage.
  // NOTE: each metric's `memory` is a MemoryInfo object (workingSetSize etc.)
  // measured in KB — NOT a byte number. Multiply by 1024 to get bytes.
  ipcMain.handle(IPC_CHANNELS.GET_APP_MEMORY, async () => {
    const metrics = app.getAppMetrics()
    const kb = metrics.reduce((sum, m) => sum + (m.memory?.workingSetSize ?? 0), 0)
    return kb * 1024
  })

  // ---- Grep / Search ----
  ipcMain.handle(
    IPC_CHANNELS.GREP_FILE,
    async (
      _event,
      data: { filePath: string; pattern: string; encoding: string; options?: Partial<GrepOptions>; maxMatches?: number }
    ) => {
      return await grepFile({
        filePath: data.filePath,
        pattern: data.pattern,
        encoding: data.encoding,
        options: data.options,
        maxMatches: data.maxMatches
      })
    }
  )

  // ---- Export ----
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_RESULTS,
    async (
      event,
      data: { filePath: string; matches: GrepMatch[]; encoding?: string }
    ) => {
      const result = await dialog.showSaveDialog({
        title: 'Export search results',
        defaultPath: `${data.filePath}.search-results.txt`,
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      })
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      const content = data.matches
        .map((m) => `${m.lineNumber}: ${m.lineContent}`)
        .join('\n')
      await writeFile(result.filePath, content, 'utf8')
      return { success: true, outputPath: result.filePath }
    }
  )

  // ---- Timeline ----
  ipcMain.handle(
    IPC_CHANNELS.TIMELINE,
    async (
      _event,
      data: { filePath: string; encoding: string; buckets?: number }
    ) => {
      return await buildTimeline({
        filePath: data.filePath,
        encoding: data.encoding,
        buckets: data.buckets
      })
    }
  )

  // ---- Indexing progress (forwarded from main to renderer) ----
  ipcMain.on(
    IPC_CHANNELS.INDEXING_PROGRESS,
    (_event, data: { filePath: string; indexed: number; total?: number }) => {
      // Forwarded by sender.send inside openFile; nothing extra needed here.
    }
  )

  // ---- Settings ----
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, settings: any) => {
    return saveSettings(settings)
  })

  // ---- Open file dialog (used by the in-renderer custom menu) ----
  ipcMain.handle(IPC_CHANNELS.OPEN_DIALOG, async () => {
    const result = await dialog.showOpenDialog(mainWindowRef!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '日志文件', extensions: ['log', 'txt', 'out', 'err', 'gz'] },
        { name: '全部文件', extensions: ['*'] }
      ]
    })
    if (result.canceled) return []
    return result.filePaths
  })

  // ---- Forward in-renderer custom menu events back to the renderer ----
  // The HTML menu (MenuBar.tsx) emits these via ipcRenderer.send, but the
  // actual handlers (onMenuFind / onMenuGotoLine / onMenuToggleTheme / ...)
  // are registered in the renderer (AppLayout). Without echoing them back,
  // clicking those menu items does nothing — e.g. "切换主题" never fires.
  const MENU_EVENTS = ['menu:open-files', 'menu:find', 'menu:goto-line', 'menu:toggle-theme']
  MENU_EVENTS.forEach((evt) => {
    ipcMain.on(evt, () => {
      if (mainWindowRef) mainWindowRef.webContents.send(evt)
    })
  })

  // ---- Window-level actions driven by the custom menu / shortcuts ----
  ipcMain.handle(IPC_CHANNELS.WINDOW_ACTION, async (_event, action: string) => {
    const win = mainWindowRef
    if (!win) return
    const wc = win.webContents
    switch (action) {
      case 'reload':
        wc.reload()
        break
      case 'force-reload':
        wc.reloadIgnoringCache()
        break
      case 'toggle-devtools':
        if (wc.isDevToolsOpened()) wc.closeDevTools()
        else wc.openDevTools()
        break
      case 'reset-zoom':
        wc.setZoomLevel(0)
        break
      case 'zoom-in':
        wc.setZoomLevel(wc.getZoomLevel() + 1)
        break
      case 'zoom-out':
        wc.setZoomLevel(wc.getZoomLevel() - 1)
        break
      case 'toggle-fullscreen':
        win.setFullScreen(!win.isFullScreen())
        break
      case 'quit':
        app.quit()
        break
    }
  })
}
