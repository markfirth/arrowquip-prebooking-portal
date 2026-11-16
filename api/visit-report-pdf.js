/**
 * POST /api/visit-report-pdf
 * Authorization: Bearer <Supabase session>
 * Body: { report: { ... } }
 *
 * Returns application/pdf bytes for an Arrowquip-branded one-page
 * US Letter dealer visit report. Never invents facts — renders only
 * what the client supplies after human approval.
 */
const { requireApprovedUser } = require('./_lib/auth')
const { buildVisitReportPdf } = require('./_lib/visitReportPdf')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method' })
    return
  }
  if (!(await requireApprovedUser(req, res))) return

  const body = req.body || {}
  const report = body.report || body
  if (!report || typeof report !== 'object') {
    res.status(400).json({ ok: false, error: 'missing report' })
    return
  }

  try {
    const bytes = await buildVisitReportPdf(report)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="Arrowquip-Dealer-Visit-Report.pdf"')
    res.status(200).send(Buffer.from(bytes))
  } catch (e) {
    res.status(500).json({ ok: false, error: 'pdf_failed', message: String((e && e.message) || e) })
  }
}
