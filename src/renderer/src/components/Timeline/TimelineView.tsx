import React, { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
import { useT } from '@renderer/i18n'
import type { Tab } from '@renderer/stores/app-store'
import type { TimelineResult } from '@shared/types'

const W = 320
const H = 150
const PAD = 8

export function TimelineView({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const goToLine = useAppStore((s) => s.goToLine)
  const t = useT()
  const [result, setResult] = useState<TimelineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    apiClient
      .buildTimeline({ filePath: tab.filePath, encoding: tab.encoding, buckets: 80 })
      .then((r) => {
        setResult(r)
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id])

  const maxCount = result?.buckets.reduce((m, b) => Math.max(m, b.count), 0) ?? 0
  const fmt = (ms: number) =>
    isNaN(ms) ? '' : new Date(ms).toLocaleString()

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-input-row">
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('timeline.title')}</span>
          <button className="button" onClick={load} title={t('tooltip.rebuild')}>
            {t('timeline.refresh')}
          </button>
          <button className="button" onClick={onClose} title={t('common.close')}>
            ×
          </button>
        </div>
        <div className="search-summary">
          {result && !loading
            ? t('timeline.summary', {
                total: result.totalLines.toLocaleString(),
                parsed: result.parsedLines.toLocaleString()
              })
            : t('timeline.scanning')}
        </div>
      </div>

      {loading && <div className="search-summary">{t('timeline.building')}</div>}
      {error && <div className="search-error">{error}</div>}

      {!loading && result && result.buckets.length === 0 && (
        <div className="hint" style={{ padding: 10, color: 'var(--text-muted)' }}>
          {t('timeline.noTimestamps')}
        </div>
      )}

      {!loading && result && result.buckets.length > 0 && (
        <div style={{ padding: PAD }}>
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            style={{ display: 'block', cursor: 'pointer' }}
          >
            {result.buckets.map((b, i) => {
              const bw = (W - PAD * 2) / result.buckets.length
              const x = PAD + i * bw
              const h = maxCount > 0 ? (b.count / maxCount) * (H - 36) : 0
              const y = H - 24 - h
              const intensity = maxCount > 0 ? Math.round((b.count / maxCount) * 200) : 0
              return (
                <rect
                  key={i}
                  x={x + 0.5}
                  y={y}
                  width={Math.max(1, bw - 1)}
                  height={Math.max(1, h)}
                  fill={`rgba(78, 201, 176, ${0.25 + (intensity / 200) * 0.75})`}
                  onClick={() => b.sampleLineNumber > 0 && goToLine(tab.id, b.sampleLineNumber)}
                >
                  <title>
                    {t('timeline.bucketTip', { count: b.count, time: fmt(b.startMs) })}
                  </title>
                </rect>
              )
            })}
            <text x={PAD} y={H - 6} fill="var(--text-muted)" fontSize="9">
              {fmt(result.minMs)}
            </text>
            <text
              x={W - PAD}
              y={H - 6}
              fill="var(--text-muted)"
              fontSize="9"
              textAnchor="end"
            >
              {fmt(result.maxMs)}
            </text>
          </svg>
        </div>
      )}
    </div>
  )
}
