import { supabase } from "./supabase";
import { arrowquipDealers } from "../data/marketData";

// The exported client is typed to the coverage-only Database schema, which does
// not include the dealer_directory table/view added by this feature's migration.
// Access those through an untyped alias to keep the query builder usable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export const DEALER_AREAS = ["East", "South", "Central", "West", "Exports"] as const;
export type DealerArea = (typeof DEALER_AREAS)[number] | "Unassigned";

export type DealerDirectoryRow = {
  id: string;
  salesforce_account_id: string;
  dealer_name: string;
  team: string | null;
  account_owner: string | null;
  territory_manager: string | null;
  dealer_success_specialist: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_country: string | null;
  status: string | null;
  area: string;
  area_override: string | null;
  effective_area: string;
  visible_in_portal: boolean;
  show_in_area_tabs: boolean;
  notes: string | null;
  sf_present: boolean;
  last_synced_at: string | null;
};

export type DealerDirectoryDataset = {
  dealers: DealerDirectoryRow[];
  source: "supabase" | "seeded";
};

/** Derive an area from seeded demo data so the UI is populated without Supabase. */
function deriveSeedArea(state: string): DealerArea {
  const east = ["OH", "PA", "NY", "VA", "WV", "KY", "TN", "GA", "NC", "SC", "FL", "MI", "IN"];
  const south = ["TX", "OK", "AR", "LA", "MS", "AL", "NM"];
  const west = ["CA", "OR", "WA", "ID", "NV", "AZ", "UT", "MT", "WY"];
  const central = ["KS", "NE", "SD", "ND", "MN", "IA", "MO", "CO", "WI", "IL"];
  const s = state.toUpperCase();
  if (east.includes(s)) return "East";
  if (south.includes(s)) return "South";
  if (west.includes(s)) return "West";
  if (central.includes(s)) return "Central";
  return "Unassigned";
}

function seededRows(): DealerDirectoryRow[] {
  return arrowquipDealers.map((d) => {
    const area = deriveSeedArea(d.state);
    return {
      id: d.id,
      salesforce_account_id: d.id,
      dealer_name: d.name,
      team: null,
      account_owner: d.territoryManager,
      territory_manager: d.territoryManager,
      dealer_success_specialist: null,
      billing_city: d.city,
      billing_state: d.state,
      billing_country: "United States",
      status: d.type,
      area,
      area_override: null,
      effective_area: area,
      visible_in_portal: true,
      show_in_area_tabs: true,
      notes: null,
      sf_present: true,
      last_synced_at: null,
    };
  });
}

/**
 * Load the Dealer Directory. Reads the org-shared `dealer_directory_effective`
 * view from Supabase; falls back to seeded demo dealers when Supabase is not
 * configured or the table is empty/unreadable.
 */
export async function loadDealerDirectory(): Promise<DealerDirectoryDataset> {
  if (!supabase) return { dealers: seededRows(), source: "seeded" };

  const { data, error } = await db
    .from("dealer_directory_effective")
    .select("*")
    .order("dealer_name", { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) console.warn("Falling back to seeded dealer directory.", error);
    return { dealers: seededRows(), source: "seeded" };
  }

  return { dealers: data as unknown as DealerDirectoryRow[], source: "supabase" };
}

/** Persist an admin edit to a dealer's local settings (requires admin session). */
export async function updateDealerSettings(
  id: string,
  patch: Partial<
    Pick<
      DealerDirectoryRow,
      "visible_in_portal" | "show_in_area_tabs" | "area_override" | "notes"
    >
  >,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db.from("dealer_directory").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Trigger the read-only Salesforce sync (admin). */
export async function syncDealersFromSalesforce(): Promise<{
  ok: boolean;
  error?: string;
  remoteCount?: number;
}> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  try {
    const resp = await fetch("/api/salesforce-dealers-sync", { method: "POST", headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) {
      return { ok: false, error: json.error || `Sync failed (${resp.status}).` };
    }
    return { ok: true, remoteCount: json.remoteCount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync request failed." };
  }
}
