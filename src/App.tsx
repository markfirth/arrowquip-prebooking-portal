import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Crosshair,
  Flag,
  Gauge,
  Globe2,
  Layers3,
  LineChart as LineChartIcon,
  Navigation,
  ShieldCheck,
  Store,
  Target,
  Users,
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  brandStrength,
  dealerRisks,
  monthlyRegistrations,
  recruitmentPipeline,
  type CompetitorDealer,
  type Market,
  type TradeShowEvent,
} from "./data/marketData";
import { loadCoverageDataset, type CoverageDataset } from "./lib/supabase";
import {
  DEALER_AREAS,
  loadDealerDirectory,
  syncDealersFromSalesforce,
  updateDealerSettings,
  type DealerDirectoryDataset,
  type DealerDirectoryRow,
} from "./lib/dealerDirectory";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Section =
  | "dashboard"
  | "dealer-directory"
  | "dealer-intelligence"
  | "dealer-sales"
  | "travel-planner"
  | "forecast"
  | "bonus-calculator"
  | "competitive-map"
  | "reports"
  | "settings";

type LayerKey =
  | "arrowquipDealers"
  | "competitorDealers"
  | "cattleDensity"
  | "registrationDensity"
  | "opportunity"
  | "tradeShows";

type LayerState = Record<LayerKey, boolean>;

const ARROWQUIP_RED = "#c8102e";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const navItems: Array<{ id: Section; label: string; icon: Icon }> = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "dealer-directory", label: "Dealer Directory", icon: Store },
  { id: "dealer-intelligence", label: "Dealer Intelligence", icon: BrainCircuit },
  { id: "dealer-sales", label: "Dealer Sales", icon: CircleDollarSign },
  { id: "travel-planner", label: "Travel Planner", icon: Navigation },
  { id: "forecast", label: "Forecast", icon: LineChartIcon },
  { id: "bonus-calculator", label: "Bonus Calculator", icon: Flag },
  { id: "competitive-map", label: "Competitive Map", icon: Globe2 },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: ShieldCheck },
];

const layerLabels: Array<{ id: LayerKey; label: string; description: string }> = [
  {
    id: "arrowquipDealers",
    label: "Arrowquip Dealers",
    description: "Revenue, registrations, inventory, score, and AM coverage",
  },
  {
    id: "competitorDealers",
    label: "Competitor Dealers",
    description: "Priefert, WW, Powder River, Pearson, Sioux Steel, Tarter, Hi-Hog, Real Tuff, Titan West",
  },
  {
    id: "cattleDensity",
    label: "Cattle Density",
    description: "Beef cows, feedlots, ranch density, and auction marts",
  },
  {
    id: "registrationDensity",
    label: "Arrowquip Registration Density",
    description: "County registrations, revenue, and sales activity",
  },
  {
    id: "opportunity",
    label: "Opportunity Layer",
    description: "Protected, build, open, and low-priority markets",
  },
  {
    id: "tradeShows",
    label: "Trade Show Coverage",
    description: "Shows, cattlemen meetings, demos, auctions, and ROI",
  },
];

const initialLayers: LayerState = {
  arrowquipDealers: true,
  competitorDealers: true,
  cattleDensity: true,
  registrationDensity: true,
  opportunity: true,
  tradeShows: false,
};

