/**
 * Field resolution + area mapping for the Pre-Booking Portal dealer sync.
 *
 * The exact Salesforce Account API names for Team / Territory Manager / Dealer
 * Success Specialist vary by org, so we resolve them from the object `describe`
 * rather than hard-coding names. Standard fields (Billing*, Owner) are fixed.
 */

const AREAS = ['East', 'South', 'Central', 'West', 'Exports']

/** North-American billing countries treated as domestic (everything else = Exports). */
const DOMESTIC_COUNTRIES = new Set([
  'us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america',
  'ca', 'can', 'canada',
])

/** Find the first describe field whose apiName or label matches a predicate. */
function findField(fields, test) {
  for (const f of fields) {
    if (test(String(f.name || ''), String(f.label || ''), f)) return f.name
  }
  return null
}

/**
 * Resolve the Account field API names we need from a describe payload.
 * Returns { team, territoryManager, dealerSuccessSpecialist, status } — any of
 * which may be null when the org has no such field.
 */
export function resolveAccountFields(describe) {
  const fields = Array.isArray(describe?.fields) ? describe.fields : []
  const has = (name) => fields.some((f) => f.name === name)

  const team =
    (has('Team__c') && 'Team__c') ||
    (has('Team') && 'Team') ||
    findField(fields, (n, l) => /team/i.test(n) || /team/i.test(l))

  const territoryManager =
    (has('Territory_Manager__c') && 'Territory_Manager__c') ||
    findField(fields, (n, l) => /territory.*manager/i.test(n) || /territory.*manager/i.test(l))

  const dealerSuccessSpecialist =
    (has('Dealer_Success_Specialist__c') && 'Dealer_Success_Specialist__c') ||
    findField(fields, (n, l) => /success.*specialist/i.test(n) || /success.*specialist/i.test(l) || /dealer.*success/i.test(l))

  const status =
    (has('Status') && 'Status') ||
    (has('Account_Status__c') && 'Account_Status__c') ||
    findField(fields, (n, l) => {
      const f = fields.find((x) => x.name === n)
      const t = String(f?.type || '')
      const isTextish = t === 'picklist' || t === 'string'
      return isTextish && (/(^|_)status$/i.test(n) || /status/i.test(l)) && !/date/i.test(n)
    }) ||
    (has('Type') && 'Type')

  const territory =
    (has('Territory__c') && 'Territory__c') ||
    findField(fields, (n, l) => (/^territory/i.test(n) || /^territory$/i.test(l)) && !/manager/i.test(n) && !/manager/i.test(l))

  return { team, territoryManager, dealerSuccessSpecialist, status, territory }
}

/** Match a free-text value to one of the five areas, or null. */
function matchAreaKeyword(value) {
  const v = String(value || '').toLowerCase()
  if (!v) return null
  if (/\bexport|international|overseas\b/.test(v)) return 'Exports'
  if (/\beast(ern)?\b/.test(v)) return 'East'
  if (/\bwest(ern)?\b/.test(v)) return 'West'
  if (/\bcentral\b/.test(v)) return 'Central'
  if (/\bsouth(ern)?\b/.test(v)) return 'South'
  return null
}

/**
 * Derive the area for a dealer from its Salesforce signals.
 * Priority: Team → Territory → Territory Manager text; then non-domestic
 * billing country ⇒ Exports; otherwise Unassigned.
 */
export function deriveArea({ team, territory, territoryManager, billingCountry }) {
  const fromText =
    matchAreaKeyword(team) ||
    matchAreaKeyword(territory) ||
    matchAreaKeyword(territoryManager)
  if (fromText) return fromText

  const country = String(billingCountry || '').trim().toLowerCase()
  if (country && !DOMESTIC_COUNTRIES.has(country)) return 'Exports'

  return 'Unassigned'
}

export { AREAS }
