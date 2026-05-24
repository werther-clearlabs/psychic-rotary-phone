import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve, sep } from 'node:path'
import type { ReportFigure } from './types'

export interface ParsedReport {
  sections: Record<string, string>
  figures: ReportFigure[]
}

export function parseMarkdownReport(markdown: string): ParsedReport {
  const sections: Record<string, string> = {}
  const figures: ReportFigure[] = []

  // Split on ## N. headings (1–12)
  const sectionRegex = /^## (\d+)\./m
  const parts = markdown.split(/(?=^## \d+\.)/m)

  let currentSection = ''
  for (const part of parts) {
    const match = part.match(sectionRegex)
    if (match) {
      currentSection = match[1]
      const body = part.replace(/^## \d+\.[^\n]*\n/, '').trim()
      sections[currentSection] = body

      // Extract figures within this section
      const figureRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
      let fig: RegExpExecArray | null
      while ((fig = figureRegex.exec(body)) !== null) {
        figures.push({ caption: fig[1], path: fig[2], section: currentSection })
      }
    }
  }

  return { sections, figures }
}

export function startReportWatcher(
  watchPath: string,
  onReport: (filePath: string, parsed: ParsedReport) => void,
): () => void {
  const resolvedWatchPath = resolve(watchPath)
  const watcher = watch(watchPath, { recursive: false }, async (event, filename) => {
    if (!filename || extname(filename) !== '.md') return
    const filePath = resolve(join(watchPath, filename))
    // Path traversal guard: filename from fs.watch may contain path separators
    if (!filePath.startsWith(resolvedWatchPath + sep) && filePath !== resolvedWatchPath) return
    try {
      const content = await readFile(filePath, 'utf8')
      const parsed = parseMarkdownReport(content)
      if (Object.keys(parsed.sections).length > 0) {
        onReport(filePath, parsed)
      }
    } catch {
      // file may have been deleted or not yet fully written — ignore
    }
  })
  return () => watcher.close()
}
