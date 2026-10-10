import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { Api } from './api'

const api: Api = {
  openFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE, filePath),
  readPage: (data) => ipcRenderer.invoke(IPC_CHANNELS.READ_PAGE, data),
  readLines: (data) => ipcRenderer.invoke(IPC_CHANNELS.READ_LINES, data),
  getLineCount: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_LINE_COUNT, filePath),
  detectEncoding: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.DETECT_ENCODING, filePath),
  closeFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_FILE, filePath),

  startTail: (data: { filePath: string; encoding: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.START_TAIL, data),
  stopTail: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.STOP_TAIL, filePath),

  grepFile: (data) => ipcRenderer.invoke(IPC_CHANNELS.GREP_FILE, data),
  filterFile: (data) => ipcRenderer.invoke(IPC_CHANNELS.FILTER_FILE, data),
  exportResults: (data) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_RESULTS, data),
  buildTimeline: (data) => ipcRenderer.invoke(IPC_CHANNELS.TIMELINE, data),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  getAppMemory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_MEMORY),

  // Custom (in-renderer) menu support
  openDialog: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIALOG),
  windowAction: (action: string) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_ACTION, action),
  sendMenuEvent: (event: string) => ipcRenderer.send(event),

  // Menu events are pushed from the main process to the renderer.
  onMenuOpenFiles: (callback: (filePaths: string[]) => void) => {
    ipcRenderer.on('menu:open-files', (_event: IpcRendererEvent, filePaths: string[]) =>
      callback(filePaths)
    )
  },
  onMenuFind: (callback: () => void) => {
    ipcRenderer.on('menu:find', () => callback())
  },
  onMenuGotoLine: (callback: () => void) => {
    ipcRenderer.on('menu:goto-line', () => callback())
  },
  onMenuToggleTheme: (callback: () => void) => {
    ipcRenderer.on('menu:toggle-theme', () => callback())
  },
  rebuildMenu: () => {
    ipcRenderer.send('app:rebuild-menu')
  },

  onTailNewLines: (callback: (data: {
    filePath: string
    newLines: string[]
    startLineNumber: number
    totalLines: number
  }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.TAIL_NEW_LINES, (_event, data) => callback(data))
  },
  onTailFileReset: (callback: (data: { filePath: string }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.TAIL_FILE_RESET, (_event, data) => callback(data))
  },

  onIndexingProgress: (callback: (data: {
    filePath: string
    indexed: number
    total?: number
  }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.INDEXING_PROGRESS, (_event, data) => callback(data))
  }
}

contextBridge.exposeInMainWorld('api', api)
