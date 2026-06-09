import {
  calculateOpportunityScore,
  classifyOpportunity,
  type OpportunityClassification,
} from "../lib/scoring";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type DealerType =
  | "Premier Dealer"
  | "Growth Dealer"
  | "Service Dealer"
  | "Inventory Partner";

export type ArrowquipDealer = Coordinates & {
  id: string;
  name: string;
  type: DealerType;
  city: string;
  state: string;
  county: string;
  revenue: number;
  registrations: number;
  inventoryValue: number;
  dealerScore: number;
  forecastAccuracy: number;
  territoryManager: string;
};

export type CompetitorBrand =
  | "Priefert"
  | "WW"
  | "Powder River"
  | "Pearson"
  | "Sioux Steel"
  | "Tarter"
  | "Hi-Hog"
  | "Real Tuff"
  | "Titan West";

export type CompetitorDealer = Coordinates & {
  id: string;
  brand: CompetitorBrand;
  name: string;
  city: string;
  state: string;
  website: string;
  distanceToNearestArrowquipDealer: number;
  opportunityScore: number;
};

export type Market = {
  id: string;
  market: string;
  state: string;
  county: string;
  center: Coordinates;
  cattleDensity: number;
  competitorDealers: number;
  arrowquipDealers: number;
  distanceToNearestArrowquipDealer: number;
  leadActivity: number;
  tradeShowActivity: number;
  strategicPriority: number;
  beefCows: number;
  feedlots: number;
  ranchDensity: number;
  auctionMarts: number;
  registrations: number;
  revenue: number;
  opportunityScore: number;
  classification: OpportunityClassification;
  recommendedAction: string;
};

export type TradeShowType =
  | "Farm Show"
  | "State Fair"
  | "Cattlemen Meeting"
  | "Feedlot Conference"
  | "Open House"
  | "Demo Day"
  | "Auction Event";

export type TradeShowEvent = Coordinates & {
  id: string;
  name: string;
  type: TradeShowType;
  city: string;
  state: string;
  date: string;
  attendance: number;
  dealerAssigned: string;
  leadsGenerated: number;
  registrationsGenerated: number;
  revenueGenerated: number;
  roi: number;
};

export type DealerRisk = {
  id: string;
  dealer: string;
  market: string;
  risk: string;
  score: number;
  recommendedAction: string;
};

export const arrowquipDealers: ArrowquipDealer[] = [
  {
    id: "aq-amarillo",
    name: "Panhandle Livestock Equipment",
    type: "Premier Dealer",
    city: "Amarillo",
    state: "TX",
    county: "Potter",
    lat: 35.2219,
    lng: -101.8313,
    revenue: 1850000,
    registrations: 342,
    inventoryValue: 620000,
    dealerScore: 91,
    forecastAccuracy: 88,
    territoryManager: "Sarah Mitchell",
  },
  {
    id: "aq-dodge-city",
    name: "High Plains Ranch Supply",
    type: "Growth Dealer",
    city: "Dodge City",
    state: "KS",
    county: "Ford",
    lat: 37.7528,
    lng: -100.0171,
    revenue: 980000,
    registrations: 184,
    inventoryValue: 310000,
    dealerScore: 76,
    forecastAccuracy: 72,
    territoryManager: "Mark Jensen",
  },
  {
    id: "aq-sioux-falls",
    name: "Dakota Cattle Systems",
    type: "Premier Dealer",
    city: "Sioux Falls",
    state: "SD",
    county: "Minnehaha",
    lat: 43.5446,
    lng: -96.7311,
    revenue: 1425000,
    registrations: 298,
    inventoryValue: 505000,
    dealerScore: 86,
    forecastAccuracy: 83,
    territoryManager: "Kelsey Brown",
  },
  {
    id: "aq-kearney",
    name: "Nebraska Working Cattle",
    type: "Inventory Partner",
    city: "Kearney",
    state: "NE",
    county: "Buffalo",
    lat: 40.6995,
    lng: -99.0817,
    revenue: 735000,
    registrations: 126,
    inventoryValue: 430000,
    dealerScore: 68,
    forecastAccuracy: 63,
    territoryManager: "Mark Jensen",
  },
  {
    id: "aq-idaho-falls",
    name: "Snake River Handling Supply",
    type: "Service Dealer",
    city: "Idaho Falls",
    state: "ID",
    county: "Bonneville",
    lat: 43.4927,
    lng: -112.0408,
    revenue: 510000,
    registrations: 94,
    inventoryValue: 185000,
    dealerScore: 61,
    forecastAccuracy: 58,
    territoryManager: "Ryan Cooper",
  },
  {
    id: "aq-red-deer",
    name: "Central Alberta Ranch Equipment",
    type: "Premier Dealer",
    city: "Red Deer",
    state: "AB",
    county: "Red Deer",
    lat: 52.2695,
    lng: -113.8112,
    revenue: 1680000,
    registrations: 321,
    inventoryValue: 590000,
    dealerScore: 89,
    forecastAccuracy: 86,
    territoryManager: "Laura McLeod",
  },
];

