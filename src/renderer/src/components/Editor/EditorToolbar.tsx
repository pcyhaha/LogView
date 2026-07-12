import React, { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
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
  onOpenGoto: () => void
  isSearchOpen: boolean
  onOpenColoring: () => void
  onOpenBookmarks: () => void
  onOpenTimeline: () => void
  activePanel: 'search' | 'coloring' | 'bookmarks' | 'timeline' | null
}

export function EditorToolbar({
  tab,
  onToggleSearch,
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
  const pageSizeSetting = useAppStore((s) => s.settings.pageSize)
  const bookmarkCount = useAppStore((s) => (s.bookmarks[tab.id] ?? []).length)

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
      window.alert('没有可导出的搜索结果，请先执行搜索。')
      return
    }
    const res = await apiClient.exportResults({
      filePath: tab.filePath,
      matches: tab.search.matches
    })
    if (res.success) {
      window.alert(`已导出 ${tab.search.matches.length} 条匹配到 ${res.outputPath}`)
    } else if (!res.canceled) {
      window.alert('导出失败。')
    }
  }

  return (
    <div className="toolbar">
      <button onClick={() => prevPage(tab.id)} disabled={!canPrev} title="上一页 (PgUp)">
        ◀ 上一页
      </button>
      <button onClick={() => nextPage(tab.id)} disabled={!canNext} title="下一页 (PgDn)">
        下一页 ▶
      </button>
      <span className="page-info">
        第 {view.currentPage + 1} / {view.totalPages} 页 · 行 {view.startLine + 1}-
        {displayEnd} / {tab.totalLines.toLocaleString()}
      </span>
      <label className="page-size" title="每页显示行数 (500-2000)">
        每页
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
        行
      </label>

      <div className="spacer" />

      <label title="文件编码">
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
        title="实时追踪文件 (tail -f)"
      >
        {tab.isTailing ? '● 追踪中' : '追踪'}
      </button>

      <button className={isSearchOpen ? 'active' : ''} onClick={onToggleSearch} title="搜索 (Ctrl+F)">
        搜索
      </button>
      <button
        className={activePanel === 'coloring' ? 'active' : ''}
        onClick={onOpenColoring}
        title="着色规则"
      >
        高亮
      </button>
      <button
        className={activePanel === 'bookmarks' ? 'active' : ''}
        onClick={onOpenBookmarks}
        title="书签 (Ctrl+F2)"
      >
        书签{bookmarkCount > 0 ? ` (${bookmarkCount})` : ''}
      </button>
      <button
        className={activePanel === 'timeline' ? 'active' : ''}
        onClick={onOpenTimeline}
        title="时间线"
      >
        时间线
      </button>
      <button onClick={onOpenGoto} title="跳转行 (Ctrl+G)">
        跳转行
      </button>
      <button onClick={handleExport} title="导出搜索结果">
        导出
      </button>
    </div>
  )
}
