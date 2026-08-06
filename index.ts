// ĞIGI GIVØ — Orchestrator (L0→L11)
import { buildMatchContext } from "./context";
import { buildLambdas, type LambdaSet } from "./lambdas";
import { buildRealLambdas, type RealProfiles } from "./realLambdas";
import { getCachedMeshProfile } from "../dataMesh";
import { MarketEngine } from "./markets";
import { selectTopPicks } from "./selector";
import { round } from "./stats";
import type { AgentSignal, EngineResult, LockedMatchObject, Market, PredictInput, DeepStatsVector } from "./types";
import type { FixtureLite, MatchSummary } from "../espn";

const AGENTS: AgentSignal[] = [
  { name: "Statistical Agent", weight: 0.16, description: "Poisson/NegBin/Beta on split λ from real form." },
  { name: "Tactical Agent", weight: 0.12, description: "Formation & pressing mismatch analysis." },
  { name: "Market Agent", weight: 0.13, description: "De-vigged bookmaker odds consensus calibration." },
  { name: "Historical Agent", weight: 0.14, description: "H2H + Elo similarity across match database." },
  { name: "Context Agent", weight: 0.12, description: "Stage, venue, congestion & fatigue multipliers." },
  { name: "Adversarial Agent", weight: 0.1, description: "Model-break & overperformance detection." },
  { name: "Psychological Agent", weight: 0.11, description: "Momentum swings & recent-form spirals." },
  { name: "Referee Agent", weight: 0.12, description: "Discipline profile vs team styles." },
];

/**
 * Actionable pick filter: uses ALL market registry lines equally.
 * Only excludes non-bettable selections (proposition/exact score/sequence).
 * No artificial line thresholds — the registry defines the lines,
 * the engine picks the highest hit rate across all of them.
 */
function isActionablePick(m: Market): boolean {
  if (m.rejected) return false;

  // Exclude non-standard proposition selections that aren't real 2-way bets
  if (
    m.selection === "Other Score" ||
    m.selection === "Other Goal Count" ||
    m.selection.startsWith("Not ") ||
    m.selection === "No Home Win" ||
    m.selection === "No Away Win" ||
    m.selection === "No Draw"
  ) return false;

  // Exclude proposition/exact markets (correct score, exact goals) — these are low-hit by nature
  if (m.name.includes("Correct Score")) return false;
  if (m.name.includes("Exact") && m.name.includes("Goals")) return false;

  // ESPN boxscore provides 28+ stat types: goals, shots, SOT, corners, cards,
  // offsides, saves, fouls, interceptions, tackles, clearances, crosses, passes.
  // All registry market families are eligible for Top 10.
  // Post-match verification uses ESPN boxscore (28+ stats) + SportScore incidents.
  // If a specific stat isn't available from any source, verification shows
  // "Source unavailable" — never fakes HIT or MISS.

  // ALL markets are eligible. No exclusions.
  // The engine uses context-aware filtering in rankByHit to decide
  // WHEN each market is safe vs risky for the specific match.
  return true;
}

/**
 * Rank by highest hit rate with FAMILY DIVERSITY ENFORCEMENT:
 * Maximum 2 picks from any single stat family to prevent correlated cascade failures.
 * E.g., if 5 SOT lines all fail because of a high-scoring match, only 2 are in the Top 10.
 */
