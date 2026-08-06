import { LEAGUE_MAP } from "@/lib/leagues";

export const dynamic = "force-dynamic";

const BASE = "https://site.api.espn.com/apis/v2/sports/soccer";

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");

  if (!league || !LEAGUE_MAP[league]) {
    return Response.json({ error: "Unknown or missing league slug." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BASE}/${league}/standings`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return Response.json({ entries: [], error: "Feed unavailable" });

    const data = await res.json();
    const groups = data.children ?? [];
    const entries: StandingsEntry[] = [];

    for (const group of groups) {
      const standings = group.standings?.entries ?? [];
      for (const entry of standings) {
        const stats: Record<string, string> = {};
        for (const s of entry.stats ?? []) {
          stats[s.name ?? s.abbreviation] = s.displayValue ?? String(s.value ?? "");
        }

        entries.push({
          rank: Number(stats.rank ?? stats.gamesBehind ?? entries.length + 1),
          team: entry.team?.displayName ?? entry.team?.name ?? "Unknown",
          teamLogo: entry.team?.logos?.[0]?.href ?? null,
          played: Number(stats.gamesPlayed ?? 0),
          won: Number(stats.wins ?? 0),
          drawn: Number(stats.ties ?? stats.draws ?? 0),
          lost: Number(stats.losses ?? 0),
          goalsFor: Number(stats.pointsFor ?? 0),
          goalsAgainst: Number(stats.pointsAgainst ?? 0),
          goalDifference: Number(stats.pointDifferential ?? stats.goalDifference ?? 0),
          points: Number(stats.points ?? 0),
          form: stats.overall ?? "",
        });
      }
    }

    entries.sort((a, b) => a.rank - b.rank);

    return Response.json({
      league: LEAGUE_MAP[league],
      entries,
    });
  } catch {
    return Response.json({ entries: [], error: "Failed to fetch standings" });
  }
}
