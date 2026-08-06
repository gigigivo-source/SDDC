// ĞIGI GIVØ — Real football data layer (ESPN public API, no key required).
import { LEAGUE_MAP } from "./leagues";
import { resilientJson } from "./httpClient";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// All ESPN reads go through the resilient client: concurrency-limited, retries
// on 429/5xx with exponential backoff, and burst-deduped — so a traffic spike
// can't trip rate limits.
async function espnFetch<T>(url: string): Promise<T | null> {
  return resilientJson<T>(url, { revalidate: 120 });
}

export interface TeamLite {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  logo: string | null;
  color: string | null;
  score: string | null;
  homeAway: "home" | "away";
  record?: string | null;
  form?: string | null;
}

export interface FixtureLite {
  id: string;
  leagueSlug: string;
  leagueName: string;
  date: string; // ISO
  state: "pre" | "in" | "post";
  statusDetail: string;
  clock?: string;
  venue: string | null;
  home: TeamLite;
  away: TeamLite;
  neutralSite: boolean;
  odds?: {
    details?: string;
    overUnder?: number;
    homeML?: number | null;
    awayML?: number | null;
    drawML?: number | null;
    provider?: string;
  } | null;
}

interface EspnScoreboard {
  leagues?: Array<{ name?: string; slug?: string }>;
  events?: EspnEvent[];
}

interface EspnEvent {
  id: string;
  date: string;
  name: string;
  status?: { type?: { state?: string; detail?: string; shortDetail?: string }; displayClock?: string };
  competitions?: Array<EspnCompetition>;
}

interface EspnCompetition {
  venue?: { fullName?: string; address?: { city?: string; country?: string } };
  neutralSite?: boolean;
  competitors?: Array<EspnCompetitor>;
  odds?: Array<EspnOdds>;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  records?: Array<{ summary?: string; type?: string }>;
  form?: string;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
    logos?: Array<{ href?: string }>;
    color?: string;
  };
}

interface EspnOdds {
  provider?: { name?: string };
  details?: string;
  overUnder?: number;
  homeTeamOdds?: { moneyLine?: number };
  awayTeamOdds?: { moneyLine?: number };
  drawOdds?: { moneyLine?: number };
}

function normalizeTeam(c: EspnCompetitor): TeamLite {
  const t = c.team ?? {};
  const logo = t.logo ?? t.logos?.[0]?.href ?? null;
  const rec = c.records?.find((r) => r.type === "total") ?? c.records?.[0];
  return {
    id: t.id ?? "",
    name: t.displayName ?? "Unknown",
    shortName: t.shortDisplayName ?? t.displayName ?? "Unknown",
    abbrev: t.abbreviation ?? "",
    logo,
    color: t.color ? `#${t.color}` : null,
    score: c.score ?? null,
    homeAway: c.homeAway,
    record: rec?.summary ?? null,
    form: c.form ?? null,
  };
}

function normalizeEvent(ev: EspnEvent, slug: string, leagueName: string): FixtureLite | null {
  const comp = ev.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;
  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const o = comp.odds?.[0];
  const venueCity = comp.venue?.address?.city;
  const venue = comp.venue?.fullName
    ? `${comp.venue.fullName}${venueCity ? `, ${venueCity}` : ""}`
    : null;

  return {
    id: ev.id,
    leagueSlug: slug,
    leagueName,
    date: ev.date,
    state: (ev.status?.type?.state as FixtureLite["state"]) ?? "pre",
    statusDetail: ev.status?.type?.shortDetail ?? ev.status?.type?.detail ?? "",
    clock: ev.status?.displayClock,
    venue,
    neutralSite: comp.neutralSite ?? false,
    home: normalizeTeam(home),
    away: normalizeTeam(away),
    odds: o
      ? {
          details: o.details,
          overUnder: o.overUnder,
          homeML: o.homeTeamOdds?.moneyLine ?? null,
          awayML: o.awayTeamOdds?.moneyLine ?? null,
          drawML: o.drawOdds?.moneyLine ?? null,
          provider: o.provider?.name,
        }
      : null,
  };
}

/** yyyymmdd or yyyymmdd-yyyymmdd */
export async function fetchScoreboard(slug: string, dates?: string): Promise<FixtureLite[]> {
  const leagueName = LEAGUE_MAP[slug]?.name ?? slug;
  const url = `${BASE}/${slug}/scoreboard${dates ? `?dates=${dates}` : ""}`;
  const data = await espnFetch<EspnScoreboard>(url);
  if (!data?.events) return [];
  const name = data.leagues?.[0]?.name ?? leagueName;
  return data.events
    .map((e) => normalizeEvent(e, slug, name))
    .filter((x): x is FixtureLite => x !== null);
}

// ---------------- Match summary (form, H2H, lineups, standings) ----------------

export interface FormGame {
  date: string;
  opponent: string;
  opponentLogo: string | null;
  result: "W" | "L" | "D" | string;
  scoreFor: number;
  scoreAgainst: number;
  atVs: string;
  competition: string;
}

export interface TeamForm {
  teamId: string;
  teamName: string;
  games: FormGame[];
  gfAvg: number;
  gaAvg: number;
  points: number;
}

