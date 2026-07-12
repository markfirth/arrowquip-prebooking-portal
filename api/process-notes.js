/**
 * Vercel API route — POST /api/process-notes?k=<TOKEN>
 * Body: { transcript: string }
 *
 * Turns a raw visit transcript (Plaud etc.) into structured, review-ready
 * visit notes with the Claude API:
 *   { ok, summary, notes[], decisions[], concerns[], opportunities[],
 *     commitments_arrowquip[], commitments_dealer[], actions:[{t,owner,due}] }
 *
 * Requires ANTHROPIC_API_KEY in the Vercel environment; without it the
 * endpoint answers { ok:false, reason:'not_configured' } and the transcript
 * stays untouched in the inbox — processing is never faked.
 */
const { ACCESS_TOKEN } = require('./_lib/dealerService')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return }
  if (((req.query && req.query.k) || '') !== ACCESS_TOKEN) { res.status(404).json({ ok: false }); return }

  const key = String(process.env.ANTHROPIC_API_KEY || '').trim()
  if (!key) {
    res.status(200).json({ ok: false, reason: 'not_configured',
      message: 'AI note processing requires ANTHROPIC_API_KEY in the Vercel environment.' })
    return
  }

  const transcript = String((req.body || {}).transcript || '').slice(0, 120000)
  if (!transcript.trim()) { res.status(200).json({ ok: false, reason: 'empty' }); return }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content:
          'You are processing the raw transcript of an Arrowquip (cattle handling equipment) sales rep\'s dealer visit. ' +
          'Produce a structured dealer visit report. Respond with ONLY a JSON object, no prose, no code fences:\n' +
          '{"summary":string (3-5 sentence executive summary),' +
          '"dealer_sentiment":string (one of: Positive, Neutral, Mixed, Negative, Unknown, with a short reason),' +
          '"notes":[string] (bullet-point visit notes, report-ready, professional),' +
          '"discussion_points":[string] (key discussion points),' +
          '"inventory_observations":[string] (what inventory/stock was observed or discussed),' +
          '"product_interest":[string] (specific products the dealer showed interest in),' +
          '"decisions":[string],"concerns":[string] (dealer concerns/problems/risks),' +
          '"opportunities":[string] (sales opportunities),' +
          '"competitor_info":[string] (any competitor mentions/intel),' +
          '"commitments_arrowquip":[string] (what Arrowquip committed to),' +
          '"commitments_dealer":[string] (what the dealer committed to),' +
          '"actions":[{"t":string,"owner":string|"","due":string|""}] (follow-up actions with owner and due date),' +
          '"cleaned_transcript_notes":string (a lightly cleaned, readable version of the conversation notes)}\n' +
          'Use empty arrays/strings when a section has nothing. Never invent facts not in the transcript.\n\nTRANSCRIPT:\n' + transcript },
        ],
      }),
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok || !data || !Array.isArray(data.content)) {
      res.status(200).json({ ok: false, reason: 'api_error', message: (data && data.error && data.error.message) || `status ${resp.status}` })
      return
    }
    const text = (data.content.find((c) => c.type === 'text') || {}).text || ''
    const m = text.match(/\{[\s\S]*\}/)
    const p = m ? JSON.parse(m[0]) : null
    if (!p) { res.status(200).json({ ok: false, reason: 'parse_error' }); return }
    const arr = (v) => Array.isArray(v) ? v.map(String) : []
    res.status(200).json({
      ok: true,
      model: 'claude-haiku-4-5-20251001',
      summary: String(p.summary || ''),
      dealer_sentiment: String(p.dealer_sentiment || ''),
      notes: arr(p.notes), discussion_points: arr(p.discussion_points),
      inventory_observations: arr(p.inventory_observations), product_interest: arr(p.product_interest),
      decisions: arr(p.decisions), concerns: arr(p.concerns),
      opportunities: arr(p.opportunities), competitor_info: arr(p.competitor_info),
      commitments_arrowquip: arr(p.commitments_arrowquip), commitments_dealer: arr(p.commitments_dealer),
      actions: Array.isArray(p.actions) ? p.actions.map((a) => ({ t: String(a.t || ''), owner: String(a.owner || ''), due: String(a.due || '') })).filter((a) => a.t) : [],
      cleaned_transcript_notes: String(p.cleaned_transcript_notes || ''),
    })
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'error', message: (e && e.message) || String(e) })
  }
}
