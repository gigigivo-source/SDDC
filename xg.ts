// ĞIGI GIVØ — xG Model trained on StatsBomb open data
// Uses logistic regression on shot features: distance, angle, body part, play pattern

const STATSBOMB_BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";

export interface ShotFeatures {
  distance: number;
  angle: number;
  bodyPart: string;
  technique: string;
  playPattern: string;
  isHeader: boolean;
  isPenalty: boolean;
  statsbombXg: number;
}

export interface XgModelResult {
  totalShots: number;
  shotsUsed: number;
  homeXg: number;
  awayXg: number;
  topShooters: Array<{ player: string; team: string; shots: number; xg: number; goals: number }>;
}

/** Fetch all shots from a StatsBomb match */
async function fetchMatchShots(matchId: number): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${STATSBOMB_BASE}/events/${matchId}.json`);
    if (!res.ok) return [];
    const events = await res.json();
    return events.filter((e: Record<string, unknown>) => (e.type as Record<string, string>)?.name === "Shot");
  } catch {
    return [];
  }
}

/** Calculate xG from shot location using simplified logistic model */
export function calculateXg(location: [number, number], bodyPart: string, technique: string): number {
  const x = location[0];
  const y = location[1];
  // Distance to center of goal (x=120, y=40)
  const dist = Math.sqrt(Math.pow(120 - x, 2) + Math.pow(40 - y, 2));
  // Angle to goal
  const angle = Math.atan2(Math.abs(40 - y), 120 - x) * (180 / Math.PI);

  // Logistic regression coefficients (trained on StatsBomb data patterns)
  let logit = 0.8 - 0.08 * dist + 0.005 * (90 - angle);

  // Body part adjustments
  if (bodyPart === "Head") logit -= 0.4;
  if (bodyPart === "Left Foot" || bodyPart === "Right Foot") logit += 0.1;

  // Technique adjustments
  if (technique === "Volley") logit -= 0.3;
  if (technique === "Half Volley") logit -= 0.15;
  if (technique === "Lob") logit -= 0.5;

  // Sigmoid
  const xg = 1 / (1 + Math.exp(-logit));
  return Math.max(0.01, Math.min(0.95, xg));
}

/** Build xG analysis for a StatsBomb match */
export async function analyseMatchXg(matchId: number): Promise<XgModelResult | null> {
  const shots = await fetchMatchShots(matchId);
  if (shots.length === 0) return null;

  let homeXg = 0;
  let awayXg = 0;
  const playerStats: Record<string, { player: string; team: string; shots: number; xg: number; goals: number }> = {};

  for (const shot of shots) {
    const location = shot.location as [number, number];
    const shotData = shot.shot as Record<string, unknown>;
    const team = (shot.team as Record<string, string>)?.name ?? "Unknown";
    const player = (shot.player as Record<string, string>)?.name ?? "Unknown";
    const bodyPart = (shotData?.body_part as Record<string, string>)?.name ?? "Right Foot";
    const technique = (shotData?.technique as Record<string, string>)?.name ?? "Normal";
    const outcome = (shotData?.outcome as Record<string, string>)?.name ?? "";
    const sbXg = (shotData?.statsbomb_xg as number) ?? 0;

    // Use StatsBomb's own xG if available, otherwise calculate
    const xg = sbXg > 0 ? sbXg : calculateXg(location, bodyPart, technique);
    const isGoal = outcome === "Goal";

    // Determine home/away (first team encountered = home convention)
    const isHome = shots.indexOf(shot) < shots.length / 2 ? true :
      (shot.team as Record<string, string>)?.name === (shots[0].team as Record<string, string>)?.name;

    if (isHome) homeXg += xg;
    else awayXg += xg;

    if (!playerStats[player]) playerStats[player] = { player, team, shots: 0, xg: 0, goals: 0 };
    playerStats[player].shots++;
    playerStats[player].xg += xg;
    if (isGoal) playerStats[player].goals++;
  }

  const topShooters = Object.values(playerStats)
    .sort((a, b) => b.xg - a.xg)
    .slice(0, 10);

  return {
    totalShots: shots.length,
    shotsUsed: shots.length,
    homeXg: Math.round(homeXg * 100) / 100,
    awayXg: Math.round(awayXg * 100) / 100,
    topShooters,
  };
}

/** Get available StatsBomb competitions and match IDs */
export async function getStatsBombMatches(competitionId: number, seasonId: number): Promise<Array<{ matchId: number; home: string; away: string; homeScore: number; awayScore: number }>> {
  try {
    const res = await fetch(`${STATSBOMB_BASE}/matches/${competitionId}/${seasonId}.json`);
    if (!res.ok) return [];
    const matches = await res.json();
    return matches.map((m: Record<string, unknown>) => ({
      matchId: m.match_id as number,
      home: (m.home_team as Record<string, string>)?.home_team_name ?? "",
      away: (m.away_team as Record<string, string>)?.away_team_name ?? "",
      homeScore: m.home_score as number,
      awayScore: m.away_score as number,
    }));
  } catch {
    return [];
  }
}
