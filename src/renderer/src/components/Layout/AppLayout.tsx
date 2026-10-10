import React, { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
import { useT } from '@renderer/i18n'
import { MenuBar } from '../MenuBar/MenuBar'
import { TabBar } from '../TabBar/TabBar'
import { EditorToolbar } from '../Editor/EditorToolbar'
import { LogViewer } from '../Editor/LogViewer'
import { SearchPanel } from '../Search/SearchPanel'
import { FilterPanel } from '../Filter/FilterPanel'
import { GotoLineDialog } from '../Dialogs/GotoLineDialog'
import { ColoringRuleEditor } from '../ColoringRules/ColoringRuleEditor'
import { BookmarkPanel } from '../Bookmarks/BookmarkPanel'
import { TimelineView } from '../Timeline/TimelineView'
import { StatusBar } from './StatusBar'

type Panel = 'search' | 'filter' | 'coloring' | 'bookmarks' | 'timeline' | null

let listenersRegistered = false

export function AppLayout() {
  const activeTab = useAppStore((s) => (s.activeTabId ? s.tabs[s.activeTabId] : null))
  const init = useAppStore((s) => s.init)
  const openFiles = useAppStore((s) => s.openFiles)
  const prevPage = useAppStore((s) => s.prevPage)
  const nextPage = useAppStore((s) => s.nextPage)
  const toggleBookmark = useAppStore((s) => s.toggleBookmark)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const theme = useAppStore((s) => s.settings.theme)
  const t = useT()

  // Closing the search panel must release both the editor highlight and the
  // in-memory matches cache (up to 20000 full-line strings), otherwise they
  // linger after the panel is dismissed.
  const closeSearch = () => {
    if (activeTab) clearSearch(activeTab.id)
    setPanel(null)
  }

  // Apply theme class to <body> so the app chrome follows the light/dark setting.
  useEffect(() => {
    document.body.className = theme === 'light' ? 'theme-light' : 'theme-dark'
  }, [theme])

  const [panel, setPanel] = useState<Panel>(null)
  const [gotoOpen, setGotoOpen] = useState(false)

  // Register IPC listeners + load settings (once per renderer process)
  useEffect(() => {
    if (listenersRegistered) return
    listenersRegistered = true
    init()
    apiClient.onMenuOpenFiles((paths) => {
      openFiles(paths)
      apiClient.rebuildMenu()
    })
    apiClient.onMenuFind(() => setPanel('search'))
    apiClient.onMenuGotoLine(() => setGotoOpen(true))
    apiClient.onMenuToggleTheme(() => useAppStore.getState().toggleTheme())
    apiClient.onTailNewLines((data) => useAppStore.getState().handleTailNewLines(data))
    apiClient.onIndexingProgress((data) => useAppStore.getState().handleIndexingProgress(data))
  }, [init, openFiles])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      // Window-level shortcuts (previously provided by the native menu)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        ;(async () => {
          const paths = await apiClient.openDialog()
          if (paths && paths.length) openFiles(paths)
        })()
        return
      }
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault()
        apiClient.windowAction('reload')
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        apiClient.windowAction('force-reload')
        return
      }
      if (e.key === 'F12') {
        e.preventDefault()
        apiClient.windowAction('toggle-devtools')
        return
      }
      if (e.key === 'F11') {
        e.preventDefault()
        apiClient.windowAction('toggle-fullscreen')
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.key === ')')) {
        e.preventDefault()
        apiClient.windowAction('reset-zoom')
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        apiClient.windowAction('zoom-in')
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        apiClient.windowAction('zoom-out')
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setPanel('search')
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        setGotoOpen(true)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f2') {
        e.preventDefault()
        if (activeTab) toggleBookmark(activeTab.id)
        return
      }
      if (e.key === 'F3') {
        e.preventDefault()
        const t = useAppStore.getState().activeTabId
        const tabNow = t ? useAppStore.getState().tabs[t] : null
        if (tabNow && tabNow.search.matches.length > 0) {
          const len = tabNow.search.matches.length
          const cur = tabNow.search.activeIndex
          const next = e.shiftKey
            ? cur <= 0
              ? len - 1
              : cur - 1
            : cur >= len - 1
              ? 0
              : cur + 1
          useAppStore.getState().jumpToSearchResult(tabNow.id, next)
        }
        return
      }
      if (e.key === 'Escape') {
        if (panel === 'search' && activeTab) clearSearch(activeTab.id)
        setPanel(null)
        setGotoOpen(false)
        return
      }
      if (!typing && activeTab) {
        if (e.key === 'PageDown') {
          e.preventDefault()
          nextPage(activeTab.id)
        } else if (e.key === 'PageUp') {
          e.preventDefault()
          prevPage(activeTab.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab, nextPage, prevPage, toggleBookmark, openFiles])

  const openPanel = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p))

  return (
    <div className="app-layout">
      <MenuBar />
      <TabBar />

      {activeTab ? (
        <>
          <EditorToolbar
            tab={activeTab}
            onToggleSearch={() => openPanel('search')}
            onToggleFilter={() => openPanel('filter')}
            onOpenGoto={() => setGotoOpen(true)}
            isSearchOpen={panel === 'search'}
            onOpenColoring={() => openPanel('coloring')}
            onOpenBookmarks={() => openPanel('bookmarks')}
            onOpenTimeline={() => openPanel('timeline')}
            activePanel={panel}
          />
          <div className="editor-main">
            <div className="editor-container">
              {activeTab.view.isLoading ? (
                <div className="editor-placeholder">
                  <p>{t('app.loading')}</p>
                </div>
              ) : activeTab.view.error ? (
                <div className="editor-placeholder">
                  <p style={{ color: 'var(--danger-color)' }}>{activeTab.view.error}</p>
                </div>
              ) : (
                <LogViewer tab={activeTab} />
              )}
            </div>
            {panel === 'search' && (
              <SearchPanel tab={activeTab} onClose={closeSearch} />
            )}
            {panel === 'filter' && (
              <FilterPanel tab={activeTab} onClose={() => setPanel(null)} />
            )}
            {panel === 'bookmarks' && (
              <BookmarkPanel tab={activeTab} onClose={() => setPanel(null)} />
            )}
            {panel === 'timeline' && (
              <TimelineView tab={activeTab} onClose={() => setPanel(null)} />
            )}
          </div>
        </>
      ) : (
        <div className="editor-main">
          <div className="editor-container">
            <div className="editor-placeholder">
              <h1>LogView</h1>
              <p>{t('app.tagline')}</p>
              <p>{t('app.openHint')}</p>
            </div>
          </div>
        </div>
      )}

      <StatusBar tab={activeTab} />

      {gotoOpen && activeTab && (
        <GotoLineDialog tab={activeTab} onClose={() => setGotoOpen(false)} />
      )}
      {panel === 'coloring' && <ColoringRuleEditor onClose={() => setPanel(null)} />}
    </div>
  )
}
