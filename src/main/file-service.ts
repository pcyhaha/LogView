import { open } from 'fs/promises'
import { buildLineIndex, getLineIndex, getLineOffset } from './line-indexer'
import { detectEncoding, decodeBuffer } from './encoding-service'
import { FILE_ENCODING } from '../shared/constants'

interface FileReadOptions {
  filePath: string
  encoding: string
  startLine?: number
  endLine?: number
  currentPage?: number
}

export async function openFile(
  filePath: string,
  onProgress?: (indexed: number, total?: number) => void
): Promise<{
  metadata: {
    filePath: string
    fileName: string
    fileSize: number
    encoding: string
    encodingConfidence: number
    totalLines: number
    lastModified: number
    isIndexingComplete: boolean
  }
  page: {
    lines: string[]
    startLine: number
    endLine: number
  }
}> {
  const fileHandle = await open(filePath, 'r')
  const stat = await fileHandle.stat()
  const { encoding, confidence } = await detectEncoding(filePath)
  await fileHandle.close()

  // Build (or fetch cached) line index
  const index = await buildLineIndex(filePath, onProgress)

  const metadata = {
    filePath,
    fileName: filePath.split(/[\\/]/).pop() || '',
    fileSize: stat.size,
    encoding,
    encodingConfidence: confidence,
    totalLines: index.totalLines,
    lastModified: stat.mtimeMs,
    isIndexingComplete: index.isComplete
  }

  const firstPage = await readPage(filePath, 0, encoding)

  return {
    metadata,
    page: {
      lines: firstPage.lines,
      startLine: firstPage.startLine,
      endLine: firstPage.endLine
    }
  }
}

export async function readPage(
  filePath: string,
  pageIndex: number,
  encoding: string,
  pageSize: number = FILE_ENCODING.PAGE_SIZE
): Promise<{ lines: string[]; startLine: number; endLine: number; totalPages: number }> {
  const index = getLineIndex(filePath)
  if (!index) throw new Error(`No line index found for ${filePath}. Open the file first.`)

  const totalPages = Math.max(1, Math.ceil(index.totalLines / pageSize))
  if (pageIndex < 0 || pageIndex >= totalPages) {
    throw new Error(`Page ${pageIndex} out of range (0-${totalPages - 1})`)
  }

  const startLine = pageIndex * pageSize
  const endLine = Math.min((pageIndex + 1) * pageSize, index.totalLines)
  const byteOffset = getLineOffset(filePath, startLine)
  const nextByteOffset = endLine < index.totalLines ? getLineOffset(filePath, endLine) : BigInt(index.fileSize)

  if (byteOffset === undefined || nextByteOffset === undefined) {
    throw new Error(`Invalid byte offset for page ${pageIndex}`)
  }

  const lines = await readLinesBetweenBytes(filePath, byteOffset, nextByteOffset, encoding)
  return { lines, startLine, endLine, totalPages }
}

export async function readLines(
  filePath: string,
  startLine: number,
  count: number,
  encoding: string
): Promise<{ lines: string[]; startLine: number; count: number }> {
  const index = getLineIndex(filePath)
  if (!index) throw new Error(`No line index found for ${filePath}. Open the file first.`)

  if (startLine < 0 || startLine >= index.totalLines) {
    throw new Error(`Start line ${startLine} out of range`)
  }

  const endLine = Math.min(startLine + count, index.totalLines)
  const byteOffset = getLineOffset(filePath, startLine)
  const nextByteOffset = endLine < index.totalLines ? getLineOffset(filePath, endLine) : BigInt(index.fileSize)

  if (byteOffset === undefined || nextByteOffset === undefined) {
    throw new Error(`Invalid byte offset for lines ${startLine}-${endLine - 1}`)
  }

  const lines = await readLinesBetweenBytes(filePath, byteOffset, nextByteOffset, encoding)
  return {
    lines,
    startLine,
    count: lines.length
  }
}

export async function getLineCount(filePath: string): Promise<number> {
  const index = getLineIndex(filePath)
  return index?.totalLines ?? 0
}

async function readLinesBetweenBytes(
  filePath: string,
  startByte: bigint,
  endByte: bigint,
  encoding: string
): Promise<string[]> {
  const size = Number(endByte - startByte)
  if (size <= 0) return []

  const buffer = Buffer.alloc(size)
  const fileHandle = await open(filePath, 'r')
  try {
    await fileHandle.read(buffer, 0, size, Number(startByte))
  } finally {
    await fileHandle.close()
  }

  const content = decodeBuffer(buffer, encoding)

  // Split into lines, dropping a trailing empty entry produced by a final newline
  const lines = content.split(/\r?\n/)
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines
}
