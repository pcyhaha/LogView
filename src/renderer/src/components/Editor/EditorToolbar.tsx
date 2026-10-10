import React, { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
import { useT } from '@renderer/i18n'
import type { Tab } from '@renderer/stores/app-store'

const ENCODINGS = [
  'utf8',
  'gbk',
  'gb2312',
  'big5',
  'shift_jis',
  'euc-jp',
  'euc-kr',
  'win1252',
  'utf16le',
  'utf16be'
]

interface EditorToolbarProps {
  tab: Tab
  onToggleSearch: () => void
  onToggleFilter: () => void
  onOpenGoto: () => void
  isSearchOpen: boolean
  onOpenColoring: () => void
  onOpenBookmarks: () => void
  onOpenTimeline: () => void
  activePanel: 'search' | 'filter' | 'coloring' | 'bookmarks' | 'timeline' | null
}

export function EditorToolbar({
  tab,
  onToggleSearch,
  onToggleFilter,
  onOpenGoto,
  isSearchOpen,
  onOpenColoring,
  onOpenBookmarks,
  onOpenTimeline,
  activePanel
}: EditorToolbarProps) {
  const goToPage = useAppStore((s) => s.goToPage)
  const prevPage = useAppStore((s) => s.prevPage)
  const nextPage = useAppStore((s) => s.nextPage)
  const setEncoding = useAppStore((s) => s.setEncoding)
  const toggleTail = useAppStore((s) => s.toggleTail)
  const setPageSize = useAppStore((s) => s.setPageSize)
  const toggleWordWrap = useAppStore((s) => s.toggleWordWrap)
  const pageSizeSetting = useAppStore((s) => s.settings.pageSize)
  const wordWrap = useAppStore((s) => s.settings.wordWrap ?? false)
  const bookmarkCount = useAppStore((s) => (s.bookmarks[tab.id] ?? []).length)
  const t = useT()

  const view = tab.view
  const canPrev = view.currentPage > 0
  const canNext = view.currentPage < view.totalPages - 1
  const displayEnd = Math.min(view.endLine, tab.totalLines)

  // Local mirror of the page-size input so we only commit (and reload) on
  // blur / Enter, avoiding a reload on every keystroke.
  const [sizeInput, setSizeInput] = useState(String(pageSizeSetting))
  useEffect(() => {
    setSizeInput(String(pageSizeSetting))
  }, [pageSizeSetting])

  const commitSize = () => {
    const v = Number(sizeInput)
    if (Number.isNaN(v)) {
      setSizeInput(String(pageSizeSetting))
      return
    }
    const clamped = Math.max(500, Math.min(2000, Math.floor(v)))
    setSizeInput(String(clamped))
    if (clamped !== pageSizeSetting) setPageSize(tab.id, clamped)
  }

  const handleExport = async () => {
    if (tab.search.matches.length === 0) {
      window.alert(t('toolbar.exportNoResults'))
      return
    }
    const res = await apiClient.exportResults({
      filePath: tab.filePath,
      matches: tab.search.matches
    })
    if (res.success) {
      window.alert(t('toolbar.exported', { count: tab.search.matches.length, path: res.outputPath }))
    } else if (!res.canceled) {
      window.alert(t('toolbar.exportFailed'))
    }
  }

  return (
    <div className="toolbar">
      <button onClick={() => prevPage(tab.id)} disabled={!canPrev} title={t('tooltip.prevPage')}>
        {t('toolbar.prevPage')}
      </button>
      <button onClick={() => nextPage(tab.id)} disabled={!canNext} title={t('tooltip.nextPage')}>
        {t('toolbar.nextPage')}
      </button>
      <span className="page-info">
        {t('toolbar.pageInfo', {
          page: view.currentPage + 1,
          totalPages: view.totalPages,
          start: view.startLine + 1,
          end: displayEnd,
          totalLines: tab.totalLines.toLocaleString()
        })}
      </span>
      <label className="page-size" title={t('tooltip.pageSize')}>
        {t('toolbar.perPage')}
        <input
          type="number"
          min={500}
          max={2000}
          step={100}
          value={sizeInput}
          onChange={(e) => setSizeInput(e.target.value)}
          onBlur={commitSize}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {t('toolbar.linesUnit')}
      </label>
      <button
        className={wordWrap ? 'active' : ''}
        onClick={toggleWordWrap}
        title={t('tooltip.wordWrap')}
      >
        {t('toolbar.wordWrap')}
      </button>

      <div className="spacer" />

      <label title={t('tooltip.encoding')}>
        <select
          value={tab.encoding}
          onChange={(e) => setEncoding(tab.id, e.target.value)}
          style={{ maxWidth: 120 }}
        >
          {ENCODINGS.map((enc) => (
            <option key={enc} value={enc}>
              {enc}
            </option>
          ))}
          {!ENCODINGS.includes(tab.encoding) && (
            <option value={tab.encoding}>{tab.encoding}</option>
          )}
        </select>
      </label>

      <button
        className={tab.isTailing ? 'active' : ''}
        onClick={() => toggleTail(tab.id)}
        title={t('tooltip.tail')}
      >
        {tab.isTailing ? t('toolbar.tailing') : t('toolbar.tail')}
      </button>

      <button className={isSearchOpen ? 'active' : ''} onClick={onToggleSearch} title={t('tooltip.search')}>
        {t('toolbar.search')}
      </button>
      <button
        className={activePanel === 'filter' ? 'active' : ''}
        onClick={onToggleFilter}
        title={t('tooltip.filter')}
      >
        {t('toolbar.filter')}
      </button>
      <button
        className={activePanel === 'coloring' ? 'active' : ''}
        onClick={onOpenColoring}
        title={t('tooltip.highlight')}
      >
        {t('toolbar.highlight')}
      </button>
      <button
        className={activePanel === 'bookmarks' ? 'active' : ''}
        onClick={onOpenBookmarks}
        title={t('tooltip.bookmarks')}
      >
        {t('toolbar.bookmarks')}{bookmarkCount > 0 ? ` (${bookmarkCount})` : ''}
      </button>
      <button
        className={activePanel === 'timeline' ? 'active' : ''}
        onClick={onOpenTimeline}
        title={t('tooltip.timeline')}
      >
        {t('toolbar.timeline')}
      </button>
      <button onClick={onOpenGoto} title={t('tooltip.gotoLine')}>
        {t('toolbar.gotoLine')}
      </button>
      <button onClick={handleExport} title={t('tooltip.export')}>
        {t('toolbar.export')}
      </button>
    </div>
  )
}
