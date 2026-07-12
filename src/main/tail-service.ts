import { open, stat } from 'fs/promises'
import chokidar, { FSWatcher } from 'chokidar'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { createDecoder } from './encoding-service'
import { getLineIndex } from './line-indexer'

interface TailState {
  filePath: string
  watcher: FSWatcher
  lastSize: number
  decoder: { write: (chunk: Buffer) => string; end: () => string }
  lineBuffer: string
  totalLines: number
  encoding: string
}

const tails = new Map<string, TailState>()

export async function startTail(
  sender: Electron.WebContents,
  filePath: string,
  encoding: string
): Promise<{ success: boolean }> {
  if (tails.has(filePath)) return { success: true }

  const decoder = createDecoder(encoding)
  let lastSize = 0
  try {
    const s = await stat(filePath)
    lastSize = s.size
  } catch {
    lastSize = 0
  }

  const index = getLineIndex(filePath)
  const totalLines = index?.totalLines ?? 0

  const watcher = chokidar.watch(filePath, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 }
  })

  const state: TailState = {
    filePath,
    watcher,
    lastSize,
    decoder,
    lineBuffer: '',
    totalLines,
    encoding
  }

  watcher.on('change', async () => {
    try {
      const s = await stat(filePath)
      const newSize = s.size

      // Detect rotation / truncation
      if (newSize < state.lastSize) {
        sender.send(IPC_CHANNELS.TAIL_FILE_RESET, { filePath })
        state.lastSize = 0
        state.lineBuffer = ''
        state.decoder = createDecoder(state.encoding)
      }

      if (newSize > state.lastSize) {
        const size = newSize - state.lastSize
        const buffer = Buffer.alloc(size)
        const handle = await open(filePath, 'r')
        try {
          await handle.read(buffer, 0, size, state.lastSize)
        } finally {
          await handle.close()
        }
        state.lastSize = newSize
        const text = state.decoder.write(buffer)
        const { lines, startLineNumber } = extractLines(state, text)
        if (lines.length > 0) {
          state.totalLines += lines.length
          sender.send(IPC_CHANNELS.TAIL_NEW_LINES, {
            filePath,
            newLines: lines,
            startLineNumber,
            totalLines: state.totalLines
          })
        }
      }
    } catch {
      // File may be temporarily unavailable; ignore this tick
    }
  })

  tails.set(filePath, state)
  return { success: true }
}

export async function stopTail(filePath: string): Promise<{ success: boolean }> {
  const state = tails.get(filePath)
  if (state) {
    await state.watcher.close()
    tails.delete(filePath)
  }
  return { success: true }
}

export function getActiveTails(): string[] {
  return Array.from(tails.keys())
}

function extractLines(
  state: TailState,
  text: string
): { lines: string[]; startLineNumber: number } {
  const lines: string[] = []
  let start = 0
  let idx: number
  while ((idx = text.indexOf('\n', start)) !== -1) {
    let line = state.lineBuffer + text.slice(start, idx)
    if (line.endsWith('\r')) line = line.slice(0, -1)
    lines.push(line)
    state.lineBuffer = ''
    start = idx + 1
  }
  state.lineBuffer += text.slice(start)
  const startLineNumber = state.totalLines + 1
  return { lines, startLineNumber }
}
