"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FixtureLite } from "@/lib/espn";
import type { LeagueDef } from "@/lib/leagues";
import type { EngineResult } from "@/lib/engine/types";
import { FixtureCard, MarketTable, Section, ConfidenceBar, GradeBadge } from "./_components/ui";
import { MatchDetail } from "./_components/MatchDetail";
import { BackgroundSlideshow } from "./_components/BackgroundSlideshow";

type Tab = "top" | "live" | "accumulators" | "performance" | "leagues" | "standings" | "oracle" | "chat" | "bankroll" | "slipbuilder" | "dailypicks" | "oddscalc" | "verified" | "results";

interface FeaturedBlock {
  slug: string;
  label: string;
  fixtures: FixtureLite[];
  upcoming: FixtureLite[];
  results: FixtureLite[];
}

interface TopData {
  featured: FeaturedBlock[];
  extra: FeaturedBlock[];
  live: FixtureLite[];
  liveCount: number;
}

const TOP_LEAGUE_PILLS = [
  { slug: "fifa.world", name: "World Cup", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png" },
  { slug: "eng.1", name: "Premier League", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png" },
  { slug: "esp.1", name: "LaLiga", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png" },
  { slug: "ita.1", name: "Serie A", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png" },
  { slug: "fra.1", name: "Ligue 1", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png" },
  { slug: "ger.1", name: "Bundesliga", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png" },
  { slug: "uefa.champions", name: "UCL", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png" },
  { slug: "uefa.europa", name: "Europa", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png" },
  { slug: "conmebol.libertadores", name: "Libertadores", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/58.png" },
  { slug: "usa.1", name: "MLS", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png" },
  { slug: "bra.1", name: "Série A", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/85.png" },
  { slug: "mex.1", name: "Liga MX", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/22.png" },
  { slug: "arg.1", name: "Liga Pro", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/1.png" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("top");
  const [selected, setSelected] = useState<FixtureLite | null>(null);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinName, setPinName] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(d => {
      setHasPin(d.hasPin);
      if (!d.hasPin) setAuthed(true); // No PIN set = open access
    }).catch(() => setAuthed(true));
  }, []);

  async function handlePin() {
    if (!hasPin) {
      // Setup new PIN
      if (pinInput.length < 4) { setPinError("PIN must be at least 4 digits"); return; }
      await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setup", pin: pinInput, name: pinName || "User" }) });
      setAuthed(true);
    } else {
      // Verify PIN
      const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", pin: pinInput }) });
      const d = await r.json();
      if (d.valid) { setAuthed(true); setPinError(""); }
      else setPinError("Incorrect PIN");
    }
  }

  if (hasPin === null) return <div className="min-h-screen bg-[#05070d] flex items-center justify-center"><div className="text-amber-300 font-mono animate-pulse">Loading...</div></div>;

  if (!authed) return (
    <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
      <div className="bg-black/50 rounded-xl p-8 w-full max-w-sm text-center">
        <Image src="/logo.png" alt="Logo" width={60} height={60} className="rounded-lg mx-auto mb-4" />
        <h1 className="text-xl font-bold text-amber-300 font-mono mb-1">GIGI GIVO</h1>
        <p className="text-xs text-slate-400 mb-6">{hasPin ? "Enter your PIN to continue" : "Set a PIN to secure your app"}</p>
        {!hasPin && (
          <input value={pinName} onChange={e => setPinName(e.target.value)} placeholder="Your name"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400 mb-3" />
        )}
        <input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder={hasPin ? "Enter PIN" : "Create PIN (4+ digits)"}
          type="password" onKeyDown={e => { if (e.key === "Enter") handlePin(); }}
          className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-amber-400 font-mono" />
        {pinError && <p className="text-rose-400 text-xs mt-2">{pinError}</p>}
        <button onClick={handlePin} className="w-full mt-4 rounded-lg bg-amber-400 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300">
          {hasPin ? "Unlock" : "Set PIN & Start"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen text-slate-100 ${tab !== "top" ? "bg-[#05070d]" : ""}`}>
      {tab === "top" && <BackgroundSlideshow />}
      <div className="relative z-10">
        <Header tab={tab} setTab={setTab} />

        {/* Live ticker removed — Live tab handles it */}

        {/* LEAGUE CHIPS — only on Top Matches tab */}
        {tab === "top" && (
          <div className="sticky top-[99px] z-30 bg-black/55 py-2 px-4 overflow-x-auto scrollbar-none">
            <div className="mx-auto flex max-w-7xl items-center gap-2">
              <button
                onClick={() => { setSelectedLeagueSlug(null); }}
                className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition border ${
                  selectedLeagueSlug === null
                    ? "bg-amber-400 text-slate-950 border-amber-400"
                    : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {TOP_LEAGUE_PILLS.map((lg) => (
                <button
                  key={lg.slug}
                  onClick={() => {
                    setSelectedLeagueSlug(lg.slug);
                    const el = document.getElementById(`league-sec-${lg.slug}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 border ${
                    selectedLeagueSlug === lg.slug
                      ? "bg-amber-400 text-slate-950 border-amber-400"
                      : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <Image src={lg.logo} alt={lg.name} width={16} height={16} className="object-contain" unoptimized />
                  <span>{lg.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 py-8">
          {tab === "top" && (
            <TopFeed
              onSelect={setSelected}
              filterSlug={selectedLeagueSlug}
              onClearFilter={() => setSelectedLeagueSlug(null)}
            />
          )}
          {tab === "live" && <LivePage onSelect={setSelected} />}
          {tab === "accumulators" && <AccumulatorPage />}
          {tab === "performance" && <PerformanceDashboard />}
          {tab === "leagues" && <LeagueBrowser onSelect={setSelected} />}
          {tab === "standings" && <StandingsView />}
          {tab === "oracle" && <ManualOracle />}
          {tab === "chat" && <ChatAssistant />}


          {tab === "dailypicks" && <DailyPicksPage />}
          {tab === "oddscalc" && <OddsCalculator />}
          {tab === "verified" && <VerifiedPage />}
          {tab === "results" && <ResultsPage onSelect={setSelected} />}
        </main>

        {selected ? <MatchDetail fixture={selected} onClose={() => setSelected(null)} /> : null}

        <footer className="bg-black/50 py-4 text-center text-xs text-slate-300 font-mono">
          ĞIGI GIVØ Proprietary Sportsbook Engine · Real Data Mesh · Zero Simulation
        </footer>
      </div>
    </div>
  );
}

// --------------- LIVE PAGE ---------------
function LivePage({ onSelect }: { onSelect: (fx: FixtureLite) => void }) {
  const [live, setLive] = useState<FixtureLite[]>([]);
  const [recent, setRecent] = useState<FixtureLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      fetch("/api/top")
        .then((r) => r.json())
        .then((d) => {
          setLive(d.live ?? []);
          // Show today's recent finished + upcoming as context
          const finished = (d.featured ?? []).flatMap((b: FeaturedBlock) => b.fixtures.filter((f: FixtureLite) => f.state === "post")).slice(0, 8);
          const upcoming = (d.upcoming ?? []).slice(0, 8);
          setRecent([...finished, ...upcoming]);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <LoadingGrid label="Checking live matches worldwide…" />;

  return (
    <div className="space-y-8">
      {live.length > 0 ? (
        <div>
          <div className="mb-3 inline-flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <h2 className="text-sm font-bold text-white">LIVE NOW — {live.length} Match{live.length > 1 ? "es" : ""} In-Play</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((fx) => (
              <FixtureCard key={`live-${fx.id}`} fx={fx} onSelect={onSelect} live />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-black/50 rounded-lg p-10 text-center">
          <div className="text-lg font-bold text-slate-300 mb-2">No matches are live right now</div>
          <p className="text-sm text-slate-400 font-mono">Live scores auto-refresh every 15 seconds. Check back during match hours.</p>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div className="mb-3 inline-block bg-black/60 rounded-lg px-3 py-1.5">
            <h2 className="text-sm font-bold text-white">Today&apos;s Schedule & Recent Results</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recent.map((fx) => (
              <FixtureCard key={`recent-${fx.leagueSlug}-${fx.id}`} fx={fx} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const mainTabs: Array<{ id: Tab; label: string }> = [
    { id: "top", label: "Top Matches" },
    { id: "live", label: "Live" },
    { id: "leagues", label: "All Leagues" },
    { id: "standings", label: "Standings" },
  ];

  const menuTabs: Array<{ id: Tab; label: string; desc: string }> = [
    { id: "accumulators", label: "Accumulators", desc: "High-hit, value bets & bankroll" },
    { id: "performance", label: "Performance", desc: "Track record & accuracy stats" },
    { id: "dailypicks", label: "Daily Picks", desc: "Today's best picks across all leagues" },
    { id: "results", label: "Results", desc: "Recent finished matches across leagues" },
    { id: "verified", label: "Verification", desc: "Post-match auto-verified oracle picks" },
    { id: "oracle", label: "Oracle Search", desc: "Search & analyse any fixture" },
    { id: "oddscalc", label: "Odds Calculator", desc: "Convert odds, dutching, hedging" },
    { id: "chat", label: "Ask Anything", desc: "Web search chat assistant" },
  ];

  const activeInMenu = menuTabs.some((t) => t.id === tab);

  return (
    <header className="sticky top-0 z-40 bg-black/60 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Ğigi Givø" width={38} height={38} className="rounded-lg" />
          <div>
            <h1 className="bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 bg-clip-text font-mono text-lg font-extrabold tracking-tight text-transparent">
              ĞIGI GIVØ
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">Bayesian Oracle · Deep Statistical Engine</p>
          </div>
        </div>
        <nav className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1 items-center">
          {mainTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMenuOpen(false); }}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-amber-400 text-slate-950 font-bold"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}

          {/* Menu dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition flex items-center gap-1.5 ${
                activeInMenu
                  ? "bg-amber-400 text-slate-950 font-bold"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              Menu
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points={menuOpen ? "2,7 5,3 8,7" : "2,3 5,7 8,3"} />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-black/90 border border-white/15 shadow-xl z-50 overflow-hidden">
                {menuTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTab(t.id); setMenuOpen(false); }}
                    className={`w-full text-left px-4 py-3 transition border-b border-white/5 last:border-0 ${
                      tab === t.id
                        ? "bg-amber-400/10 text-amber-300"
                        : "text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-[10px] text-slate-400">{t.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

function LoadingGrid({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-black/50 px-4 py-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
        <span className="animate-pulse font-mono text-sm text-amber-300">{label}</span>
      </div>
      {/* Shimmer animate-pulse bg-white/10 cards matching the fixture-card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-white/10 bg-black/50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-2.5 w-20 animate-pulse bg-white/10 rounded" />
              <div className="h-2.5 w-10 animate-pulse bg-white/10 rounded" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse bg-white/10 rounded-full" />
                <div className="h-3 flex-1 animate-pulse bg-white/10 rounded" />
                <div className="h-3 w-5 animate-pulse bg-white/10 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse bg-white/10 rounded-full" />
                <div className="h-3 flex-1 animate-pulse bg-white/10 rounded" />
                <div className="h-3 w-5 animate-pulse bg-white/10 rounded" />
              </div>
            </div>
            <div className="mt-3 h-2 w-24 animate-pulse bg-white/10 rounded border-t border-white/5 pt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------- TOP FEED ---------------
function TopFeed({
  onSelect,
  filterSlug,
  onClearFilter,
}: {
  onSelect: (fx: FixtureLite) => void;
  filterSlug: string | null;
  onClearFilter: () => void;
}) {
  const [data, setData] = useState<TopData | null>(null);

  useEffect(() => {
    fetch("/api/top")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ featured: [], extra: [], live: [], liveCount: 0 }));
  }, []);

  if (!data) return <LoadingGrid label="Connecting to Football Data Mesh…" />;

  const filteredBlocks = filterSlug
    ? data.featured.filter((b) => b.slug === filterSlug)
    : data.featured;

  return (
    <div className="space-y-10">
      {/* FILTER ACTIVE BANNER */}
      {filterSlug ? (
        <div className="flex items-center justify-between rounded-lg bg-black/50 px-4 py-2 text-sm text-amber-200">
          <span>Filtering: <strong>{TOP_LEAGUE_PILLS.find((p) => p.slug === filterSlug)?.name ?? filterSlug}</strong></span>
          <button onClick={onClearFilter} className="text-xs text-slate-300 hover:text-white underline font-mono">
            Show All ✕
          </button>
        </div>
      ) : null}

      {/* VALUE BET ALERTS — prominent on homepage */}
      {!filterSlug && <ValueAlerts />}

      {/* FEATURED LEAGUES — each with upcoming + results */}
      {filteredBlocks.map((block) => {
        const up = block.upcoming ?? block.fixtures.filter((f) => f.state !== "post");
        const res = block.results ?? block.fixtures.filter((f) => f.state === "post");
        if (up.length === 0 && res.length === 0) return null;
        const pill = TOP_LEAGUE_PILLS.find((p) => p.slug === block.slug);
        return (
          <section id={`league-sec-${block.slug}`} key={block.slug} className="scroll-mt-36 space-y-4">
            <div className="inline-flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1.5">
              {pill && (
                <Image src={pill.logo} alt={block.label} width={20} height={20} className="object-contain" unoptimized />
              )}
              <h2 className="text-sm font-bold text-white">{block.label}</h2>
              {up.length > 0 && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-mono font-medium">
                  {up.length} upcoming
                </span>
              )}
              {res.length > 0 && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-slate-300 font-mono font-medium">
                  {res.length} results
                </span>
              )}
            </div>

            {up.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {up.map((fx) => (
                  <FixtureCard key={`${block.slug}-${fx.id}`} fx={fx} onSelect={onSelect} />
                ))}
              </div>
            )}

            {res.length > 0 && (
              <div>
                <div className="mb-2 inline-block bg-black/40 rounded px-2 py-1 text-[11px] font-mono text-slate-400">
                  Recent Results
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {res.map((fx) => (
                    <FixtureCard key={`res-${block.slug}-${fx.id}`} fx={fx} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* MORE LEAGUES */}
      {!filterSlug && data.extra.length > 0 && (
        <section className="pt-4 border-t border-white/10">
          <div className="mb-3 inline-block bg-black/60 rounded-lg px-3 py-1.5">
            <h2 className="text-sm font-bold text-white">More Leagues</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.extra.flatMap((b) => b.fixtures).slice(0, 12).map((fx) => (
              <FixtureCard key={`extra-${fx.leagueSlug}-${fx.id}`} fx={fx} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --------------- ALL LEAGUES ---------------
function LeagueBrowser({ onSelect }: { onSelect: (fx: FixtureLite) => void }) {
  const [byRegion, setByRegion] = useState<Record<string, LeagueDef[]> | null>(null);
  const [activeLeague, setActiveLeague] = useState<LeagueDef | null>(null);
  const [upcoming, setUpcoming] = useState<FixtureLite[]>([]);
  const [results, setResults] = useState<FixtureLite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingFx, setLoadingFx] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/leagues")
      .then((r) => r.json())
      .then((d) => setByRegion(d.byRegion ?? {}))
      .catch(() => setByRegion({}));
  }, []);

  const loadLeague = useCallback((lg: LeagueDef) => {
    setActiveLeague(lg);
    setUpcoming([]);
    setResults([]);
    setLoaded(false);
    setLoadingFx(true);
    // Scroll to fixtures area on mobile
    setTimeout(() => {
      const el = document.getElementById("league-fixtures");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    fetch(`/api/fixtures?league=${lg.slug}`)
      .then((r) => r.json())
      .then((d) => {
        setUpcoming(d.upcoming ?? []);
        setResults(d.results ?? []);
        setLoaded(true);
      })
      .catch(() => { setUpcoming([]); setResults([]); setLoaded(true); })
      .finally(() => setLoadingFx(false));
  }, []);

  const filtered = useMemo(() => {
    if (!byRegion) return null;
    if (!search.trim()) return byRegion;
    const q = search.toLowerCase();
    const out: Record<string, LeagueDef[]> = {};
    for (const [region, lgs] of Object.entries(byRegion)) {
      const m = lgs.filter((l) => l.name.toLowerCase().includes(q) || region.toLowerCase().includes(q));
      if (m.length) out[region] = m;
    }
    return out;
  }, [byRegion, search]);

  if (!filtered) return <LoadingGrid label="Loading leagues…" />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leagues…"
          className="w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
        />
        <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
          {Object.entries(filtered).map(([region, lgs]) => (
            <div key={region}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 font-mono">{region}</div>
              <div className="space-y-0.5">
                {lgs.map((lg) => (
                  <button
                    key={lg.slug}
                    onClick={() => loadLeague(lg)}
                    className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
                      activeLeague?.slug === lg.slug
                        ? "bg-amber-400/20 text-amber-200 font-bold"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {lg.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div id="league-fixtures" className="scroll-mt-24">
        {!activeLeague ? (
          <div className="bg-black/50 rounded-lg p-10 text-center text-slate-400 font-mono">
            Select a league to load fixtures & results.
          </div>
        ) : loadingFx || !loaded ? (
          <LoadingGrid label={`Loading ${activeLeague.name}…`} />
        ) : upcoming.length === 0 && results.length === 0 ? (
          <div className="bg-black/50 rounded-lg p-10 text-center text-slate-400 font-mono">
            No fixtures or results for {activeLeague.name}.
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming / Live */}
            {upcoming.length > 0 && (
              <div>
                <div className="mb-3 inline-block bg-black/60 rounded-lg px-3 py-1.5">
                  <h2 className="text-sm font-bold text-white">Upcoming — {activeLeague.name} ({upcoming.length})</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((fx) => (
                    <FixtureCard key={fx.id} fx={fx} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Results */}
            {results.length > 0 && (
              <div>
                <div className="mb-3 inline-block bg-black/60 rounded-lg px-3 py-1.5">
                  <h2 className="text-sm font-bold text-white">Recent Results — {activeLeague.name} ({results.length})</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((fx) => (
                    <FixtureCard key={`res-${fx.id}`} fx={fx} onSelect={onSelect} />
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-slate-500 font-mono">
                  Tap any finished match → Oracle + Post-Match Verification
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------- STANDINGS ---------------
interface StandingsEntry {
  rank: number;
  team: string;
  teamLogo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
}

function StandingsView() {
  const [activeSlug, setActiveSlug] = useState("eng.1");
  const [entries, setEntries] = useState<StandingsEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStandings = useCallback((slug: string) => {
    setActiveSlug(slug);
    setLoading(true);
    fetch(`/api/standings?league=${slug}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStandings("eng.1"); }, [loadStandings]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TOP_LEAGUE_PILLS.slice(1, 10).map((lg) => (
          <button
            key={lg.slug}
            onClick={() => loadStandings(lg.slug)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition flex items-center gap-1.5 ${
              activeSlug === lg.slug
                ? "bg-amber-400 text-slate-950 border-amber-400"
                : "border-white/15 bg-black/40 text-slate-300 hover:bg-black/60"
            }`}
          >
            <Image src={lg.logo} alt={lg.name} width={14} height={14} className="object-contain" unoptimized />
            {lg.name}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingGrid label="Loading standings…" />
      ) : entries.length === 0 ? (
        <div className="bg-black/50 rounded-lg p-10 text-center text-slate-400 font-mono">
          No standings data available.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-black/50">
          <table className="w-full text-left text-sm font-mono">
            <thead className="bg-black/30 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2 w-8">#</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-center">P</th>
                <th className="px-3 py-2 text-center">W</th>
                <th className="px-3 py-2 text-center">D</th>
                <th className="px-3 py-2 text-center">L</th>
                <th className="px-3 py-2 text-center">GD</th>
                <th className="px-3 py-2 text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e, i) => (
                <tr key={i} className={i < 4 ? "border-l-2 border-l-emerald-500" : i >= entries.length - 3 ? "border-l-2 border-l-rose-500" : ""}>
                  <td className="px-3 py-1.5 text-slate-400">{e.rank}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {e.teamLogo && <Image src={e.teamLogo} alt={e.team} width={18} height={18} className="object-contain" unoptimized />}
                      <span className="text-slate-100 font-medium truncate">{e.team}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center text-slate-300">{e.played}</td>
                  <td className="px-3 py-1.5 text-center text-slate-300">{e.won}</td>
                  <td className="px-3 py-1.5 text-center text-slate-300">{e.drawn}</td>
                  <td className="px-3 py-1.5 text-center text-slate-300">{e.lost}</td>
                  <td className="px-3 py-1.5 text-center text-slate-300">{e.goalDifference > 0 ? `+${e.goalDifference}` : e.goalDifference}</td>
                  <td className="px-3 py-1.5 text-center font-bold text-amber-300">{e.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --------------- MANUAL ORACLE ---------------
function ManualOracle() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FixtureLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFx, setSelectedFx] = useState<FixtureLite | null>(null);

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.results ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="bg-black/50 rounded-lg p-4">
        <h2 className="text-base font-bold text-white">Oracle Search</h2>
        <p className="text-xs text-slate-400 mt-1">Search for any team, league, or match to run the oracle</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team, league or match... (e.g. Arsenal, World Cup, Barcelona)"
          className="w-full rounded-lg border border-white/15 bg-black/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400 font-mono"
        />
        {searching && (
          <div className="absolute right-3 top-3 text-xs text-amber-300 font-mono animate-pulse">Searching...</div>
        )}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && !selectedFx && (
        <div className="bg-black/50 rounded-lg overflow-hidden divide-y divide-white/5">
          {searchResults.map((fx) => (
            <button
              key={`${fx.leagueSlug}-${fx.id}`}
              onClick={() => setSelectedFx(fx)}
              className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3"
            >
              {fx.home.logo && <Image src={fx.home.logo} alt="" width={20} height={20} className="object-contain" unoptimized />}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{fx.home.name} vs {fx.away.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{fx.leagueName} | {new Date(fx.date).toLocaleDateString()}</div>
              </div>
              {fx.state === "post" && fx.home.score !== null && (
                <span className="text-sm font-mono font-bold text-amber-300">{fx.home.score}-{fx.away.score}</span>
              )}
              <span className={`text-[10px] font-mono ${fx.state === "in" ? "text-rose-300" : fx.state === "pre" ? "text-emerald-300" : "text-slate-400"}`}>
                {fx.state === "in" ? "LIVE" : fx.state === "pre" ? "Upcoming" : "FT"}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && searchResults.length === 0 && !searching && (
        <div className="bg-black/50 rounded-lg p-6 text-center text-slate-400 text-sm font-mono">
          No matches found for &quot;{query}&quot;
        </div>
      )}

      {/* Selected match opens the oracle modal */}
      {selectedFx && (
        <MatchDetail fixture={selectedFx} onClose={() => setSelectedFx(null)} />
      )}
    </div>
  );
}

// --------------- POST-MATCH VERIFICATION PAGE ---------------
interface VerifiedMatch {
  fixture: FixtureLite;
  hitCount: number;
  evaluatedCount: number;
  top10: Array<{
    name: string;
    selection: string;
    hitRate: number;
    outcome: string;
    reason?: string;
  }>;
}

function VerifiedPage() {
  const [matches, setMatches] = useState<VerifiedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/verify")
      .then((r) => r.json())
      .then((d) => setMatches(d.verified ?? []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingGrid label="Running post-match verification on recent finished matches…" />;

  if (matches.length === 0) {
    return (
      <div className="bg-black/50 rounded-lg p-10 text-center">
        <div className="text-lg font-bold text-slate-300 mb-2">No finished matches to verify</div>
        <p className="text-sm text-slate-400 font-mono">Check back after matches have been completed today.</p>
      </div>
    );
  }

  const totalHits = matches.reduce((s, m) => s + m.hitCount, 0);
  const totalEval = matches.reduce((s, m) => s + m.evaluatedCount, 0);

  return (
    <div className="space-y-8">
      {/* Overall accuracy banner */}
      <div className="bg-black/50 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-emerald-300 font-mono flex items-center gap-2">
              
              POST-MATCH AUTOMATIC VERIFICATION
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Oracle predictions verified against real ESPN boxscore data (shots, SOT, corners, cards, offsides, saves)
            </p>
          </div>
          <div className="bg-black/40 rounded-lg px-5 py-3 text-center border border-emerald-500/30">
            <div className="text-3xl font-extrabold font-mono text-emerald-300">
              {totalHits}/{totalEval}
            </div>
            <div className="text-[10px] text-emerald-200 font-bold uppercase">
              OVERALL HIT RATE ({totalEval > 0 ? ((totalHits / totalEval) * 100).toFixed(0) : 0}%)
            </div>
          </div>
        </div>
      </div>

      {/* Each verified match */}
      {matches.map((vm) => {
        const pct = vm.evaluatedCount > 0 ? ((vm.hitCount / vm.evaluatedCount) * 100).toFixed(0) : "—";
        const perfect = vm.hitCount === vm.evaluatedCount && vm.evaluatedCount > 0;
        return (
          <div key={vm.fixture.id} className="bg-black/50 rounded-lg p-4">
            {/* Match header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                {vm.fixture.home.logo && (
                  <Image src={vm.fixture.home.logo} alt={vm.fixture.home.shortName} width={24} height={24} className="object-contain" unoptimized />
                )}
                <span className="font-bold text-white">{vm.fixture.home.name}</span>
                <span className="font-mono text-xl font-extrabold text-amber-300">
                  {vm.fixture.home.score} - {vm.fixture.away.score}
                </span>
                <span className="font-bold text-white">{vm.fixture.away.name}</span>
                {vm.fixture.away.logo && (
                  <Image src={vm.fixture.away.logo} alt={vm.fixture.away.shortName} width={24} height={24} className="object-contain" unoptimized />
                )}
                <span className="text-xs text-slate-400 font-mono">{vm.fixture.leagueName}</span>
              </div>
              <div className={`rounded-lg px-3 py-1.5 font-mono text-center border ${
                perfect ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-amber-500/20 border-amber-500/40 text-amber-300"
              }`}>
                <div className="text-lg font-extrabold">{vm.hitCount}/{vm.evaluatedCount}</div>
                <div className="text-[9px] font-bold uppercase">{pct}% HIT</div>
              </div>
            </div>

            {/* Top 10 picks with verification */}
            <div className="space-y-1.5">
              {vm.top10.map((pick, i) => {
                const badge =
                  pick.outcome === "HIT" ? "HIT" :
                  pick.outcome === "MISS" ? "MISS" : "PENDING";
                const badgeColor =
                  pick.outcome === "HIT" ? "text-emerald-300" :
                  pick.outcome === "MISS" ? "text-rose-300" : "text-slate-400";
                return (
                  <div key={i} className="flex items-center gap-3 rounded-md bg-black/30 px-3 py-2">
                    <span className="text-xs font-mono text-slate-500 w-5">{i + 1}.</span>
                    <span className={`text-sm ${badgeColor}`}>{badge}</span>
                    <span className="text-sm text-white font-medium flex-1">{pick.name}</span>
                    <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                      {pick.selection}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{(pick.hitRate * 100).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --------------- RESULTS PAGE ---------------
function ResultsPage({ onSelect }: { onSelect: (fx: FixtureLite) => void }) {
  const [results, setResults] = useState<FixtureLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const loadResults = useCallback((slug: string | null) => {
    setActiveSlug(slug);
    setLoading(true);
    const url = slug ? `/api/results?league=${slug}` : "/api/results";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadResults(null); }, [loadResults]);

  return (
    <div className="space-y-6">
      {/* League filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => loadResults(null)}
          className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
            activeSlug === null ? "bg-amber-400 text-slate-950 border-amber-400" : "border-white/15 bg-black/40 text-slate-300 hover:bg-black/60"
          }`}
        >
          All Leagues
        </button>
        {TOP_LEAGUE_PILLS.map((lg) => (
          <button
            key={lg.slug}
            onClick={() => loadResults(lg.slug)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition flex items-center gap-1.5 ${
              activeSlug === lg.slug ? "bg-amber-400 text-slate-950 border-amber-400" : "border-white/15 bg-black/40 text-slate-300 hover:bg-black/60"
            }`}
          >
            <Image src={lg.logo} alt={lg.name} width={14} height={14} className="object-contain" unoptimized />
            {lg.name}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingGrid label="Loading recent results…" />
      ) : results.length === 0 ? (
        <div className="bg-black/50 rounded-lg p-10 text-center">
          <div className="text-lg font-bold text-slate-300 mb-2">No recent results found</div>
          <p className="text-sm text-slate-400 font-mono">Try a different league or check back later.</p>
        </div>
      ) : (
        <div>
          <div className="mb-3 inline-block bg-black/60 rounded-lg px-3 py-1.5">
            <h2 className="text-sm font-bold text-white">Recent Results — {results.length} matches</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((fx) => (
              <FixtureCard key={`res-${fx.leagueSlug}-${fx.id}`} fx={fx} onSelect={onSelect} />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-slate-500 font-mono">
            Tap any finished match → Deep Statistical Oracle + Post-Match Verification
          </p>
        </div>
      )}
    </div>
  );
}

// --------------- PERFORMANCE DASHBOARD ---------------
interface PerfData {
  totalMatches: number;
  totalPicks: number;
  totalHits: number;
  totalMisses: number;
  totalPending: number;
  totalVerified: number;
  overallAccuracy: number;
  perfectMatches: number;
  currentStreak: number;
  streakType: "W" | "L" | null;
  top1: { hits: number; total: number; accuracy: number };
  top3: { hits: number; total: number; accuracy: number };
  top10: { hits: number; total: number; accuracy: number };
  tierSweep?: { top1: number; top3: number; top5: number; top10: number; counts: { top1: number; top3: number; top5: number; top10: number } };
  bestMatch: { matchLabel: string; score: string; accuracy: number; hits: number; total: number } | null;
  leagueBreakdown: Array<{ league: string; hits: number; misses: number; matches: number; accuracy: number }>;
  accumulatorPerformance: {
    total: number; won: number; lost: number; pending: number; settled: number;
    winRate: number; roi: number; totalStaked: number; totalReturns: number;
    slips: Array<{ id: number; name: string; legs: number; odds: number; prob: number; stake: number; status: string; potentialReturn: number }>;
  };
  recentMatches: Array<{
    id: number;
    matchLabel: string;
    league: string;
    matchDate: string;
    homeScore: number;
    awayScore: number;
    hits: number;
    misses: number;
    pending: number;
    accuracy: number;
    totalPicks: number;
    top10Detail: Array<{ name: string; selection: string; outcome: string }>;
  }>;
}

function PerformanceDashboard() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingGrid label="Loading performance records..." />;

  if (!data || data.totalMatches === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-black/50 rounded-lg p-4">
          <h2 className="text-base font-bold text-white">ORACLE PERFORMANCE TRACKER</h2>
          <p className="text-xs text-slate-400 mt-1">Track record of every post-match verification</p>
        </div>
        <div className="bg-black/50 rounded-lg p-10 text-center">
          <div className="text-lg font-bold text-slate-300 mb-2">No verified matches yet</div>
          <p className="text-sm text-slate-400 font-mono">
            Tap any finished match to run the oracle. Post-match verification results will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-black/50 rounded-lg p-4">
        <h2 className="text-base font-bold text-white">ORACLE PERFORMANCE TRACKER</h2>
        <p className="text-xs text-slate-400 mt-1">
          Track record across {data.totalMatches} verified match{data.totalMatches > 1 ? "es" : ""}
        </p>
      </div>

      {/* Key stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Overall Accuracy" value={`${(data.overallAccuracy * 100).toFixed(1)}%`} sub={`${data.totalHits}H ${data.totalMisses}M / ${data.totalVerified} verified`} color={data.overallAccuracy >= 0.8 ? "text-emerald-300" : data.overallAccuracy >= 0.6 ? "text-amber-300" : "text-rose-300"} />
        <StatCard label="Total Matches" value={String(data.totalMatches)} sub={`${data.perfectMatches} perfect, ${data.totalMatches - data.perfectMatches} with misses`} color="text-amber-300" />
        <StatCard label="Picks Breakdown" value={`${data.totalHits}H / ${data.totalMisses}M`} sub={`${data.totalPending} pending to resolve`} color="text-white" />
        <StatCard label="Current Streak" value={`${data.currentStreak}${data.streakType ?? ""}`} sub={data.streakType === "W" ? "consecutive perfect" : data.streakType === "L" ? "consecutive with misses" : "no data"} color={data.streakType === "W" ? "text-emerald-300" : "text-rose-300"} />
      </div>

      {/* TIER CLEAN-SWEEP WIN RATES — how often the WHOLE tier hits */}
      {data.tierSweep && (
        <div>
          <div className="mb-2 inline-block bg-black/60 rounded-lg px-3 py-1.5">
            <h3 className="text-sm font-bold text-white">Tier Win Rate <span className="text-slate-400 font-normal">— clean-sweep (all legs hit)</span></h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: "top1" as const, label: "TOP 1", desc: "Single safest pick" },
              { key: "top3" as const, label: "TOP 3", desc: "Safest treble" },
              { key: "top5" as const, label: "TOP 5", desc: "Safest 5-fold" },
              { key: "top10" as const, label: "TOP 10", desc: "Full slip" },
            ].map((t) => {
              const rate = data.tierSweep![t.key];
              const n = data.tierSweep!.counts[t.key];
              const color = rate >= 0.9 ? "text-emerald-300" : rate >= 0.75 ? "text-cyan-300" : rate >= 0.6 ? "text-amber-300" : "text-rose-300";
              const bar = rate >= 0.9 ? "bg-emerald-500" : rate >= 0.75 ? "bg-cyan-500" : rate >= 0.6 ? "bg-amber-500" : "bg-rose-500";
              return (
                <div key={t.key} className="bg-black/50 rounded-lg p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-white font-mono">{t.label}</span>
                    <span className={`text-2xl font-extrabold font-mono ${color}`}>{n > 0 ? `${(rate * 100).toFixed(0)}%` : "—"}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                  <div className="mt-2 h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${rate * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">{n} settled</div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 font-mono">Pick the tier that matches your risk: shorter tiers hit clean far more often.</p>
        </div>
      )}

      {/* Top 1 / Top 3 / Top 10 position accuracy */}
      {data.top1.total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-black/50 rounded-lg p-4">
            <div className="text-xs text-slate-400 font-mono mb-1">TOP 1 PICK ACCURACY</div>
            <div className={`text-2xl font-extrabold font-mono ${data.top1.accuracy >= 0.8 ? "text-emerald-300" : data.top1.accuracy >= 0.6 ? "text-amber-300" : "text-rose-300"}`}>
              {(data.top1.accuracy * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{data.top1.hits} hit / {data.top1.total - data.top1.hits} miss across {data.top1.total} matches</div>
            <div className="mt-2 h-2 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.top1.accuracy * 100}%` }} />
            </div>
          </div>
          <div className="bg-black/50 rounded-lg p-4">
            <div className="text-xs text-slate-400 font-mono mb-1">TOP 3 PICKS ACCURACY</div>
            <div className={`text-2xl font-extrabold font-mono ${data.top3.accuracy >= 0.8 ? "text-emerald-300" : data.top3.accuracy >= 0.6 ? "text-amber-300" : "text-rose-300"}`}>
              {(data.top3.accuracy * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{data.top3.hits} hit / {data.top3.total - data.top3.hits} miss across {data.top3.total} picks</div>
            <div className="mt-2 h-2 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.top3.accuracy * 100}%` }} />
            </div>
          </div>
          <div className="bg-black/50 rounded-lg p-4">
            <div className="text-xs text-slate-400 font-mono mb-1">TOP 10 PICKS ACCURACY</div>
            <div className={`text-2xl font-extrabold font-mono ${data.top10.accuracy >= 0.8 ? "text-emerald-300" : data.top10.accuracy >= 0.6 ? "text-amber-300" : "text-rose-300"}`}>
              {(data.top10.accuracy * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{data.top10.hits} hit / {data.top10.total - data.top10.hits} miss across {data.top10.total} picks</div>
            <div className="mt-2 h-2 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.top10.accuracy * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* League breakdown */}
      {data.leagueBreakdown.length > 0 && (
        <div>
          <div className="mb-2 inline-block bg-black/60 rounded-lg px-3 py-1.5">
            <h3 className="text-sm font-bold text-white">Accuracy by League</h3>
          </div>
          <div className="bg-black/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm font-mono">
              <thead className="bg-black/30 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">League</th>
                  <th className="px-3 py-2 text-center">Matches</th>
                  <th className="px-3 py-2 text-center">Hits</th>
                  <th className="px-3 py-2 text-center">Misses</th>
                  <th className="px-3 py-2 text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.leagueBreakdown.map((lg) => (
                  <tr key={lg.league}>
                    <td className="px-3 py-2 text-slate-200 font-medium">{lg.league}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{lg.matches}</td>
                    <td className="px-3 py-2 text-center text-emerald-300">{lg.hits}</td>
                    <td className="px-3 py-2 text-center text-rose-300">{lg.misses}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={lg.accuracy >= 0.8 ? "text-emerald-300 font-bold" : lg.accuracy >= 0.6 ? "text-amber-300" : "text-rose-300"}>
                        {(lg.accuracy * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accumulator Performance */}
      {data.accumulatorPerformance && data.accumulatorPerformance.total > 0 && (
        <div>
          <div className="mb-2 inline-block bg-black/60 rounded-lg px-3 py-1.5">
            <h3 className="text-sm font-bold text-white">Accumulator Performance</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-3">
            <div className="bg-black/50 rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold font-mono text-amber-300">{data.accumulatorPerformance.total}</div>
              <div className="text-[10px] text-slate-400">Total Slips</div>
            </div>
            <div className="bg-black/50 rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold font-mono text-emerald-300">{data.accumulatorPerformance.won}</div>
              <div className="text-[10px] text-slate-400">Won</div>
            </div>
            <div className="bg-black/50 rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold font-mono text-rose-300">{data.accumulatorPerformance.lost}</div>
              <div className="text-[10px] text-slate-400">Lost</div>
            </div>
            <div className="bg-black/50 rounded-lg p-3 text-center">
              <div className={`text-xl font-extrabold font-mono ${data.accumulatorPerformance.winRate >= 50 ? "text-emerald-300" : "text-rose-300"}`}>
                {data.accumulatorPerformance.winRate.toFixed(0)}%
              </div>
              <div className="text-[10px] text-slate-400">Win Rate</div>
            </div>
            <div className="bg-black/50 rounded-lg p-3 text-center">
              <div className={`text-xl font-extrabold font-mono ${data.accumulatorPerformance.roi >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {data.accumulatorPerformance.roi >= 0 ? "+" : ""}{data.accumulatorPerformance.roi.toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">ROI</div>
            </div>
          </div>
          <div className="bg-black/50 rounded-lg divide-y divide-white/5">
            {data.accumulatorPerformance.slips.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <div>
                  <span className="text-white font-medium">{s.name}</span>
                  <span className="text-slate-400 ml-2">{s.legs} legs | odds {s.odds?.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono">${(s.stake ?? 10).toFixed(0)} → ${s.potentialReturn?.toFixed(2)}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold font-mono ${
                    s.status === "won" ? "bg-emerald-500/20 text-emerald-300" : s.status === "lost" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
                  }`}>{s.status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent match history */}
      <div>
        <div className="mb-2 inline-block bg-black/60 rounded-lg px-3 py-1.5">
          <h3 className="text-sm font-bold text-white">Match-by-Match History</h3>
        </div>
        <div className="space-y-3">
          {data.recentMatches.map((m) => {
            const perfect = m.misses === 0 && m.hits > 0;
            return (
              <div key={m.id} className="bg-black/50 rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-sm font-bold text-white">{m.matchLabel}</span>
                    <span className="ml-2 text-xs text-slate-400 font-mono">{m.homeScore}-{m.awayScore}</span>
                    <span className="ml-2 text-xs text-slate-500">{m.league} | {m.matchDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.pending > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="rounded px-2 py-1 text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {m.pending} to resolve
                        </span>
                        <button
                          onClick={async (e) => {
                            const btn = e.currentTarget;
                            btn.textContent = "Searching...";
                            btn.disabled = true;
                            await fetch("/api/verify-pending", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ performanceId: m.id }),
                            });
                            fetch("/api/performance").then(r => r.json()).then(setData);
                            btn.textContent = "Done";
                          }}
                          className="rounded px-2 py-1 text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/40"
                        >
                          Web Search
                        </button>
                      </div>
                    )}
                    <div className={`rounded px-2 py-1 text-xs font-bold font-mono ${
                      perfect ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                      m.misses > 0 ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                      "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {m.hits}H {m.misses}M / {m.totalPicks}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(m.top10Detail as Array<{ name: string; selection: string; outcome: string }>).map((pick, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-black/20 rounded px-2 py-1.5">
                      <span className={`w-12 shrink-0 text-right font-mono font-bold ${
                        pick.outcome === "HIT" ? "text-emerald-400" : pick.outcome === "MISS" ? "text-rose-400" : "text-amber-400"
                      }`}>
                        {pick.outcome}
                      </span>
                      <span className="text-slate-200 truncate flex-1">{pick.name}</span>
                      <span className="text-slate-400 shrink-0">{pick.selection}</span>
                      {pick.outcome === "PENDING" && (
                        <span className="flex gap-1 shrink-0 ml-1">
                          <button
                            onClick={async () => {
                              await fetch("/api/performance/resolve", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ performanceId: m.id, pickIndex: i, outcome: "HIT" }),
                              });
                              // Reload data
                              fetch("/api/performance").then(r => r.json()).then(setData);
                            }}
                            className="rounded bg-emerald-500/30 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/50"
                          >
                            HIT
                          </button>
                          <button
                            onClick={async () => {
                              await fetch("/api/performance/resolve", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ performanceId: m.id, pickIndex: i, outcome: "MISS" }),
                              });
                              fetch("/api/performance").then(r => r.json()).then(setData);
                            }}
                            className="rounded bg-rose-500/30 border border-rose-500/50 px-2 py-0.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500/50"
                          >
                            MISS
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-black/50 rounded-lg p-4 text-center">
      <div className={`text-2xl font-extrabold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-white font-medium mt-1">{label}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

// --------------- ACCUMULATOR PAGE ---------------
interface AccaPick {
  matchLabel: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  marketName: string;
  selection: string;
  hitRate: number;
  fairOdds: number;
  reason: string;
  family: string;
  date: string;
}

interface Acca {
  name: string;
  picks: AccaPick[];
  combinedProbability: number;
  combinedOdds: number;
  legs: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
}

function AccumulatorPage() {
  const [accas, setAccas] = useState<Acca[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAnalysed, setTotalAnalysed] = useState(0);
  const [accaTab, setAccaTab] = useState<"highhit" | "value" | "bankroll" | "performance">("highhit");
  type AccaStats = {
    total: number; won: number; lost: number; pending: number; winRate: number; roi: number;
    slips: Array<{ id: number; name: string; type: string; legs: number; odds: number; stake: number; status: string; potentialReturn: number }>;
  };
  const [perfData, setPerfData] = useState<{ all: AccaStats; highHit: AccaStats; value: AccaStats } | null>(null);

  useEffect(() => {
    fetch("/api/accumulator").then(r => r.json()).then(d => { setAccas(d.accumulators ?? []); setTotalAnalysed(d.totalMatchesAnalysed ?? 0); }).catch(() => setAccas([])).finally(() => setLoading(false));
    fetch("/api/performance").then(r => r.json()).then(d => setPerfData(d.accumulatorPerformance ?? null)).catch(() => {});
  }, []);

  const valueAccas = accas.filter(a => a.picks.some(p => (p as unknown as { valueEdge: number }).valueEdge > 0));
  if (loading) return <LoadingGrid label="Scanning upcoming matches..." />;

  return (
    <div className="space-y-6">
      <div className="bg-black/50 rounded-lg p-4">
        <h2 className="text-base font-bold text-white">ACCUMULATORS</h2>
        <p className="text-xs text-slate-400 mt-1">{totalAnalysed} matches analysed</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setAccaTab("highhit")} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${accaTab === "highhit" ? "bg-amber-400 text-slate-950" : "bg-black/50 text-slate-300 hover:bg-black/70"}`}>High Hit Accumulators</button>
        <button onClick={() => setAccaTab("value")} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${accaTab === "value" ? "bg-emerald-400 text-slate-950" : "bg-black/50 text-slate-300 hover:bg-black/70"}`}>Value Bets Accumulators</button>
        <button onClick={() => setAccaTab("bankroll")} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${accaTab === "bankroll" ? "bg-amber-400 text-slate-950" : "bg-black/50 text-slate-300 hover:bg-black/70"}`}>Bankroll</button>
        <button onClick={() => setAccaTab("performance")} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${accaTab === "performance" ? "bg-cyan-400 text-slate-950" : "bg-black/50 text-slate-300 hover:bg-black/70"}`}>Performance</button>
      </div>

      {accaTab === "bankroll" && <BankrollTracker />}

      {accaTab === "performance" && perfData && (
        <div className="space-y-6">
          {/* High Hit Performance */}
          <div>
            <div className="mb-2 inline-block bg-black/60 rounded-lg px-3 py-1.5">
              <h3 className="text-sm font-bold text-white">High Hit Accumulators Performance</h3>
            </div>
            <AccaPerfBlock data={perfData.highHit} />
          </div>

          {/* Value Bets Performance */}
          <div>
            <div className="mb-2 inline-block bg-emerald-500/20 rounded-lg px-3 py-1.5 border border-emerald-500/30">
              <h3 className="text-sm font-bold text-emerald-300">Value Bets Accumulators Performance</h3>
            </div>
            <AccaPerfBlock data={perfData.value} />
          </div>

          {/* Combined */}
          <div>
            <div className="mb-2 inline-block bg-black/60 rounded-lg px-3 py-1.5">
              <h3 className="text-sm font-bold text-white">All Accumulators Combined</h3>
            </div>
            <AccaPerfBlock data={perfData.all} />
          </div>
        </div>
      )}

      {accaTab === "value" && (
        valueAccas.length === 0 ? (
          <div className="bg-black/50 rounded-lg p-10 text-center text-slate-400 text-sm font-mono">No value bet accumulators found right now.</div>
        ) : (
          <div className="space-y-4">
            {valueAccas.map((acca, idx) => (
              <AccaCardRender key={`val-${idx}`} acca={acca} />
            ))}
          </div>
        )
      )}

      {accaTab === "highhit" && (
        accas.length === 0 ? (
          <div className="bg-black/50 rounded-lg p-10 text-center text-slate-400 text-sm font-mono">No accumulators available. Check back closer to match day.</div>
        ) : (
          <div className="space-y-4">
            {accas.map((acca, idx) => (
              <AccaCardRender key={`hh-${idx}`} acca={acca} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AccaCardRender({ acca }: { acca: Acca }) {
  return (
    <div className="bg-black/50 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white">{acca.name}</h3>
          <span className="text-xs text-slate-400 font-mono">{acca.legs} legs</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded px-2 py-1 text-xs font-bold font-mono border ${acca.risk === "LOW" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : acca.risk === "MEDIUM" ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "bg-rose-500/20 border-rose-500/30 text-rose-300"}`}>{acca.risk} RISK</div>
          <div className="text-right">
            <div className="text-lg font-extrabold font-mono text-amber-300">{acca.combinedOdds.toFixed(2)}</div>
            <div className="text-[10px] text-slate-400">odds</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold font-mono text-emerald-300">{(acca.combinedProbability * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-slate-400">probability</div>
          </div>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {acca.picks.map((pick, i) => {
          const ve = (pick as unknown as { valueEdge: number }).valueEdge;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs font-mono text-slate-500 w-5">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white font-medium truncate">{pick.matchLabel}</div>
                <div className="text-[10px] text-slate-400 truncate">{pick.league}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-mono text-amber-300 font-bold">{pick.marketName}</div>
                <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-mono font-bold text-emerald-300">{pick.selection}</span>
              </div>
              <div className="text-right shrink-0 w-16">
                <div className="text-sm font-bold font-mono text-emerald-300">{(pick.hitRate * 100).toFixed(0)}%</div>
                {ve > 0 && <div className="text-[10px] text-cyan-300 font-mono font-bold">+{(ve * 100).toFixed(1)}% value</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-4 py-2 bg-black/30 text-xs text-slate-400 font-mono">
        <span>Stake $10 → Return: <strong className="text-amber-300">${(10 * acca.combinedOdds).toFixed(2)}</strong></span>
        <span>Prob: <strong className="text-emerald-300">{(acca.combinedProbability * 100).toFixed(1)}%</strong></span>
      </div>
    </div>
  );
}

// --------------- CHAT ASSISTANT ---------------
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string; snippet: string }>;
}

function ChatAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.answer ?? "No answer found.",
        sources: data.sources,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Search failed. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-black/50 rounded-lg p-4">
        <h2 className="text-base font-bold text-white">Ask Anything</h2>
        <p className="text-xs text-slate-400 mt-1">Web search assistant — ask about players, transfers, stats, match previews, or anything football related</p>
      </div>

      {/* Chat messages */}
      <div className="space-y-3 min-h-[200px] max-h-[60vh] overflow-y-auto">
        {messages.length === 0 && (
          <div className="bg-black/30 rounded-lg p-6 text-center text-slate-400 text-sm">
            <p className="mb-3">Ask me anything about football. For example:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Who is the top scorer in World Cup 2026?", "Arsenal latest transfer news", "Mbappe career stats", "La Liga standings 2026"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="rounded-full bg-black/40 border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-3 ${
              msg.role === "user"
                ? "bg-amber-400/20 border border-amber-400/30 text-slate-100"
                : "bg-black/50 border border-white/10 text-slate-200"
            }`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                  <div className="text-[10px] text-slate-400 font-mono">Sources:</div>
                  {msg.sources.map((s, si) => (
                    <a
                      key={si}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-cyan-400 hover:text-cyan-300 truncate"
                    >
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-slate-400 animate-pulse font-mono">
              Searching the web...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask anything about football..."
          className="flex-1 rounded-lg border border-white/15 bg-black/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400 font-mono"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// --------------- BANKROLL TRACKER ---------------
function BankrollTracker() {
  const [data, setData] = useState<{
    balance: number; deposits: number; totalStaked: number; totalReturns: number;
    roi: number; profitLoss: number; totalBets: number; wonBets: number;
    entries: Array<{ id: number; type: string; amount: number; balance: number; description: string; createdAt: string }>;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("deposit");
  const [accountBalance, setAccountBalance] = useState("");

  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/bankroll").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid label="Loading bankroll..." />;

  async function submit() {
    if (!amount || !desc) return;
    const num = parseFloat(amount);
    if (isNaN(num)) return;
    const finalAmount = type === "bet" ? -Math.abs(num) : Math.abs(num);
    await fetch("/api/bankroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount: finalAmount, description: desc }),
    });
    setAmount(""); setDesc("");
    load();
  }

  async function setInitialBalance() {
    const num = parseFloat(accountBalance);
    if (isNaN(num) || num <= 0) return;
    await fetch("/api/bankroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "deposit", amount: num, description: "My account balance" }),
    });
    setAccountBalance("");
    load();
  }

  // First time — ask user to enter their account balance
  if (data && data.entries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-black/50 rounded-lg p-4">
          <h2 className="text-base font-bold text-white">Bankroll Tracker</h2>
          <p className="text-xs text-slate-400 mt-1">Enter your betting account balance to start tracking</p>
        </div>
        <div className="bg-black/50 rounded-lg p-6">
          <div className="text-sm font-bold text-white mb-2">What is your current betting account balance?</div>
          <p className="text-xs text-slate-400 mb-4">Enter the total amount currently in your betting account. This becomes your starting point for tracking profit and loss.</p>
          <div className="flex gap-2 items-center">
            <span className="text-2xl font-bold text-amber-300 font-mono">$</span>
            <input value={accountBalance} onChange={e => setAccountBalance(e.target.value)}
              placeholder="e.g. 500" type="number" step="0.01"
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-xl text-white outline-none focus:border-amber-400 font-mono" />
            <button onClick={setInitialBalance}
              className="rounded-lg bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300">
              Start Tracking
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-black/50 rounded-lg p-4">
        <h2 className="text-base font-bold text-white">Bankroll Tracker</h2>
        <p className="text-xs text-slate-400 mt-1">Track your betting account balance, bets, wins and ROI</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-black/50 rounded-lg p-3 text-center">
          <div className="text-xl font-extrabold font-mono text-amber-300">${(data?.balance ?? 0).toFixed(2)}</div>
          <div className="text-[10px] text-slate-400">Current Balance</div>
        </div>
        <div className="bg-black/50 rounded-lg p-3 text-center">
          <div className={`text-xl font-extrabold font-mono ${(data?.profitLoss ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {(data?.profitLoss ?? 0) >= 0 ? "+" : ""}{(data?.profitLoss ?? 0).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400">Profit / Loss</div>
        </div>
        <div className="bg-black/50 rounded-lg p-3 text-center">
          <div className={`text-xl font-extrabold font-mono ${(data?.roi ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {(data?.roi ?? 0).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400">ROI</div>
        </div>
        <div className="bg-black/50 rounded-lg p-3 text-center">
          <div className="text-xl font-extrabold font-mono text-white">{data?.totalBets ?? 0}</div>
          <div className="text-[10px] text-slate-400">Total Bets</div>
        </div>
      </div>

      {/* Record a transaction */}
      <div className="bg-black/50 rounded-lg p-4">
        <div className="text-xs text-slate-400 font-mono mb-2">RECORD TRANSACTION</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["deposit", "bet", "win", "withdraw"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`rounded px-3 py-1.5 text-xs font-bold capitalize ${type === t ? "bg-amber-400 text-slate-950" : "bg-black/40 text-slate-300 border border-white/15"}`}>
              {t === "deposit" ? "Deposit" : t === "bet" ? "Place Bet" : t === "win" ? "Bet Won" : "Withdraw"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" type="number"
            className="w-28 rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 font-mono" />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={type === "bet" ? "e.g. Arsenal Over 2.5 Goals" : type === "win" ? "e.g. Arsenal Over 2.5 WON" : "Description"}
            className="flex-1 rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
          <button onClick={submit} className="rounded bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">Add</button>
        </div>
      </div>

      {/* Transaction history */}
      {data?.entries && data.entries.length > 0 && (
        <div>
          <div className="mb-2 inline-block bg-black/60 rounded-lg px-3 py-1.5">
            <h3 className="text-sm font-bold text-white">Transaction History</h3>
          </div>
          <div className="bg-black/50 rounded-lg divide-y divide-white/5">
            {data.entries.map(e => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold font-mono ${
                    e.type === "win" ? "bg-emerald-500/20 text-emerald-300" :
                    e.type === "bet" ? "bg-rose-500/20 text-rose-300" :
                    e.type === "deposit" ? "bg-amber-500/20 text-amber-300" :
                    "bg-slate-500/20 text-slate-300"
                  }`}>{e.type.toUpperCase()}</span>
                  <span className="text-slate-200">{e.description}</span>
                </div>
                <div className="text-right font-mono flex items-center gap-3">
                  <span className={e.amount >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {e.amount >= 0 ? "+" : ""}{e.amount.toFixed(2)}
                  </span>
                  <span className="text-slate-500">Balance: ${e.balance.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// --------------- DAILY PICKS ---------------
function DailyPicksPage() {
  const [data, setData] = useState<{ date: string; totalMatches: number; picks: Array<{
    match: string; league: string; date: string; homeLogo: string | null; awayLogo: string | null;
    top3: Array<{ name: string; selection: string; hitRate: number; reason: string }>;
    valueBets: Array<{ name: string; selection: string; edge: number; odds: number; kelly: number }>;
  }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/daily-picks").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingGrid label="Generating today's best picks across all leagues..." />;

  return (
    <div className="space-y-6">
      <div className="bg-black/50 rounded-lg p-4">
        <h2 className="text-base font-bold text-white">Daily Picks Report — {data?.date}</h2>
        <p className="text-xs text-slate-400 mt-1">{data?.totalMatches ?? 0} matches analysed across top leagues</p>
      </div>

      {data?.picks?.map((p, idx) => (
        <div key={idx} className="bg-black/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            {p.homeLogo && <Image src={p.homeLogo} alt="" width={20} height={20} className="object-contain" unoptimized />}
            <span className="text-sm font-bold text-white">{p.match}</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">{p.league} | {p.date}</span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono mb-1">TOP 3 PICKS</div>
          <div className="space-y-1 mb-3">
            {p.top3.map((pick, i) => (
              <div key={i} className="flex items-center gap-2 bg-black/30 rounded px-3 py-2 text-xs">
                <span className="font-mono text-slate-500 w-4">{i+1}.</span>
                <span className="text-white flex-1">{pick.name}</span>
                <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono font-bold text-emerald-300">{pick.selection}</span>
                <span className="font-mono text-emerald-300">{(pick.hitRate*100).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          {p.valueBets.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 font-mono mb-1">VALUE BETS</div>
              {p.valueBets.map((vb, i) => (
                <div key={i} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded px-3 py-2 text-xs mb-1">
                  <span className="text-white flex-1">{vb.name} — {vb.selection}</span>
                  <span className="text-emerald-300 font-mono font-bold">+{(vb.edge*100).toFixed(1)}% edge</span>
                  <span className="text-amber-300 font-mono">{vb.odds.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {(!data?.picks || data.picks.length === 0) && (
        <div className="bg-black/50 rounded-lg p-10 text-center text-slate-400 text-sm font-mono">
          No upcoming matches to analyse right now.
        </div>
      )}
    </div>
  );
}

// --------------- ODDS CALCULATOR ---------------
function OddsCalculator() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<"decimal"|"american"|"fractional"|"probability">("decimal");
  const [result, setResult] = useState<{decimal:number;american:number;fractional:string;impliedProbability:number}|null>(null);
  const [dutchOdds, setDutchOdds] = useState("");
  const [dutchResult, setDutchResult] = useState<{selections:Array<{odds:number;stake:number;impliedProb:string}>;totalStake:number;guaranteedReturn:number;margin:string}|null>(null);

  async function convert() {
    const params = new URLSearchParams();
    if (format === "decimal") params.set("decimal", input);
    else if (format === "american") params.set("american", input);
    else if (format === "fractional") params.set("fractional", input);
    else params.set("probability", input);
    const r = await fetch(`/api/odds-calc?${params}`);
    const d = await r.json();
    setResult(d);
  }

  async function calcDutch() {
    if (!dutchOdds.trim()) return;
    const r = await fetch(`/api/odds-calc?decimal=1&dutch=${encodeURIComponent(dutchOdds)}`);
    const d = await r.json();
    setDutchResult(d.dutching);
  }

  return (
    <div className="space-y-6">
      <div className="bg-black/50 rounded-lg p-4">
        <h2 className="text-base font-bold text-white">Odds Calculator</h2>
        <p className="text-xs text-slate-400 mt-1">Convert between formats, calculate implied probability, dutching</p>
      </div>

      {/* Converter */}
      <div className="bg-black/50 rounded-lg p-4">
        <div className="text-xs text-slate-400 font-mono mb-2">ODDS CONVERTER</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["decimal","american","fractional","probability"] as const).map(f => (
            <button key={f} onClick={() => setFormat(f)} className={`rounded px-3 py-1 text-xs font-bold capitalize ${format===f?"bg-amber-400 text-slate-950":"bg-black/40 text-slate-300 border border-white/15"}`}>{f}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder={format === "decimal" ? "e.g. 2.50" : format === "american" ? "e.g. +150 or -200" : format === "fractional" ? "e.g. 3/2" : "e.g. 0.65"} onKeyDown={e => { if(e.key==="Enter") convert(); }}
            className="flex-1 rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 font-mono" />
          <button onClick={convert} className="rounded bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">Convert</button>
        </div>
        {result && (
          <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-4">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-[10px] text-slate-400 font-mono">DECIMAL</div>
              <div className="font-mono font-bold text-amber-300">{result.decimal.toFixed(3)}</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-[10px] text-slate-400 font-mono">AMERICAN</div>
              <div className="font-mono font-bold text-white">{result.american > 0 ? "+" : ""}{result.american}</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-[10px] text-slate-400 font-mono">FRACTIONAL</div>
              <div className="font-mono font-bold text-white">{result.fractional}</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-[10px] text-slate-400 font-mono">PROBABILITY</div>
              <div className="font-mono font-bold text-emerald-300">{result.impliedProbability}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Dutching */}
      <div className="bg-black/50 rounded-lg p-4">
        <div className="text-xs text-slate-400 font-mono mb-2">DUTCHING CALCULATOR</div>
        <p className="text-[10px] text-slate-400 mb-2">Enter decimal odds separated by commas (e.g. 2.50, 3.20, 4.00)</p>
        <div className="flex gap-2">
          <input value={dutchOdds} onChange={e => setDutchOdds(e.target.value)} placeholder="2.50, 3.20, 4.00"
            className="flex-1 rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 font-mono" />
          <button onClick={calcDutch} className="rounded bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">Calculate</button>
        </div>
        {dutchResult && (
          <div className="mt-3">
            <div className="space-y-1 mb-2">
              {dutchResult.selections.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-black/30 rounded px-3 py-1.5 text-xs font-mono">
                  <span className="text-white">Selection {i+1}: <span className="text-amber-300">{s.odds.toFixed(2)}</span></span>
                  <span className="text-slate-300">Stake: <span className="text-emerald-300">${s.stake.toFixed(2)}</span></span>
                  <span className="text-slate-400">{s.impliedProb}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs font-mono bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2">
              <span className="text-slate-300">Total stake: ${dutchResult.totalStake}</span>
              <span className="text-emerald-300 font-bold">Guaranteed return: ${dutchResult.guaranteedReturn.toFixed(2)}</span>
              <span className="text-slate-400">Margin: {dutchResult.margin}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------- ACCA PERF BLOCK ---------------
function AccaPerfBlock({ data }: { data: { total: number; won: number; lost: number; pending: number; winRate: number; roi: number; slips: Array<{ id: number; name: string; type: string; legs: number; odds: number; status: string; potentialReturn: number }> } }) {
  if (data.total === 0) return <div className="bg-black/50 rounded-lg p-6 text-center text-slate-400 text-sm font-mono">No records yet.</div>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="bg-black/50 rounded-lg p-2.5 text-center"><div className="text-lg font-extrabold font-mono text-amber-300">{data.total}</div><div className="text-[9px] text-slate-400">Total</div></div>
        <div className="bg-black/50 rounded-lg p-2.5 text-center"><div className="text-lg font-extrabold font-mono text-emerald-300">{data.won}</div><div className="text-[9px] text-slate-400">Won</div></div>
        <div className="bg-black/50 rounded-lg p-2.5 text-center"><div className="text-lg font-extrabold font-mono text-rose-300">{data.lost}</div><div className="text-[9px] text-slate-400">Lost</div></div>
        <div className="bg-black/50 rounded-lg p-2.5 text-center"><div className={`text-lg font-extrabold font-mono ${data.winRate >= 50 ? "text-emerald-300" : "text-rose-300"}`}>{data.winRate.toFixed(0)}%</div><div className="text-[9px] text-slate-400">Win Rate</div></div>
        <div className="bg-black/50 rounded-lg p-2.5 text-center"><div className={`text-lg font-extrabold font-mono ${data.roi >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{data.roi >= 0 ? "+" : ""}{data.roi.toFixed(1)}%</div><div className="text-[9px] text-slate-400">ROI</div></div>
      </div>
      {data.slips.length > 0 && (
        <div className="bg-black/50 rounded-lg divide-y divide-white/5">
          {data.slips.map(s => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-white font-medium">{s.name} <span className="text-slate-400 ml-1">{s.legs} legs | {s.odds?.toFixed(2)}</span></span>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold font-mono ${s.status === "won" ? "bg-emerald-500/20 text-emerald-300" : s.status === "lost" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>{s.status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------- VALUE BET ALERTS (Homepage) ---------------
function ValueAlerts() {
  const [alerts, setAlerts] = useState<Array<{
    match: string; league: string; market: string; selection: string;
    edge: number; odds: number; kelly: number; provider: string;
    homeLogo: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/daily-picks")
      .then(r => r.json())
      .then(d => {
        const values: typeof alerts = [];
        for (const pick of d.picks ?? []) {
          for (const vb of pick.valueBets ?? []) {
            if (vb.edge > 0.02) {
              values.push({
                match: pick.match, league: pick.league,
                market: vb.name, selection: vb.selection,
                edge: vb.edge, odds: vb.odds, kelly: vb.kelly,
                provider: "Best available", homeLogo: pick.homeLogo,
              });
            }
          }
        }
        setAlerts(values.sort((a, b) => b.edge - a.edge).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || alerts.length === 0) return null;

  return (
    <div className="bg-black/50 rounded-lg p-4">
      <div className="text-xs font-bold text-emerald-300 font-mono mb-3">VALUE BET ALERTS — Oracle Edge Over Bookmaker</div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
            {a.homeLogo && <Image src={a.homeLogo} alt="" width={18} height={18} className="object-contain" unoptimized />}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium truncate">{a.match}</div>
              <div className="text-[10px] text-slate-400">{a.league} | {a.market} — {a.selection}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-extrabold font-mono text-emerald-300">+{(a.edge * 100).toFixed(1)}%</div>
              <div className="text-[10px] text-slate-400 font-mono">{a.odds.toFixed(2)} odds</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
