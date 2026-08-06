import { fetchScoreboard, type FixtureLite } from "@/lib/espn";

export const dynamic = "force-dynamic";

const FEATURED = [
  { slug: "uefa.champions", label: "UEFA Champions League" },
  { slug: "fifa.world", label: "FIFA World Cup" },
  { slug: "eng.1", label: "English Premier League" },
  { slug: "esp.1", label: "Spanish LaLiga" },
  { slug: "ita.1", label: "Italian Serie A" },
  { slug: "fra.1", label: "French Ligue 1" },
  { slug: "ger.1", label: "German Bundesliga" },
  { slug: "conmebol.libertadores", label: "Copa Libertadores" },
  { slug: "ned.1", label: "Dutch Eredivisie" },
  { slug: "por.1", label: "Portuguese Primeira Liga" },
  { slug: "usa.1", label: "Major League Soccer" },
  { slug: "bra.1", label: "Brazilian Série A" },
  { slug: "mex.1", label: "Liga MX" },
  { slug: "arg.1", label: "Argentine Liga Profesional" },
  { slug: "uefa.europa", label: "UEFA Europa League" },
];

const EXTRA = [
  { slug: "sco.1", label: "Scottish Premiership" },
  { slug: "bel.1", label: "Belgian Pro League" },
  { slug: "tur.1", label: "Turkish Süper Lig" },
  { slug: "jpn.1", label: "Japanese J.League" },
  { slug: "ksa.1", label: "Saudi Pro League" },
];

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function GET() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 21);
  const recentRange = `${fmt(from)}-${fmt(now)}`;

  // Fetch current fixtures AND recent results for each featured league in parallel
  const results = await Promise.all(
    FEATURED.map(async (l) => {
      const [current, recent] = await Promise.all([
        fetchScoreboard(l.slug),
        fetchScoreboard(l.slug, recentRange).catch(() => [] as FixtureLite[]),
      ]);

      const upcoming = current.filter((f) => f.state === "pre" || f.state === "in");
      const finished = recent
        .filter((f) => f.state === "post")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      return { slug: l.slug, label: l.label, fixtures: current, upcoming, results: finished };
    })
  );

  const extraResults = await Promise.all(
    EXTRA.map(async (l) => {
      const current = await fetchScoreboard(l.slug);
      return { slug: l.slug, label: l.label, fixtures: current, upcoming: current.filter((f) => f.state === "pre"), results: current.filter((f) => f.state === "post").slice(0, 5) };
    })
  );

  // Collect all live matches
  const allFixtures: FixtureLite[] = [];
  for (const r of [...results, ...extraResults]) {
    for (const fx of r.fixtures) allFixtures.push(fx);
  }
  const live = allFixtures.filter((f) => f.state === "in");

  return Response.json({
    featured: results,
    extra: extraResults,
    live,
    liveCount: live.length,
  });
}
