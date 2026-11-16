/**
 * Shared Arrowquip-branded one-page dealer visit report builder (pdf-lib).
 * Used by /api/visit-report-pdf and local smoke tests.
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const RED = rgb(0.8, 0.086, 0.18) // #CC162E
const BLACK = rgb(0.11, 0.11, 0.12)
const GREY = rgb(0.42, 0.45, 0.48)
const LIGHT = rgb(0.97, 0.97, 0.98)
const ATTN_BG = rgb(1, 0.96, 0.965)

function s(v, max) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim()
  return max && t.length > max ? t.slice(0, max - 1) + '…' : t
}

function wrap(font, text, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  words.forEach((w) => {
    const trial = line ? line + ' ' + w : w
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) line = trial
    else {
      if (line) lines.push(line)
      line = w
    }
  })
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/**
 * @param {object} report
 * @returns {Promise<Uint8Array>}
 */
async function buildVisitReportPdf(report) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792]) // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const L = 36
  const R = width - 36
  let y = height - 36

  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: RED })
  y = height - 28
  page.drawText('ARROWQUIP — DEALER VISIT REPORT', { x: L, y, size: 12, font: bold, color: BLACK })
  const conf = 'INTERNAL — CONFIDENTIAL'
  page.drawText(conf, { x: R - bold.widthOfTextAtSize(conf, 8), y: y + 2, size: 8, font: bold, color: RED })
  y -= 14
  page.drawText('Field Intelligence · North America', { x: L, y, size: 8, font, color: GREY })
  y -= 10
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.6, color: rgb(0.9, 0.9, 0.91) })
  y -= 14

  const meta = [
    ['Dealer', s(report.dealerName, 48)],
    ['Location', s(report.location, 40)],
    ['Visit date', s(report.visitDate, 24)],
    ['Account manager', s(report.accountManager, 32)],
    ['Territory', s(report.territory, 24)],
    ['Purpose', s(report.purpose, 48)],
  ]
  const colW = (R - L) / 3
  for (let i = 0; i < meta.length; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = L + col * colW
    const yy = y - row * 28
    page.drawRectangle({ x, y: yy - 18, width: colW - 6, height: 24, color: LIGHT })
    page.drawText(meta[i][0].toUpperCase(), { x: x + 5, y: yy - 2, size: 6.5, font: bold, color: GREY })
    page.drawText(meta[i][1], { x: x + 5, y: yy - 14, size: 9, font: bold, color: BLACK })
  }
  y -= 68

  const attendees = s(report.attendees, 120)
  if (attendees) {
    page.drawText('ATTENDEES', { x: L, y, size: 6.5, font: bold, color: GREY })
    y -= 11
    page.drawText(attendees, { x: L, y, size: 9, font, color: BLACK })
    y -= 14
  }

  function heading(t) {
    page.drawText(t.toUpperCase(), { x: L, y, size: 8, font: bold, color: RED })
    y -= 3
    page.drawLine({ start: { x: L, y }, end: { x: L + 120, y }, thickness: 0.7, color: rgb(0.94, 0.79, 0.81) })
    y -= 12
  }

  const photos = Array.isArray(report.photoCaptions) ? report.photoCaptions.filter(Boolean) : []
  if (photos.length) {
    heading('Photo gallery')
    photos.slice(0, 4).forEach((cap, i) => {
      const boxW = (R - L - 18) / 3
      if (i < 3) {
        const x = L + i * (boxW + 9)
        page.drawRectangle({ x, y: y - 48, width: boxW, height: 52, color: LIGHT })
        page.drawText(s(cap, 28), { x: x + 4, y: y - 44, size: 7, font, color: GREY })
      }
    })
    y -= 60
  }

  heading('Executive summary')
  wrap(font, s(report.executiveSummary, 700), 9.5, R - L)
    .slice(0, 5)
    .forEach((ln) => {
      page.drawText(ln, { x: L, y, size: 9.5, font, color: BLACK })
      y -= 12
    })
  y -= 4

  heading('Commercial intelligence')
  const intel = Array.isArray(report.commercialIntelligence) ? report.commercialIntelligence : []
  intel.slice(0, 5).forEach((item) => {
    wrap(font, '• ' + s(item, 160), 9, R - L).forEach((ln) => {
      page.drawText(ln, { x: L, y, size: 9, font, color: BLACK })
      y -= 11
    })
  })
  if (!intel.length) {
    page.drawText('• None recorded', { x: L, y, size: 9, font, color: GREY })
    y -= 12
  }
  y -= 4

  heading('Key commitments & next steps')
  const tasks = Array.isArray(report.tasks) ? report.tasks : []
  page.drawText('Action', { x: L, y, size: 7, font: bold, color: GREY })
  page.drawText('Owner', { x: L + 260, y, size: 7, font: bold, color: GREY })
  page.drawText('Due', { x: L + 360, y, size: 7, font: bold, color: GREY })
  page.drawText('Priority', { x: L + 430, y, size: 7, font: bold, color: GREY })
  y -= 10
  tasks.slice(0, 5).forEach((t) => {
    page.drawText(s(t.title || t.t, 48), { x: L, y, size: 8.5, font, color: BLACK })
    page.drawText(s(t.owner, 18), { x: L + 260, y, size: 8.5, font, color: BLACK })
    page.drawText(s(t.due, 14), { x: L + 360, y, size: 8.5, font, color: BLACK })
    const pr = s(t.priority || 'Normal', 10)
    page.drawText(pr, {
      x: L + 430,
      y,
      size: 8.5,
      font: bold,
      color: pr.toLowerCase() === 'high' ? RED : BLACK,
    })
    y -= 11
  })
  if (!tasks.length) {
    page.drawText('None approved yet', { x: L, y, size: 9, font, color: GREY })
    y -= 12
  }
  y -= 6

  const attn = s(report.managementAttention, 320)
  if (attn) {
    heading('Management attention')
    const boxH = 36
    page.drawRectangle({ x: L, y: y - boxH + 14, width: R - L, height: boxH, color: ATTN_BG })
    page.drawRectangle({ x: L, y: y - boxH + 14, width: 3, height: boxH, color: RED })
    wrap(font, attn, 9, R - L - 16)
      .slice(0, 2)
      .forEach((ln, i) => {
        page.drawText(ln, { x: L + 10, y: y - 2 - i * 11, size: 9, font, color: BLACK })
      })
    y -= boxH + 6
  }

  heading('Next steps')
  wrap(font, s(report.nextSteps, 280), 9.5, R - L)
    .slice(0, 3)
    .forEach((ln) => {
      page.drawText(ln, { x: L, y, size: 9.5, font, color: BLACK })
      y -= 12
    })

  page.drawLine({ start: { x: L, y: 42 }, end: { x: R, y: 42 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.91) })
  page.drawText('Arrowquip TRAVEL — Internal Field Intelligence', { x: L, y: 28, size: 7.5, font, color: GREY })
  const link = s(report.recordUrl || 'https://pre-bookings.com', 60)
  page.drawText(link, { x: R - font.widthOfTextAtSize(link, 7.5), y: 28, size: 7.5, font, color: GREY })
  page.drawText('Photo binaries omitted when not supplied — captions retained in the full record.', {
    x: L,
    y: 16,
    size: 6.5,
    font,
    color: GREY,
  })

  return pdf.save()
}

module.exports = { buildVisitReportPdf, s, wrap }
