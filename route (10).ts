import { LEAGUE_MAP } from "@/lib/leagues";

export const dynamic = "force-dynamic";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

interface BoxscoreStat {
  name: string;
  home: string;
  away: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");
  const eventId = searchParams.get("event");

  if (!league || !eventId || !LEAGUE_MAP[league]) {
    return Response.json({ error: "Missing league or event." }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/${league}/summary?event=${eventId}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return Response.json({ stats: [], error: "Feed unavailable" });

    const data = await res.json();
    const teams = data.boxscore?.teams ?? [];
    if (teams.length < 2) return Response.json({ stats: [], error: "No boxscore data" });

    const homeStats: Record<string, string> = {};
    const awayStats: Record<string, string> = {};
    for (const s of teams[0]?.statistics ?? []) homeStats[s.name] = s.displayValue ?? "";
    for (const s of teams[1]?.statistics ?? []) awayStats[s.name] = s.displayValue ?? "";

    const statNames = [
      { key: "possessionPct", label: "Possession %" },
      { key: "totalShots", label: "Total Shots" },
      { key: "shotsOnTarget", label: "Shots on Target" },
      { key: "wonCorners", label: "Corners" },
      { key: "yellowCards", label: "Yellow Cards" },
      { key: "redCards", label: "Red Cards" },
      { key: "foulsCommitted", label: "Fouls" },
      { key: "offsides", label: "Offsides" },
      { key: "saves", label: "Saves" },
      { key: "totalPasses", label: "Total Passes" },
      { key: "accuratePasses", label: "Accurate Passes" },
      { key: "passPct", label: "Pass Accuracy" },
      { key: "totalTackles", label: "Tackles" },
      { key: "interceptions", label: "Interceptions" },
      { key: "totalClearance", label: "Clearances" },
      { key: "blockedShots", label: "Blocked Shots" },
    ];

    const stats: BoxscoreStat[] = statNames
      .filter((s) => homeStats[s.key] !== undefined || awayStats[s.key] !== undefined)
      .map((s) => ({
        name: s.label,
        home: homeStats[s.key] ?? "—",
        away: awayStats[s.key] ?? "—",
      }));

    const homeTeam = teams[0]?.team?.displayName ?? "Home";
    const awayTeam = teams[1]?.team?.displayName ?? "Away";

    return Response.json({ homeTeam, awayTeam, stats });
  } catch {
    return Response.json({ stats: [], error: "Failed to fetch boxscore" });
  }
}
