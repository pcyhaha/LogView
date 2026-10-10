import React from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { useT } from '@renderer/i18n'
import type { Tab } from '@renderer/stores/app-store'

export function BookmarkPanel({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const bookmarks = useAppStore((s) => s.bookmarks[tab.id] ?? [])
  const cursorLine = useAppStore((s) => s.cursorLines[tab.id])
  const goToLine = useAppStore((s) => s.goToLine)
  const toggleBookmark = useAppStore((s) => s.toggleBookmark)
  const removeBookmark = useAppStore((s) => s.removeBookmark)
  const t = useT()

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-input-row">
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('bookmarks.title')}</span>
          <button
            className="button"
            onClick={() => toggleBookmark(tab.id)}
            title={t('tooltip.addBookmark')}
          >
            {t('bookmarks.add')}
          </button>
          <button className="button" onClick={onClose} title={t('common.close')}>
            ×
          </button>
        </div>
        <div className="search-summary">
          {t('bookmarks.count', { count: bookmarks.length })}
          {cursorLine ? ` · ${t('bookmarks.cursorAt', { line: cursorLine.toLocaleString() })}` : ''}
        </div>
      </div>

      <div className="search-results">
        {bookmarks.length === 0 && (
          <div className="hint" style={{ padding: 10, color: 'var(--text-muted)' }}>
            {t('bookmarks.empty')}
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
              title={t('tooltip.removeBookmark')}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
