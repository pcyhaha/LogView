import React, { useState } from 'react'
import { useAppStore } from '@renderer/stores/app-store'
import type { ColoringRule } from '@shared/types'

function genId(): string {
  return `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const TEMPLATE: Omit<ColoringRule, 'id'> = {
  name: '新规则',
  regex: 'ERROR',
  bgColor: '#5a1d1d',
  fgColor: '#ffb4b4',
  scope: 'fullLine',
  enabled: true
}

export function ColoringRuleEditor({ onClose }: { onClose: () => void }) {
  const rules = useAppStore((s) => s.settings.coloringRules)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [error, setError] = useState<string | null>(null)

  const save = (next: ColoringRule[]) => {
    updateSettings({ coloringRules: next })
  }

  const addRule = () => {
    const rule: ColoringRule = { id: genId(), ...TEMPLATE }
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
      setError(`正则表达式无效：${(e as Error).message}`)
    }
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div className="dialog coloring-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>着色规则</h3>
        <p className="hint">用正则表达式高亮匹配的日志行。</p>

        <div className="rule-list">
          {rules.length === 0 && <div className="hint">暂无规则，点击下方“添加规则”。</div>}
          {rules.map((rule) => (
            <div className="rule-row" key={rule.id}>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => toggleRule(rule.id)}
                title="启用"
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
                placeholder="正则表达式"
              />
              <select
                value={rule.scope}
                onChange={(e) =>
                  updateRule(rule.id, { scope: e.target.value as ColoringRule['scope'] })
                }
              >
                <option value="fullLine">整行</option>
                <option value="matchOnly">仅匹配</option>
              </select>
              <input
                type="color"
                value={rule.bgColor}
                onChange={(e) => updateRule(rule.id, { bgColor: e.target.value })}
                title="背景色"
              />
              <input
                type="color"
                value={rule.fgColor}
                onChange={(e) => updateRule(rule.id, { fgColor: e.target.value })}
                title="文字色"
              />
              <button className="tab-close" onClick={() => removeRule(rule.id)} title="删除">
                ×
              </button>
            </div>
          ))}
        </div>

        {error && <div className="search-error">{error}</div>}

        <div className="dialog-actions">
          <button className="button" onClick={addRule}>
            + 添加规则
          </button>
          <button className="primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
