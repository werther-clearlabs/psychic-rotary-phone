// src/server/genomics/watcher-init.ts
import { startReportWatcher } from './report-watcher'
import { upsertReportFromFile } from './reports-store'
import { listCases } from './cases-store'

const watchPath = process.env.GENOMICS_REPORT_WATCH_PATH

let started = false

if (watchPath && !started) {
  started = true
  startReportWatcher(watchPath, (filePath, parsed) => {
    // Match file to a case by looking for a case_id embedded in the filename.
    // Convention: agent writes files as {case_id}-report.md or {case_id}.md
    const filename = filePath.split('/').pop() ?? ''
    const cases = listCases()
    const matchedCase = cases.find((c) => filename.includes(c.id))
    if (!matchedCase) {
      console.warn('[genomics watcher] could not match report file to a case:', filename)
      return
    }
    upsertReportFromFile(undefined, matchedCase.id, filePath, parsed.sections, parsed.figures)
    console.log(`[genomics watcher] imported report for case ${matchedCase.id} from ${filePath}`)
  })
  console.log(`[genomics watcher] watching ${watchPath} for markdown reports`)
}
