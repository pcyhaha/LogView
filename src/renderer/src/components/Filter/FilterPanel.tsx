import React, { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
import { useT } from '@renderer/i18n'
import type { Tab } from '@renderer/stores/app-store'
import type { GrepOptions, FilterLine, FilterMode } from '@shared/types'
import { VirtualList } from '../Common/VirtualList'

interface FilterPanelProps {
  tab: Tab
  onClose: () => void
}

const ROW_HEIGHT = 26

export function FilterPanel({ tab, onClose }: FilterPanelProps) {
  const goToLine = useAppStore((s) => s.goToLine)
  const t = useT()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<FilterMode>('include')
  const [options, setOptions] = useState<GrepOptions>({
    pattern: '',
    caseSensitive: false,
    wholeWord: false,
    regex: false
  })
  const [lines, setLines] = useState<FilterLine[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executed, setExecuted] = useState(false)

  const run = () => {
    const q = query.trim()
    if (!q) {
      setLines([])
      setTotalCount(0)
      setTruncated(false)
      setExecuted(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    apiClient
      .filterFile({
        filePath: tab.filePath,
        pattern: q,
        encoding: tab.encoding,
        mode,
        options,
        maxLines: 100000
      })
      .then((r) => {
        setLines(r.lines)
        setTotalCount(r.totalCount)
        setTruncated(r.truncated)
        setExecuted(true)
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }

  // Reset when switching tabs so stale results never leak across files.
  useEffect(() => {
    setQuery('')
    setLines([])
    setTotalCount(0)
    setTruncated(false)
    setExecuted(false)
    setError(null)
  }, [tab.id])

  const renderRow = (line: FilterLine) => (
    <div className="filter-row" onClick={() => goToLine(tab.id, line.lineNumber)}>
      <span className="line-no">{line.lineNumber}</span>
      <span className="line-text">{line.content}</span>
    </div>
  )

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-input-row">
          <input
            autoFocus
            placeholder={t('filter.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run()
            }}
          />
          <button className="button" onClick={run}>
            {t('filter.run')}
          </button>
          <button className="button" onClick={onClose} title={t('common.close')}>
            ×
          </button>
        </div>
        <div className="search-options">
          <label className="search-scope">
            {t('filter.mode')}
            <select value={mode} onChange={(e) => setMode(e.target.value as FilterMode)}>
              <option value="include">{t('filter.modeInclude')}</option>
              <option value="exclude">{t('filter.modeExclude')}</option>
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

      {loading && <div className="search-summary">{t('filter.filtering')}</div>}
      {error && <div className="search-error">{error}</div>}
      {!loading && !error && executed && (
        <div className="search-summary">
          <span>
            {mode === 'include' ? t('filter.resultInclude') : t('filter.resultExclude')}{' '}
            {t('filter.lineCount', { count: totalCount.toLocaleString() })}
            {truncated ? t('filter.truncated') : ''}
          </span>
          <span className="hint">{t('filter.clickHint')}</span>
        </div>
      )}

      <VirtualList
        items={lines}
        itemHeight={ROW_HEIGHT}
        renderItem={renderRow}
        getKey={(l) => l.lineNumber}
        className="filter-results"
      />
    </div>
  )
}
