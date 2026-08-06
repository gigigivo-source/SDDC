// ĞIGI GIVØ — Worldwide league & competition catalog (ESPN soccer slugs).
// No API key required. Grouped by region for the browser UI.

export interface LeagueDef {
  slug: string;
  name: string;
  region: string;
  tier: number; // 1 = top pick for "Top Matches" aggregation
}

export const LEAGUES: LeagueDef[] = [
  // ---- Top European ----
  { slug: "eng.1", name: "English Premier League", region: "England", tier: 1 },
  { slug: "esp.1", name: "Spanish LaLiga", region: "Spain", tier: 1 },
  { slug: "ger.1", name: "German Bundesliga", region: "Germany", tier: 1 },
  { slug: "ita.1", name: "Italian Serie A", region: "Italy", tier: 1 },
  { slug: "fra.1", name: "French Ligue 1", region: "France", tier: 1 },
  { slug: "ned.1", name: "Dutch Eredivisie", region: "Netherlands", tier: 1 },
  { slug: "por.1", name: "Portuguese Primeira Liga", region: "Portugal", tier: 1 },

  // ---- UEFA / Continental clubs ----
  { slug: "uefa.champions", name: "UEFA Champions League", region: "Europe (UEFA)", tier: 1 },
  { slug: "uefa.europa", name: "UEFA Europa League", region: "Europe (UEFA)", tier: 1 },
  { slug: "uefa.europa.conf", name: "UEFA Europa Conference League", region: "Europe (UEFA)", tier: 2 },
  { slug: "uefa.super_cup", name: "UEFA Super Cup", region: "Europe (UEFA)", tier: 2 },
  { slug: "fifa.cwc", name: "FIFA Club World Cup", region: "Global Clubs", tier: 1 },
  { slug: "concacaf.champions", name: "CONCACAF Champions Cup", region: "North America", tier: 2 },
  { slug: "conmebol.libertadores", name: "Copa Libertadores", region: "South America", tier: 1 },
  { slug: "conmebol.sudamericana", name: "Copa Sudamericana", region: "South America", tier: 2 },
  { slug: "afc.champions", name: "AFC Champions League Elite", region: "Asia", tier: 2 },
  { slug: "caf.champions", name: "CAF Champions League", region: "Africa", tier: 2 },

  // ---- Domestic cups (big) ----
  { slug: "eng.fa", name: "English FA Cup", region: "England", tier: 2 },
  { slug: "eng.league_cup", name: "English EFL Cup", region: "England", tier: 2 },
  { slug: "eng.2", name: "English Championship", region: "England", tier: 2 },
  { slug: "esp.copa_del_rey", name: "Copa del Rey", region: "Spain", tier: 2 },
  { slug: "esp.2", name: "Spanish LaLiga 2", region: "Spain", tier: 3 },
  { slug: "ger.dfb_pokal", name: "DFB Pokal", region: "Germany", tier: 2 },
  { slug: "ger.2", name: "German 2. Bundesliga", region: "Germany", tier: 3 },
  { slug: "ita.coppa_italia", name: "Coppa Italia", region: "Italy", tier: 2 },
  { slug: "ita.2", name: "Italian Serie B", region: "Italy", tier: 3 },
  { slug: "fra.coupe_de_france", name: "Coupe de France", region: "France", tier: 2 },
  { slug: "fra.2", name: "French Ligue 2", region: "France", tier: 3 },

  // ---- Rest of Europe ----
  { slug: "bel.1", name: "Belgian Pro League", region: "Belgium", tier: 2 },
  { slug: "sco.1", name: "Scottish Premiership", region: "Scotland", tier: 2 },
  { slug: "tur.1", name: "Turkish Süper Lig", region: "Turkey", tier: 2 },
  { slug: "gre.1", name: "Greek Super League", region: "Greece", tier: 3 },
  { slug: "sui.1", name: "Swiss Super League", region: "Switzerland", tier: 3 },
  { slug: "aut.1", name: "Austrian Bundesliga", region: "Austria", tier: 3 },
  { slug: "rus.1", name: "Russian Premier League", region: "Russia", tier: 3 },
  { slug: "ukr.1", name: "Ukrainian Premier League", region: "Ukraine", tier: 3 },
  { slug: "den.1", name: "Danish Superliga", region: "Denmark", tier: 3 },
  { slug: "nor.1", name: "Norwegian Eliteserien", region: "Norway", tier: 3 },
  { slug: "swe.1", name: "Swedish Allsvenskan", region: "Sweden", tier: 3 },
  { slug: "pol.1", name: "Polish Ekstraklasa", region: "Poland", tier: 3 },
  { slug: "cze.1", name: "Czech First League", region: "Czechia", tier: 3 },
  { slug: "cro.1", name: "Croatian HNL", region: "Croatia", tier: 3 },
  { slug: "rou.1", name: "Romanian Liga 1", region: "Romania", tier: 3 },

  // ---- Americas ----
  { slug: "usa.1", name: "Major League Soccer", region: "USA & Canada", tier: 1 },
  { slug: "usa.usl.1", name: "USL Championship", region: "USA & Canada", tier: 3 },
  { slug: "mex.1", name: "Liga MX", region: "Mexico", tier: 1 },
  { slug: "bra.1", name: "Brazilian Serie A", region: "Brazil", tier: 1 },
  { slug: "bra.2", name: "Brazilian Serie B", region: "Brazil", tier: 3 },
  { slug: "arg.1", name: "Argentine Liga Profesional", region: "Argentina", tier: 1 },
  { slug: "col.1", name: "Colombian Primera A", region: "Colombia", tier: 3 },
  { slug: "chi.1", name: "Chilean Primera División", region: "Chile", tier: 3 },
  { slug: "uru.1", name: "Uruguayan Primera División", region: "Uruguay", tier: 3 },
  { slug: "ecu.1", name: "Ecuadorian Serie A", region: "Ecuador", tier: 3 },
  { slug: "par.1", name: "Paraguayan Primera División", region: "Paraguay", tier: 3 },
  { slug: "per.1", name: "Peruvian Liga 1", region: "Peru", tier: 3 },

  // ---- Asia / Oceania / MEA ----
  { slug: "jpn.1", name: "Japanese J.League", region: "Asia", tier: 2 },
  { slug: "kor.1", name: "K League 1", region: "Asia", tier: 3 },
  { slug: "chn.1", name: "Chinese Super League", region: "Asia", tier: 3 },
  { slug: "aus.1", name: "Australian A-League", region: "Oceania", tier: 3 },
  { slug: "ksa.1", name: "Saudi Pro League", region: "Middle East", tier: 2 },
  { slug: "uae.1", name: "UAE Pro League", region: "Middle East", tier: 3 },
  { slug: "qat.1", name: "Qatar Stars League", region: "Middle East", tier: 3 },
  { slug: "egy.1", name: "Egyptian Premier League", region: "Africa", tier: 3 },
  { slug: "rsa.1", name: "South African PSL", region: "Africa", tier: 3 },

  // ---- International (national teams) ----
  { slug: "fifa.world", name: "FIFA World Cup", region: "International", tier: 1 },
  { slug: "fifa.worldq.uefa", name: "World Cup Qualifying — UEFA", region: "International", tier: 2 },
  { slug: "fifa.worldq.conmebol", name: "World Cup Qualifying — CONMEBOL", region: "International", tier: 2 },
  { slug: "fifa.worldq.concacaf", name: "World Cup Qualifying — CONCACAF", region: "International", tier: 2 },
  { slug: "fifa.worldq.afc", name: "World Cup Qualifying — AFC", region: "International", tier: 3 },
  { slug: "fifa.worldq.caf", name: "World Cup Qualifying — CAF", region: "International", tier: 3 },
  { slug: "uefa.euro", name: "UEFA European Championship", region: "International", tier: 1 },
  { slug: "uefa.nations", name: "UEFA Nations League", region: "International", tier: 2 },
  { slug: "conmebol.america", name: "Copa América", region: "International", tier: 1 },
  { slug: "concacaf.gold", name: "CONCACAF Gold Cup", region: "International", tier: 2 },
  { slug: "caf.nations", name: "Africa Cup of Nations", region: "International", tier: 2 },
  { slug: "afc.asian.cup", name: "AFC Asian Cup", region: "International", tier: 2 },
  { slug: "fifa.friendly", name: "International Friendlies", region: "International", tier: 2 },
];

export const LEAGUE_MAP: Record<string, LeagueDef> = Object.fromEntries(
  LEAGUES.map((l) => [l.slug, l])
);

export function leaguesByRegion(): Record<string, LeagueDef[]> {
  const map: Record<string, LeagueDef[]> = {};
  for (const l of LEAGUES) {
    (map[l.region] ??= []).push(l);
  }
  return map;
}

// Leagues aggregated for the "Top Matches" home feed.
export const TOP_FEED_SLUGS = LEAGUES.filter((l) => l.tier === 1).map((l) => l.slug);
