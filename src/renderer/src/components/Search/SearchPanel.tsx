import React, { useState, useEffect } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import type { Tab } from '@renderer/stores/app-store'
import type { GrepOptions } from '@shared/types'
import type { SearchScope } from '@shared/search-matcher'

interface SearchPanelProps {
  tab: Tab
  onClose: () => void
}

export function SearchPanel({ tab, onClose }: SearchPanelProps) {
  const search = useAppStore((s) => s.search)
  const setSearchScope = useAppStore((s) => s.setSearchScope)
  const [query, setQuery] = useState(tab.search.query)
  const [options, setOptions] = useState<GrepOptions>(tab.search.options)

  // Keep local state in sync when switching tabs
  useEffect(() => {
    setQuery(tab.search.query)
    setOptions(tab.search.options)
  }, [tab.id])

  const submit = () => {
    search(tab.id, query, options)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit()
  }

  // Navigate between matches (wraps around at both ends).
  const goPrev = () => {
    const len = matches.length
    if (len === 0) return
    const next = activeIndex <= 0 ? len - 1 : activeIndex - 1
    useAppStore.getState().jumpToSearchResult(tab.id, next)
  }
  const goNext = () => {
    const len = matches.length
    if (len === 0) return
    const next = activeIndex >= len - 1 ? 0 : activeIndex + 1
    useAppStore.getState().jumpToSearchResult(tab.id, next)
  }

  const matches = tab.search.matches
  const activeIndex = tab.search.activeIndex

  const renderLine = (lineContent: string, matchStart?: number, matchEnd?: number) => {
    if (
      matchStart === undefined ||
      matchEnd === undefined ||
      matchStart < 0 ||
      matchEnd > lineContent.length
    ) {
      return <span className="line-text">{lineContent}</span>
    }
    return (
      <span className="line-text">
        {lineContent.slice(0, matchStart)}
        <mark>{lineContent.slice(matchStart, matchEnd)}</mark>
        {lineContent.slice(matchEnd)}
      </span>
    )
  }

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-input-row">
          <input
            autoFocus
            placeholder="在文件中搜索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="button" onClick={submit}>
            查找
          </button>
          <button className="button" onClick={onClose} title="关闭">
            ×
          </button>
        </div>
        <div className="search-options">
          <label className="search-scope">
            范围：
            <select
              value={tab.search.scope}
              onChange={(e) => setSearchScope(tab.id, e.target.value as SearchScope)}
            >
              <option value="page">当前页</option>
              <option value="file">整个文件</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.caseSensitive}
              onChange={(e) => setOptions({ ...options, caseSensitive: e.target.checked })}
            />
            区分大小写
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.wholeWord}
              onChange={(e) => setOptions({ ...options, wholeWord: e.target.checked })}
            />
            整词
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.regex}
              onChange={(e) => setOptions({ ...options, regex: e.target.checked })}
            />
            正则
          </label>
        </div>
      </div>

      {tab.search.isSearching && <div className="search-summary">搜索中…</div>}
      {tab.search.error && <div className="search-error">{tab.search.error}</div>}
      {!tab.search.isSearching && !tab.search.error && query && (
        <div className="search-summary">
          <span className="search-nav">
            <button className="button" onClick={goPrev} disabled={matches.length === 0} title="上一个匹配 (Shift+F3)">
              ↑ 上一个
            </button>
            <button className="button" onClick={goNext} disabled={matches.length === 0} title="下一个匹配 (F3)">
              ↓ 下一个
            </button>
          </span>
          <span className="search-count">
            {matches.length} 个匹配
            {tab.search.activeIndex >= 0 ? ` · #${tab.search.activeIndex + 1}` : ''}
          </span>
        </div>
      )}

      <div className="search-results">
        {matches.map((m, i) => {
          const activeMatch = i === activeIndex ? m : undefined
          return (
            <div
              key={`${m.lineNumber}-${i}`}
              className={`search-result${i === activeIndex ? ' active' : ''}`}
              onClick={() => useAppStore.getState().jumpToSearchResult(tab.id, i)}
            >
              <span className="line-no">{m.lineNumber}</span>
              {renderLine(m.lineContent, activeMatch?.matchStart, activeMatch?.matchEnd)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
