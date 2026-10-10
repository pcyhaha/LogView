import { create } from 'zustand'
import { apiClient } from '@renderer/services/api-client'
import { searchLines, type SearchScope } from '@shared/search-matcher'
import type {
  AppSettings,
  GrepOptions,
  GrepMatch,
  FileMetadata,
  Bookmark
} from '@shared/types'

export const SCROLL_TO_BOTTOM = -1

export interface TabView {
  lines: string[]
  startLine: number // 0-based file line of the first displayed line
  endLine: number
  totalPages: number
  currentPage: number
  isLoading: boolean
  error: string | null
}

export interface SearchState {
  query: string
  options: GrepOptions
  scope: SearchScope
  isSearching: boolean
  matches: GrepMatch[]
  activeIndex: number
  error: string | null
}

export interface Tab {
  id: string
  filePath: string
  fileName: string
  encoding: string
  encodingConfidence: number
  totalLines: number
  fileSize: number
  lastModified: number
  isIndexingComplete: boolean
  isTailing: boolean
  view: TabView
  search: SearchState
  pendingScrollLine: number | null
  pendingScrollToken: number
}

interface AppState {
  tabs: Record<string, Tab>
  tabOrder: string[]
  activeTabId: string | null
  settings: AppSettings
  isInitialized: boolean
  bookmarks: Record<string, Bookmark[]>
  cursorLines: Record<string, number>

  init: () => Promise<void>
  openFiles: (paths: string[]) => Promise<void>
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  goToPage: (id: string, pageIndex: number) => Promise<void>
  nextPage: (id: string) => Promise<void>
  prevPage: (id: string) => Promise<void>
  goToLine: (id: string, lineNumber: number) => Promise<void>
  setEncoding: (id: string, encoding: string) => Promise<void>
  toggleTail: (id: string) => Promise<void>
  search: (id: string, pattern: string, options?: Partial<GrepOptions>) => Promise<void>
  setSearchScope: (id: string, scope: SearchScope) => void
  clearSearch: (id: string) => void
  jumpToSearchResult: (id: string, index: number) => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setPageSize: (id: string, size: number) => Promise<void>
  toggleWordWrap: () => void
  setLanguage: (lang: 'zh' | 'en') => void

  setCursorLine: (id: string, line: number) => void
  toggleBookmark: (id: string, line?: number) => void
  removeBookmark: (id: string, bookmarkId: string) => void
  toggleTheme: () => void

  handleTailNewLines: (data: {
    filePath: string
    newLines: string[]
    startLineNumber: number
    totalLines: number
  }) => void
  handleIndexingProgress: (data: { filePath: string; indexed: number; total?: number }) => void
}

function genId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptySearch(): SearchState {
  return {
    query: '',
    options: { pattern: '', caseSensitive: false, wholeWord: false, regex: false },
    scope: 'page',
    isSearching: false,
    matches: [],
    activeIndex: -1,
    error: null
  }
}

function pageSize(settings: AppSettings): number {
  return settings.pageSize || 1000
}

// ---- Tail 批量刷新 ----
// 主进程每个文件变更 tick 都会推送新行；逐 tick 合并意味着整页数组复制
// + Monaco 全量重解析 + 滚动，高频写入时是持续的性能负担。这里按时间
// 窗口聚合后一次性刷新。
interface PendingTail {
  lines: string[]
  totalLines: number
  timer: ReturnType<typeof setTimeout> | null
}
const pendingTails = new Map<string, PendingTail>()
const TAIL_FLUSH_INTERVAL = 150

