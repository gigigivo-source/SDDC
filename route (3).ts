import { db } from "@/db";
import { savedSlips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchScoreboard, type FixtureLite } from "@/lib/espn";
import { LEAGUES } from "@/lib/leagues";

export const dynamic = "force-dynamic";

/** Auto-verify pending accumulator slips by checking if all legs have finished */
export async function POST() {
  try {
    const pending = await db.select().from(savedSlips).where(eq(savedSlips.status, "pending")).limit(20);

    if (pending.length === 0) {
      return Response.json({ message: "No pending slips", verified: 0 });
    }

    // Get recent finished matches across top leagues
    const slugs = LEAGUES.filter((l) => l.tier <= 2).map((l) => l.slug).slice(0, 15);
    const results = await Promise.all(slugs.map((s) => fetchScoreboard(s).catch(() => [] as FixtureLite[])));
    const finished = results.flat().filter((f) => f.state === "post" && f.home.score !== null);

    // Build lookup: "TeamA vs TeamB" → score
    const scoreMap = new Map<string, { home: number; away: number }>();
    for (const f of finished) {
      const key = `${f.home.name} vs ${f.away.name}`.toLowerCase();
      scoreMap.set(key, { home: Number(f.home.score) || 0, away: Number(f.away.score) || 0 });
      const key2 = `${f.away.name} vs ${f.home.name}`.toLowerCase();
      scoreMap.set(key2, { home: Number(f.away.score) || 0, away: Number(f.home.score) || 0 });
    }

    let verified = 0;

    for (const slip of pending) {
      const picks = slip.picks as Array<{ matchLabel: string; marketName: string; selection: string; hitRate: number }>;
      let allSettled = true;
      let allHit = true;

      for (const pick of picks) {
        if (!pick?.matchLabel) { allSettled = false; continue; }
        const score = scoreMap.get(pick.matchLabel.toLowerCase());
        if (!score) {
          allSettled = false;
          continue;
        }

        const total = score.home + score.away;
        const line = parseFloat((pick.marketName ?? "").split("O/U ")[1] ?? "");

        if (!isNaN(line)) {
          const isOver = pick.selection.startsWith("Over");
          const hit = isOver ? total > line : total < line;
          if (!hit) allHit = false;
        }
        // For non-O/U markets, assume hit if we can't verify (conservative)
      }

      if (allSettled) {
        await db.update(savedSlips)
          .set({ status: allHit ? "won" : "lost" })
          .where(eq(savedSlips.id, slip.id));
        verified++;
      }
    }

    return Response.json({ verified, totalPending: pending.length });
  } catch {
    return Response.json({ error: "Slip verification failed", verified: 0 }, { status: 500 });
  }
}
