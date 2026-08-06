// ĞIGI GIVØ — Player-Level Prediction Engine
// Uses per-90 stats to generate individual player market probabilities

export interface PlayerProfile {
  name: string;
  team: string;
  position: string;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  appearances: number;
  // Per-90 rates
  goalsP90: number;
  shotsP90: number;
  sotP90: number;
}

export interface PlayerMarket {
  player: string;
  team: string;
  market: string;
  selection: string;
  probability: number;
  fairOdds: number;
}

/** Calculate player markets from season stats */
export function generatePlayerMarkets(player: PlayerProfile): PlayerMarket[] {
  const markets: PlayerMarket[] = [];

  // Anytime Goalscorer: P(scores) = 1 - Poisson(0, goalsP90)
  const scorerProb = 1 - Math.exp(-player.goalsP90);
  markets.push({
    player: player.name, team: player.team,
    market: "Anytime Goalscorer", selection: "Yes",
    probability: Math.round(scorerProb * 1000) / 1000,
    fairOdds: Math.round((1 / scorerProb) * 100) / 100,
  });

  // 2+ Goals (Brace): P(2+) = 1 - Poisson(0) - Poisson(1)
  const braceProb = 1 - Math.exp(-player.goalsP90) * (1 + player.goalsP90);
  if (braceProb > 0.01) {
    markets.push({
      player: player.name, team: player.team,
      market: "2+ Goals (Brace)", selection: "Yes",
      probability: Math.round(braceProb * 1000) / 1000,
      fairOdds: Math.round((1 / braceProb) * 100) / 100,
    });
  }

  // Shots on Target O/U 0.5, 1.5, 2.5
  for (const line of [0.5, 1.5, 2.5]) {
    const overProb = poissonSf(Math.ceil(line), player.sotP90);
    markets.push({
      player: player.name, team: player.team,
      market: `Shots on Target O/U ${line}`, selection: overProb >= 0.5 ? `Over ${line}` : `Under ${line}`,
      probability: Math.round(Math.max(overProb, 1 - overProb) * 1000) / 1000,
      fairOdds: Math.round((1 / Math.max(overProb, 1 - overProb)) * 100) / 100,
    });
  }

  // Total Shots O/U 0.5, 1.5, 2.5
  for (const line of [0.5, 1.5, 2.5]) {
    const overProb = poissonSf(Math.ceil(line), player.shotsP90);
    markets.push({
      player: player.name, team: player.team,
      market: `Total Shots O/U ${line}`, selection: overProb >= 0.5 ? `Over ${line}` : `Under ${line}`,
      probability: Math.round(Math.max(overProb, 1 - overProb) * 1000) / 1000,
      fairOdds: Math.round((1 / Math.max(overProb, 1 - overProb)) * 100) / 100,
    });
  }

  return markets;
}

