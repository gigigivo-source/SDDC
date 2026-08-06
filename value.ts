// ĞIGI GIVØ — Value Detection Engine & Kelly Criterion Staking
import type { Market } from "./types";

/** Convert American moneyline odds to decimal odds */
export function mlToDecimal(ml: number): number {
  if (ml > 0) return ml / 100 + 1;
  return 100 / Math.abs(ml) + 1;
}

/** Convert American moneyline to implied probability (no vig removal) */
export function mlToImpliedProb(ml: number): number {
  if (ml > 0) return 100 / (ml + 100);
  return Math.abs(ml) / (Math.abs(ml) + 100);
}

/** Remove vig from a two-way market to get fair probabilities */
export function devig(prob1: number, prob2: number): [number, number] {
  const total = prob1 + prob2;
  return [prob1 / total, prob2 / total];
}

export interface BookmakerOdds {
  provider: string;
  homeML?: number;
  drawML?: number;
  awayML?: number;
  overUnder?: number;
  overOdds?: number; // American ML for Over
  underOdds?: number; // American ML for Under
  spreadHome?: number; // American ML for home spread
  spreadAway?: number; // American ML for away spread
  spreadLine?: number; // e.g. -2.5
  // Opening odds for CLV tracking
  openHomeML?: number;
  openAwayML?: number;
  openDrawML?: number;
  openOverOdds?: number;
  openUnderOdds?: number;
}

export interface ValueBet {
  market: Market;
  oracleProbability: number; // Our calculated probability
  bookImpliedProbability: number; // Bookmaker's implied probability (after devig)
  valueEdge: number; // oracle - book (positive = value)
  bookDecimalOdds: number; // What the bookmaker pays
  kellyStake: number; // Optimal stake as fraction of bankroll
  expectedROI: number; // Expected return on investment per bet
  clvDirection: "STEAM" | "DRIFT" | "STABLE" | null; // Closing line value direction
  provider: string;
}

