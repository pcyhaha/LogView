import Store from 'electron-store'
import { app } from 'electron'
import path from 'path'
import type { AppSettings } from '../shared/types'

// 绿色版：数据文件跟随 exe 所在目录（数据在同目录），而非 AppData/Roaming。
// - portable 单文件版：运行时会解压到临时目录，app.getPath('exe') 指向临时目录，
//   必须用 electron-builder 注入的 PORTABLE_EXECUTABLE_DIR 定位真正的 exe 同级目录。
// - 开发模式：使用默认用户数据目录，避免污染项目与开发环境。
function resolvePortableCwd(): string | undefined {
  if (!app.isPackaged) return undefined
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (portableDir) return portableDir
  return path.dirname(app.getPath('exe'))
}

const store = new Store({ name: 'logview-settings', cwd: resolvePortableCwd() })

const DEFAULT_SETTINGS: AppSettings = {
  pageSize: 1000,
  theme: 'light',
  wordWrap: false,
  language: 'zh',
  coloringRules: [],
  recentFiles: []
}

const SETTINGS_KEY = 'settings'
const MAX_RECENT_FILES = 20

export function getSettings(): AppSettings {
  const saved = store.get(SETTINGS_KEY, {}) as Partial<AppSettings>
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    coloringRules: saved.coloringRules ?? DEFAULT_SETTINGS.coloringRules,
    recentFiles: saved.recentFiles ?? DEFAULT_SETTINGS.recentFiles
  }
}

export function saveSettings(settings: AppSettings): { success: boolean } {
  store.set(SETTINGS_KEY, settings)
  return { success: true }
}

export function addRecentFile(filePath: string): void {
  const settings = getSettings()
  const recent = [filePath, ...settings.recentFiles.filter((f) => f !== filePath)].slice(
    0,
    MAX_RECENT_FILES
  )
  store.set(SETTINGS_KEY, { ...settings, recentFiles: recent })
}