const classificationColors = {
  "Protected Market": "bg-black text-white",
  "Build Market": "bg-red-50 text-red-700 border-red-200",
  "Open Market": "bg-red-600 text-white",
  "Low Priority": "bg-stone-100 text-stone-700 border-stone-200",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function App() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [layers, setLayers] = useState<LayerState>(initialLayers);
  const [dataset, setDataset] = useState<CoverageDataset | null>(null);

  useEffect(() => {
    let isMounted = true;

    void loadCoverageDataset().then((coverageDataset) => {
      if (isMounted) {
        setDataset(coverageDataset);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!dataset) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] text-black">
        <div className="executive-card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[#c8102e]">
            <Gauge className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
            Loading Arrowquip Intelligence
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Preparing market coverage data</h1>
        </div>
      </main>
    );
  }

  const activeItem = navItems.find((item) => item.id === activeSection) ?? navItems[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#111111]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-stone-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-stone-200 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center bg-[#c8102e] text-lg font-black text-white">
                AQ
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c8102e]">
                  Arrowquip
                </p>
                <h1 className="text-lg font-semibold leading-tight">
                  Dealer Intelligence
                </h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              Internal strategic planning for dealer coverage, competitive gaps,
              cattle density, and executive market investment.
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === activeSection;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-full items-center gap-3 border px-3 py-3 text-left text-sm font-semibold transition ${
                    isActive
                      ? "border-[#c8102e] bg-red-50 text-[#c8102e]"
                      : "border-transparent text-stone-700 hover:border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                  <span>{item.label}</span>
                  {isActive ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-stone-200 p-4">
            <div className="executive-card p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Data Source
              </p>
              <p className="mt-2 text-sm font-semibold">
                {dataset.source === "supabase" ? "Supabase live tables" : "Seeded planning dataset"}
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Connect Mapbox and Supabase env vars to move this dashboard into
                live internal planning operations.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#c8102e]">
                <ActiveIcon className="h-4 w-4" />
                Executive Planning System
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {activeItem.label}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <QuickStat
                label="Arrowquip Dealers"
                value={dataset.arrowquipDealers.length.toString()}
              />
              <QuickStat
                label="Competitor Dealers"
                value={dataset.competitorDealers.length.toString()}
              />
              <QuickStat
                label="Open Markets"
                value={dataset.markets
                  .filter((market) => market.classification === "Open Market")
                  .length.toString()}
              />
            </div>
          </div>
        </header>

        <main>
          {activeSection === "dashboard" ? (
            <Dashboard dataset={dataset} onNavigate={setActiveSection} />
          ) : null}
          {activeSection === "dealer-directory" ? <DealerDirectory /> : null}
          {activeSection === "dealer-intelligence" ? (
            <>
              <MarketIntelligence dataset={dataset} />
              <OpportunityFinder markets={dataset.markets} />
              <DealerLocator dataset={dataset} />
            </>
          ) : null}
          {activeSection === "dealer-sales" ? (
            <ComingSoon
              eyebrow="Dealer Sales"
              title="Dealer sales performance"
              description="Invoiced and registered sales by dealer. Wired to Salesforce after the read-only dealer sync is verified — Salesforce stays the source of truth."
            />
          ) : null}
          {activeSection === "travel-planner" ? <TravelPlanner /> : null}
          {activeSection === "forecast" ? (
            <ComingSoon
              eyebrow="Forecast"
              title="Pre-booking forecast"
              description="Territory and program forecast against goal. Builds on the synced dealer directory and sales data."
            />
          ) : null}
          {activeSection === "bonus-calculator" ? (
            <ComingSoon
              eyebrow="Bonus Calculator"
              title="Territory bonus calculator"
              description="Model rep and territory bonuses from registered sales and targets."
            />
          ) : null}
          {activeSection === "competitive-map" ? (
            <>
              <CoverageMapView dataset={dataset} layers={layers} setLayers={setLayers} />
              <CompetitorDirectory competitors={dataset.competitorDealers} />
            </>
          ) : null}
          {activeSection === "reports" ? (
            <>
              <ExecutiveReports dataset={dataset} />
              <TradeShows events={dataset.tradeShows} markets={dataset.markets} />
            </>
          ) : null}
          {activeSection === "settings" ? <AdminArchitecture /> : null}
        </main>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-stone-200 bg-white px-4 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function CoverageMapView({
  dataset,
  layers,
  setLayers,
}: {
  dataset: CoverageDataset;
  layers: LayerState;
  setLayers: (layers: LayerState) => void;
}) {
  const topOpenMarkets = useMemo(
    () =>
      [...dataset.markets]
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, 4),
    [dataset.markets],
  );

  return (
    <section className="grid min-h-[calc(100vh-105px)] grid-cols-1 xl:grid-cols-[1fr_420px]">
      <div className="relative min-h-[640px] border-b border-stone-200 xl:border-b-0 xl:border-r">
        <StrategicMap dataset={dataset} layers={layers} />
      </div>

      <aside className="space-y-4 bg-white p-4 sm:p-6">
        <PanelTitle
          eyebrow="Map Layers"
          title="Coverage and competitive intelligence"
          description="Toggle strategic layers for dealer coverage, cattle density, sales density, opportunities, and trade show coverage."
        />

        <div className="space-y-2">
          {layerLabels.map((layer) => (
            <label
              key={layer.id}
              className="flex cursor-pointer gap-3 border border-stone-200 bg-white p-3 transition hover:border-stone-300"
            >
              <input
                type="checkbox"
                checked={layers[layer.id]}
                onChange={() =>
                  setLayers({
                    ...layers,
                    [layer.id]: !layers[layer.id],
                  })
                }
                className="mt-1 h-4 w-4 accent-[#c8102e]"
              />
              <span>
                <span className="block text-sm font-semibold">{layer.label}</span>
                <span className="mt-1 block text-xs leading-5 text-stone-500">
                  {layer.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Users}
            label="Avg Dealer Score"
            value={`${Math.round(
              dataset.arrowquipDealers.reduce((sum, dealer) => sum + dealer.dealerScore, 0) /
                dataset.arrowquipDealers.length,
            )}`}
          />
          <MetricCard
            icon={Crosshair}
            label="Highest Opportunity"
            value={`${topOpenMarkets[0]?.opportunityScore ?? 0}`}
          />
        </div>

        <div className="executive-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Top Open Markets</h3>
            <Target className="h-4 w-4 text-[#c8102e]" />
          </div>
          <div className="mt-4 space-y-3">
            {topOpenMarkets.map((market) => (
              <div key={market.id} className="border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{market.market}</p>
                    <p className="text-xs text-stone-500">
                      {market.state} | {market.competitorDealers} competitor dealers
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-[#c8102e]">
                    {market.opportunityScore}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-600">
                  {market.recommendedAction}
                </p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

function StrategicMap({
  dataset,
  layers,
}: {
  dataset: CoverageDataset;
  layers: LayerState;
}) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<string>(
    "Select a pin or market to inspect dealer performance and opportunity context.",
  );

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-101.5, 42.5],
      zoom: 3.2,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("arrowquip-dealers", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: dataset.arrowquipDealers.map((dealer) => ({
            type: "Feature",
            properties: {
              name: dealer.name,
              summary: `${dealer.name} | ${dealer.type} | ${formatCurrency(
                dealer.revenue,
              )} revenue | ${dealer.registrations} registrations | Score ${
                dealer.dealerScore
              } | ${dealer.territoryManager}`,
            },
            geometry: {
              type: "Point",
              coordinates: [dealer.lng, dealer.lat],
            },
          })),
        },
      });

      map.addSource("competitor-dealers", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: dataset.competitorDealers.map((dealer) => ({
            type: "Feature",
            properties: {
              name: dealer.name,
              summary: `${dealer.brand} | ${dealer.name} | ${dealer.city}, ${
                dealer.state
              } | ${dealer.distanceToNearestArrowquipDealer} miles to nearest Arrowquip`,
            },
            geometry: {
              type: "Point",
              coordinates: [dealer.lng, dealer.lat],
            },
          })),
        },
      });

      map.addSource("markets", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: dataset.markets.map((market) => ({
            type: "Feature",
            properties: {
              name: market.market,
              cattleDensity: market.cattleDensity,
              registrations: market.registrations,
              opportunityScore: market.opportunityScore,
              summary: `${market.market} | ${market.classification} | Score ${market.opportunityScore} | Beef cows ${formatNumber(
                market.beefCows,
              )}`,
            },
            geometry: {
              type: "Point",
              coordinates: [market.center.lng, market.center.lat],
            },
          })),
        },
      });

      map.addSource("trade-shows", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: dataset.tradeShows.map((event) => ({
            type: "Feature",
            properties: {
              name: event.name,
              summary: `${event.type} | ${event.name} | ${event.date} | ${event.leadsGenerated} leads | ROI ${event.roi}x`,
            },
            geometry: {
              type: "Point",
              coordinates: [event.lng, event.lat],
            },
          })),
        },
      });

      map.addLayer({
        id: "cattle-density-heat",
        type: "heatmap",
        source: "markets",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "cattleDensity"], 0, 0, 100, 1],
          "heatmap-intensity": 0.9,
          "heatmap-radius": 52,
          "heatmap-opacity": 0.68,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(255,255,255,0)",
            0.35,
            "#fee2e2",
            0.7,
            "#f87171",
            1,
            ARROWQUIP_RED,
          ],
        },
      });

      map.addLayer({
        id: "registration-density",
        type: "circle",
        source: "markets",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "registrations"], 0, 6, 340, 38],
          "circle-color": "rgba(17,17,17,0.12)",
          "circle-stroke-color": "#111111",
          "circle-stroke-width": 1,
        },
      });

      map.addLayer({
        id: "opportunity-markets",
        type: "circle",
        source: "markets",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "opportunityScore"],
            40,
            12,
            90,
            34,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "opportunityScore"],
            40,
            "#e7e5e4",
            65,
            "#fca5a5",
            90,
            ARROWQUIP_RED,
          ],
          "circle-opacity": 0.56,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "arrowquip-dealer-pins",
        type: "circle",
        source: "arrowquip-dealers",
        paint: {
          "circle-radius": 8,
          "circle-color": ARROWQUIP_RED,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "competitor-dealer-pins",
        type: "circle",
        source: "competitor-dealers",
        paint: {
          "circle-radius": 7,
          "circle-color": "#111111",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "trade-show-pins",
        type: "circle",
        source: "trade-shows",
        paint: {
          "circle-radius": 7,
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
        layout: {
          visibility: "none",
        },
      });

      [
        "arrowquip-dealer-pins",
        "competitor-dealer-pins",
        "opportunity-markets",
        "trade-show-pins",
      ].forEach((layerId) => {
        map.on("click", layerId, (event) => {
          const feature = event.features?.[0];
          const summary = feature?.properties?.summary;

          if (typeof summary === "string") {
            setSelectedSummary(summary);
          }
        });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [dataset]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const visibilityByLayer: Array<{ layerId: string; visible: boolean }> = [
      { layerId: "arrowquip-dealer-pins", visible: layers.arrowquipDealers },
      { layerId: "competitor-dealer-pins", visible: layers.competitorDealers },
      { layerId: "cattle-density-heat", visible: layers.cattleDensity },
      { layerId: "registration-density", visible: layers.registrationDensity },
      { layerId: "opportunity-markets", visible: layers.opportunity },
      { layerId: "trade-show-pins", visible: layers.tradeShows },
    ];

    visibilityByLayer.forEach(({ layerId, visible }) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    });
  }, [layers]);

  return (
    <div className="relative h-full min-h-[640px] overflow-hidden bg-white">
      {MAPBOX_TOKEN ? (
        <div ref={mapContainer} className="absolute inset-0" />
      ) : (
        <FallbackMap dataset={dataset} layers={layers} onSelect={setSelectedSummary} />
      )}

      <div className="absolute left-4 top-4 max-w-md border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-red-50 text-[#c8102e]">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Coverage Map
            </p>
            <h3 className="text-lg font-semibold">Dealer coverage and competitive gaps</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">{selectedSummary}</p>
          </div>
        </div>
      </div>

      {!MAPBOX_TOKEN ? (
        <div className="absolute bottom-4 left-4 max-w-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
          Create a public Mapbox access token in the Mapbox dashboard, then add it
          as <strong>VITE_MAPBOX_ACCESS_TOKEN</strong> in <strong>.env.local</strong>{" "}
          and restart the dev server. The planning canvas below preserves the same
          layer model for local review until that token is available.
        </div>
      ) : null}
    </div>
  );
}

