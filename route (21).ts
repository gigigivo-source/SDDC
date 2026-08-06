import { LEAGUE_MAP } from "@/lib/leagues";
import { searchFixture, getMultiBookOdds } from "@/lib/apiFootball";

export const dynamic = "force-dynamic";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

function mlToDecimal(ml: number): number {
  if (ml > 0) return ml / 100 + 1;
  return 100 / Math.abs(ml) + 1;
}

interface OddsLine {
  provider: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  overUnder?: number;
  overOdds?: number;
  underOdds?: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");
  const eventId = searchParams.get("event");
  const home = searchParams.get("home") ?? "";
  const away = searchParams.get("away") ?? "";
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const lines: OddsLine[] = [];

  // 1. ESPN/DraftKings odds
  if (league && eventId) {
    try {
      const res = await fetch(`${ESPN_BASE}/${league}/summary?event=${eventId}`, { next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        const pc = data.pickcenter?.[0];
        if (pc) {
          const ml = pc.moneyline;
          const total = pc.total;
          if (ml?.home?.close?.odds) {
            lines.push({
              provider: pc.provider?.name ?? "DraftKings",
              homeOdds: mlToDecimal(Number(ml.home.close.odds)),
              drawOdds: ml?.draw?.close?.odds ? mlToDecimal(Number(ml.draw.close.odds)) : 0,
              awayOdds: ml?.away?.close?.odds ? mlToDecimal(Number(ml.away.close.odds)) : 0,
              overUnder: pc.overUnder,
              overOdds: total?.over?.close?.odds ? mlToDecimal(Number(total.over.close.odds)) : undefined,
              underOdds: total?.under?.close?.odds ? mlToDecimal(Number(total.under.close.odds)) : undefined,
            });
          }
        }
      }
    } catch { /* skip */ }
  }

  // 2. API-Football — 11 bookmakers (Bet365, Pinnacle, Betfair, 1xBet, William Hill, etc.)
  if (home && away) {
    try {
      const fixtureId = await searchFixture(home, away, date);
      if (fixtureId) {
        const multiOdds = await getMultiBookOdds(fixtureId);
        if (multiOdds) {
          for (const bm of multiOdds.bookmakers) {
            // Don't duplicate if same provider already from ESPN
            if (!lines.some(l => l.provider.toLowerCase().includes(bm.bookmaker.toLowerCase().slice(0, 5)))) {
              lines.push({
                provider: bm.bookmaker,
                homeOdds: bm.homeOdds,
                drawOdds: bm.drawOdds,
                awayOdds: bm.awayOdds,
              });
            }
          }
          // Add O/U lines from API-Football
          for (const ou of multiOdds.overUnderLines.slice(0, 5)) {
            const existing = lines.find(l => l.provider === ou.bookmaker);
            if (existing && !existing.overUnder) {
              existing.overUnder = parseFloat(ou.line);
              existing.overOdds = ou.over;
              existing.underOdds = ou.under;
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  // Find best odds
  const bestHome = lines.length > 0 ? Math.max(...lines.map(l => l.homeOdds).filter(o => o > 0)) : 0;
  const bestDraw = lines.length > 0 ? Math.max(...lines.map(l => l.drawOdds).filter(o => o > 0)) : 0;
  const bestAway = lines.length > 0 ? Math.max(...lines.map(l => l.awayOdds).filter(o => o > 0)) : 0;

  return Response.json({
    lines,
    bestOdds: { home: bestHome, draw: bestDraw, away: bestAway },
    providers: [...new Set(lines.map(l => l.provider))],
    count: lines.length,
    hasMultipleProviders: new Set(lines.map(l => l.provider)).size > 1,
  });
}