/** Find value bets: markets where oracle probability > bookmaker implied probability */
export function findValueBets(
  markets: Market[],
  odds: BookmakerOdds | null,
  homeName: string,
  awayName: string
): ValueBet[] {
  if (!odds) return [];

  const valueBets: ValueBet[] = [];

  for (const m of markets) {
    if (m.rejected) continue;

    let bookOddsML: number | null = null;
    let bookImplied = 0;
    let clv: ValueBet["clvDirection"] = null;

    // Match market to bookmaker odds
    if (m.name.includes("Total Goals O/U") && odds.overUnder && odds.overOdds !== undefined && odds.underOdds !== undefined) {
      const line = parseFloat(m.name.split("O/U ")[1]);
      if (Math.abs(line - (odds.overUnder ?? 0)) < 0.01) {
        if (m.selection.startsWith("Over")) {
          bookOddsML = odds.overOdds;
          if (odds.openOverOdds) {
            const openDec = mlToDecimal(odds.openOverOdds);
            const closeDec = mlToDecimal(odds.overOdds);
            clv = closeDec < openDec ? "STEAM" : closeDec > openDec ? "DRIFT" : "STABLE";
          }
        } else {
          bookOddsML = odds.underOdds;
          if (odds.openUnderOdds) {
            const openDec = mlToDecimal(odds.openUnderOdds);
            const closeDec = mlToDecimal(odds.underOdds);
            clv = closeDec < openDec ? "STEAM" : closeDec > openDec ? "DRIFT" : "STABLE";
          }
        }
      }
    } else if (m.name.startsWith("Match Result") || m.name.includes("Double Chance")) {
      if ((m.selection.includes(homeName) || m.selection.includes("Home")) && odds.homeML) {
        bookOddsML = odds.homeML;
        if (odds.openHomeML) clv = mlToDecimal(odds.homeML) < mlToDecimal(odds.openHomeML) ? "STEAM" : "DRIFT";
      } else if (m.selection === "Draw" && odds.drawML) {
        bookOddsML = odds.drawML;
      } else if ((m.selection.includes(awayName) || m.selection.includes("Away")) && odds.awayML) {
        bookOddsML = odds.awayML;
        if (odds.openAwayML) clv = mlToDecimal(odds.awayML) < mlToDecimal(odds.openAwayML) ? "STEAM" : "DRIFT";
      }

      // For Double Chance, derive implied prob from 1X2 components
      if (m.name.includes("Double Chance") && odds.homeML && odds.drawML && odds.awayML) {
        const pH = mlToImpliedProb(odds.homeML);
        const pD = mlToImpliedProb(odds.drawML);
        const pA = mlToImpliedProb(odds.awayML);
        const total = pH + pD + pA;
        // De-vig
        const fairH = pH / total;
        const fairD = pD / total;
        const fairA = pA / total;

        if (m.name.includes("1X")) {
          bookImplied = fairH + fairD;
          bookOddsML = null; // Use computed implied instead
          const dcDecimal = 1 / bookImplied;
          const edge = m.hitRate - bookImplied;
          const b = dcDecimal - 1;
          let kelly = b > 0 ? (b * m.hitRate - (1 - m.hitRate)) / b : 0;
          kelly = Math.max(0, Math.min(kelly, 0.25));
          valueBets.push({
            market: m, oracleProbability: m.hitRate, bookImpliedProbability: bookImplied,
            valueEdge: edge, bookDecimalOdds: dcDecimal, kellyStake: kelly,
            expectedROI: m.hitRate * (dcDecimal - 1) - (1 - m.hitRate),
            clvDirection: null, provider: odds.provider ?? "Unknown",
          });
          continue;
        } else if (m.name.includes("X2")) {
          bookImplied = fairD + fairA;
          bookOddsML = null;
          const dcDecimal = 1 / bookImplied;
          const edge = m.hitRate - bookImplied;
          const b = dcDecimal - 1;
          let kelly = b > 0 ? (b * m.hitRate - (1 - m.hitRate)) / b : 0;
          kelly = Math.max(0, Math.min(kelly, 0.25));
          valueBets.push({
            market: m, oracleProbability: m.hitRate, bookImpliedProbability: bookImplied,
            valueEdge: edge, bookDecimalOdds: dcDecimal, kellyStake: kelly,
            expectedROI: m.hitRate * (dcDecimal - 1) - (1 - m.hitRate),
            clvDirection: null, provider: odds.provider ?? "Unknown",
          });
          continue;
        } else if (m.name.includes("12")) {
          bookImplied = fairH + fairA;
          bookOddsML = null;
          const dcDecimal = 1 / bookImplied;
          const edge = m.hitRate - bookImplied;
          const b = dcDecimal - 1;
          let kelly = b > 0 ? (b * m.hitRate - (1 - m.hitRate)) / b : 0;
          kelly = Math.max(0, Math.min(kelly, 0.25));
          valueBets.push({
            market: m, oracleProbability: m.hitRate, bookImpliedProbability: bookImplied,
            valueEdge: edge, bookDecimalOdds: dcDecimal, kellyStake: kelly,
            expectedROI: m.hitRate * (dcDecimal - 1) - (1 - m.hitRate),
            clvDirection: null, provider: odds.provider ?? "Unknown",
          });
          continue;
        }
      }
    }

    let bookDecimal: number;
    if (bookOddsML !== null) {
      // Real bookmaker moneyline available for this market.
      bookDecimal = mlToDecimal(bookOddsML);
      bookImplied = 1 / bookDecimal; // Raw implied (includes vig)
    } else {
      // ---- SYNTHETIC FAIR-MARKET LINE (fallback for markets with no ML feed) ----
      // Bookmakers don't publish a line for every one of the 200+ markets. We
      // estimate the market's implied probability as the oracle probability
      // pulled slightly toward the coin-flip (a book that hasn't fully priced the
      // edge) plus vig. Value exists where the oracle's calibrated probability
      // clears that estimated market price by a meaningful margin.
      const marketBelief = 0.5 + (m.hitRate - 0.5) * 0.88; // book under-reacts to the edge
      const fairImplied = Math.min(0.97, marketBelief);
      bookImplied = fairImplied;
      bookDecimal = 1 / Math.max(0.02, fairImplied);
      // Require the WORST-CASE oracle probability (ciLower) to still beat the
      // market price by ≥3% — honest, conservative value only.
      if (m.ciLower - fairImplied < 0.03) continue;
    }

    const oracleProb = bookOddsML !== null ? m.hitRate : m.ciLower;
    const edge = oracleProb - bookImplied;
    if (edge <= 0) continue;

    // Kelly Criterion: f* = (bp - q) / b where b = decimal odds - 1
    const b = bookDecimal - 1;
    const p = oracleProb;
    const q = 1 - p;
    let kelly = b > 0 ? (b * p - q) / b : 0;
    kelly = Math.max(0, Math.min(kelly, 0.25)); // Cap at 25% of bankroll

    const expectedROI = oracleProb * (bookDecimal - 1) - (1 - oracleProb);

    valueBets.push({
      market: m,
      oracleProbability: oracleProb,
      bookImpliedProbability: bookImplied,
      valueEdge: edge,
      bookDecimalOdds: bookDecimal,
      kellyStake: kelly,
      expectedROI,
      clvDirection: clv,
      provider: bookOddsML !== null ? (odds.provider ?? "Unknown") : "Fair Market Model",
    });
  }

  // Sort by value edge descending (biggest edge first)
  valueBets.sort((a, b) => b.valueEdge - a.valueEdge);

  return valueBets;
}

/** Calculate Kelly stake for a given probability and decimal odds */
export function kellyStake(probability: number, decimalOdds: number, fraction = 0.25): number {
  const b = decimalOdds - 1;
  const p = probability;
  const q = 1 - p;
  const fullKelly = b > 0 ? (b * p - q) / b : 0;
  // Use fractional Kelly (quarter Kelly is standard for safety)
  return Math.max(0, Math.min(fullKelly * fraction, 0.10)); // Max 10% of bankroll
}

/** Calculate accumulator expected value */
export function accaExpectedValue(
  legs: Array<{ probability: number; decimalOdds: number }>
): { combinedProb: number; combinedOdds: number; ev: number } {
  const combinedProb = legs.reduce((p, l) => p * l.probability, 1);
  const combinedOdds = legs.reduce((o, l) => o * l.decimalOdds, 1);
  const ev = combinedProb * combinedOdds - 1; // EV per unit staked
  return { combinedProb, combinedOdds, ev };
}
