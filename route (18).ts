import { LEAGUE_MAP } from "@/lib/leagues";

export const dynamic = "force-dynamic";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

interface KeyEvent {
  minute: string;
  type: string;
  icon: string;
  text: string;
  team?: string;
}

interface LiveStat {
  name: string;
  home: string;
  away: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");
  const eventId = searchParams.get("event");

  if (!league || !eventId) {
    return Response.json({ error: "Missing league or event." }, { status: 400 });
  }

  try {
    const res = await fetch(`${ESPN_BASE}/${league}/summary?event=${eventId}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return Response.json({ error: "Feed unavailable" }, { status: 502 });

    const data = await res.json();

    // Key events (goals, cards, subs)
    const keyEvents: KeyEvent[] = (data.keyEvents ?? []).map((e: Record<string, unknown>) => {
      const t = e.type as Record<string, string> | undefined;
      const typeStr = t?.type ?? t?.text ?? "event";
      const icon = typeStr;
      const clock = e.clock as Record<string, string> | undefined;
      const team = e.team as Record<string, string> | undefined;
      return {
        minute: clock?.displayValue ?? "",
        type: typeStr,
        icon,
        text: (e.shortText ?? e.text ?? "") as string,
        team: team?.displayName,
      };
    });

    // Commentary feed
    const commentary: Array<{ minute: string; text: string }> = (data.commentary ?? []).map(
      (c: Record<string, unknown>) => {
        const time = c.time as Record<string, string> | undefined;
        return {
          minute: time?.displayValue ?? "",
          text: (c.text ?? "") as string,
        };
      }
    );

    // Live/current boxscore stats
    const teams = data.boxscore?.teams ?? [];
    const stats: LiveStat[] = [];
    if (teams.length >= 2) {
      const statNames = [
        { key: "possessionPct", label: "Possession %" },
        { key: "totalShots", label: "Shots" },
        { key: "shotsOnTarget", label: "Shots on Target" },
        { key: "wonCorners", label: "Corners" },
        { key: "yellowCards", label: "Yellow Cards" },
        { key: "redCards", label: "Red Cards" },
        { key: "foulsCommitted", label: "Fouls" },
        { key: "offsides", label: "Offsides" },
        { key: "saves", label: "Saves" },
        { key: "totalPasses", label: "Passes" },
        { key: "passPct", label: "Pass Accuracy" },
      ];
      const homeStats: Record<string, string> = {};
      const awayStats: Record<string, string> = {};
      for (const s of teams[0]?.statistics ?? []) homeStats[s.name] = s.displayValue ?? "";
      for (const s of teams[1]?.statistics ?? []) awayStats[s.name] = s.displayValue ?? "";

      for (const s of statNames) {
        if (homeStats[s.key] !== undefined || awayStats[s.key] !== undefined) {
          stats.push({ name: s.label, home: homeStats[s.key] ?? "0", away: awayStats[s.key] ?? "0" });
        }
      }
    }

    const homeTeam = teams[0]?.team?.displayName ?? "Home";
    const awayTeam = teams[1]?.team?.displayName ?? "Away";

    // Lineups
    const lineups = (data.rosters ?? []).map((r: Record<string, unknown>) => ({
      side: r.homeAway as string,
      players: ((r.roster ?? []) as Array<Record<string, unknown>>).map((p) => ({
        name: (p.athlete as Record<string, string>)?.displayName ?? "?",
        jersey: p.jersey as string,
        starter: !!p.starter,
        position: (p.position as Record<string, string>)?.abbreviation,
      })),
    }));

    return Response.json({
      homeTeam,
      awayTeam,
      keyEvents,
      commentary: commentary.slice(0, 30),
      stats,
      lineups,
      leagueName: LEAGUE_MAP[league]?.name ?? league,
    });
  } catch {
    return Response.json({ error: "Failed to fetch live data" }, { status: 502 });
  }
}
