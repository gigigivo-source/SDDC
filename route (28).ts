import { fetchScoreboard, type FixtureLite } from "@/lib/espn";
import { TOP_FEED_SLUGS } from "@/lib/leagues";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");

  // If a specific league is requested, fetch its recent results
  if (league) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const dateRange = `${fmt(from)}-${fmt(now)}`;
    const fixtures = await fetchScoreboard(league, dateRange);
    const results = fixtures
      .filter((f) => f.state === "post")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return Response.json({ results, count: results.length });
  }

  // Otherwise fetch recent results from top leagues (wider range to catch off-season)
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const dateRange = `${fmt(from)}-${fmt(now)}`;

  // Include World Cup, UCL, and Copa America explicitly alongside regular leagues
  const extraSlugs = ["fifa.world", "uefa.champions", "uefa.europa", "conmebol.libertadores", "conmebol.america"];
  const baseSlugs = TOP_FEED_SLUGS.slice(0, 10);
  const slugs = [...new Set([...extraSlugs, ...baseSlugs])];
  const all = await Promise.all(slugs.map((s) => fetchScoreboard(s, dateRange)));
  const results: FixtureLite[] = all
    .flat()
    .filter((f) => f.state === "post")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 40);

  return Response.json({ results, count: results.length });
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