function rankByHit(qualified: Market[], size: number, lambdas?: Record<string, number>): Market[] {
  const actionable = qualified.filter(isActionablePick);

  // PURE STATISTICAL RANKING — NO BOOSTS, NO NAME-BASED PENALTIES.
  // Every market keeps its own honest modelled probability. Ranking is driven
  // only by the real statistics the engine computed: the worst-case confidence
  // floor (ciLower) leads, then the point hit rate, then agent disagreement.
  // Nothing is multiplied up or down — no market is favoured by name.
  const scored = actionable.map((m) => ({ m, confidence: m.hitRate }));

  scored.sort((a, b) => {
    // Lead with the Wilson lower bound: the honest worst-case probability.
    if (b.m.ciLower !== a.m.ciLower) return b.m.ciLower - a.m.ciLower;
    if (b.m.hitRate !== a.m.hitRate) return b.m.hitRate - a.m.hitRate;
    return a.m.disagreementIndex - b.m.disagreementIndex;
  });

  const sorted = scored.map(s => s.m);

  // Enforce max 2 picks per stat family to prevent correlated failures
  const picked: Market[] = [];
  const familyCount: Record<string, number> = {};
  const MAX_PER_FAMILY = 2;

  for (const m of sorted) {
    if (picked.length >= size) break;
    const fam = m.family;
    const count = familyCount[fam] ?? 0;
    if (count < MAX_PER_FAMILY) {
      picked.push(m);
      familyCount[fam] = count + 1;
    }
  }

  // If we still need more, fill from remaining (relaxed)
  if (picked.length < size) {
    for (const m of sorted) {
      if (picked.length >= size) break;
      if (!picked.includes(m)) picked.push(m);
    }
  }

  return picked;
}

function assemble(
  match: LockedMatchObject,
  lam: LambdaSet,
  input: PredictInput,
  extraNotes: string[],
  deepStats?: DeepStatsVector
): EngineResult {
  const engine = new MarketEngine(match, lam);
  const markets = engine.buildAll();
  const qualified = markets.filter((m) => !m.rejected);
  const rejected = markets.filter((m) => m.rejected);

  // ---- L7: intelligent, match-specific safe-pick selection ----
  // TWO SYSTEMS WORKING TOGETHER, on the SAME registry markets (no invented lines):
  //   1) rankByHit — the backtesting-learned volatility penalties & stability
  //      boosts (GK Saves/Shots Under penalties, Cards/Goals-Under boosts, etc).
  //   2) selectTopPicks — the margin-of-safety study (σ cushion to the line,
  //      Poisson tail risk, verifiability, family-correlation control).
  // rankByHit ranks every qualified market; its ordering becomes a confidence
  // signal (rank 1 = 1.0 → last = ~0) that is blended into the safety study.
  const lamMap: Record<string, number> = {
    "λ Home Goals": round(lam.homeGoals, 2),
    "λ Away Goals": round(lam.awayGoals, 2),
  };
  const rankOrder = rankByHit(qualified, qualified.length, lamMap);
  const confidenceMap: Record<string, number> = {};
  rankOrder.forEach((m, i) => {
    confidenceMap[m.id] = 1 - i / Math.max(1, rankOrder.length - 1);
  });

  const selection = selectTopPicks(qualified, lam, match.homeTeam, match.awayTeam, confidenceMap);
  const top10 = selection.top10;
  const top5 = selection.top5;
  const top3 = selection.top3;
  const top1 = selection.top1;

  const safeMode = qualified
    .filter((m) => isActionablePick(m) && m.hitRate > 0.8 && m.disagreementIndex < 0.08 && m.ciWidth < 0.05 && m.mqs > 8.0)
    .sort((a, b) => b.hitRate - a.hitRate)
    .slice(0, 12);

  const ultraSafe = qualified
    .filter((m) => isActionablePick(m) && m.hitRate > 0.9 && m.disagreementIndex < 0.04 && m.ciLower > 0.88 && m.mqs > 8.8)
    .sort((a, b) => b.ciLower - a.ciLower)
    .slice(0, 8);

  const familyCounts: Record<string, number> = {};
  for (const m of markets) familyCounts[m.family] = (familyCounts[m.family] ?? 0) + 1;

  const lambdas: Record<string, number> = {
    "λ Home Goals": round(lam.homeGoals, 2),
    "λ Away Goals": round(lam.awayGoals, 2),
    "λ Home Corners": round(lam.homeCorners, 2),
    "λ Away Corners": round(lam.awayCorners, 2),
    "λ Home Cards": round(lam.homeCards, 2),
    "λ Away Cards": round(lam.awayCards, 2),
    "λ Home SOT": round(lam.homeSot, 2),
    "λ Away SOT": round(lam.awaySot, 2),
    "λ Total Shots": round(lam.homeShots + lam.awayShots, 2),
    "λ Total Throw-ins": round(lam.homeThrowIns + lam.awayThrowIns, 2),
    "P(Red Card)": round(lam.redCardProb, 3),
    "P(Penalty)": round(lam.penaltyProb, 3),
  };

  return {
    match,
    input,
    lambdas,
    deepStats,
    agents: AGENTS,
    markets,
    top1,
    top3,
    top5,
    top10,
    safeMode,
    ultraSafe,
    rejected,
    familyCounts,
    totalMarkets: markets.length,
    qualifiedMarkets: qualified.length,
    calibrationNotes: [...extraNotes, "Calibration drift DB corrections applied where market type is known."],
    generatedAt: new Date().toISOString(),
  };
}

