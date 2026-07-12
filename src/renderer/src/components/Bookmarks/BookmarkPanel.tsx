import React from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import type { Tab } from '@renderer/stores/app-store'

export function BookmarkPanel({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const bookmarks = useAppStore((s) => s.bookmarks[tab.id] ?? [])
  const cursorLine = useAppStore((s) => s.cursorLines[tab.id])
  const goToLine = useAppStore((s) => s.goToLine)
  const toggleBookmark = useAppStore((s) => s.toggleBookmark)
  const removeBookmark = useAppStore((s) => s.removeBookmark)

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-input-row">
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>书签</span>
          <button
            className="button"
            onClick={() => toggleBookmark(tab.id)}
            title="在当前行添加书签 (Ctrl+F2)"
          >
            + 添加
          </button>
          <button className="button" onClick={onClose} title="关闭">
            ×
          </button>
        </div>
        <div className="search-summary">
          {bookmarks.length} 个书签
          {cursorLine ? ` · 光标在第 ${cursorLine.toLocaleString()} 行` : ''}
        </div>
      </div>

      <div className="search-results">
        {bookmarks.length === 0 && (
          <div className="hint" style={{ padding: 10, color: 'var(--text-muted)' }}>
            暂无书签。将光标置于某行后按 Ctrl+F2（或点“+ 添加”）。
          </div>
        )}
        {bookmarks.map((bm) => (
          <div
            key={bm.id}
            className="search-result"
            onClick={() => goToLine(tab.id, bm.lineNumber)}
          >
            <span className="line-no">{bm.lineNumber.toLocaleString()}</span>
            <span className="line-text">{tab.view.lines[bm.lineNumber - tab.view.startLine - 1] ?? ''}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                removeBookmark(tab.id, bm.id)
              }}
              title="移除"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