export interface LineupPlayer {
  name: string;
  jersey?: string;
  position?: string;
  starter: boolean;
}

export interface MatchSummary {
  odds: FixtureLite["odds"] | null;
  homeForm: TeamForm | null;
  awayForm: TeamForm | null;
  h2h: Array<{ date: string; home: string; away: string; score: string }>;
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  lineupAvailable: boolean;
  homeFormation: string | null;
  awayFormation: string | null;
  venue: string | null;
}

interface EspnFormEvent {
  gameDate?: string;
  opponent?: { displayName?: string };
  opponentLogo?: string;
  gameResult?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamScore?: string;
  awayTeamScore?: string;
  atVs?: string;
  leagueName?: string;
}

interface EspnSummary {
  pickcenter?: EspnOdds[];
  lastFiveGames?: EspnFormEntry[];
  headToHeadGames?: Array<{ events?: Array<{ gameDate?: string; homeTeam?: { displayName?: string }; awayTeam?: { displayName?: string }; homeTeamScore?: string; awayTeamScore?: string }> }>;
  rosters?: Array<{
    homeAway?: string;
    formation?: string;
    team?: { id?: string };
    roster?: Array<{ starter?: boolean; jersey?: string; position?: { abbreviation?: string }; athlete?: { displayName?: string } }>;
  }>;
  gameInfo?: { venue?: { fullName?: string } };
}

interface EspnFormEntry {
  team?: { id?: string; displayName?: string };
  events?: EspnFormEvent[];
}

function buildForm(entry: EspnFormEntry): TeamForm | null {
  if (!entry?.team?.id) return null;
  const teamId = entry.team.id;
  const games: FormGame[] = [];
  let gf = 0;
  let ga = 0;
  let pts = 0;
  for (const ev of entry.events ?? []) {
    const isHome = ev.homeTeamId === teamId;
    const scoreFor = Number(isHome ? ev.homeTeamScore : ev.awayTeamScore) || 0;
    const scoreAgainst = Number(isHome ? ev.awayTeamScore : ev.homeTeamScore) || 0;
    gf += scoreFor;
    ga += scoreAgainst;
    const result = ev.gameResult ?? (scoreFor > scoreAgainst ? "W" : scoreFor < scoreAgainst ? "L" : "D");
    if (result === "W") pts += 3;
    else if (result === "D") pts += 1;
    games.push({
      date: ev.gameDate ?? "",
      opponent: ev.opponent?.displayName ?? "?",
      opponentLogo: ev.opponentLogo ?? null,
      result,
      scoreFor,
      scoreAgainst,
      atVs: ev.atVs ?? "",
      competition: ev.leagueName ?? "",
    });
  }
  const n = games.length || 1;
  return {
    teamId,
    teamName: entry.team.displayName ?? "",
    games,
    gfAvg: gf / n,
    gaAvg: ga / n,
    points: pts,
  };
}

export async function fetchSummary(slug: string, eventId: string): Promise<MatchSummary | null> {
  const data = await espnFetch<EspnSummary>(`${BASE}/${slug}/summary?event=${eventId}`);
  if (!data) return null;

  const homeEntry = data.lastFiveGames?.find((_, i) => i === 0);
  const awayEntry = data.lastFiveGames?.find((_, i) => i === 1);

  const h2h: MatchSummary["h2h"] = [];
  for (const block of data.headToHeadGames ?? []) {
    for (const ev of block.events ?? []) {
      h2h.push({
        date: ev.gameDate ?? "",
        home: ev.homeTeam?.displayName ?? "?",
        away: ev.awayTeam?.displayName ?? "?",
        score: `${ev.homeTeamScore ?? "-"} - ${ev.awayTeamScore ?? "-"}`,
      });
    }
  }

  const parseRoster = (which: "home" | "away"): LineupPlayer[] => {
    const r = data.rosters?.find((x) => x.homeAway === which);
    if (!r?.roster) return [];
    return r.roster.map((p) => ({
      name: p.athlete?.displayName ?? "?",
      jersey: p.jersey,
      position: p.position?.abbreviation,
      starter: !!p.starter,
    }));
  };
  const homeLineup = parseRoster("home");
  const awayLineup = parseRoster("away");
  const homeFormation = data.rosters?.find((x) => x.homeAway === "home")?.formation ?? null;
  const awayFormation = data.rosters?.find((x) => x.homeAway === "away")?.formation ?? null;

  const o = data.pickcenter?.[0];

  return {
    odds: o
      ? {
          details: o.details,
          overUnder: o.overUnder,
          homeML: o.homeTeamOdds?.moneyLine ?? null,
          awayML: o.awayTeamOdds?.moneyLine ?? null,
          drawML: o.drawOdds?.moneyLine ?? null,
          provider: o.provider?.name,
        }
      : null,
    homeForm: homeEntry ? buildForm(homeEntry) : null,
    awayForm: awayEntry ? buildForm(awayEntry) : null,
    h2h: h2h.slice(0, 8),
    homeLineup,
    awayLineup,
    lineupAvailable: homeLineup.length > 0 && awayLineup.length > 0,
    homeFormation,
    awayFormation,
    venue: data.gameInfo?.venue?.fullName ?? null,
  };
}
