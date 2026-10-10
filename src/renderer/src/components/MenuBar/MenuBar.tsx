import React, { useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { apiClient } from '@renderer/services/api-client'
import { useT } from '@renderer/i18n'
import './MenuBar.css'

type MenuKey = 'file' | 'edit' | 'view' | null

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const openFiles = useAppStore((s) => s.openFiles)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const language = useAppStore((s) => s.settings.language) ?? 'zh'
  const t = useT()

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
        {t('menu.file')}
        {openMenu === 'file' && (
          <ul className="menu-dropdown">
            <li onClick={openFileDialog}>
              {t('menu.file.open')}<span className="menu-acc">Ctrl+O</span>
            </li>
            <li className="menu-sep" />
            <li className="menu-group-label">{t('menu.file.recent')}</li>
            {recentFiles.length ? (
              recentFiles.map((p) => (
                <li key={p} className="menu-recent" onClick={() => openRecent(p)} title={p}>
                  {p}
                </li>
              ))
            ) : (
              <li className="menu-disabled">{t('menu.file.recentEmpty')}</li>
            )}
            <li className="menu-sep" />
            <li onClick={() => winAction('quit')}>
              {t('menu.file.quit')}<span className="menu-acc">Alt+F4</span>
            </li>
          </ul>
        )}
      </div>

      <div
        className={`menu-item ${openMenu === 'edit' ? 'open' : ''}`}
        onMouseEnter={() => hover('edit')}
      >
        {t('menu.edit')}
        {openMenu === 'edit' && (
          <ul className="menu-dropdown">
            <li onClick={copy}>
              {t('menu.edit.copy')}<span className="menu-acc">Ctrl+C</span>
            </li>
            <li onClick={selectAll}>
              {t('menu.edit.selectAll')}<span className="menu-acc">Ctrl+A</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => send('menu:find')}>
              {t('menu.edit.find')}<span className="menu-acc">Ctrl+F</span>
            </li>
            <li onClick={() => send('menu:goto-line')}>
              {t('menu.edit.gotoLine')}<span className="menu-acc">Ctrl+G</span>
            </li>
          </ul>
        )}
      </div>

      <div
        className={`menu-item ${openMenu === 'view' ? 'open' : ''}`}
        onMouseEnter={() => hover('view')}
      >
        {t('menu.view')}
        {openMenu === 'view' && (
          <ul className="menu-dropdown">
            <li onClick={() => winAction('reload')}>
              {t('menu.view.reload')}<span className="menu-acc">Ctrl+R</span>
            </li>
            <li onClick={() => winAction('force-reload')}>
              {t('menu.view.forceReload')}<span className="menu-acc">Ctrl+Shift+R</span>
            </li>
            <li onClick={() => winAction('toggle-devtools')}>
              {t('menu.view.devtools')}<span className="menu-acc">F12</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => winAction('reset-zoom')}>
              {t('menu.view.resetZoom')}<span className="menu-acc">Ctrl+0</span>
            </li>
            <li onClick={() => winAction('zoom-in')}>
              {t('menu.view.zoomIn')}<span className="menu-acc">Ctrl++</span>
            </li>
            <li onClick={() => winAction('zoom-out')}>
              {t('menu.view.zoomOut')}<span className="menu-acc">Ctrl+-</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => winAction('toggle-fullscreen')}>
              {t('menu.view.fullscreen')}<span className="menu-acc">F11</span>
            </li>
            <li className="menu-sep" />
            <li onClick={() => send('menu:toggle-theme')}>{t('menu.view.toggleTheme')}</li>
            <li className="menu-sep" />
            <li className="menu-group-label">{t('menu.view.language')}</li>
            <li
              className={language === 'zh' ? 'menu-active' : ''}
              onClick={() => {
                close()
                setLanguage('zh')
              }}
            >
              中文
            </li>
            <li
              className={language === 'en' ? 'menu-active' : ''}
              onClick={() => {
                close()
                setLanguage('en')
              }}
            >
              English
            </li>
          </ul>
        )}
      </div>

      {openMenu && <div className="menu-overlay" onClick={close} />}
    </div>
  )
}