export const useAppStore = create<AppState>((set, get) => {
  const flushTail = (tabId: string): void => {
    const pending = pendingTails.get(tabId)
    if (!pending) return
    pendingTails.delete(tabId)

    const state = get()
    const current = state.tabs[tabId]
    if (!current || !current.isTailing) return
    const size = pageSize(state.settings)

    // 写入速率超过页面容量时只保留最新的一页
    let newLines = pending.lines
    if (newLines.length > size) {
      newLines = newLines.slice(newLines.length - size)
    }
    let lines = current.view.lines.concat(newLines)
    let startLine = current.view.startLine
    if (lines.length > size) {
      const overflow = lines.length - size
      lines = lines.slice(overflow)
      startLine = startLine + overflow
    }
    const totalLines = Math.max(current.totalLines, pending.totalLines)

    set((s) => ({
      tabs: {
        ...s.tabs,
        [tabId]: {
          ...s.tabs[tabId],
          totalLines,
          view: {
            ...s.tabs[tabId].view,
            lines,
            startLine,
            endLine: startLine + lines.length,
            totalPages: Math.max(1, Math.ceil(totalLines / size))
          },
          pendingScrollLine: SCROLL_TO_BOTTOM,
          pendingScrollToken: s.tabs[tabId].pendingScrollToken + 1
        }
      }
    }))
  }

  return {
  tabs: {},
  tabOrder: [],
  activeTabId: null,
  settings: { pageSize: 1000, theme: 'light', wordWrap: false, language: 'zh', coloringRules: [], recentFiles: [] },
  isInitialized: false,
  bookmarks: {},
  cursorLines: {},

  init: async () => {
    try {
      const settings = await apiClient.getSettings()
      // wordWrap/language 是后加的字段：旧持久化数据没有该 key，这里补默认值
      set({
        settings: {
          ...settings,
          wordWrap: settings.wordWrap ?? false,
          language: settings.language ?? 'zh'
        },
        isInitialized: true
      })
    } catch {
      set({ isInitialized: true })
    }
  },

  openFiles: async (paths) => {
    let state = get()
    const settings = state.settings
    const size = pageSize(settings)
    let activeId = state.activeTabId

    for (const filePath of paths) {
      const existing = Object.values(state.tabs).find((t) => t.filePath === filePath)
      if (existing) {
        activeId = existing.id
        continue
      }
      try {
        const { metadata, page } = await apiClient.openFile(filePath)
        const id = genId()
        const tab: Tab = {
          id,
          filePath: metadata.filePath,
          fileName: metadata.fileName,
          encoding: metadata.encoding,
          encodingConfidence: metadata.encodingConfidence,
          totalLines: metadata.totalLines,
          fileSize: metadata.fileSize,
          lastModified: metadata.lastModified,
          isIndexingComplete: metadata.isIndexingComplete,
          isTailing: false,
          view: {
            lines: page.lines,
            startLine: page.startLine,
            endLine: page.endLine,
            totalPages: Math.max(1, Math.ceil(metadata.totalLines / size)),
            currentPage: Math.floor(page.startLine / size),
            isLoading: false,
            error: null
          },
          search: emptySearch(),
          pendingScrollLine: null,
          pendingScrollToken: 0
        }
        set((s) => ({
          tabs: { ...s.tabs, [id]: tab },
          tabOrder: [...s.tabOrder, id],
          activeTabId: id
        }))
        activeId = id
        state = get()
      } catch (err) {
        console.error('Failed to open file', filePath, err)
      }
    }
    if (activeId) set({ activeTabId: activeId })
  },

  closeTab: (id) => {
    const state = get()
    const tab = state.tabs[id]
    if (tab?.isTailing) {
      apiClient.stopTail(tab.filePath).catch(() => {})
    }
    // 清掉未 flush 的 tail 缓冲，避免定时器在关 tab 后触发
    const pending = pendingTails.get(id)
    if (pending?.timer) clearTimeout(pending.timer)
    pendingTails.delete(id)
    // 释放主进程为该文件缓存的行索引与文件句柄，
    // 否则大文件索引（8 字节/行）在整个会话期间常驻内存
    if (tab) {
      apiClient.closeFile(tab.filePath).catch(() => {})
    }
    const order = state.tabOrder.filter((t) => t !== id)
    const tabs = { ...state.tabs }
    delete tabs[id]
    const bookmarks = { ...state.bookmarks }
    delete bookmarks[id]
    const cursorLines = { ...state.cursorLines }
    delete cursorLines[id]
    let activeTabId = state.activeTabId
    if (activeTabId === id) {
      activeTabId = order.length > 0 ? order[order.length - 1] : null
    }
    set({ tabs, tabOrder: order, activeTabId, bookmarks, cursorLines })
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  goToPage: async (id, pageIndex) => {
    const state = get()
    const tab = state.tabs[id]
    if (!tab) return
    const size = pageSize(state.settings)
    if (pageIndex < 0 || pageIndex >= tab.view.totalPages) return

    set((s) => ({
      tabs: {
        ...s.tabs,
        [id]: { ...s.tabs[id], view: { ...s.tabs[id].view, isLoading: true, error: null } }
      }
    }))

    try {
      const result = await apiClient.readPage({
        filePath: tab.filePath,
        pageIndex,
        encoding: tab.encoding,
        pageSize: size
      })
      set((s) => {
        const cur = s.tabs[id]
        // 当前页搜索的结果只对本页有效；翻页后失效，清空匹配列表（保留查询词/选项）。
        const clearPageMatches = cur.search.scope === 'page' && cur.search.matches.length > 0
        return {
          tabs: {
            ...s.tabs,
            [id]: {
              ...cur,
              view: {
                lines: result.lines,
                startLine: result.startLine,
                endLine: result.endLine,
                totalPages: result.totalPages,
                currentPage: pageIndex,
                isLoading: false,
                error: null
              },
              search: clearPageMatches
                ? { ...cur.search, matches: [], activeIndex: -1 }
                : cur.search,
              pendingScrollLine: null,
              pendingScrollToken: 0
            }
          }
        }
      })
    } catch (err) {
      set((s) => ({
        tabs: {
          ...s.tabs,
          [id]: {
            ...s.tabs[id],
            view: { ...s.tabs[id].view, isLoading: false, error: String(err) }
          }
        }
      }))
    }
  },

  nextPage: async (id) => {
    const tab = get().tabs[id]
    if (!tab) return
    await get().goToPage(id, tab.view.currentPage + 1)
  },

  prevPage: async (id) => {
    const tab = get().tabs[id]
    if (!tab) return
    await get().goToPage(id, tab.view.currentPage - 1)
  },

  goToLine: async (id, lineNumber) => {
    const state = get()
    const tab = state.tabs[id]
    if (!tab || lineNumber < 1 || lineNumber > tab.totalLines) return
    const size = pageSize(state.settings)
    const pageIndex = Math.floor((lineNumber - 1) / size)
    await get().goToPage(id, pageIndex)
    set((s) => ({
      tabs: {
        ...s.tabs,
        [id]: {
          ...s.tabs[id],
          pendingScrollLine: lineNumber,
          pendingScrollToken: s.tabs[id].pendingScrollToken + 1
        }
      }
    }))
  },

  setEncoding: async (id, encoding) => {
    const state = get()
    const tab = state.tabs[id]
    if (!tab) return
    set((s) => ({
      tabs: { ...s.tabs, [id]: { ...s.tabs[id], encoding } }
    }))
    await get().goToPage(id, tab.view.currentPage)
  },

  toggleTail: async (id) => {
    const state = get()
    const tab = state.tabs[id]
    if (!tab) return
    const size = pageSize(state.settings)

    if (!tab.isTailing) {
      try {
        await apiClient.startTail({ filePath: tab.filePath, encoding: tab.encoding })
      } catch {
        /* ignore */
      }
      // Seed the view with the tail of the file
      const start = Math.max(0, tab.totalLines - size)
      try {
        const result = await apiClient.readLines({
          filePath: tab.filePath,
          startLine: start,
          count: size,
          encoding: tab.encoding
        })
        set((s) => ({
          tabs: {
            ...s.tabs,
            [id]: {
              ...s.tabs[id],
              isTailing: true,
              view: {
                ...s.tabs[id].view,
                lines: result.lines,
                startLine: result.startLine,
                endLine: result.startLine + result.lines.length,
                isLoading: false,
                error: null
              },
              pendingScrollLine: SCROLL_TO_BOTTOM
            }
          }
        }))
      } catch {
        set((s) => ({
          tabs: { ...s.tabs, [id]: { ...s.tabs[id], isTailing: true } }
        }))
      }
    } else {
      try {
        await apiClient.stopTail(tab.filePath)
      } catch {
        /* ignore */
      }
      set((s) => ({
        tabs: { ...s.tabs, [id]: { ...s.tabs[id], isTailing: false } }
      }))
      // Reload current page to restore paged view
      await get().goToPage(id, tab.view.currentPage)
    }
  },

  search: async (id, pattern, options) => {
    const state = get()
    const tab = state.tabs[id]
    if (!tab) return
    const opts: GrepOptions = {
      pattern,
      caseSensitive: options?.caseSensitive ?? tab.search.options.caseSensitive,
      wholeWord: options?.wholeWord ?? tab.search.options.wholeWord,
      regex: options?.regex ?? tab.search.options.regex
    }
    const scope = tab.search.scope

    set((s) => ({
      tabs: {
        ...s.tabs,
        [id]: {
          ...s.tabs[id],
          search: { query: pattern, options: opts, scope, isSearching: true, matches: [], activeIndex: -1, error: null }
        }
      }
    }))

    if (!pattern) {
      set((s) => ({
        tabs: {
          ...s.tabs,
          [id]: {
            ...s.tabs[id],
            search: { ...s.tabs[id].search, isSearching: false, matches: [], activeIndex: -1 }
          }
        }
      }))
      return
    }

    // 当前页：直接对已在内存中的 tab.view.lines 做匹配，零文件 IO，毫秒级。
    if (scope === 'page') {
      const matches = searchLines(tab.view.lines, tab.view.startLine, opts)
      set((s) => ({
        tabs: {
          ...s.tabs,
          [id]: {
            ...s.tabs[id],
            search: {
              query: pattern,
              options: opts,
              scope,
              isSearching: false,
              matches,
              activeIndex: matches.length > 0 ? 0 : -1,
              error: null
            }
          }
        }
      }))
      if (matches.length > 0) {
        await get().jumpToSearchResult(id, 0)
      }
      return
    }

    // 整个文件：交给主进程流式扫描（大文件较慢，按需使用）。
    try {
      const result = await apiClient.grepFile({
        filePath: tab.filePath,
        pattern,
        encoding: tab.encoding,
        options: opts,
        maxMatches: 50000
      })
      set((s) => ({
        tabs: {
          ...s.tabs,
          [id]: {
            ...s.tabs[id],
            search: {
              query: pattern,
              options: opts,
              scope,
              isSearching: false,
              matches: result.matches,
              activeIndex: result.matches.length > 0 ? 0 : -1,
              error: null
            }
          }
        }
      }))
      if (result.matches.length > 0) {
        await get().jumpToSearchResult(id, 0)
      }
    } catch (err) {
      set((s) => ({
        tabs: {
          ...s.tabs,
          [id]: {
            ...s.tabs[id],
            search: { ...s.tabs[id].search, isSearching: false, error: String(err) }
          }
        }
      }))
    }
  },

  setSearchScope: (id, scope) => {
    const tab = get().tabs[id]
    if (!tab) return
    const prev = tab.search.scope
    set((s) => ({
      tabs: {
        ...s.tabs,
        [id]: { ...s.tabs[id], search: { ...s.tabs[id].search, scope } }
      }
    }))
    // 切换范围后，若已有查询词则立即按新范围重搜。
    if (prev !== scope && tab.search.query) {
      get().search(id, tab.search.query, tab.search.options)
    }
  },

  clearSearch: (id) => {
    set((s) => ({
      tabs: {
        ...s.tabs,
        [id]: { ...s.tabs[id], search: emptySearch(), pendingScrollLine: null }
      }
    }))
  },

  jumpToSearchResult: async (id, index) => {
    const tab = get().tabs[id]
    if (!tab || index < 0 || index >= tab.search.matches.length) return
    const match = tab.search.matches[index]
    set((s) => ({
      tabs: {
        ...s.tabs,
        [id]: {
          ...s.tabs[id],
          search: { ...s.tabs[id].search, activeIndex: index },
          pendingScrollLine: match.lineNumber,
          pendingScrollToken: s.tabs[id].pendingScrollToken + 1
        }
      }
    }))
    if (match.lineNumber < tab.view.startLine + 1 || match.lineNumber > tab.view.endLine) {
      await get().goToLine(id, match.lineNumber)
    }
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    try {
      await apiClient.saveSettings(next)
    } catch {
      /* ignore */
    }
  },

  setPageSize: async (id, size) => {
    const clamped = Math.max(500, Math.min(2000, Math.floor(size || 0)))
    if (clamped < 500) return
    const tab = get().tabs[id]
    if (!tab) return
    // Persist the new page size (also updates the in-memory settings used by
    // pageSize() so subsequent reads pick it up immediately).
    await get().updateSettings({ pageSize: clamped })

    // Keep the current first visible line in view: recompute the page index
    // against the new size, and refresh totalPages so goToPage's range guard
    // (which still holds the OLD totalPages) doesn't reject the new index.
    const firstLine = tab.view.startLine + 1
    const newTotalPages = Math.max(1, Math.ceil(tab.totalLines / clamped))
    const newPage = Math.min(Math.floor((firstLine - 1) / clamped), newTotalPages - 1)
    set((s) => ({
      tabs: {
        ...s.tabs,
        [id]: { ...s.tabs[id], view: { ...s.tabs[id].view, totalPages: newTotalPages } }
      }
    }))
    await get().goToPage(id, newPage)
  },

  setCursorLine: (id, line) => {
    if (get().cursorLines[id] === line) return
    set((s) => ({ cursorLines: { ...s.cursorLines, [id]: line } }))
  },

  toggleBookmark: (id, line) => {
    const target = line ?? get().cursorLines[id]
    if (!target) return
    const existing = get().bookmarks[id] ?? []
    const found = existing.find((b) => b.lineNumber === target)
    if (found) {
      set((s) => ({
        bookmarks: {
          ...s.bookmarks,
          [id]: (s.bookmarks[id] ?? []).filter((b) => b.id !== found.id)
        }
      }))
      return
    }
    const bookmark: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fileId: id,
      lineNumber: target,
      label: '',
      createdAt: Date.now()
    }
    set((s) => ({
      bookmarks: {
        ...s.bookmarks,
        [id]: [...(s.bookmarks[id] ?? []), bookmark].sort((a, b) => a.lineNumber - b.lineNumber)
      }
    }))
  },

  removeBookmark: (id, bookmarkId) => {
    set((s) => ({
      bookmarks: {
        ...s.bookmarks,
        [id]: (s.bookmarks[id] ?? []).filter((b) => b.id !== bookmarkId)
      }
    }))
  },

  toggleTheme: () => {
    const current = get().settings.theme
    const next = current === 'dark' ? 'light' : 'dark'
    get().updateSettings({ theme: next })
  },

  toggleWordWrap: () => {
    const next = !(get().settings.wordWrap ?? false)
    get().updateSettings({ wordWrap: next })
  },

  setLanguage: (lang) => {
    get().updateSettings({ language: lang })
  },

  handleTailNewLines: (data) => {
    const state = get()
    const tab = Object.values(state.tabs).find((t) => t.filePath === data.filePath)
    if (!tab || !tab.isTailing) return

    // 先攒入缓冲，由 flushTail 按时间窗口批量合并进视图
    const pending = pendingTails.get(tab.id) ?? { lines: [], totalLines: 0, timer: null }
    pendingTails.set(tab.id, pending)
    for (const line of data.newLines) {
      pending.lines.push(line)
    }
    pending.totalLines = Math.max(pending.totalLines, data.totalLines)
    if (pending.timer === null) {
      const tabId = tab.id
      pending.timer = setTimeout(() => {
        flushTail(tabId)
      }, TAIL_FLUSH_INTERVAL)
    }
  },

  handleIndexingProgress: (data) => {
    const state = get()
    const tab = Object.values(state.tabs).find((t) => t.filePath === data.filePath)
    if (!tab) return
    const size = pageSize(state.settings)
    if (data.indexed <= tab.totalLines && tab.isIndexingComplete) return
    const isComplete = data.total !== undefined && data.indexed >= data.total
    set((s) => {
      const current = s.tabs[tab.id]
      const totalLines = Math.max(current.totalLines, data.indexed)
      return {
        tabs: {
          ...s.tabs,
          [tab.id]: {
            ...current,
            totalLines,
            isIndexingComplete: isComplete,
            view: {
              ...current.view,
              totalPages: Math.max(1, Math.ceil(totalLines / size))
            }
          }
        }
      }
    })
  }
  }
})
