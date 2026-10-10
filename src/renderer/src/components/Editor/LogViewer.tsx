import React, { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { OnMount, Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useAppStore, SCROLL_TO_BOTTOM, Tab } from '@renderer/stores/app-store'
import type { ColoringRule, Bookmark } from '@shared/types'

interface LogViewerProps {
  tab: Tab
}

const STYLE_ELEMENT_ID = 'logview-coloring-style'

function ensureColoringStyle(rules: ColoringRule[]): void {
  let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ELEMENT_ID
    document.head.appendChild(el)
  }
  const css = rules
    .filter((r) => r.enabled)
    .map(
      (r) =>
        `.cr-${r.id} { background-color: ${r.bgColor || 'transparent'}; color: ${
          r.fgColor || 'inherit'
        }; }`
    )
    .join('\n')
  el.textContent = css
}

export function LogViewer({ tab }: LogViewerProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])
  const startLineRef = useRef(tab.view.startLine)
  // 上一次写入 Monaco 的内容/起始行，用于跳过冗余的 setValue（全量重解析）
  const lastContentRef = useRef<string | null>(null)
  const lastStartLineRef = useRef<number | null>(null)
  const theme = useAppStore((s) => s.settings.theme)
  const wordWrap = useAppStore((s) => s.settings.wordWrap ?? false)
  const coloringRules = useAppStore((s) => s.settings.coloringRules)
  const bookmarks = useAppStore((s) => s.bookmarks[tab.id])
  const setCursorLine = useAppStore((s) => s.setCursorLine)
  // Monaco loads asynchronously; the content effect must re-run once the
  // editor is actually mounted, otherwise the first page is never written.
  const [editorReady, setEditorReady] = useState(false)

  // 只有页面数据变化时才重新拼接，避免任意重渲染都做一次千行字符串拼接
  const content = useMemo(() => tab.view.lines.join('\n'), [tab.view.lines])
  const startLine = tab.view.startLine
  const tabId = tab.id
  startLineRef.current = startLine

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    monaco.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark')
    editor.onDidChangeCursorPosition((e) => {
      const fileLine = startLineRef.current + e.position.lineNumber
      setCursorLine(tabId, fileLine)
    })
    setEditorReady(true)
    applyDecorations()
  }

  function applyDecorations() {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    const model = editor.getModel()
    if (!model) return

    const decos: MonacoEditor.IModelDeltaDecoration[] = []

    // 1. Search matches
    const matches = tab.search?.matches ?? []
    const activeIndex = tab.search?.activeIndex ?? -1
    matches.forEach((m, i) => {
      const modelLine = m.lineNumber - startLine
      if (modelLine < 1 || modelLine > tab.view.lines.length) return
      decos.push({
        range: new monaco.Range(modelLine, m.matchStart + 1, modelLine, m.matchEnd + 1),
        options: {
          inlineClassName: i === activeIndex ? 'current-find-match' : 'find-match-highlight',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      })
    })

    // 2. Coloring rules
    const lines = tab.view.lines
    for (const rule of coloringRules) {
      if (!rule.enabled || !rule.regex) continue
      let matcher: RegExp
      try {
        matcher = new RegExp(rule.regex, 'g')
      } catch {
        continue
      }
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i]
        const modelLine = i + 1
        matcher.lastIndex = 0
        let m: RegExpExecArray | null
        let matched = false
        while ((m = matcher.exec(lineText)) !== null) {
          if (m[0].length === 0) {
            matcher.lastIndex++
            continue
          }
          matched = true
          if (rule.scope === 'matchOnly') {
            decos.push({
              range: new monaco.Range(modelLine, m.index + 1, modelLine, m.index + m[0].length + 1),
              options: { inlineClassName: `cr-${rule.id}` }
            })
          }
        }
        if (matched && rule.scope !== 'matchOnly') {
          decos.push({
            range: new monaco.Range(modelLine, 1, modelLine, 1),
            options: { isWholeLine: true, className: `cr-${rule.id}` }
          })
        }
      }
    }

    // 3. Bookmarks
    for (const bm of bookmarks ?? []) {
      const modelLine = bm.lineNumber - startLine
      if (modelLine < 1 || modelLine > lines.length) continue
      decos.push({
        range: new monaco.Range(modelLine, 1, modelLine, 1),
        options: { isWholeLine: true, className: 'bm-line' }
      })
    }

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decos)
  }

  function revealPending() {
    const editor = editorRef.current
    if (!editor) return
    const line = tab.pendingScrollLine
    if (line === null || line === undefined) return
    if (line === SCROLL_TO_BOTTOM) {
      const lastLine = Math.max(1, tab.view.lines.length)
      editor.revealLineInCenter(lastLine)
      editor.setScrollTop(editor.getScrollHeight())
    } else {
      const modelLine = line - startLine
      if (modelLine >= 1 && modelLine <= tab.view.lines.length) {
        editor.revealLineInCenter(modelLine)
        editor.setPosition({ lineNumber: modelLine, column: 1 })
      }
    }
  }

  // 更新文档内容、行号映射并应用装饰。内容与装饰合并为单个 effect：
  // 翻页时 search matches 与 content 同时变化，原先两个 effect 会把
  // applyDecorations（含逐行染色正则）连续执行两遍。
  useEffect(() => {
    if (!editorReady) return
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    if (lastContentRef.current !== content || lastStartLineRef.current !== startLine) {
      lastContentRef.current = content
      lastStartLineRef.current = startLine
      const model = editor.getModel()
      if (model) {
        model.setValue(content)
      } else {
        editor.setModel(monaco.editor.createModel(content, 'plaintext'))
      }
      editor.updateOptions({
        lineNumbers: (n: number) => String(startLine + n)
      })
    }

    ensureColoringStyle(coloringRules)
    applyDecorations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, startLine, editorReady, tab.search?.matches, tab.search?.activeIndex, coloringRules, bookmarks])

  // Reveal the requested line (goto line / search jump / tail follow).
  useEffect(() => {
    revealPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.pendingScrollToken])

  // Theme sync
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark')
    }
  }, [theme])

  // 自动换行开关
  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wordWrap ? 'on' : 'off' })
  }, [wordWrap])

  return (
    <Editor
      height="100%"
      width="100%"
      defaultLanguage="plaintext"
      theme={theme === 'light' ? 'vs' : 'vs-dark'}
      onMount={handleMount}
      options={{
        readOnly: true,
        domReadOnly: true,
        fontSize: 13,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        lineNumbers: (n: number) => String(startLine + n),
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none',
        minimap: { enabled: false },
        automaticLayout: true,
        wordWrap: wordWrap ? 'on' : 'off',
        smoothScrolling: true,
        cursorBlinking: 'solid',
        contextmenu: false,
        scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12 }
      }}
    />
  )
}