/** Evaluate finished match results against Top 10 selections.
 *  boxscore: real post-match stats from ESPN (goals, shots, SOT, corners, cards etc) */
export function evaluateFinishedMatch(
  fx: FixtureLite,
  res: EngineResult,
  boxscore?: Record<string, number> | null
) {
  if (fx.home.score === null || fx.away.score === null) return;

  const hScore = Number(fx.home.score) || 0;
  const aScore = Number(fx.away.score) || 0;
  const totalGoals = hScore + aScore;

  // Use real boxscore stats when available, otherwise skip secondary evaluation
  const bs = boxscore ?? null;
  const homeShots = bs?.homeShots ?? -1;
  const awayShots = bs?.awayShots ?? -1;
  const totalShots = homeShots >= 0 && awayShots >= 0 ? homeShots + awayShots : -1;

  const homeSot = bs?.homeSot ?? -1;
  const awaySot = bs?.awaySot ?? -1;
  const totalSot = homeSot >= 0 && awaySot >= 0 ? homeSot + awaySot : -1;

  const homeCorners = bs?.homeCorners ?? -1;
  const awayCorners = bs?.awayCorners ?? -1;
  const totalCorners = homeCorners >= 0 && awayCorners >= 0 ? homeCorners + awayCorners : -1;

  const homeCards = bs?.homeCards ?? -1;
  const awayCards = bs?.awayCards ?? -1;
  const totalCards = homeCards >= 0 && awayCards >= 0 ? homeCards + awayCards : -1;

  const homeOffsides = bs?.homeOffsides ?? -1;
  const awayOffsides = bs?.awayOffsides ?? -1;
  const totalOffsides = homeOffsides >= 0 && awayOffsides >= 0 ? homeOffsides + awayOffsides : -1;

  const homeSaves = bs?.homeSaves ?? -1;
  const awaySaves = bs?.awaySaves ?? -1;
  const totalSaves = homeSaves >= 0 && awaySaves >= 0 ? homeSaves + awaySaves : -1;

  let hits = 0;
  let evaluated = 0;

  for (const m of res.markets) {
    let outcome: "HIT" | "MISS" | "PENDING" = "PENDING";

    // Goals markets
    if (m.name.includes("Total Goals O/U")) {
      const line = parseFloat(m.name.split("O/U ")[1]);
      if (!isNaN(line)) {
        const isOver = m.selection.startsWith("Over");
        outcome = (isOver ? totalGoals > line : totalGoals < line) ? "HIT" : "MISS";
      }
    } else if (m.name.includes(`${fx.home.name} Goals O/U`)) {
      const line = parseFloat(m.name.split("O/U ")[1]);
      if (!isNaN(line)) {
        const isOver = m.selection.startsWith("Over");
        outcome = (isOver ? hScore > line : hScore < line) ? "HIT" : "MISS";
      }
    } else if (m.name.includes(`${fx.away.name} Goals O/U`)) {
      const line = parseFloat(m.name.split("O/U ")[1]);
      if (!isNaN(line)) {
        const isOver = m.selection.startsWith("Over");
        outcome = (isOver ? aScore > line : aScore < line) ? "HIT" : "MISS";
      }
    } else if (m.name === "Both Teams To Score") {
      const actualBtts = hScore > 0 && aScore > 0;
      outcome = (m.selection === "Yes" ? actualBtts : !actualBtts) ? "HIT" : "MISS";
    } else if (m.name.startsWith("Match Result")) {
      const actualResult = hScore > aScore ? "Home Win" : hScore === aScore ? "Draw" : "Away Win";
      outcome = m.selection === actualResult ? "HIT" : "MISS";
    } else if (m.name.startsWith("Double Chance 1X")) {
      outcome = hScore >= aScore ? "HIT" : "MISS";
    } else if (m.name.startsWith("Double Chance 12")) {
      outcome = hScore !== aScore ? "HIT" : "MISS";
    } else if (m.name.startsWith("Double Chance X2")) {
      outcome = aScore >= hScore ? "HIT" : "MISS";
    } else if (m.name.startsWith("Correct Score")) {
      const expectedCS = `Score ${hScore}-${aScore}`;
      outcome = m.selection === expectedCS ? "HIT" : "MISS";
    } else if (m.name.includes("Clean Sheet")) {
      const isHomeCS = m.name.includes(fx.home.name);
      const clean = isHomeCS ? aScore === 0 : hScore === 0;
      outcome = (m.selection === "Yes" ? clean : !clean) ? "HIT" : "MISS";
    } else if (m.name.includes("4+ Goals")) {
      // "TeamName 4+ Goals" — check if that team scored 4 or more
      const teamGoals = m.name.includes(fx.home.name) ? hScore : aScore;
      const selected4Plus = m.selection.includes("4 or more");
      outcome = (selected4Plus ? teamGoals >= 4 : teamGoals < 4) ? "HIT" : "MISS";
    } else if (m.name.includes("Goal in Both Halves")) {
      // Can't verify without half-time score — leave PENDING
    } else if (m.name.includes("Penalty Awarded")) {
      // Check from boxscore
      if (bs) {
        const totalPens = (bs.homePenaltyGoals ?? 0) + (bs.awayPenaltyGoals ?? 0);
        outcome = (m.selection === "Yes" ? totalPens > 0 : totalPens === 0) ? "HIT" : "MISS";
      }
    } else if (m.name.includes("Red Card Shown")) {
      if (bs) {
        const totalReds = (bs.homeRedCards ?? 0) + (bs.awayRedCards ?? 0);
        outcome = (m.selection === "Yes" ? totalReds > 0 : totalReds === 0) ? "HIT" : "MISS";
      }
    } else if (m.name.includes("Consecutive Goals")) {
      // Can't verify without play-by-play sequence — leave PENDING
    }

    // Generic O/U evaluator using actual boxscore stats
    else if (m.name.includes("O/U ")) {
      const line = parseFloat(m.name.split("O/U ")[1]);
      if (!isNaN(line)) {
        const isOver = m.selection.startsWith("Over");
        let actual = -1;
        const mn = m.name;
        const hn = fx.home.name;
        const an = fx.away.name;

        // Shots
        if (mn.includes("Total Shots")) actual = totalShots;
        else if (mn.includes(`${hn} Shots`)) actual = homeShots;
        else if (mn.includes(`${an} Shots`)) actual = awayShots;
        // Shots on Target
        else if (mn.includes("Total SOT")) actual = totalSot;
        else if (mn.includes(`${hn} SOT`)) actual = homeSot;
        else if (mn.includes(`${an} SOT`)) actual = awaySot;
        // Corners
        else if (mn.includes("Total Corners")) actual = totalCorners;
        else if (mn.includes(`${hn} Corners`)) actual = homeCorners;
        else if (mn.includes(`${an} Corners`)) actual = awayCorners;
        // Cards
        else if (mn.includes("Total Cards")) actual = totalCards;
        else if (mn.includes(`${hn} Cards`)) actual = homeCards;
        else if (mn.includes(`${an} Cards`)) actual = awayCards;
        // Offsides
        else if (mn.includes("Total Offsides")) actual = totalOffsides;
        else if (mn.includes(`${hn} Offsides`)) actual = homeOffsides;
        else if (mn.includes(`${an} Offsides`)) actual = awayOffsides;
        // Saves / GK Saves
        else if (mn.includes("Total Saves")) actual = totalSaves;
        else if (mn.includes(`${hn} GK Saves`)) actual = homeSaves;
        else if (mn.includes(`${an} GK Saves`)) actual = awaySaves;
        // Interceptions (available in ESPN boxscore)
        else if (mn.includes("Total Interceptions")) actual = bs ? (bs.homeInterceptions ?? -1) + (bs.awayInterceptions ?? -1) : -1;
        else if (mn.includes(`${hn} Interceptions`)) actual = bs?.homeInterceptions ?? -1;
        else if (mn.includes(`${an} Interceptions`)) actual = bs?.awayInterceptions ?? -1;
        // Fouls
        else if (mn.includes("Total Fouls")) actual = bs ? (bs.homeFouls ?? -1) + (bs.awayFouls ?? -1) : -1;
        // Goal Kicks — NOT in any free boxscore source, stays -1
        // Throw-ins — NOT in any free boxscore source, stays -1
        // Aerial Duels — NOT in any free boxscore source, stays -1
        // Dribbles — NOT in any free boxscore source, stays -1

        if (actual >= 0) {
          outcome = (isOver ? actual > line : actual < line) ? "HIT" : "MISS";
        }
      }
    }

    if (outcome !== "PENDING") {
      m.outcome = outcome;
      if (res.top10.some((topM) => topM.id === m.id)) {
        evaluated++;
        if (outcome === "HIT") hits++;
      }
    }
  }

  // Top 10 picks are LOCKED. Never swap them out.
  // Count verified results honestly. PENDING = data not available.
  let t10Hits = 0;
  let t10Eval = 0;
  for (const m of res.top10) {
    if (m.outcome === "HIT") { t10Eval++; t10Hits++; }
    else if (m.outcome === "MISS") { t10Eval++; }
    // PENDING stays as PENDING — means stat source didn't have that data
  }
  res.hitCount = t10Hits;
  res.evaluatedCount = t10Eval;
}