function FallbackMap({
  dataset,
  layers,
  onSelect,
}: {
  dataset: CoverageDataset;
  layers: LayerState;
  onSelect: (summary: string) => void;
}) {
  const project = (coords: { lat: number; lng: number }) => ({
    x: Math.min(Math.max(((coords.lng + 125) / 55) * 100, 4), 96),
    y: Math.min(Math.max(((56 - coords.lat) / 31) * 100, 5), 95),
  });

  return (
    <div className="arrowquip-gradient absolute inset-0">
      <div className="absolute inset-6 border border-stone-200 bg-white/60">
        <div className="absolute left-[9%] top-[22%] h-[52%] w-[72%] border border-stone-300 bg-white/40" />
        <div className="absolute left-[20%] top-[34%] h-[36%] w-[48%] border border-stone-200 bg-white/50" />
        <div className="absolute bottom-5 right-5 grid grid-cols-2 gap-2 border border-stone-200 bg-white p-3 text-xs">
          <LegendDot color="#c8102e" label="Arrowquip" />
          <LegendDot color="#111111" label="Competitor" />
          <LegendDot color="#fca5a5" label="Cattle density" />
          <LegendDot color="#f59e0b" label="Trade show" />
        </div>
      </div>

      {layers.cattleDensity
        ? dataset.markets.map((market) => {
            const point = project(market.center);
            const size = 72 + market.cattleDensity * 1.4;

            return (
              <button
                key={`density-${market.id}`}
                type="button"
                onClick={() =>
                  onSelect(
                    `${market.market} | ${market.classification} | Beef cows ${formatNumber(
                      market.beefCows,
                    )} | Opportunity ${market.opportunityScore}`,
                  )
                }
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8102e]/20 blur-[1px]"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  width: size,
                  height: size,
                }}
                aria-label={market.market}
              />
            );
          })
        : null}

      {layers.opportunity
        ? dataset.markets.map((market) => {
            const point = project(market.center);

            return (
              <button
                key={`opportunity-${market.id}`}
                type="button"
                onClick={() =>
                  onSelect(
                    `${market.market} | ${market.classification} | Score ${market.opportunityScore} | ${market.recommendedAction}`,
                  )
                }
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#c8102e]/70 text-[10px] font-bold text-white shadow-sm"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  width: 26 + market.opportunityScore / 2,
                  height: 26 + market.opportunityScore / 2,
                }}
                aria-label={market.market}
              >
                {market.opportunityScore}
              </button>
            );
          })
        : null}

      {layers.arrowquipDealers
        ? dataset.arrowquipDealers.map((dealer) => {
            const point = project(dealer);

            return (
              <button
                key={dealer.id}
                type="button"
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 border-2 border-white bg-[#c8102e] shadow-sm"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onClick={() =>
                  onSelect(
                    `${dealer.name} | ${dealer.type} | ${formatCurrency(
                      dealer.revenue,
                    )} revenue | ${dealer.registrations} registrations | Score ${
                      dealer.dealerScore
                    } | ${dealer.territoryManager}`,
                  )
                }
                aria-label={dealer.name}
              />
            );
          })
        : null}

      {layers.competitorDealers
        ? dataset.competitorDealers.map((dealer) => {
            const point = project(dealer);

            return (
              <button
                key={dealer.id}
                type="button"
                className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black shadow-sm"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onClick={() =>
                  onSelect(
                    `${dealer.brand} | ${dealer.name} | ${dealer.city}, ${dealer.state} | ${dealer.distanceToNearestArrowquipDealer} miles to nearest Arrowquip`,
                  )
                }
                aria-label={dealer.name}
              />
            );
          })
        : null}

      {layers.tradeShows
        ? dataset.tradeShows.map((event) => {
            const point = project(event);

            return (
              <button
                key={event.id}
                type="button"
                className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-sm"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onClick={() =>
                  onSelect(
                    `${event.type} | ${event.name} | ${event.date} | ${event.leadsGenerated} leads | ROI ${event.roi}x`,
                  )
                }
                aria-label={event.name}
              >
                <Flag className="h-3 w-3" />
              </button>
            );
          })
        : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium text-stone-600">{label}</span>
    </div>
  );
}

