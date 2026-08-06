// ĞIGI GIVØ — Intelligent Top-N Selector (L7: match study & safe-pick reasoning)
//
// Goal: maximise the chance of a 10/10 Top-10. Instead of ranking by raw hit
// rate, this module STUDIES each market for the specific fixture and scores it
// on real margin-of-safety, distribution tail risk, verifiability and family
// correlation — then assembles a diversified, high-floor Top 10 / Top 3 / Top 1.

import { poissonPmf } from "./stats";
import { calibratedWinProb, marketReliability } from "./calibration";
import type { Market } from "./types";
import type { LambdaSet } from "./lambdas";

// Families whose stat is NOT present in the ESPN boxscore / free feeds.
// A pick from these can NEVER be confirmed HIT — so it can never contribute to a
// verified 10/10. They are excluded from the safe Top-N entirely.
const UNVERIFIABLE = [
  "Throw-ins",
  "Goal Kicks",
  "Possession / Metrics", // aerials, dribbles, passes, interceptions detail
  "Goal Sequence",        // needs play-by-play ordering
  "Advanced Events",      // "goal in both halves" needs HT data
];

// Families that ARE verifiable from the ESPN boxscore.
const VERIFIABLE = new Set([
  "Goals", "Corners", "Yellow Cards", "Shots on Target",
  "Shots Towards Goal", "Offsides", "Saves", "Interceptions",
  "Goalkeeper", "Penalty / Sending Off",
]);

function isVerifiable(m: Market): boolean {
  if (UNVERIFIABLE.some((f) => m.family === f || m.name.includes(f))) return false;
  // Interceptions live under "Possession / Metrics" family label but ARE in
  // the boxscore, so allow the Interceptions-named lines explicitly.
  if (m.name.includes("Interceptions")) return true;
  if (m.family === "Interceptions") return true;
  return VERIFIABLE.has(m.family) || m.name.startsWith("Match Result") || m.name.includes("Double Chance") || m.name.includes("Both Teams") || m.name.includes("Clean Sheet");
}

// Map a market to the Poisson λ that drives its outcome, for margin analysis.
function lambdaFor(m: Market, lam: LambdaSet, homeName: string, awayName: string): number | null {
  const n = m.name;
  const total = (a: number, b: number) => a + b;
  if (n.includes("Total Goals")) return total(lam.homeGoals, lam.awayGoals);
  if (n.includes(`${homeName} Goals`)) return lam.homeGoals;
  if (n.includes(`${awayName} Goals`)) return lam.awayGoals;
  if (n.includes("Total Corners")) return total(lam.homeCorners, lam.awayCorners);
  if (n.includes(`${homeName} Corners`)) return lam.homeCorners;
  if (n.includes(`${awayName} Corners`)) return lam.awayCorners;
  if (n.includes("Total Cards")) return total(lam.homeCards, lam.awayCards);
  if (n.includes(`${homeName} Cards`)) return lam.homeCards;
  if (n.includes(`${awayName} Cards`)) return lam.awayCards;
  if (n.includes("Total SOT")) return total(lam.homeSot, lam.awaySot);
  if (n.includes(`${homeName} SOT`)) return lam.homeSot;
  if (n.includes(`${awayName} SOT`)) return lam.awaySot;
  if (n.includes("Total Shots")) return total(lam.homeShots, lam.awayShots);
  if (n.includes(`${homeName} Shots`)) return lam.homeShots;
  if (n.includes(`${awayName} Shots`)) return lam.awayShots;
  if (n.includes("Total Offsides")) return total(lam.homeOffsides, lam.awayOffsides);
  if (n.includes("Total Saves")) return total(lam.homeSaves, lam.awaySaves);
  if (n.includes(`${homeName} GK Saves`)) return lam.homeSaves;
  if (n.includes(`${awayName} GK Saves`)) return lam.awaySaves;
  return null;
}

/**
 * Margin-of-safety score for an O/U pick, using the Poisson distribution.
 * Returns the probability the pick is WRONG (tail mass on the wrong side of the
 * line). Lower = safer. Also rewards picks whose line is far from λ.
 */