export const competitorDealers: CompetitorDealer[] = [
  {
    id: "cp-priefert-lubbock",
    brand: "Priefert",
    name: "Lubbock Ranch & Feed",
    city: "Lubbock",
    state: "TX",
    website: "https://example.com/priefert-lubbock",
    lat: 33.5779,
    lng: -101.8552,
    distanceToNearestArrowquipDealer: 124,
    opportunityScore: 82,
  },
  {
    id: "cp-ww-enid",
    brand: "WW",
    name: "Red Dirt Livestock Supply",
    city: "Enid",
    state: "OK",
    website: "https://example.com/ww-enid",
    lat: 36.3956,
    lng: -97.8784,
    distanceToNearestArrowquipDealer: 238,
    opportunityScore: 78,
  },
  {
    id: "cp-powder-river-billings",
    brand: "Powder River",
    name: "Big Sky Cattle Equipment",
    city: "Billings",
    state: "MT",
    website: "https://example.com/powder-river-billings",
    lat: 45.7833,
    lng: -108.5007,
    distanceToNearestArrowquipDealer: 312,
    opportunityScore: 86,
  },
  {
    id: "cp-pearson-fort-collins",
    brand: "Pearson",
    name: "Front Range Ag Supply",
    city: "Fort Collins",
    state: "CO",
    website: "https://example.com/pearson-fort-collins",
    lat: 40.5853,
    lng: -105.0844,
    distanceToNearestArrowquipDealer: 228,
    opportunityScore: 71,
  },
  {
    id: "cp-sioux-steel-fargo",
    brand: "Sioux Steel",
    name: "Red River Farm Systems",
    city: "Fargo",
    state: "ND",
    website: "https://example.com/sioux-steel-fargo",
    lat: 46.8772,
    lng: -96.7898,
    distanceToNearestArrowquipDealer: 244,
    opportunityScore: 68,
  },
  {
    id: "cp-tarter-lexington",
    brand: "Tarter",
    name: "Bluegrass Livestock Supply",
    city: "Lexington",
    state: "KY",
    website: "https://example.com/tarter-lexington",
    lat: 38.0406,
    lng: -84.5037,
    distanceToNearestArrowquipDealer: 622,
    opportunityScore: 74,
  },
  {
    id: "cp-hi-hog-saskatoon",
    brand: "Hi-Hog",
    name: "Prairie Stockyards Equipment",
    city: "Saskatoon",
    state: "SK",
    website: "https://example.com/hi-hog-saskatoon",
    lat: 52.1332,
    lng: -106.67,
    distanceToNearestArrowquipDealer: 289,
    opportunityScore: 83,
  },
  {
    id: "cp-real-tuff-grand-island",
    brand: "Real Tuff",
    name: "Central Plains Cattle Supply",
    city: "Grand Island",
    state: "NE",
    website: "https://example.com/real-tuff-grand-island",
    lat: 40.9264,
    lng: -98.342,
    distanceToNearestArrowquipDealer: 49,
    opportunityScore: 64,
  },
  {
    id: "cp-titan-west-ogallala",
    brand: "Titan West",
    name: "Ogallala Feedlot Equipment",
    city: "Ogallala",
    state: "NE",
    website: "https://example.com/titan-west-ogallala",
    lat: 41.1281,
    lng: -101.7196,
    distanceToNearestArrowquipDealer: 181,
    opportunityScore: 77,
  },
];

