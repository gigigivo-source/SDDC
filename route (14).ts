import { fetchScoreboard, type FixtureLite } from "@/lib/espn";
import { LEAGUE_MAP } from "@/lib/leagues";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");
  const dates = searchParams.get("dates") ?? undefined;

  if (!league || !LEAGUE_MAP[league]) {
    return Response.json({ error: "Unknown or missing league slug." }, { status: 400 });
  }

  // Fetch current/upcoming fixtures
  const fixtures = await fetchScoreboard(league, dates);

  // Also fetch recent results (last 30 days) for this league
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const recentRange = `${fmt(from)}-${fmt(now)}`;
  let recentResults: FixtureLite[] = [];
  try {
    const recent = await fetchScoreboard(league, recentRange);
    recentResults = recent
      .filter((f) => f.state === "post")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  } catch {
    // ignore
  }

  // Sort main fixtures: live first, then upcoming, then finished
  fixtures.sort((a, b) => {
    const rank = (s: string) => (s === "in" ? 0 : s === "pre" ? 1 : 2);
    if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Separate upcoming from finished in main feed
  const upcoming = fixtures.filter((f) => f.state === "pre" || f.state === "in");
  const finished = fixtures.filter((f) => f.state === "post");

  // Merge recent results (deduplicate by ID)
  const seenIds = new Set(finished.map((f) => f.id));
  for (const r of recentResults) {
    if (!seenIds.has(r.id)) {
      finished.push(r);
      seenIds.add(r.id);
    }
  }

  return Response.json({
    league: LEAGUE_MAP[league],
    fixtures: [...upcoming, ...finished],
    upcoming,
    results: finished.slice(0, 20),
    upcomingCount: upcoming.length,
    resultsCount: finished.length,
  });
}
