import { fetchScoreboard, fetchSummary, type FixtureLite } from "@/lib/espn";
import { runEngineFromRealWithProfiles } from "@/lib/engine";
import { findValueBets, type BookmakerOdds } from "@/lib/engine/value";
import { TOP_FEED_SLUGS } from "@/lib/leagues";
import { db } from "@/db";
import { dailyPicks } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const slugs = TOP_FEED_SLUGS.slice(0, 12);
  const results = await Promise.all(slugs.map(s => fetchScoreboard(s)));
  const upcoming = results.flat().filter(f => f.state === "pre").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 20);

  const picks: Array<{
    match: string; league: string; date: string; homeLogo: string | null; awayLogo: string | null;
    top3: Array<{ name: string; selection: string; hitRate: number; reason: string }>;
    valueBets: Array<{ name: string; selection: string; edge: number; odds: number; kelly: number }>;
  }> = [];

  for (const fx of upcoming.slice(0, 10)) {
    try {
      const sum = await fetchSummary(fx.leagueSlug, fx.id);
      const pred = await runEngineFromRealWithProfiles(fx, sum);
      const odds: BookmakerOdds | null = sum?.odds ? {
        provider: sum.odds.provider ?? "DK",
        homeML: sum.odds.homeML ?? undefined, drawML: sum.odds.drawML ?? undefined,
        awayML: sum.odds.awayML ?? undefined, overUnder: sum.odds.overUnder ?? undefined,
      } : null;
      const vb = findValueBets(pred.markets, odds, fx.home.name, fx.away.name);

      const top3 = pred.top10.slice(0, 3).map(m => ({ name: m.name, selection: m.selection, hitRate: m.hitRate, reason: m.reason ?? "" }));

      picks.push({
        match: `${fx.home.name} vs ${fx.away.name}`,
        league: fx.leagueName, date: fx.date.slice(0, 10),
        homeLogo: fx.home.logo, awayLogo: fx.away.logo,
        top3,
        valueBets: vb.filter(v => v.valueEdge > 0).slice(0, 2).map(v => ({
          name: v.market.name, selection: v.market.selection,
          edge: v.valueEdge, odds: v.bookDecimalOdds, kelly: v.kellyStake,
        })),
      });

      // AUTO-TRACK: record this match's top-3 daily picks once per day so their
      // real outcomes can be settled and reported. Idempotent by (date, eventId).
      try {
        const pickDate = new Date().toISOString().slice(0, 10);
        const existing = await db
          .select({ id: dailyPicks.id })
          .from(dailyPicks)
          .where(and(eq(dailyPicks.pickDate, pickDate), eq(dailyPicks.eventId, fx.id)))
          .limit(1);
        if (!existing[0]) {
          await db.insert(dailyPicks).values({
            pickDate,
            match: `${fx.home.name} vs ${fx.away.name}`,
            league: fx.leagueName,
            leagueSlug: fx.leagueSlug,
            eventId: fx.id,
            picks: top3.map(p => ({ ...p, outcome: "PENDING" })),
            hits: 0, misses: 0, pending: top3.length, status: "pending",
          });
        }
      } catch { /* tracking is best-effort */ }
    } catch { /* skip */ }
  }

  const today = new Date().toISOString().slice(0, 10);
  return Response.json({ date: today, totalMatches: picks.length, picks });
}