function DealerLocator({ dataset }: { dataset: CoverageDataset }) {
  const [query, setQuery] = useState("Billings");
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const market =
      dataset.markets.find((item) =>
        [item.market, item.state, item.county].some((value) =>
          value.toLowerCase().includes(normalized),
        ),
      ) ?? dataset.markets[0];

    const nearestArrowquip = nearestByCoordinate(market.center, dataset.arrowquipDealers);
    const nearestCompetitor = nearestByCoordinate(market.center, dataset.competitorDealers);

    return { market, nearestArrowquip, nearestCompetitor };
  }, [dataset, query]);

  return (
    <PageShell
      eyebrow="Dealer Locator"
      title="Nearest coverage by city, state, county, or postal market"
      description="Search a market to compare nearest Arrowquip coverage, competitor pressure, cattle density, opportunity score, and recommended action."
    >
      <div className="executive-card p-4">
        <label className="text-sm font-semibold" htmlFor="dealer-search">
          Market search
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="dealer-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="City, state, county, postal code"
            className="min-h-12 flex-1 border border-stone-300 bg-white px-4 text-base outline-none focus:border-[#c8102e]"
          />
          <button className="min-h-12 bg-[#c8102e] px-6 font-semibold text-white">
            Locate market
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <InsightCard
          icon={Store}
          label="Nearest Arrowquip Dealer"
          title={matches.nearestArrowquip.name}
          value={`${Math.round(
            distanceMiles(matches.market.center, matches.nearestArrowquip),
          )} miles`}
          description={`${matches.nearestArrowquip.city}, ${matches.nearestArrowquip.state} | Score ${matches.nearestArrowquip.dealerScore} | ${matches.nearestArrowquip.territoryManager}`}
        />
        <InsightCard
          icon={Building2}
          label="Nearest Competitor Dealer"
          title={matches.nearestCompetitor.name}
          value={`${Math.round(
            distanceMiles(matches.market.center, matches.nearestCompetitor),
          )} miles`}
          description={`${matches.nearestCompetitor.brand} | ${matches.nearestCompetitor.city}, ${matches.nearestCompetitor.state}`}
        />
        <InsightCard
          icon={Target}
          label="Opportunity Score"
          title={matches.market.classification}
          value={matches.market.opportunityScore.toString()}
          description={matches.market.recommendedAction}
        />
      </div>

      <div className="executive-card overflow-hidden">
        <TableHeader title="Market context" />
        <div className="grid gap-px bg-stone-200 md:grid-cols-4">
          <DataTile label="Cattle Density" value={`${matches.market.cattleDensity}/100`} />
          <DataTile label="Beef Cows" value={formatNumber(matches.market.beefCows)} />
          <DataTile label="Feedlots" value={formatNumber(matches.market.feedlots)} />
          <DataTile label="Auction Marts" value={formatNumber(matches.market.auctionMarts)} />
        </div>
      </div>
    </PageShell>
  );
}

function Dashboard({
  dataset,
  onNavigate,
}: {
  dataset: CoverageDataset;
  onNavigate: (section: Section) => void;
}) {
  const dealerCount = dataset.arrowquipDealers.length;
  const totalRevenue = dataset.arrowquipDealers.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const totalRegistrations = dataset.arrowquipDealers.reduce((sum, d) => sum + (d.registrations || 0), 0);
  const competitorCount = dataset.competitorDealers.length;

  const tiles: Array<{ label: string; value: string; section: Section }> = [
    { label: "Arrowquip Dealers", value: formatNumber(dealerCount), section: "dealer-directory" },
    { label: "Total Revenue", value: formatCurrency(totalRevenue), section: "reports" },
    { label: "Registrations", value: formatNumber(totalRegistrations), section: "dealer-intelligence" },
    { label: "Competitor Dealers", value: formatNumber(competitorCount), section: "competitive-map" },
  ];

  const quickLinks: Array<{ label: string; section: Section }> = [
    { label: "Open Dealer Directory", section: "dealer-directory" },
    { label: "Dealer Intelligence", section: "dealer-intelligence" },
    { label: "Travel Planner", section: "travel-planner" },
    { label: "Competitive Map", section: "competitive-map" },
    { label: "Reports", section: "reports" },
  ];

  return (
    <PageShell
      eyebrow="Dashboard"
      title="Arrowquip Pre-Booking Portal"
      description="One workspace for dealer coverage, intelligence, sales, and pre-booking travel planning."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => onNavigate(t.section)}
            className="executive-card p-4 text-left transition hover:border-[#c8102e]"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">{t.label}</p>
            <p className="mt-2 text-2xl font-semibold text-stone-900">{t.value}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {quickLinks.map((q) => (
          <button
            key={q.section}
            type="button"
            onClick={() => onNavigate(q.section)}
            className="border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 transition hover:border-stone-400"
          >
            {q.label}
          </button>
        ))}
      </div>
    </PageShell>
  );
}