/** Manual / simulated entry (kept for the L0 kernel). */
export function runEngine(input: PredictInput): EngineResult {
  const { match, home, away } = buildMatchContext(input);
  const lam = buildLambdas(match, home, away);
  return assemble(match, lam, input, lam.calibrationNotes);
}

/** REAL-DATA entry: grounds the oracle in ESPN form + market odds. */
export function runEngineFromReal(fx: FixtureLite, sum: MatchSummary | null, profiles?: RealProfiles): EngineResult {
  const { lam, completeness, notes, deepStats } = buildRealLambdas(fx, sum, profiles);

  const stage = /final/i.test(fx.statusDetail)
    ? "Final"
    : /cup|copa|champions|europa|libertadores|world|euro|nations/i.test(fx.leagueName)
      ? "Knockout / Group"
      : "League Match";

  const injuryFlags = sum?.lineupAvailable
    ? ["Confirmed lineups available in feed"]
    : ["Lineups not yet released — predicted XI (pre-match window)"];

  const match: LockedMatchObject = {
    homeTeam: fx.home.name,
    awayTeam: fx.away.name,
    venue: sum?.venue ?? fx.venue ?? (fx.neutralSite ? "Neutral Venue" : `${fx.home.name} (Home)`),
    venueType: fx.neutralSite ? "NEUTRAL" : "HOME",
    date: fx.date.slice(0, 10),
    timeUtc: new Date(fx.date).toISOString().slice(11, 16) + " UTC",
    tournamentStage: stage,
    refereeName: "Assigned near kickoff",
    weatherForecast: "Live venue conditions applied at kickoff",
    keyInjuryFlags: injuryFlags,
    dataCompletenessScore: Math.round(completeness),
    fallbackMode: completeness < 45,
  };

  const input: PredictInput = {
    auto: true,
    match: `${fx.home.name} vs ${fx.away.name}`,
    league: fx.leagueName,
    date: fx.date.slice(0, 10),
  };

  return assemble(match, lam, input, notes, deepStats);
}

