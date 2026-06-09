# Arrowquip Dealer Intelligence Platform

Internal executive planning system for Arrowquip dealer coverage, competitor coverage, cattle-market density, sales density, open-market opportunities, dealer recruitment targets, and trade show coverage.

## Stack

- React + TypeScript
- Tailwind CSS
- Mapbox GL JS
- Supabase + PostgreSQL/PostGIS
- Recharts
- Vite

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Optional environment variables:

```bash
VITE_MAPBOX_ACCESS_TOKEN=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Without credentials, the app uses a seeded planning dataset and a branded fallback map canvas. With `VITE_MAPBOX_ACCESS_TOKEN`, the Coverage Map uses Mapbox GL JS. With Supabase variables, the app queries live planning tables and falls back to seeded data if a read fails.

## Supabase schema

Review and apply `supabase/schema.sql` in a Supabase project. The schema includes:

- Arrowquip dealers
- Competitor dealers
- Markets and opportunity scoring
- Trade show events
- PostGIS geography columns and indexes
- RLS policies using `app_metadata` claims for Arrowquip organization/role checks
- Security-invoker market ranking view

Client-side code uses the current Supabase publishable-key convention:

```ts
createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
```

Do not expose Supabase secret or service-role keys in the browser.

## Strategic modules

1. Coverage Map
2. Dealer Locator
3. Dealer Directory
4. Competitor Directory
5. Market Intelligence
6. Opportunity Finder
7. Trade Shows & Events
8. Reports
9. Admin

## Opportunity score

The opportunity score follows the requested formula:

- 30% cattle density
- 20% competitor presence
- 20% distance to nearest Arrowquip dealer
- 15% lead activity
- 10% trade show activity
- 5% strategic priority

Markets are classified as Protected Market, Build Market, Open Market, or Low Priority.
