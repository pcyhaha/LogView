import React from 'react'
import { useAppStore } from '@renderer/stores/app-store'

export function TabBar() {
  const tabOrder = useAppStore((s) => s.tabOrder)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const tabs = useAppStore((s) => s.tabs)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const closeTab = useAppStore((s) => s.closeTab)

  if (tabOrder.length === 0) return null

  return (
    <div className="editor-tab-bar">
      {tabOrder.map((id) => {
        const tab = tabs[id]
        if (!tab) return null
        return (
          <div
            key={id}
            className={`tab${id === activeTabId ? ' active' : ''}${tab.isTailing ? ' tailing' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <span className="tab-title" title={tab.filePath}>
              {tab.fileName}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(id)
              }}
              title="关闭"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
