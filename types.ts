// ĞIGI GIVØ — Shared types

export type Grade = "A" | "B" | "C" | "D";

export interface PredictInput {
  auto: boolean;
  match: string; // "TEAM vs TEAM"
  league: string;
  date: string; // YYYY-MM-DD
}

export interface LockedMatchObject {
  homeTeam: string;
  awayTeam: string;
  venue: string;
  venueType: "HOME" | "NEUTRAL";
  date: string;
  timeUtc: string;
  tournamentStage: string;
  refereeName: string;
  weatherForecast: string;
  keyInjuryFlags: string[];
  dataCompletenessScore: number; // 0..100
  fallbackMode: boolean;
}

export interface PickExplanation {
  whyQualified: string; // E.g. "Passed Poisson validation, DI 2.1% < 5%, MQS 9.4/10, Wilson CI [96.2%–99.1%]"
  whySelectedForMatch: string; // E.g. "Arsenal xG 2.45 vs Coventry GA 1.67/90 yields λ=2.45 home goals expectation."
  whyOutcomePossible: string; // E.g. "In 98.4% of Poisson scenarios for λ=2.45, Arsenal scores at least 1 goal."
}

export interface Market {
  id: string;
  name: string;
  family: string;
  selection: string;
  hitRate: number;
  ciLower: number;
  ciUpper: number;
  ciWidth: number;
  fairOddsBest: number;
  fairOddsWorst: number;
  mqs: number; // market quality score 0..10
  grade: Grade;
  disagreementIndex: number;
  rejected: boolean;
  rejectReason?: string;
  niche: boolean;
  reason?: string; // Summary rationale
  explanation?: PickExplanation; // Deep 3-part rationale
  outcome?: "HIT" | "MISS" | "PENDING"; // Real post-match result validation
}

export interface AgentSignal {
  name: string;
  weight: number;
  description: string;
}

export interface MatchContextInsight {
  tactics: string;
  importance: string;
  playerMatchups: string;
  biasStatement: string;
}

export interface DeepStatsVector {
  homeXg: number;
  awayXg: number;
  matchContext?: MatchContextInsight;
  homeGfAvg: number;
  homeGaAvg: number;
  awayGfAvg: number;
  awayGaAvg: number;
  homeSotAvg: number;
  awaySotAvg: number;
  homeCornersAvg: number;
  awayCornersAvg: number;
  homeCardsAvg: number;
  awayCardsAvg: number;
  homeFoulsAvg: number;
  awayFoulsAvg: number;
  homePossessionPct: number;
  awayPossessionPct: number;
  marketHomeProb: number | null;
  marketDrawProb: number | null;
  marketAwayProb: number | null;
  sources: Array<{ name: string; trust: number; coverage: string }>;
}

export interface EngineResult {
  match: LockedMatchObject;
  input: PredictInput;
  lambdas: Record<string, number>;
  deepStats?: DeepStatsVector;
  agents: AgentSignal[];
  markets: Market[];
  top1: Market[];
  top3: Market[];
  top5: Market[];
  top10: Market[];
  safeMode: Market[];
  ultraSafe: Market[];
  rejected: Market[];
  familyCounts: Record<string, number>;
  totalMarkets: number;
  qualifiedMarkets: number;
  calibrationNotes: string[];
  generatedAt: string;
  hitCount?: number;
  evaluatedCount?: number;
}
