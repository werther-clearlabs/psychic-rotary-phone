import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getLatestReport } from '../../../server/genomics/reports-store'
import { getCase } from '../../../server/genomics/cases-store'
import puppeteer from 'puppeteer'

function buildReportHtml(caseRecord: { patient_name?: string | null }, sections: Record<string, string>): string {
  const sectionLabels: Record<string, string> = {
    '1': 'Header / Specimen Information', '2': 'Test Methodology and Limitations',
    '3': 'Results Summary', '4': 'Tier I — Variants of Strong Clinical Significance',
    '5': 'Tier II — Variants of Potential Clinical Significance', '6': 'Biomarker Signatures',
    '7': 'Tier III — Variants of Uncertain Significance (VUS)', '8': 'Therapy Recommendations',
    '9': 'Matched Clinical Trials', '10': 'Methodology Appendix',
    '11': 'References', '12': 'Disclaimers',
  }
  const body = Object.entries(sections)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `<section><h2>${k}. ${sectionLabels[k] ?? ''}</h2><div>${v.replace(/\n/g, '<br>')}</div></section>`)
    .join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#2c2c35;padding:40px}
    h1{font-size:22px;text-align:center}h2{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}
    section{margin-bottom:16px}
  </style></head><body>
  <h1>Molecular Pathology and Precision Oncology Report</h1>
  <p style="text-align:center;color:red;font-style:italic">RESEARCH USE ONLY — NOT FOR CLINICAL DECISION-MAKING</p>
  ${body}
  </body></html>`
}

export const Route = createFileRoute('/api/genomics/cases/$caseId/report/export-pdf')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const report = getLatestReport(undefined, params.caseId)
        if (!report) return Response.json({ error: 'No report found' }, { status: 404 })
        const caseRecord = getCase(undefined, params.caseId)

        const html = buildReportHtml(caseRecord ?? {}, report.sections)
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
        let pdfBuffer: Uint8Array
        try {
          const page = await browser.newPage()
          await page.setContent(html, { waitUntil: 'networkidle0' })
          pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } })
        } finally {
          await browser.close()
        }

        return new Response(pdfBuffer as BodyInit, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="report-${params.caseId}.pdf"`,
          },
        })
      },
    },
  },
})
