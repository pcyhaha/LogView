import { open, FileHandle } from 'fs/promises'
import { buildLineIndex, getLineIndex, getLineOffset, invalidateIndex } from './line-indexer'
import { detectEncoding, decodeBuffer } from './encoding-service'
import { FILE_ENCODING } from '../shared/constants'

// 长生命周期文件句柄缓存。翻页/跳转读取非常频繁，之前每次读取都要
// open + read + close 一轮 syscall；复用句柄可省掉打开/关闭开销。
const handleCache = new Map<string, FileHandle>()

async function getHandle(filePath: string): Promise<FileHandle> {
  let handle = handleCache.get(filePath)
  if (!handle) {
    handle = await open(filePath, 'r')
    handleCache.set(filePath, handle)
  }
  return handle
}

// 释放一个文件在主进程的全部缓存资源（句柄 + 行索引）。
// 关闭标签页时应调用，否则大文件的行索引（8 字节/行）会一直常驻内存。
export async function releaseFile(filePath: string): Promise<void> {
  const handle = handleCache.get(filePath)
  if (handle) {
    handleCache.delete(filePath)
    await handle.close().catch(() => {})
  }
  invalidateIndex(filePath)
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
  const nextByteOffset = endLine < index.totalLines ? getLineOffset(filePath, endLine) : index.fileSize

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
  const nextByteOffset = endLine < index.totalLines ? getLineOffset(filePath, endLine) : index.fileSize

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
  startByte: number,
  endByte: number,
  encoding: string
): Promise<string[]> {
  const size = endByte - startByte
  if (size <= 0) return []

  const buffer = Buffer.alloc(size)
  const fileHandle = await getHandle(filePath)
  let bytesRead = 0
  try {
    ;({ bytesRead } = await fileHandle.read(buffer, 0, size, startByte))
  } catch (err) {
    // 句柄可能因文件轮转/删除失效：丢弃缓存，让下次读取重新打开
    handleCache.delete(filePath)
    await fileHandle.close().catch(() => {})
    throw err
  }
  if (bytesRead < size) {
    // 文件可能在缓存句柄打开后被截断：丢弃缓存句柄，避免后续读到脏数据
    handleCache.delete(filePath)
    void fileHandle.close().catch(() => {})
  }

  const content = decodeBuffer(buffer.subarray(0, bytesRead), encoding)

  // Split into lines, dropping a trailing empty entry produced by a final newline
  const lines = content.split(/\r?\n/)
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines
}
