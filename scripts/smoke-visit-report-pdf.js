#!/usr/bin/env node
/** Local smoke test — builds a fixture PDF without auth or network. */
const fs = require('fs')
const path = require('path')
const { buildVisitReportPdf } = require('../api/_lib/visitReportPdf')

async function main() {
  const bytes = await buildVisitReportPdf({
    dealerName: 'Riverside Equipment Co.',
    location: '1840 Industrial Pkwy, Springfield, WI',
    visitDate: 'Nov 16, 2026',
    accountManager: 'Mark Firth',
    territory: 'Midwest',
    purpose: 'Review spring order opportunities and inventory',
    attendees: 'John Peterson (Dealer), Mark Firth (Arrowquip)',
    photoCaptions: ['Dealership exterior', 'Arrowquip inventory', 'Product discussion'],
    executiveSummary:
      'Visited to review spring order opportunities and inventory positioning. Strong interest in Q-Catch systems; aged stock and competitor crowder pricing require follow-up. No order was confirmed in the meeting.',
    commercialIntelligence: [
      'Interest in spring Q-Catch order (not confirmed)',
      'Merchandising support for aged units',
      'Competitor crowder lead-time / pricing pressure',
    ],
    tasks: [
      { title: 'Send crowder lead-time clarification', owner: 'Mark Firth', due: 'Friday', priority: 'High' },
      { title: 'Share spring Q-Catch proposal (draft)', owner: 'Mark Firth', due: 'Next week', priority: 'Normal' },
      { title: 'Confirm aged units to feature', owner: 'Dealer', due: 'Suggested', priority: 'Normal' },
    ],
    managementAttention: 'Review regional competitive pricing and potential marketing support.',
    nextSteps: 'Next: Send crowder lead-time clarification',
    recordUrl: 'https://pre-bookings.com',
  })
  const outDir = path.join(__dirname, '..', 'claude', 'samples')
  fs.mkdirSync(outDir, { recursive: true })
  const out = path.join(outDir, 'Arrowquip-Dealer-Visit-Report-sample.pdf')
  fs.writeFileSync(out, bytes)
  const art = '/opt/cursor/artifacts/Arrowquip-Dealer-Visit-Report-sample.pdf'
  try {
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true })
    fs.writeFileSync(art, bytes)
  } catch (_) {}
  console.log('OK', out, bytes.length, 'bytes')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
