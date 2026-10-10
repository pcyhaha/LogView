import { useAppStore } from '@renderer/stores/app-store'
import { zh } from './zh'
import { en } from './en'
import type { DictKey } from './zh'

export type Language = 'zh' | 'en'
export type TranslationParams = Record<string, string | number>

const dictionaries: Record<Language, Record<DictKey, string>> = { zh, en }

// 取词：缺失时回退中文字典，再缺失则原样返回 key（便于发现漏翻）
export function translate(lang: Language, key: DictKey, params?: TranslationParams): string {
  const dict = dictionaries[lang] ?? zh
  let text = dict[key] ?? zh[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

// 组件内使用：订阅 settings.language，语言切换时触发重渲染
export function useT(): (key: DictKey, params?: TranslationParams) => string {
  const lang = useAppStore((s) => s.settings.language) ?? 'zh'
  return (key, params) => translate(lang, key, params)
}