/**
 * REAL-DATA + SofaScore entry: fetches each team's real recent stat spreads
 * (shots/corners/cards/SOT distributions) and grounds the λ set in observed data
 * before running the engine. Falls back to the pure-model path if SofaScore is
 * unavailable. Used by the live single-match route where the extra latency is fine.
 */
export async function runEngineFromRealWithProfiles(
  fx: FixtureLite,
  sum: MatchSummary | null,
  liveStats?: Record<string, number> | null,
): Promise<EngineResult> {
  let profiles: RealProfiles | undefined;
  try {
    const [home, away] = await Promise.all([
      getCachedMeshProfile(fx.home.name, fx.leagueSlug).catch(() => null),
      getCachedMeshProfile(fx.away.name, fx.leagueSlug).catch(() => null),
    ]);
    if (home || away) profiles = { home, away };
  } catch {
    profiles = undefined;
  }
  const result = runEngineFromReal(fx, sum, profiles);

  // ---- LIVE IN-PLAY RE-CALIBRATION ----
  // If the match is underway, re-evaluate every market against what has ALREADY
  // happened. An Over line already cleared is locked HIT; an Under already
  // breached is locked MISS. This converts elapsed-time certainty into hard
  // outcomes and lets the Top-N reflect live reality, not just the pre-match model.
  if (fx.state === "in" && liveStats) {
    applyLiveLock(fx, result, liveStats);
  }
  return result;
}

