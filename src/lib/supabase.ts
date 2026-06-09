import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  arrowquipDealers,
  competitorDealers,
  markets,
  tradeShows,
  type ArrowquipDealer,
  type CompetitorDealer,
  type Market,
  type TradeShowEvent,
} from "../data/marketData";

export type CoverageDataset = {
  arrowquipDealers: ArrowquipDealer[];
  competitorDealers: CompetitorDealer[];
  markets: Market[];
  tradeShows: TradeShowEvent[];
  source: "supabase" | "seeded";
};

type Database = {
  public: {
    Tables: {
      arrowquip_dealers: {
        Row: ArrowquipDealer;
      };
      competitor_dealers: {
        Row: CompetitorDealer;
      };
      markets: {
        Row: Market;
      };
      trade_show_events: {
        Row: TradeShowEvent;
      };
    };
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey)
    : null;

export async function loadCoverageDataset(): Promise<CoverageDataset> {
  if (!supabase) {
    return {
      arrowquipDealers,
      competitorDealers,
      markets,
      tradeShows,
      source: "seeded",
    };
  }

  const [
    arrowquipDealerResult,
    competitorDealerResult,
    marketResult,
    tradeShowResult,
  ] = await Promise.all([
    supabase.from("arrowquip_dealers").select("*"),
    supabase.from("competitor_dealers").select("*"),
    supabase.from("markets").select("*"),
    supabase.from("trade_show_events").select("*"),
  ]);

  const hasError =
    arrowquipDealerResult.error ||
    competitorDealerResult.error ||
    marketResult.error ||
    tradeShowResult.error;

  if (hasError) {
    console.warn("Falling back to seeded coverage data.", hasError);

    return {
      arrowquipDealers,
      competitorDealers,
      markets,
      tradeShows,
      source: "seeded",
    };
  }

  return {
    arrowquipDealers: arrowquipDealerResult.data ?? [],
    competitorDealers: competitorDealerResult.data ?? [],
    markets: marketResult.data ?? [],
    tradeShows: tradeShowResult.data ?? [],
    source: "supabase",
  };
}