function poissonSf(k: number, lambda: number): number {
  if (lambda <= 0) return 0;
  let cdf = 0;
  for (let i = 0; i < k; i++) {
    cdf += Math.exp(i * Math.log(lambda) - lambda - logFactorial(i));
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

function logFactorial(n: number): number {
  let r = 0;
  for (let i = 2; i <= n; i++) r += Math.log(i);
  return r;
}

// Formation tactical profiles
export interface FormationProfile {
  formation: string;
  style: "attacking" | "defensive" | "balanced" | "wing-play" | "possession";
  defenderCount: number;
  midfielderCount: number;
  forwardCount: number;
  attackingStrength: number; // 0-1
  defensiveStrength: number; // 0-1
  wingFocus: number; // 0-1
}

const FORMATION_DB: Record<string, FormationProfile> = {
  "4-3-3": { formation: "4-3-3", style: "attacking", defenderCount: 4, midfielderCount: 3, forwardCount: 3, attackingStrength: 0.80, defensiveStrength: 0.60, wingFocus: 0.85 },
  "4-4-2": { formation: "4-4-2", style: "balanced", defenderCount: 4, midfielderCount: 4, forwardCount: 2, attackingStrength: 0.65, defensiveStrength: 0.70, wingFocus: 0.70 },
  "4-2-3-1": { formation: "4-2-3-1", style: "balanced", defenderCount: 4, midfielderCount: 5, forwardCount: 1, attackingStrength: 0.70, defensiveStrength: 0.72, wingFocus: 0.75 },
  "3-5-2": { formation: "3-5-2", style: "wing-play", defenderCount: 3, midfielderCount: 5, forwardCount: 2, attackingStrength: 0.75, defensiveStrength: 0.55, wingFocus: 0.90 },
  "3-4-3": { formation: "3-4-3", style: "attacking", defenderCount: 3, midfielderCount: 4, forwardCount: 3, attackingStrength: 0.85, defensiveStrength: 0.45, wingFocus: 0.80 },
  "5-3-2": { formation: "5-3-2", style: "defensive", defenderCount: 5, midfielderCount: 3, forwardCount: 2, attackingStrength: 0.50, defensiveStrength: 0.85, wingFocus: 0.40 },
  "5-4-1": { formation: "5-4-1", style: "defensive", defenderCount: 5, midfielderCount: 4, forwardCount: 1, attackingStrength: 0.35, defensiveStrength: 0.90, wingFocus: 0.30 },
  "4-1-4-1": { formation: "4-1-4-1", style: "possession", defenderCount: 4, midfielderCount: 5, forwardCount: 1, attackingStrength: 0.60, defensiveStrength: 0.75, wingFocus: 0.65 },
  "4-5-1": { formation: "4-5-1", style: "defensive", defenderCount: 4, midfielderCount: 5, forwardCount: 1, attackingStrength: 0.45, defensiveStrength: 0.80, wingFocus: 0.50 },
  "4-3-2-1": { formation: "4-3-2-1", style: "attacking", defenderCount: 4, midfielderCount: 5, forwardCount: 1, attackingStrength: 0.72, defensiveStrength: 0.65, wingFocus: 0.55 },
  "4-4-1-1": { formation: "4-4-1-1", style: "balanced", defenderCount: 4, midfielderCount: 5, forwardCount: 1, attackingStrength: 0.58, defensiveStrength: 0.73, wingFocus: 0.60 },
};

export function getFormationProfile(formation: string): FormationProfile {
  return FORMATION_DB[formation] ?? FORMATION_DB["4-4-2"];
}

/** Analyse tactical mismatch between two formations */
export function analyseFormationMismatch(homeFormation: string, awayFormation: string): {
  homeAdvantage: number; // -0.3 to +0.3
  goalMultiplier: number;
  cornerMultiplier: number;
  cardMultiplier: number;
  description: string;
} {
  const h = getFormationProfile(homeFormation);
  const a = getFormationProfile(awayFormation);

  // Attacking formation vs defensive = frustration (fewer goals, more corners/cards)
  const atkVsDef = h.attackingStrength - a.defensiveStrength;
  const defVsAtk = a.attackingStrength - h.defensiveStrength;

  let goalMult = 1.0;
  let cornerMult = 1.0;
  let cardMult = 1.0;
  let desc = "";

  if (h.style === "attacking" && a.style === "defensive") {
    goalMult = 0.88;
    cornerMult = 1.15;
    cardMult = 1.12;
    desc = `${homeFormation} (attacking) vs ${awayFormation} (defensive) — expect frustration, corners from blocked attacks, tactical fouls.`;
  } else if (h.style === "attacking" && a.style === "attacking") {
    goalMult = 1.15;
    cornerMult = 1.08;
    cardMult = 0.92;
    desc = `${homeFormation} vs ${awayFormation} — both attacking formations = open, high-scoring potential.`;
  } else if (h.style === "defensive" && a.style === "defensive") {
    goalMult = 0.80;
    cornerMult = 0.85;
    cardMult = 1.08;
    desc = `${homeFormation} vs ${awayFormation} — both defensive = low-scoring, cautious match.`;
  } else if (h.style === "wing-play" || a.style === "wing-play") {
    cornerMult = 1.12;
    desc = `Wing-play formation (${h.style === "wing-play" ? homeFormation : awayFormation}) — expect more crosses and corners.`;
  } else {
    desc = `${homeFormation} vs ${awayFormation} — standard tactical balance.`;
  }

  const homeAdv = (atkVsDef - defVsAtk) * 0.15;

  return { homeAdvantage: homeAdv, goalMultiplier: goalMult, cornerMultiplier: cornerMult, cardMultiplier: cardMult, description: desc };
}
