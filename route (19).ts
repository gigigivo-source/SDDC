import { db } from "@/db";
import { predictions, performanceLog } from "@/db/schema";
import { fetchSummary, type FixtureLite } from "@/lib/espn";
import { runEngineFromRealWithProfiles, evaluateFinishedMatch } from "@/lib/engine";
import { findValueBets, type BookmakerOdds, type ValueBet } from "@/lib/engine/value";
import { searchFixture, getMultiBookOdds } from "@/lib/apiFootball";
import { LEAGUE_MAP } from "@/lib/leagues";
import { withMonitoring } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

interface BoxStat {
  name: string;
  displayValue: string;
}

/** Fetch actual post-match boxscore stats from ESPN */
async function fetchBoxscore(
  slug: string,
  eventId: string,
  homeName: string,
  awayName: string
): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`${ESPN_BASE}/${slug}/summary?event=${eventId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const teams = data.boxscore?.teams;
    if (!teams || teams.length < 2) return null;

    const parse = (stats: BoxStat[]) => {
      const m: Record<string, number> = {};
      for (const s of stats) m[s.name] = parseFloat(s.displayValue) || 0;
      return m;
    };

    const home = parse(teams[0]?.statistics ?? []);
    const away = parse(teams[1]?.statistics ?? []);

    return {
      homeGoals: Number(home.totalGoals) || 0,
      awayGoals: Number(away.totalGoals) || 0,
      homeShots: home.totalShots ?? 0,
      awayShots: away.totalShots ?? 0,
      homeSot: home.shotsOnTarget ?? 0,
      awaySot: away.shotsOnTarget ?? 0,
      homeCorners: home.wonCorners ?? 0,
      awayCorners: away.wonCorners ?? 0,
      homeCards: home.yellowCards ?? 0,
      awayCards: away.yellowCards ?? 0,
      homeFouls: home.foulsCommitted ?? 0,
      awayFouls: away.foulsCommitted ?? 0,
      homeOffsides: home.offsides ?? 0,
      awayOffsides: away.offsides ?? 0,
      homeSaves: home.saves ?? 0,
      awaySaves: away.saves ?? 0,
      homeInterceptions: home.interceptions ?? 0,
      awayInterceptions: away.interceptions ?? 0,
      homeTackles: home.totalTackles ?? 0,
      awayTackles: away.totalTackles ?? 0,
      homeClearances: home.totalClearance ?? 0,
      awayClearances: away.totalClearance ?? 0,
      homePasses: home.totalPasses ?? 0,
      awayPasses: away.totalPasses ?? 0,
      homeRedCards: home.redCards ?? 0,
      awayRedCards: away.redCards ?? 0,
      homePenaltyGoals: home.penaltyKickGoals ?? 0,
      awayPenaltyGoals: away.penaltyKickGoals ?? 0,
    };
  } catch {
    return null;
  }
}

async function handlePost(req: Request): Promise<Response> {
  let fixture: FixtureLite;
  try {
    const body = await req.json();
    fixture = body.fixture as FixtureLite;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!fixture?.id || !fixture?.leagueSlug || !fixture?.home || !fixture?.away) {
    return Response.json({ error: "Missing fixture data." }, { status: 400 });
  }
  if (!LEAGUE_MAP[fixture.leagueSlug]) {
    return Response.json({ error: "Unknown league." }, { status: 400 });
  }

  const summary = await fetchSummary(fixture.leagueSlug, fixture.id);
  // For LIVE matches, fetch current in-play stats so the engine can lock any
  // markets already decided and re-calibrate the rest against live reality.
  let liveStats: Record<string, number> | null = null;
  if (fixture.state === "in") {
    liveStats = await fetchBoxscore(
      fixture.leagueSlug,
      fixture.id,
      fixture.home.name,
      fixture.away.name,
    );
  }

  const prediction = await runEngineFromRealWithProfiles(fixture, summary, liveStats);

  // For finished matches: fetch REAL boxscore and verify every Top 10 market
  let boxscore: Record<string, number> | null = null;
  if (fixture.state === "post" && fixture.home.score !== null) {
    boxscore = await fetchBoxscore(
      fixture.leagueSlug,
      fixture.id,
      fixture.home.name,
      fixture.away.name
    );
    evaluateFinishedMatch(fixture, prediction, boxscore);

    // Log performance record
    const h = prediction.hitCount ?? 0;
    const evalC = prediction.evaluatedCount ?? 0;
    const miss = prediction.top10.filter((m) => m.outcome === "MISS").length;
    const pend = prediction.top10.filter((m) => m.outcome === "PENDING" || !m.outcome).length;
    try {
      await db.insert(performanceLog).values({
        eventId: fixture.id,
        matchLabel: `${fixture.home.name} vs ${fixture.away.name}`,
        homeTeam: fixture.home.name,
        awayTeam: fixture.away.name,
        league: fixture.leagueName,
        leagueSlug: fixture.leagueSlug,
        matchDate: fixture.date.slice(0, 10),
        homeScore: Number(fixture.home.score) || 0,
        awayScore: Number(fixture.away.score) || 0,
        totalPicks: prediction.top10.length,
        hits: h,
        misses: miss,
        pending: pend,
        accuracy: evalC > 0 ? h / evalC : 0,
        top10Detail: prediction.top10.map((m) => ({
          name: m.name,
          selection: m.selection,
          hitRate: m.hitRate,
          outcome: m.outcome,
          family: m.family,
        })),
      });
    } catch (e) {
      console.error("performance log failed", e);
    }
  }

  try {
    await db.insert(predictions).values({
      matchLabel: `${fixture.home.name} vs ${fixture.away.name}`,
      homeTeam: fixture.home.name,
      awayTeam: fixture.away.name,
      league: fixture.leagueName,
      leagueSlug: fixture.leagueSlug,
      eventId: fixture.id,
      matchDate: fixture.date.slice(0, 10),
      tournamentStage: prediction.match.tournamentStage ?? "",
      topPick: prediction.top1[0]?.name ?? "N/A",
      topHitRate: prediction.top1[0]?.hitRate ?? 0,
      totalMarkets: prediction.totalMarkets,
      qualifiedMarkets: prediction.qualifiedMarkets,
      dataCompleteness: prediction.match.dataCompletenessScore,
      result: prediction,
    });
  } catch (e) {
    console.error("persist match prediction failed", e);
  }

  // Extract full bookmaker odds for value detection
  let bookOdds: BookmakerOdds | null = null;
  let valueBets: ValueBet[] = [];

  if (summary) {
    // Odds come through the summary.odds field we already parse
    const o = summary.odds;
    if (o) {
      bookOdds = {
        provider: o.provider ?? "DraftKings",
        homeML: o.homeML ?? undefined,
        drawML: o.drawML ?? undefined,
        awayML: o.awayML ?? undefined,
        overUnder: o.overUnder ?? undefined,
      };
    }
  }

  // Also try to get detailed odds from ESPN pickcenter
  try {
    const summaryRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${fixture.leagueSlug}/summary?event=${fixture.id}`,
      { next: { revalidate: 300 } }
    );
    if (summaryRes.ok) {
      const raw = await summaryRes.json();
      const pc = raw.pickcenter?.[0];
      if (pc) {
        const total = pc.total;
        const ml = pc.moneyline;
        bookOdds = {
          provider: pc.provider?.name ?? "DraftKings",
          homeML: ml?.home?.close?.odds ? Number(ml.home.close.odds) : bookOdds?.homeML,
          drawML: ml?.draw?.close?.odds ? Number(ml.draw.close.odds) : bookOdds?.drawML,
          awayML: ml?.away?.close?.odds ? Number(ml.away.close.odds) : bookOdds?.awayML,
          overUnder: pc.overUnder ?? bookOdds?.overUnder,
          overOdds: total?.over?.close?.odds ? Number(total.over.close.odds) : undefined,
          underOdds: total?.under?.close?.odds ? Number(total.under.close.odds) : undefined,
          openHomeML: ml?.home?.open?.odds ? Number(ml.home.open.odds) : undefined,
          openAwayML: ml?.away?.open?.odds ? Number(ml.away.open.odds) : undefined,
          openDrawML: ml?.draw?.open?.odds ? Number(ml.draw.open.odds) : undefined,
          openOverOdds: total?.over?.open?.odds ? Number(total.over.open.odds) : undefined,
          openUnderOdds: total?.under?.open?.odds ? Number(total.under.open.odds) : undefined,
          spreadHome: pc.pointSpread?.home?.close?.odds ? Number(pc.pointSpread.home.close.odds) : undefined,
          spreadAway: pc.pointSpread?.away?.close?.odds ? Number(pc.pointSpread.away.close.odds) : undefined,
          spreadLine: pc.pointSpread?.home?.close?.line ? Number(pc.pointSpread.home.close.line) : undefined,
        };
      }
    }
  } catch {
    // Use whatever odds we already have
  }

  // Enrich with API-Football multi-bookmaker odds (11 bookmakers)
  let multiBookOdds: Array<{ bookmaker: string; homeOdds: number; drawOdds: number; awayOdds: number }> = [];
  if (fixture.state === "pre") {
    try {
      const apiFootballId = await searchFixture(fixture.home.name, fixture.away.name, fixture.date.slice(0, 10));
      if (apiFootballId) {
        const multiOdds = await getMultiBookOdds(apiFootballId);
        if (multiOdds) {
          multiBookOdds = multiOdds.bookmakers;
          // Use the best available odds for value detection
          if (!bookOdds || multiOdds.bestHome > (bookOdds.homeML ? (1 / (Math.abs(bookOdds.homeML) / (Math.abs(bookOdds.homeML) + 100))) : 0)) {
            // API-Football has better data — use Pinnacle as primary
            const pinnacle = multiOdds.bookmakers.find(b => b.bookmaker === "Pinnacle");
            const best = pinnacle ?? multiOdds.bookmakers[0];
            if (best) {
              bookOdds = {
                ...bookOdds,
                provider: best.bookmaker,
                homeML: best.homeOdds >= 2 ? (best.homeOdds - 1) * 100 : -100 / (best.homeOdds - 1),
                drawML: best.drawOdds >= 2 ? (best.drawOdds - 1) * 100 : -100 / (best.drawOdds - 1),
                awayML: best.awayOdds >= 2 ? (best.awayOdds - 1) * 100 : -100 / (best.awayOdds - 1),
              };
            }
          }
        }
      }
    } catch { /* API-Football optional */ }
  }

  // Find value bets
  if (bookOdds && fixture.state === "pre") {
    valueBets = findValueBets(
      prediction.markets,
      bookOdds,
      fixture.home.name,
      fixture.away.name
    );
  }

  return Response.json({ fixture, summary, prediction, boxscore, bookOdds, valueBets, multiBookOdds });
}

export const POST = withMonitoring("api/match", handlePost);
