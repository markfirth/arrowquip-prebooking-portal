export type OpportunityClassification =
  | "Protected Market"
  | "Build Market"
  | "Open Market"
  | "Low Priority";

export type OpportunityInputs = {
  cattleDensity: number;
  competitorPresence: number;
  distanceToNearestArrowquipDealer: number;
  leadActivity: number;
  tradeShowActivity: number;
  strategicPriority: number;
};

export function calculateOpportunityScore(inputs: OpportunityInputs): number {
  return Math.round(
    inputs.cattleDensity * 0.3 +
      inputs.competitorPresence * 0.2 +
      inputs.distanceToNearestArrowquipDealer * 0.2 +
      inputs.leadActivity * 0.15 +
      inputs.tradeShowActivity * 0.1 +
      inputs.strategicPriority * 0.05,
  );
}

export function classifyOpportunity(
  score: number,
  arrowquipDealers: number,
): OpportunityClassification {
  if (arrowquipDealers > 1 && score >= 62) {
    return "Protected Market";
  }

  if (score >= 74) {
    return "Open Market";
  }

  if (score >= 52) {
    return "Build Market";
  }

  return "Low Priority";
}