const marketInputs = [
  {
    id: "market-billings",
    market: "Billings Cattle Corridor",
    state: "MT",
    county: "Yellowstone",
    center: { lat: 45.7833, lng: -108.5007 },
    cattleDensity: 91,
    competitorDealers: 4,
    arrowquipDealers: 0,
    distanceToNearestArrowquipDealer: 88,
    leadActivity: 72,
    tradeShowActivity: 64,
    strategicPriority: 90,
    beefCows: 492000,
    feedlots: 18,
    ranchDensity: 87,
    auctionMarts: 9,
    registrations: 42,
    revenue: 185000,
    recommendedAction: "Recruit premier dealer and fund Billings livestock show presence.",
  },
  {
    id: "market-lubbock",
    market: "South Plains Beef Belt",
    state: "TX",
    county: "Lubbock",
    center: { lat: 33.5779, lng: -101.8552 },
    cattleDensity: 86,
    competitorDealers: 5,
    arrowquipDealers: 0,
    distanceToNearestArrowquipDealer: 74,
    leadActivity: 81,
    tradeShowActivity: 58,
    strategicPriority: 83,
    beefCows: 438000,
    feedlots: 22,
    ranchDensity: 79,
    auctionMarts: 11,
    registrations: 61,
    revenue: 275000,
    recommendedAction: "Open recruitment campaign and assign AM prospecting blitz.",
  },
  {
    id: "market-enid",
    market: "Northwest Oklahoma Stocker Market",
    state: "OK",
    county: "Garfield",
    center: { lat: 36.3956, lng: -97.8784 },
    cattleDensity: 78,
    competitorDealers: 3,
    arrowquipDealers: 0,
    distanceToNearestArrowquipDealer: 77,
    leadActivity: 67,
    tradeShowActivity: 55,
    strategicPriority: 74,
    beefCows: 332000,
    feedlots: 15,
    ranchDensity: 76,
    auctionMarts: 8,
    registrations: 34,
    revenue: 150000,
    recommendedAction: "Target WW-adjacent accounts and recruit service-first dealer.",
  },
  {
    id: "market-dodge-city",
    market: "Dodge City Feedlot Cluster",
    state: "KS",
    county: "Ford",
    center: { lat: 37.7528, lng: -100.0171 },
    cattleDensity: 94,
    competitorDealers: 2,
    arrowquipDealers: 1,
    distanceToNearestArrowquipDealer: 18,
    leadActivity: 76,
    tradeShowActivity: 70,
    strategicPriority: 76,
    beefCows: 516000,
    feedlots: 31,
    ranchDensity: 88,
    auctionMarts: 7,
    registrations: 184,
    revenue: 980000,
    recommendedAction: "Grow inventory depth and improve forecast discipline.",
  },
  {
    id: "market-grand-island",
    market: "Central Nebraska Sale Barn Network",
    state: "NE",
    county: "Hall",
    center: { lat: 40.9264, lng: -98.342 },
    cattleDensity: 82,
    competitorDealers: 3,
    arrowquipDealers: 1,
    distanceToNearestArrowquipDealer: 28,
    leadActivity: 62,
    tradeShowActivity: 73,
    strategicPriority: 68,
    beefCows: 388000,
    feedlots: 19,
    ranchDensity: 80,
    auctionMarts: 12,
    registrations: 126,
    revenue: 735000,
    recommendedAction: "Protect share with demo days and targeted AM coaching.",
  },
  {
    id: "market-lexington",
    market: "Bluegrass Cow-Calf Region",
    state: "KY",
    county: "Fayette",
    center: { lat: 38.0406, lng: -84.5037 },
    cattleDensity: 67,
    competitorDealers: 4,
    arrowquipDealers: 0,
    distanceToNearestArrowquipDealer: 95,
    leadActivity: 54,
    tradeShowActivity: 52,
    strategicPriority: 61,
    beefCows: 248000,
    feedlots: 7,
    ranchDensity: 64,
    auctionMarts: 6,
    registrations: 19,
    revenue: 83000,
    recommendedAction: "Validate demand through co-op marketing before recruitment.",
  },
  {
    id: "market-red-deer",
    market: "Central Alberta Ranch Core",
    state: "AB",
    county: "Red Deer",
    center: { lat: 52.2695, lng: -113.8112 },
    cattleDensity: 89,
    competitorDealers: 2,
    arrowquipDealers: 2,
    distanceToNearestArrowquipDealer: 12,
    leadActivity: 79,
    tradeShowActivity: 86,
    strategicPriority: 82,
    beefCows: 462000,
    feedlots: 24,
    ranchDensity: 91,
    auctionMarts: 10,
    registrations: 321,
    revenue: 1680000,
    recommendedAction: "Protected market: defend with account plans and show coverage.",
  },
  {
    id: "market-saskatoon",
    market: "Saskatoon Prairie Expansion",
    state: "SK",
    county: "Saskatoon",
    center: { lat: 52.1332, lng: -106.67 },
    cattleDensity: 84,
    competitorDealers: 3,
    arrowquipDealers: 0,
    distanceToNearestArrowquipDealer: 82,
    leadActivity: 61,
    tradeShowActivity: 79,
    strategicPriority: 88,
    beefCows: 405000,
    feedlots: 13,
    ranchDensity: 83,
    auctionMarts: 7,
    registrations: 26,
    revenue: 115000,
    recommendedAction: "Recruit Canadian dealer and prioritize cattlemen meetings.",
  },
] satisfies Array<Omit<Market, "opportunityScore" | "classification">>;

