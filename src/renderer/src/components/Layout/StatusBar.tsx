import React, { useEffect, useState } from 'react'
import { useT } from '@renderer/i18n'
import type { Tab } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// Refresh the runtime memory reading every 3s — frequent enough to be useful,
// slow enough to be negligible overhead.
const MEMORY_REFRESH_MS = 3000

export function StatusBar({ tab }: { tab: Tab | null }) {
  const t = useT()
  const [memBytes, setMemBytes] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const bytes = await apiClient.getAppMemory()
        if (alive) setMemBytes(bytes)
      } catch {
        /* ignore — memory read is best-effort */
      }
    }
    tick()
    const timer = setInterval(tick, MEMORY_REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const memText =
    memBytes === null ? t('status.memoryNA') : t('status.memory', { size: formatSize(memBytes) })

  if (!tab) {
    return (
      <div className="status-bar">
        <div className="status-bar-left">
          <span className="status-item">{t('status.ready')}</span>
        </div>
        <div className="status-bar-right">
          <span className="status-item">{memText}</span>
          <span className="status-item">{t('status.noFile')}</span>
        </div>
      </div>
    )
  }

  const status = tab.isTailing
    ? t('status.tailing')
    : tab.isIndexingComplete
    ? t('status.ready')
    : t('status.indexing')

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-item">{status}</span>
        <span className="status-item">{tab.fileName}</span>
      </div>
      <div className="status-bar-right">
        <span className="status-item">{t('status.lineCount', { count: tab.totalLines.toLocaleString() })}</span>
        <span className="status-item">{formatSize(tab.fileSize)}</span>
        <span className="status-item">{tab.encoding}</span>
        <span className="status-item">{memText}</span>
      </div>
    </div>
  )
}
