import React, { useState, useEffect } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { useT } from '@renderer/i18n'
import type { Tab } from '@renderer/stores/app-store'
import type { GrepOptions } from '@shared/types'
import type { SearchScope } from '@shared/search-matcher'
import { VirtualList } from '../Common/VirtualList'

interface SearchPanelProps {
  tab: Tab
  onClose: () => void
}

const ROW_HEIGHT = 28

export function SearchPanel({ tab, onClose }: SearchPanelProps) {
  const search = useAppStore((s) => s.search)
  const setSearchScope = useAppStore((s) => s.setSearchScope)
  const t = useT()
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
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="button" onClick={submit}>
            {t('search.find')}
          </button>
          <button className="button" onClick={onClose} title={t('common.close')}>
            ×
          </button>
        </div>
        <div className="search-options">
          <label className="search-scope">
            {t('search.scope')}
            <select
              value={tab.search.scope}
              onChange={(e) => setSearchScope(tab.id, e.target.value as SearchScope)}
            >
              <option value="page">{t('search.scopePage')}</option>
              <option value="file">{t('search.scopeFile')}</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.caseSensitive}
              onChange={(e) => setOptions({ ...options, caseSensitive: e.target.checked })}
            />
            {t('search.caseSensitive')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.wholeWord}
              onChange={(e) => setOptions({ ...options, wholeWord: e.target.checked })}
            />
            {t('search.wholeWord')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.regex}
              onChange={(e) => setOptions({ ...options, regex: e.target.checked })}
            />
            {t('search.regex')}
          </label>
        </div>
      </div>

      {tab.search.isSearching && <div className="search-summary">{t('search.searching')}</div>}
      {tab.search.error && <div className="search-error">{tab.search.error}</div>}
      {!tab.search.isSearching && !tab.search.error && query && (
        <div className="search-summary">
          <span className="search-nav">
            <button className="button" onClick={goPrev} disabled={matches.length === 0} title={t('tooltip.prevMatch')}>
              {t('search.prev')}
            </button>
            <button className="button" onClick={goNext} disabled={matches.length === 0} title={t('tooltip.nextMatch')}>
              {t('search.next')}
            </button>
          </span>
          <span className="search-count">
            {t('search.matchCount', { count: matches.length })}
            {tab.search.activeIndex >= 0 ? ` · #${tab.search.activeIndex + 1}` : ''}
          </span>
        </div>
      )}

      <VirtualList
        items={matches}
        itemHeight={ROW_HEIGHT}
        getKey={(m, i) => `${m.lineNumber}-${i}`}
        renderItem={(m, i) => {
          const activeMatch = i === activeIndex ? m : undefined
          return (
            <div
              className={`search-result${i === activeIndex ? ' active' : ''}`}
              onClick={() => useAppStore.getState().jumpToSearchResult(tab.id, i)}
            >
              <span className="line-no">{m.lineNumber}</span>
              {renderLine(m.lineContent, activeMatch?.matchStart, activeMatch?.matchEnd)}
            </div>
          )
        }}
        className="search-results"
      />
    </div>
  )
}
