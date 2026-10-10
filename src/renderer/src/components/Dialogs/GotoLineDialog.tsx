import React, { useState, useEffect } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { useT } from '@renderer/i18n'
import type { Tab } from '@renderer/stores/app-store'

interface GotoLineDialogProps {
  tab: Tab
  onClose: () => void
}

export function GotoLineDialog({ tab, onClose }: GotoLineDialogProps) {
  const goToLine = useAppStore((s) => s.goToLine)
  const t = useT()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setValue('')
    setError('')
  }, [tab.id])

  const submit = () => {
    const line = parseInt(value, 10)
    if (isNaN(line) || line < 1 || line > tab.totalLines) {
      setError(t('goto.invalidRange', { max: tab.totalLines.toLocaleString() }))
      return
    }
    goToLine(tab.id, line)
    onClose()
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{t('goto.title')}</h3>
        <input
          autoFocus
          type="number"
          min={1}
          max={tab.totalLines}
          placeholder={`1 - ${tab.totalLines.toLocaleString()}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onClose()
          }}
        />
        {error && <div className="search-error">{error}</div>}
        <div className="dialog-actions">
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" onClick={submit}>
            {t('goto.go')}
          </button>
        </div>
      </div>
    </div>
  )
}