export const markets: Market[] = marketInputs.map((market) => {
  const opportunityScore = calculateOpportunityScore({
    cattleDensity: market.cattleDensity,
    competitorPresence: Math.min(market.competitorDealers * 18, 100),
    distanceToNearestArrowquipDealer: market.distanceToNearestArrowquipDealer,
    leadActivity: market.leadActivity,
    tradeShowActivity: market.tradeShowActivity,
    strategicPriority: market.strategicPriority,
  });

  return {
    ...market,
    opportunityScore,
    classification: classifyOpportunity(opportunityScore, market.arrowquipDealers),
  };
});

export const tradeShows: TradeShowEvent[] = [
  {
    id: "show-ncba",
    name: "Cattle Industry Convention",
    type: "Cattlemen Meeting",
    city: "San Antonio",
    state: "TX",
    date: "2026-02-03",
    attendance: 8200,
    dealerAssigned: "Panhandle Livestock Equipment",
    leadsGenerated: 145,
    registrationsGenerated: 38,
    revenueGenerated: 265000,
    roi: 4.8,
    lat: 29.4252,
    lng: -98.4946,
  },
  {
    id: "show-husker",
    name: "Husker Harvest Days",
    type: "Farm Show",
    city: "Grand Island",
    state: "NE",
    date: "2026-09-15",
    attendance: 56000,
    dealerAssigned: "Nebraska Working Cattle",
    leadsGenerated: 212,
    registrationsGenerated: 44,
    revenueGenerated: 318000,
    roi: 5.6,
    lat: 40.9264,
    lng: -98.342,
  },
  {
    id: "show-billings",
    name: "Northern Livestock Expo",
    type: "Farm Show",
    city: "Billings",
    state: "MT",
    date: "2026-06-21",
    attendance: 18700,
    dealerAssigned: "Unassigned",
    leadsGenerated: 96,
    registrationsGenerated: 13,
    revenueGenerated: 87000,
    roi: 2.7,
    lat: 45.7833,
    lng: -108.5007,
  },
  {
    id: "show-red-deer",
    name: "Agri-Trade Equipment Expo",
    type: "Farm Show",
    city: "Red Deer",
    state: "AB",
    date: "2026-11-11",
    attendance: 30000,
    dealerAssigned: "Central Alberta Ranch Equipment",
    leadsGenerated: 188,
    registrationsGenerated: 57,
    revenueGenerated: 422000,
    roi: 6.2,
    lat: 52.2695,
    lng: -113.8112,
  },
  {
    id: "show-oklahoma",
    name: "Northwest Oklahoma Auction Series",
    type: "Auction Event",
    city: "Enid",
    state: "OK",
    date: "2026-04-18",
    attendance: 3900,
    dealerAssigned: "Unassigned",
    leadsGenerated: 51,
    registrationsGenerated: 6,
    revenueGenerated: 41000,
    roi: 1.9,
    lat: 36.3956,
    lng: -97.8784,
  },
  {
    id: "show-saskatoon",
    name: "Prairie Beef Congress",
    type: "Cattlemen Meeting",
    city: "Saskatoon",
    state: "SK",
    date: "2026-08-07",
    attendance: 9200,
    dealerAssigned: "Unassigned",
    leadsGenerated: 83,
    registrationsGenerated: 9,
    revenueGenerated: 59000,
    roi: 2.2,
    lat: 52.1332,
    lng: -106.67,
  },
];

