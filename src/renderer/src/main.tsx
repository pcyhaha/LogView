import React from 'react'
import ReactDOM from 'react-dom/client'
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { App } from './App'
import '@renderer/styles/global.css'
import '@renderer/styles/monaco-overrides.css'

// Configure Monaco to run from the bundled package (offline-friendly) and
// provide the editor web worker required for background tokenization.
;(self as any).MonacoEnvironment = {
  getWorker() {
    return new EditorWorker()
  }
}
loader.config({ monaco })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
