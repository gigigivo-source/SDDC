import { fetchScoreboard, type FixtureLite } from "@/lib/espn";
import { LEAGUES } from "@/lib/leagues";

export const dynamic = "force-dynamic";

// In-memory cache to avoid rescanning all 77 leagues on every search
let fixtureCache: FixtureLite[] = [];
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFixtureCache(): Promise<FixtureLite[]> {
  if (Date.now() - cacheTime < CACHE_TTL && fixtureCache.length > 0) {
    return fixtureCache;
  }

  const slugs = LEAGUES.map((l) => l.slug);
  const batchSize = 20;
  const all: FixtureLite[] = [];

  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((s) => fetchScoreboard(s).catch(() => [] as FixtureLite[])));
    all.push(...results.flat());
  }

  // Also fetch international with date range
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 7);
  const to = new Date(now); to.setDate(to.getDate() + 14);
  const range = `${fmt(from)}-${fmt(to)}`;
  const intl = ["fifa.world", "uefa.champions", "uefa.europa", "conmebol.america", "uefa.euro", "fifa.friendly"];
  const intlRes = await Promise.all(intl.map((s) => fetchScoreboard(s, range).catch(() => [] as FixtureLite[])));
  all.push(...intlRes.flat());

  // Deduplicate
  const seen = new Set<string>();
  fixtureCache = [];
  for (const f of all) {
    if (!seen.has(f.id)) { seen.add(f.id); fixtureCache.push(f); }
  }
  cacheTime = Date.now();
  return fixtureCache;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  if (q.length < 2) {
    return Response.json({ results: [] });
  }

  const fixtures = await getFixtureCache();

  const matches = fixtures.filter((f) => {
    const s = `${f.home.name} ${f.away.name} ${f.home.shortName} ${f.away.shortName} ${f.leagueName}`.toLowerCase();
    return s.includes(q);
  });

  matches.sort((a, b) => {
    const rank = (s: string) => (s === "in" ? 0 : s === "pre" ? 1 : 2);
    if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return Response.json({ results: matches.slice(0, 20), cached: true, total: fixtures.length });
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
