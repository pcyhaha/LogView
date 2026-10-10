import React, { useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import { useT } from '@renderer/i18n'
import type { ColoringRule } from '@shared/types'

function genId(): string {
  return `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const TEMPLATE: Omit<ColoringRule, 'id' | 'name'> = {
  regex: 'ERROR',
  bgColor: '#5a1d1d',
  fgColor: '#ffb4b4',
  scope: 'fullLine',
  enabled: true
}

export function ColoringRuleEditor({ onClose }: { onClose: () => void }) {
  const rules = useAppStore((s) => s.settings.coloringRules)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const t = useT()
  const [error, setError] = useState<string | null>(null)

  const save = (next: ColoringRule[]) => {
    updateSettings({ coloringRules: next })
  }

  const addRule = () => {
    // 规则名按当前语言生成，保存的是具体文案（历史规则不受语言切换影响）
    const rule: ColoringRule = { id: genId(), name: t('coloring.newRuleName'), ...TEMPLATE }
    save([...rules, rule])
  }

  const updateRule = (id: string, patch: Partial<ColoringRule>) => {
    save(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRule = (id: string) => {
    save(rules.filter((r) => r.id !== id))
  }

  const toggleRule = (id: string) => {
    const r = rules.find((x) => x.id === id)
    if (r) updateRule(id, { enabled: !r.enabled })
  }

  const validate = (regex: string) => {
    try {
      // eslint-disable-next-line no-new
      new RegExp(regex)
      setError(null)
    } catch (e) {
      setError(t('coloring.invalidRegex', { message: (e as Error).message }))
    }
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div className="dialog coloring-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{t('coloring.title')}</h3>
        <p className="hint">{t('coloring.hint')}</p>

        <div className="rule-list">
          {rules.length === 0 && <div className="hint">{t('coloring.empty')}</div>}
          {rules.map((rule) => (
            <div className="rule-row" key={rule.id}>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => toggleRule(rule.id)}
                title={t('tooltip.enableRule')}
              />
              <input
                className="rule-name"
                value={rule.name}
                onChange={(e) => updateRule(rule.id, { name: e.target.value })}
              />
              <input
                className="rule-regex"
                value={rule.regex}
                onChange={(e) => {
                  updateRule(rule.id, { regex: e.target.value })
                  validate(e.target.value)
                }}
                placeholder={t('coloring.regexPlaceholder')}
              />
              <select
                value={rule.scope}
                onChange={(e) =>
                  updateRule(rule.id, { scope: e.target.value as ColoringRule['scope'] })
                }
              >
                <option value="fullLine">{t('coloring.scopeFullLine')}</option>
                <option value="matchOnly">{t('coloring.scopeMatchOnly')}</option>
              </select>
              <input
                type="color"
                value={rule.bgColor}
                onChange={(e) => updateRule(rule.id, { bgColor: e.target.value })}
                title={t('tooltip.ruleBgColor')}
              />
              <input
                type="color"
                value={rule.fgColor}
                onChange={(e) => updateRule(rule.id, { fgColor: e.target.value })}
                title={t('tooltip.ruleFgColor')}
              />
              <button className="tab-close" onClick={() => removeRule(rule.id)} title={t('tooltip.deleteRule')}>
                ×
              </button>
            </div>
          ))}
        </div>

        {error && <div className="search-error">{error}</div>}

        <div className="dialog-actions">
          <button className="button" onClick={addRule}>
            {t('coloring.addRule')}
          </button>
          <button className="primary" onClick={onClose}>
            {t('coloring.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
