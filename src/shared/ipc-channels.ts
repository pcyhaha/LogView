export const IPC_CHANNELS = {
  // File operations
  OPEN_FILE: 'open-file',
  READ_PAGE: 'read-page',
  READ_LINES: 'read-lines',
  GET_LINE_COUNT: 'get-line-count',
  DETECT_ENCODING: 'detect-encoding',
  SET_ENCODING: 'set-encoding',

  // Tail mode
  START_TAIL: 'start-tail',
  STOP_TAIL: 'stop-tail',
  TAIL_NEW_LINES: 'tail:new-lines',
  TAIL_FILE_RESET: 'tail:file-reset',

  // Search
  GREP_FILE: 'grep-file',

  // Export
  EXPORT_RESULTS: 'export-results',

  // Timeline
  TIMELINE: 'timeline',

  // Indexing
  INDEXING_PROGRESS: 'indexing:progress',

  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',

  // Runtime memory (sum of all Electron processes)
  GET_APP_MEMORY: 'get-app-memory',

  // Custom (in-renderer) menu support
  OPEN_DIALOG: 'open-dialog',
  WINDOW_ACTION: 'window-action'
} as const

export const PAGE_SIZE = 1000
export const PREFETCH_THRESHOLD = 200
export const PAGE_CACHE_SIZE = 5