export const dealerRisks: DealerRisk[] = [
  {
    id: "risk-idaho",
    dealer: "Snake River Handling Supply",
    market: "Idaho Falls",
    risk: "Low inventory depth and declining registrations.",
    score: 81,
    recommendedAction: "AM visit, inventory floorplan review, and 90-day growth plan.",
  },
  {
    id: "risk-kearney",
    dealer: "Nebraska Working Cattle",
    market: "Central Nebraska",
    risk: "Forecast accuracy below network benchmark.",
    score: 72,
    recommendedAction: "Coach pipeline hygiene before Husker Harvest Days.",
  },
  {
    id: "risk-dodge",
    dealer: "High Plains Ranch Supply",
    market: "Dodge City",
    risk: "Competitors increasing feedlot account penetration.",
    score: 66,
    recommendedAction: "Fund demo day series and joint AM/dealer account calls.",
  },
];

export const recruitmentPipeline = [
  {
    market: "Billings Cattle Corridor",
    candidate: "Yellowstone Ag Equipment",
    stage: "Executive intro",
    potentialRevenue: 1250000,
  },
  {
    market: "South Plains Beef Belt",
    candidate: "Caprock Ranch Supply",
    stage: "Financial review",
    potentialRevenue: 1450000,
  },
  {
    market: "Saskatoon Prairie Expansion",
    candidate: "Prairie Iron Co-op",
    stage: "Territory fit",
    potentialRevenue: 980000,
  },
  {
    market: "Northwest Oklahoma Stocker Market",
    candidate: "Red Dirt Handling Systems",
    stage: "Prospecting",
    potentialRevenue: 720000,
  },
];

export const brandStrength = [
  { brand: "Priefert", dealers: 18, overlapMarkets: 9 },
  { brand: "WW", dealers: 12, overlapMarkets: 7 },
  { brand: "Powder River", dealers: 10, overlapMarkets: 6 },
  { brand: "Pearson", dealers: 8, overlapMarkets: 4 },
  { brand: "Sioux Steel", dealers: 7, overlapMarkets: 3 },
  { brand: "Tarter", dealers: 9, overlapMarkets: 5 },
  { brand: "Hi-Hog", dealers: 6, overlapMarkets: 4 },
  { brand: "Real Tuff", dealers: 5, overlapMarkets: 3 },
  { brand: "Titan West", dealers: 4, overlapMarkets: 2 },
];

export const monthlyRegistrations = [
  { month: "Jan", registrations: 92, revenue: 410000 },
  { month: "Feb", registrations: 108, revenue: 486000 },
  { month: "Mar", registrations: 124, revenue: 558000 },
  { month: "Apr", registrations: 117, revenue: 529000 },
  { month: "May", registrations: 136, revenue: 615000 },
  { month: "Jun", registrations: 148, revenue: 668000 },
];