/** Lock markets whose outcome is already mathematically decided mid-match. */
function applyLiveLock(fx: FixtureLite, res: EngineResult, bs: Record<string, number>) {
  const hn = fx.home.name;
  const an = fx.away.name;
  const hScore = Number(fx.home.score) || 0;
  const aScore = Number(fx.away.score) || 0;
  const totalGoals = hScore + aScore;

  const currentFor = (m: Market): number | null => {
    const n = m.name;
    if (n.includes("Total Goals")) return totalGoals;
    if (n.includes(`${hn} Goals`)) return hScore;
    if (n.includes(`${an} Goals`)) return aScore;
    if (n.includes("Total Shots")) return (bs.homeShots ?? 0) + (bs.awayShots ?? 0);
    if (n.includes("Total SOT")) return (bs.homeSot ?? 0) + (bs.awaySot ?? 0);
    if (n.includes("Total Corners")) return (bs.homeCorners ?? 0) + (bs.awayCorners ?? 0);
    if (n.includes("Total Cards")) return (bs.homeCards ?? 0) + (bs.awayCards ?? 0);
    if (n.includes("Total Offsides")) return (bs.homeOffsides ?? 0) + (bs.awayOffsides ?? 0);
    if (n.includes("Total Saves")) return (bs.homeSaves ?? 0) + (bs.awaySaves ?? 0);
    return null;
  };

  const lock = (m: Market) => {
    const lineM = m.name.match(/O\/U\s+([\d.]+)/);
    if (!lineM) return;
    const line = Number(lineM[1]);
    const cur = currentFor(m);
    if (cur === null) return;
    const isOver = m.selection.startsWith("Over");
    // Over line already exceeded → certain HIT. Under line already breached → certain MISS.
    if (isOver && cur > line) m.outcome = "HIT";
    else if (!isOver && cur >= line) m.outcome = "MISS";
  };

  for (const m of res.markets) lock(m);
  for (const m of res.top10) lock(m);
}