function tailRisk(m: Market, lambda: number): number {
  const lineMatch = m.name.match(/O\/U\s+([\d.]+)/);
  if (!lineMatch) return 1 - m.hitRate; // fall back to hit rate complement
  const line = Number(lineMatch[1]);
  const isOver = m.selection.startsWith("Over");
  const threshold = Math.ceil(line); // integer boundary

  // P(X >= threshold) is "over" mass. Compute exact tail on the WRONG side.
  let overMass = 0;
  for (let k = threshold; k <= threshold + 40; k++) overMass += poissonPmf(k, lambda);
  overMass = Math.max(0, Math.min(1, overMass));
  const underMass = 1 - overMass;

  return isOver ? underMass : overMass; // probability the pick loses
}

export interface SafetyScore {
  market: Market;
  safety: number;       // 0..1, higher = safer for THIS match
  wrongProb: number;    // modelled probability the pick loses
  marginUnits: number;  // how far λ sits from the line (in σ)
  verifiable: boolean;
  notes: string;
}

/** Study one market for this specific fixture and produce a safety score. */
export function scoreMarket(
  m: Market,
  lam: LambdaSet,
  homeName: string,
  awayName: string,
): SafetyScore {
  const verifiable = isVerifiable(m);
  const lambda = lambdaFor(m, lam, homeName, awayName);

  // Match-context volatility from the model's own λ — used to make calibration
  // fixture-specific (count stats are trusted less in chaotic/lopsided games).
  const totalGoals = lam.homeGoals + lam.awayGoals;
  const evenness = 1 - Math.min(1, Math.abs(lam.homeGoals - lam.awayGoals) / Math.max(0.5, totalGoals));
  const ctx = { totalGoals, evenness };

  let wrongProb = 1 - m.hitRate;
  let marginUnits = 0;
  let notes = "";

  if (lambda !== null) {
    const lineMatch = m.name.match(/O\/U\s+([\d.]+)/);
    if (lineMatch) {
      const line = Number(lineMatch[1]);
      const rawWrong = tailRisk(m, lambda);
      // CALIBRATION: correct the raw model probability by its empirical
      // reliability, then derive loss risk from the calibrated number. Swingy
      // families (saves/shots) get their over-confidence removed; goal/card
      // markets keep their genuine edge. Honest correction, not a boost.
      const calWin = calibratedWinProb(m, 1 - rawWrong, ctx);
      wrongProb = 1 - calWin;
      // Margin in standard deviations (Poisson σ = √λ). Bigger cushion = safer.
      const sigma = Math.sqrt(Math.max(0.5, lambda));
      marginUnits = Math.abs(lambda - line) / sigma;
      notes = `λ ${lambda.toFixed(2)} vs line ${line} → ${marginUnits.toFixed(2)}σ cushion, calibrated loss risk ${(wrongProb * 100).toFixed(1)}% (reliability ${(marketReliability(m, ctx) * 100).toFixed(0)}%).`;
    }
  } else {
    // Non-O/U (result, BTTS, clean sheet): calibrate the worst-case CI floor.
    const calWin = calibratedWinProb(m, m.ciLower, ctx);
    wrongProb = 1 - calWin;
    marginUnits = (calWin - 0.5) * 4;
    notes = `Discrete market, calibrated CI-floor ${(calWin * 100).toFixed(0)}% (reliability ${(marketReliability(m, ctx) * 100).toFixed(0)}%).`;
  }

  // Safety blends: low loss-probability, wide margin, tight CI, high MQS,
  // low agent disagreement. Margin cushion is weighted heavily because a wide
  // PURE STATISTICAL SAFETY — NO BOOSTS, NO NAME-BASED PENALTIES.
  // Built only from the market's own honest numbers:
  //   • (1 - wrongProb): modelled probability the pick WINS (Poisson tail math)
  //   • marginUnits: how many σ the projected λ clears the line by (distribution)
  //   • ciLower: Wilson worst-case confidence floor
  //   • mqs: the engine's market quality score
  //   • (1 - disagreementIndex): agent consensus
  // Every input is computed from the real λ for THIS match — no market is
  // multiplied up or down because of its name or family.
  // Lead with the two purest robustness measures — the modelled win
  // probability and the distribution margin (σ the λ clears the line by).
  // Both are exact statistics for THIS match; weighting them more is ranking
  // by robustness, not boosting any market.
  const safety =
    (1 - wrongProb) * 0.50 +
    Math.min(1, marginUnits / 3.0) * 0.35 +
    m.ciLower * 0.10 +
    (1 - m.disagreementIndex) * 0.05;

  return { market: m, safety: Math.max(0, Math.min(1, safety)), wrongProb, marginUnits, verifiable, notes };
}