function TravelPlanner() {
  return (
    <section className="space-y-3 p-4 sm:p-6">
      <PanelTitle
        eyebrow="Travel Planner"
        title="2027 Pre-Booking Travel Planner"
        description="The full pre-booking travel planner, embedded unchanged."
      />
      <div className="executive-card overflow-hidden p-0">
        <iframe
          src="/travel-planner.html"
          title="Arrowquip Pre-Booking Travel Planner"
          className="block w-full"
          style={{ height: "calc(100vh - 180px)", minHeight: "640px", border: "0" }}
        />
      </div>
    </section>
  );
}

function ComingSoon({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <PageShell eyebrow={eyebrow} title={title} description={description}>
      <div className="executive-card p-8 text-center text-sm text-stone-500">
        This module is being wired up. The dealer directory and Salesforce sync it depends on are
        already in place.
      </div>
    </PageShell>
  );
}

const DIRECTORY_TABS = ["Master", ...DEALER_AREAS] as const;
type DirectoryTab = (typeof DIRECTORY_TABS)[number];
const AREA_OVERRIDE_OPTIONS = ["", ...DEALER_AREAS, "Unassigned"] as const;

function formatSynced(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function DealerDirectory() {
  const [dataset, setDataset] = useState<DealerDirectoryDataset>({ dealers: [], source: "seeded" });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DirectoryTab>("Master");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    const next = await loadDealerDirectory();
    setDataset(next);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runSync = async () => {
    setSyncing(true);
    setMessage("Syncing dealers from Salesforce…");
    const result = await syncDealersFromSalesforce();
    if (result.ok) {
      setMessage(`Synced ${result.remoteCount ?? 0} dealers from Salesforce.`);
      await refresh();
    } else {
      setMessage(result.error || "Sync failed.");
    }
    setSyncing(false);
  };

  // Local-first edit: update UI immediately, then persist to Supabase.
  const patchDealer = (id: string, patch: Partial<DealerDirectoryRow>) => {
    setDataset((prev) => ({
      ...prev,
      dealers: prev.dealers.map((d) => {
        if (d.id !== id) return d;
        const merged = { ...d, ...patch };
        if ("area_override" in patch) {
          merged.effective_area = (patch.area_override && patch.area_override.trim()) || d.area;
        }
        return merged;
      }),
    }));
    void updateDealerSettings(id, patch).then((res) => {
      if (!res.ok) {
        setMessage(
          dataset.source === "seeded"
            ? "Showing seeded data — connect Supabase and sign in as an admin to save edits."
            : res.error || "Could not save edit.",
        );
      }
    });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { Master: dataset.dealers.length };
    for (const area of DEALER_AREAS) {
      c[area] = dataset.dealers.filter(
        (d) => d.effective_area === area && d.visible_in_portal && d.show_in_area_tabs,
      ).length;
    }
    return c;
  }, [dataset]);

  return (
    <PageShell
      eyebrow="Dealer Directory"
      title="Salesforce dealer sync — Master Sheet & area coverage"
      description="Every dealer from every area, synced read-only from Salesforce. The Master Sheet is editable; area tabs are filtered views. Manual planner data is preserved across syncs."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {DIRECTORY_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                tab === t
                  ? "border-[#c8102e] bg-[#c8102e] text-white"
                  : "border-stone-300 bg-white text-stone-600 hover:border-stone-400"
              }`}
            >
              {t === "Master" ? "Master Sheet" : t}
              <span className="ml-2 opacity-70">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
              dataset.source === "supabase"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {dataset.source === "supabase" ? "Live" : "Seeded"}
          </span>
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={syncing}
            className="border border-stone-900 bg-stone-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-black disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync from Salesforce"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">{message}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-stone-500">Loading dealers…</p>
      ) : tab === "Master" ? (
        <MasterSheet dealers={dataset.dealers} onPatch={patchDealer} />
      ) : (
        <AreaView area={tab} dealers={dataset.dealers} />
      )}
    </PageShell>
  );
}

function MasterSheet({
  dealers,
  onPatch,
}: {
  dealers: DealerDirectoryRow[];
  onPatch: (id: string, patch: Partial<DealerDirectoryRow>) => void;
}) {
  return (
    <div className="executive-card overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-[0.14em] text-stone-500">
          <tr>
            <Th>Dealer</Th>
            <Th>Area (effective)</Th>
            <Th>Area override</Th>
            <Th>Account Owner</Th>
            <Th>Territory Manager</Th>
            <Th>Dealer Success</Th>
            <Th>Billing</Th>
            <Th>Status</Th>
            <Th>Visible</Th>
            <Th>Area tabs</Th>
            <Th>Last synced</Th>
          </tr>
        </thead>
        <tbody>
          {dealers.map((d) => (
            <tr key={d.id} className="border-t border-stone-200">
              <Td>
                <p className="font-semibold">{d.dealer_name || "—"}</p>
                <p className="text-[11px] text-stone-400">{d.salesforce_account_id}</p>
                {!d.sf_present ? (
                  <span className="mt-1 inline-block border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] uppercase text-amber-700">
                    Missing in Salesforce
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="inline-flex border border-stone-300 bg-white px-2 py-1 text-xs font-semibold">
                  {d.effective_area}
                </span>
              </Td>
              <Td>
                <select
                  value={d.area_override ?? ""}
                  onChange={(e) => onPatch(d.id, { area_override: e.target.value || null })}
                  className="border border-stone-300 bg-white px-2 py-1 text-xs"
                >
                  {AREA_OVERRIDE_OPTIONS.map((opt) => (
                    <option key={opt || "sf"} value={opt}>
                      {opt === "" ? "From Salesforce" : opt}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>{d.account_owner || "—"}</Td>
              <Td>{d.territory_manager || "—"}</Td>
              <Td>{d.dealer_success_specialist || "—"}</Td>
              <Td>
                {[d.billing_city, d.billing_state].filter(Boolean).join(", ") || "—"}
                {d.billing_country ? (
                  <p className="text-[11px] text-stone-400">{d.billing_country}</p>
                ) : null}
              </Td>
              <Td>{d.status || "—"}</Td>
              <Td>
                <input
                  type="checkbox"
                  checked={d.visible_in_portal}
                  onChange={(e) => onPatch(d.id, { visible_in_portal: e.target.checked })}
                />
              </Td>
              <Td>
                <input
                  type="checkbox"
                  checked={d.show_in_area_tabs}
                  onChange={(e) => onPatch(d.id, { show_in_area_tabs: e.target.checked })}
                />
              </Td>
              <Td className="text-[11px] text-stone-500">{formatSynced(d.last_synced_at)}</Td>
            </tr>
          ))}
          {dealers.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-6 text-center text-sm text-stone-500">
                No dealers yet. Click “Sync from Salesforce”.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AreaView({ area, dealers }: { area: string; dealers: DealerDirectoryRow[] }) {
  const rows = dealers.filter(
    (d) => d.effective_area === area && d.visible_in_portal && d.show_in_area_tabs,
  );
  return (
    <div className="executive-card overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-[0.14em] text-stone-500">
          <tr>
            <Th>Dealer</Th>
            <Th>Account Owner</Th>
            <Th>Territory Manager</Th>
            <Th>Dealer Success</Th>
            <Th>Billing</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-stone-200">
              <Td>
                <p className="font-semibold">{d.dealer_name || "—"}</p>
                <p className="text-[11px] text-stone-400">{d.salesforce_account_id}</p>
              </Td>
              <Td>{d.account_owner || "—"}</Td>
              <Td>{d.territory_manager || "—"}</Td>
              <Td>{d.dealer_success_specialist || "—"}</Td>
              <Td>{[d.billing_city, d.billing_state].filter(Boolean).join(", ") || "—"}</Td>
              <Td>{d.status || "—"}</Td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-stone-500">
                No {area} dealers are visible. Assign dealers to {area} on the Master Sheet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function CompetitorDirectory({ competitors }: { competitors: CompetitorDealer[] }) {
  return (
    <PageShell
      eyebrow="Competitor Directory"
      title="Competitive dealer footprint by brand"
      description="Brand, dealer, location, website, distance to nearest Arrowquip dealer, and opportunity signal."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="executive-card overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-[0.14em] text-stone-500">
              <tr>
                <Th>Brand</Th>
                <Th>Dealer Name</Th>
                <Th>Location</Th>
                <Th>Website</Th>
                <Th>Distance to Arrowquip</Th>
                <Th>Opportunity Score</Th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((dealer) => (
                <tr key={dealer.id} className="border-t border-stone-200">
                  <Td>
                    <span className="border border-stone-300 px-2 py-1 text-xs font-bold uppercase tracking-[0.12em]">
                      {dealer.brand}
                    </span>
                  </Td>
                  <Td>{dealer.name}</Td>
                  <Td>{`${dealer.city}, ${dealer.state}`}</Td>
                  <Td>
                    <a className="text-[#c8102e] underline-offset-4 hover:underline" href={dealer.website}>
                      Dealer site
                    </a>
                  </Td>
                  <Td>{dealer.distanceToNearestArrowquipDealer} miles</Td>
                  <Td>
                    <ScoreBadge score={dealer.opportunityScore} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ChartCard title="Competitor strongholds">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={brandStrength} layout="vertical" margin={{ left: 10, right: 18 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="brand" type="category" width={88} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="dealers" fill={ARROWQUIP_RED} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </PageShell>
  );
}

function MarketIntelligence({ dataset }: { dataset: CoverageDataset }) {
  const totalRegistrations = dataset.arrowquipDealers.reduce(
    (sum, dealer) => sum + dealer.registrations,
    0,
  );
  const averageDealerScore = Math.round(
    dataset.arrowquipDealers.reduce((sum, dealer) => sum + dealer.dealerScore, 0) /
      dataset.arrowquipDealers.length,
  );
  const averageForecastAccuracy = Math.round(
    dataset.arrowquipDealers.reduce((sum, dealer) => sum + dealer.forecastAccuracy, 0) /
      dataset.arrowquipDealers.length,
  );
  const topGrowthMarkets = [...dataset.markets]
    .sort((a, b) => b.registrations - a.registrations)
    .slice(0, 5);
  const highestRiskMarkets = [...dataset.markets]
    .sort((a, b) => b.competitorDealers - a.competitorDealers)
    .slice(0, 5);

  return (
    <PageShell
      eyebrow="Market Intelligence Dashboard"
      title="Network, registration, market, and competitive performance"
      description="Executive KPIs for total coverage, market activity, forecast accuracy, and growth/risk ranking."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Store} label="Total Arrowquip Dealers" value={dataset.arrowquipDealers.length.toString()} />
        <MetricCard icon={Building2} label="Total Competitor Dealers" value={dataset.competitorDealers.length.toString()} />
        <MetricCard
          icon={Target}
          label="Total Open Markets"
          value={dataset.markets.filter((market) => market.classification === "Open Market").length.toString()}
        />
        <MetricCard icon={Gauge} label="Average Dealer Score" value={averageDealerScore.toString()} />
        <MetricCard icon={Navigation} label="Avg Forecast Accuracy" value={`${averageForecastAccuracy}%`} />
        <MetricCard icon={Globe2} label="Total Cattle Markets" value={dataset.markets.length.toString()} />
        <MetricCard icon={Flag} label="Total Registrations" value={formatNumber(totalRegistrations)} />
        <MetricCard
          icon={CircleDollarSign}
          label="Tracked Revenue"
          value={formatCurrency(
            dataset.arrowquipDealers.reduce((sum, dealer) => sum + dealer.revenue, 0),
          )}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Registrations and revenue trend">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyRegistrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value, name) => (name === "revenue" ? formatCurrency(Number(value)) : value)} />
              <Line type="monotone" dataKey="registrations" stroke="#111111" strokeWidth={2} />
              <Line type="monotone" dataKey="revenue" stroke={ARROWQUIP_RED} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Market classification mix">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={classificationSummary(dataset.markets)}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                label
              >
                {classificationSummary(dataset.markets).map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={["#c8102e", "#111111", "#fca5a5", "#d6d3d1"][index]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankingList title="Top Growth Markets" markets={topGrowthMarkets} metric="registrations" />
        <RankingList title="Highest Risk Markets" markets={highestRiskMarkets} metric="competitorDealers" />
      </div>
    </PageShell>
  );
}

function OpportunityFinder({ markets }: { markets: Market[] }) {
  const rankedMarkets = useMemo(
    () => [...markets].sort((a, b) => b.opportunityScore - a.opportunityScore),
    [markets],
  );

  return (
    <PageShell
      eyebrow="Opportunity Finder"
      title="Ranked markets by recruitment and investment priority"
      description="Markets sorted by highest opportunity first using cattle density, competitor presence, distance to Arrowquip coverage, leads, trade show activity, and strategic priority."
    >
      <div className="executive-card overflow-x-auto">
        <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-[0.14em] text-stone-500">
            <tr>
              <Th>Market</Th>
              <Th>State</Th>
              <Th>Cattle Density</Th>
              <Th>Competitor Dealers</Th>
              <Th>Arrowquip Dealers</Th>
              <Th>Opportunity Score</Th>
              <Th>Recommended Action</Th>
            </tr>
          </thead>
          <tbody>
            {rankedMarkets.map((market) => (
              <tr key={market.id} className="border-t border-stone-200">
                <Td>
                  <p className="font-semibold">{market.market}</p>
                  <ClassificationBadge classification={market.classification} />
                </Td>
                <Td>{market.state}</Td>
                <Td>{market.cattleDensity}/100</Td>
                <Td>{market.competitorDealers}</Td>
                <Td>{market.arrowquipDealers}</Td>
                <Td>
                  <ScoreBadge score={market.opportunityScore} />
                </Td>
                <Td>{market.recommendedAction}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function TradeShows({ events, markets }: { events: TradeShowEvent[]; markets: Market[] }) {
  const unassignedEvents = events.filter((event) => event.dealerAssigned === "Unassigned");

  return (
    <PageShell
      eyebrow="Trade Shows & Events"
      title="Event coverage, lead generation, revenue impact, and ROI"
      description="Plan coverage for farm shows, state fairs, cattlemen meetings, feedlot conferences, open houses, demo days, and auction events."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={CalendarDays} label="Tracked Events" value={events.length.toString()} />
        <MetricCard
          icon={Users}
          label="Leads Generated"
          value={formatNumber(events.reduce((sum, event) => sum + event.leadsGenerated, 0))}
        />
        <MetricCard
          icon={Flag}
          label="Registrations"
          value={formatNumber(events.reduce((sum, event) => sum + event.registrationsGenerated, 0))}
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Revenue Generated"
          value={formatCurrency(events.reduce((sum, event) => sum + event.revenueGenerated, 0))}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="executive-card overflow-x-auto">
          <TableHeader title="Event performance" />
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-[0.14em] text-stone-500">
              <tr>
                <Th>Event</Th>
                <Th>Type</Th>
                <Th>Date</Th>
                <Th>Attendance</Th>
                <Th>Dealer Assigned</Th>
                <Th>Leads</Th>
                <Th>Registrations</Th>
                <Th>Revenue</Th>
                <Th>ROI</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-stone-200">
                  <Td>
                    <p className="font-semibold">{event.name}</p>
                    <p className="text-xs text-stone-500">{`${event.city}, ${event.state}`}</p>
                  </Td>
                  <Td>{event.type}</Td>
                  <Td>{event.date}</Td>
                  <Td>{formatNumber(event.attendance)}</Td>
                  <Td>{event.dealerAssigned}</Td>
                  <Td>{event.leadsGenerated}</Td>
                  <Td>{event.registrationsGenerated}</Td>
                  <Td>{formatCurrency(event.revenueGenerated)}</Td>
                  <Td>{event.roi}x</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <ChartCard title="ROI by event">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={events}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="state" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="roi" fill={ARROWQUIP_RED} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="executive-card p-4">
            <h3 className="font-semibold">Coverage gaps</h3>
            <div className="mt-4 space-y-3">
              {unassignedEvents.map((event) => {
                const market = markets.find((item) => item.state === event.state);

                return (
                  <div key={event.id} className="border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
                    <p className="text-sm font-semibold">{event.name}</p>
                    <p className="text-xs leading-5 text-stone-600">
                      {event.city}, {event.state} | {event.leadsGenerated} leads |{" "}
                      {market ? `Market opportunity ${market.opportunityScore}` : "Market validation required"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function ExecutiveReports({ dataset }: { dataset: CoverageDataset }) {
  const topOpenMarkets = [...dataset.markets]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 20);
  const topCompetitorStrongholds = [...dataset.competitorDealers]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 20);

  return (
    <PageShell
      eyebrow="Executive Dashboard"
      title="CCO and leadership strategic planning report"
      description="Open markets, dealer risks, competitor strongholds, coverage gaps, recruitment pipeline, and network health."
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard icon={Gauge} label="Network Health Score" value="78" />
        <MetricCard icon={Target} label="Dealer Coverage Gaps" value="6" />
        <MetricCard icon={AlertTriangle} label="Top Dealer Risks" value={dealerRisks.length.toString()} />
        <MetricCard icon={BrainCircuit} label="AI Models Planned" value="5" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ExecutiveList
          title="Top 20 Open Markets"
          items={topOpenMarkets.map((market) => ({
            label: market.market,
            value: market.opportunityScore.toString(),
            detail: market.recommendedAction,
          }))}
        />
        <ExecutiveList
          title="Top 20 Dealer Risks"
          items={dealerRisks.map((risk) => ({
            label: risk.dealer,
            value: risk.score.toString(),
            detail: `${risk.market}: ${risk.recommendedAction}`,
          }))}
        />
        <ExecutiveList
          title="Top Competitor Strongholds"
          items={topCompetitorStrongholds.map((dealer) => ({
            label: `${dealer.brand} - ${dealer.city}, ${dealer.state}`,
            value: dealer.opportunityScore.toString(),
            detail: `${dealer.name}; ${dealer.distanceToNearestArrowquipDealer} miles from nearest Arrowquip dealer.`,
          }))}
        />
        <ExecutiveList
          title="Recruitment Pipeline"
          items={recruitmentPipeline.map((pipeline) => ({
            label: pipeline.market,
            value: formatCurrency(pipeline.potentialRevenue),
            detail: `${pipeline.candidate} | ${pipeline.stage}`,
          }))}
        />
      </div>
    </PageShell>
  );
}

function AdminArchitecture() {
  const aiFeatures = [
    "AI Dealer Recruitment Recommendations",
    "AI Market Scoring",
    "AI Territory Planning",
    "AI Travel Route Planning",
    "AI Trade Show Recommendations",
    "AI Dealer Growth Suggestions",
  ];

  return (
    <PageShell
      eyebrow="Admin"
      title="Platform architecture and future AI readiness"
      description="Operational configuration surface for Supabase, Mapbox layers, security, scoring weights, and future AI planning features."
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <ArchitectureCard
          title="Data Platform"
          icon={ShieldCheck}
          items={[
            "Supabase PostgreSQL schema included in /supabase/schema.sql",
            "RLS policies scoped to authenticated Arrowquip users",
            "PostGIS-ready geometry columns for future international expansion",
            "Seeded fallback keeps UI reviewable without live credentials",
          ]}
        />
        <ArchitectureCard
          title="Map Operations"
          icon={Layers3}
          items={[
            "Mapbox GL JS layer registry for dealer, competitor, density, and event layers",
            "Layer toggles mirror the executive planning workflow",
            "Designed for thousands of points through GeoJSON source separation",
            "County-level density model can evolve into tilesets as data grows",
          ]}
        />
        <ArchitectureCard
          title="AI Planning Roadmap"
          icon={BrainCircuit}
          items={aiFeatures}
        />
      </div>

      <div className="executive-card p-5">
        <h3 className="text-lg font-semibold">Strategic scoring controls</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          {[
            ["Cattle density", "30%"],
            ["Competitor presence", "20%"],
            ["Distance to AQ dealer", "20%"],
            ["Lead activity", "15%"],
            ["Trade show activity", "10%"],
            ["Strategic priority", "5%"],
          ].map(([label, value]) => (
            <div key={label} className="border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#c8102e]">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <PanelTitle eyebrow={eyebrow} title={title} description={description} />
      {children}
    </section>
  );
}

function PanelTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c8102e]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

function MetricCard({
  icon: IconComponent,
  label,
  value,
}: {
  icon: Icon;
  label: string;
  value: string;
}) {
  return (
    <div className="executive-card p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
          {label}
        </p>
        <IconComponent className="h-4 w-4 text-[#c8102e]" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function InsightCard({
  icon: IconComponent,
  label,
  title,
  value,
  description,
}: {
  icon: Icon;
  label: string;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="executive-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center bg-red-50 text-[#c8102e]">
          <IconComponent className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
            {label}
          </p>
          <h3 className="font-semibold">{title}</h3>
        </div>
      </div>
      <p className="mt-5 text-4xl font-semibold tracking-tight">{value}</p>
      <p className="mt-3 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

function DataTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="executive-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function RankingList({
  title,
  markets,
  metric,
}: {
  title: string;
  markets: Market[];
  metric: "registrations" | "competitorDealers";
}) {
  return (
    <div className="executive-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {markets.map((market) => (
          <div key={market.id} className="flex items-center justify-between border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
            <div>
              <p className="text-sm font-semibold">{market.market}</p>
              <p className="text-xs text-stone-500">{market.state}</p>
            </div>
            <span className="text-lg font-semibold text-[#c8102e]">{market[metric]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <div className="executive-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-2">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-stone-600">{item.detail}</p>
              </div>
              <span className="shrink-0 text-lg font-semibold text-[#c8102e]">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchitectureCard({
  title,
  icon: IconComponent,
  items,
}: {
  title: string;
  icon: Icon;
  items: string[];
}) {
  return (
    <div className="executive-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center bg-red-50 text-[#c8102e]">
          <IconComponent className="h-5 w-5" />
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-stone-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8102e]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-stone-200 px-4 py-3">
      <h3 className="font-semibold">{title}</h3>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="border-b border-stone-200 px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-4 align-top text-stone-700 ${className ?? ""}`}>{children}</td>;
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "border-red-200 bg-red-50 text-[#c8102e]"
      : score >= 70
        ? "border-stone-300 bg-stone-50 text-stone-900"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex min-w-12 justify-center border px-2 py-1 text-xs font-bold ${tone}`}>
      {score}
    </span>
  );
}

function ClassificationBadge({
  classification,
}: {
  classification: Market["classification"];
}) {
  return (
    <span
      className={`mt-2 inline-flex border px-2 py-1 text-xs font-semibold ${
        classificationColors[classification]
      }`}
    >
      {classification}
    </span>
  );
}

function classificationSummary(markets: Market[]) {
  return Object.entries(
    markets.reduce<Record<string, number>>((summary, market) => {
      summary[market.classification] = (summary[market.classification] ?? 0) + 1;
      return summary;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
}

function nearestByCoordinate<T extends { lat: number; lng: number }>(
  origin: { lat: number; lng: number },
  items: T[],
): T {
  return items.reduce((nearest, item) =>
    distanceMiles(origin, item) < distanceMiles(origin, nearest) ? item : nearest,
  );
}

function distanceMiles(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): number {
  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export default App;
