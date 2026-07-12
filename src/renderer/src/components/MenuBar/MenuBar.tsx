import React, { useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
import './MenuBar.css'

type MenuKey = 'file' | 'edit' | 'view' | null

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const openFiles = useAppStore((s) => s.openFiles)

  const refreshRecent = async () => {
    try {
      const settings = await apiClient.getSettings()
      setRecentFiles(settings.recentFiles ?? [])
    } catch {
      setRecentFiles([])
    }
  }

  // Top menus expand on hover only (no click toggle). Hovering another top
  // item while a menu is open switches to it (mirrors native menu behavior).
  // When re-entering the SAME item via its dropdown child we must NOT close it
  // — otherwise moving the cursor from the label down through the gap into the
  // dropdown would close the menu.
  const hover = (key: MenuKey) => {
    if (openMenu === key) return
    if (key === 'file') refreshRecent()
    setOpenMenu(key)
  }

  const close = () => setOpenMenu(null)

  const openFileDialog = async () => {
    close()
    const paths = await apiClient.openDialog()
    if (paths && paths.length) openFiles(paths)
  }

  const openRecent = (p: string) => {
    close()
    openFiles([p])
  }

  // Reuse the existing main-process event listeners wired in AppLayout.
  const send = (event: string) => {
    close()
    apiClient.sendMenuEvent(event)
  }

  const winAction = (action: string) => {
    close()
    apiClient.windowAction(action)
  }

  const copy = () => {
    close()
    document.execCommand('copy')
  }

  const selectAll = () => {
    close()
    document.execCommand('selectAll')
  }

  return (
    <div className="menu-bar">
      <span className="menu-app-title">LogView</span>

      <div
        className={`menu-item ${openMenu === 'file' ? 'open' : ''}`}
        onMouseEnter={() => hover('file')}
      >
        文件
        {openMenu === 'file' && (
          <ul className="menu-dropdown">
            <li onClick={openFileDialog}>
              打开文件...<span className="menu-acc">Ctrl+O</span>
            </li>
            <li className="menu-sep" />
            <li className="menu-group-label">最近打开</li>
            {recentFiles.length ? (
              recentFiles.map((p) => (
                <li key={p} className="menu-recent" onClick={() => openRecent(p)} title={p}>
                  {p}
                </li>
              ))
            ) : (
              <li className="menu-disabled">(空)</li>
            )}
            <li className="menu-sep" />
            <li onClick={() => winAction('quit')}>
              退出<span className="menu-acc">Alt+F4</span>
            </li>
          </ul>
        )}
      </div>

      <div
        className={`menu-item ${openMenu === 'edit' ? 'open' : ''}`}
        onMouseEnter={() => hover('edit')}
      >
        编辑
        {openMenu === 'edit' && (
          <ul className="menu-dropdown">
            <li onClick={copy}>
              复制<span className="menu-acc">Ctrl+C</span>
            </li>
            <li onClick={selectAll}>
              全选<span className="menu-acc">Ctrl+A</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => send('menu:find')}>
              查找<span className="menu-acc">Ctrl+F</span>
            </li>
            <li onClick={() => send('menu:goto-line')}>
              跳转到行...<span className="menu-acc">Ctrl+G</span>
            </li>
          </ul>
        )}
      </div>

      <div
        className={`menu-item ${openMenu === 'view' ? 'open' : ''}`}
        onMouseEnter={() => hover('view')}
      >
        视图
        {openMenu === 'view' && (
          <ul className="menu-dropdown">
            <li onClick={() => winAction('reload')}>
              重新加载<span className="menu-acc">Ctrl+R</span>
            </li>
            <li onClick={() => winAction('force-reload')}>
              强制重新加载<span className="menu-acc">Ctrl+Shift+R</span>
            </li>
            <li onClick={() => winAction('toggle-devtools')}>
              切换开发者工具<span className="menu-acc">F12</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => winAction('reset-zoom')}>
              重置缩放<span className="menu-acc">Ctrl+0</span>
            </li>
            <li onClick={() => winAction('zoom-in')}>
              放大<span className="menu-acc">Ctrl++</span>
            </li>
            <li onClick={() => winAction('zoom-out')}>
              缩小<span className="menu-acc">Ctrl+-</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => winAction('toggle-fullscreen')}>
              切换全屏<span className="menu-acc">F11</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => send('menu:toggle-theme')}>切换主题</li>
          </ul>
        )}
      </div>

      {openMenu && <div className="menu-overlay" onClick={close} />}
    </div>
  )
}