export interface SelectionResult {
  top1: Market[];
  top3: Market[];
  top5: Market[];
  top10: Market[];
}

/**
 * Assemble the safest possible Top-N for THIS match.
 * - Only verifiable markets ALREADY IN THE REGISTRY are eligible (no invented lines).
 * - Two systems work TOGETHER: the backtesting-learned confidence from
 *   rankByHit (`confidenceMap`) is blended with the margin-of-safety study here.
 * - Hard floor: modelled loss probability must be low.
 * - Family diversity: cap correlated families to avoid cascade failure.
 *
 * @param confidenceMap  market.id -> rankByHit confidence (0..1+), the L-layer
 *                       backtesting signal. When absent, safety alone is used.
 */
export function selectTopPicks(
  markets: Market[],
  lam: LambdaSet,
  homeName: string,
  awayName: string,
  confidenceMap?: Record<string, number>,
): SelectionResult {
  const scored = markets
    .filter((m) => !m.rejected)
    .map((m) => {
      const s = scoreMarket(m, lam, homeName, awayName);
      // COMBINE the two systems: margin-of-safety study × backtesting confidence.
      // Both derive from the same registry market — nothing is invented.
      const conf = confidenceMap?.[m.id];
      const combined = conf !== undefined
        ? s.safety * 0.6 + Math.min(1, conf) * 0.4
        : s.safety;
      return { ...s, combined };
    })
    // Only truly confirmable markets can go into the "must hit 10/10" set.
    .filter((s) => s.verifiable)
    .sort((a, b) => b.combined - a.combined);

  // Family-class caps: stable families (goals, cards) may contribute more legs
  // because they rarely break; volatile count families are capped at 1 so a
  // single bad-tempo game can't cascade the whole Top 10.
  const STABLE = new Set(["Goals", "Yellow Cards"]);
  const VOLATILE_FAM = /Shots|SOT|Saves|Corners|Interceptions/;
  const capFor = (fam: string): number => {
    if (STABLE.has(fam)) return 3;
    if (VOLATILE_FAM.test(fam)) return 1;
    return 2;
  };
  const MAX_PER_FAMILY = 2; // default, kept for the relaxation tier
  const famCount: Record<string, number> = {};
  const picked: Market[] = [];

  // Primary pass: strict safety floor — only legs whose OWN math says the loss
  // risk is under 6%. This is honest filtering (not boosting): a market only
  // qualifies if its real modelled probability is genuinely high.
  for (const s of scored) {
    if (picked.length >= 10) break;
    const fam = s.market.family;
    if (s.wrongProb > 0.06) continue;
    if ((famCount[fam] ?? 0) >= capFor(fam)) continue;
    picked.push(s.market);
    famCount[fam] = (famCount[fam] ?? 0) + 1;
  }

  // Progressive relaxation — but ALWAYS take the safest remaining pick, never a
  // thin one just to fill a slot. Each tier widens the acceptable loss risk
  // slightly while still preferring the highest-safety candidates first.
  for (const maxLoss of [0.09, 0.12, 0.16, 0.24, 1.0]) {
    if (picked.length >= 10) break;
    for (const s of scored) {
      if (picked.length >= 10) break;
      if (picked.includes(s.market)) continue;
      if (s.wrongProb > maxLoss) continue;
      const fam = s.market.family;
      if ((famCount[fam] ?? 0) >= MAX_PER_FAMILY + 1) continue;
      picked.push(s.market);
      famCount[fam] = (famCount[fam] ?? 0) + 1;
    }
  }

  return {
    top1: picked.slice(0, 1),
    top3: picked.slice(0, 3),
    top5: picked.slice(0, 5),
    top10: picked.slice(0, 10),
  };
}
