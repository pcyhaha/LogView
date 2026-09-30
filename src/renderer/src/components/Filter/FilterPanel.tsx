import React, { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
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
            placeholder="过滤关键词（匹配的行保留/隐藏）..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run()
            }}
          />
          <button className="button" onClick={run}>
            过滤
          </button>
          <button className="button" onClick={onClose} title="关闭">
            ×
          </button>
        </div>
        <div className="search-options">
          <label className="search-scope">
            模式：
            <select value={mode} onChange={(e) => setMode(e.target.value as FilterMode)}>
              <option value="include">保留匹配行</option>
              <option value="exclude">隐藏匹配行</option>
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

      {loading && <div className="search-summary">正在过滤…</div>}
      {error && <div className="search-error">{error}</div>}
      {!loading && !error && executed && (
        <div className="search-summary">
          <span>
            {mode === 'include' ? '匹配' : '剩余'} {totalCount.toLocaleString()} 行
            {truncated ? '（已达上限，结果被截断）' : ''}
          </span>
          <span className="hint">点击行跳转到原文</span>
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
