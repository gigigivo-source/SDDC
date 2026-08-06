export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const decimal = parseFloat(searchParams.get("decimal") ?? "0");
  const american = parseFloat(searchParams.get("american") ?? "0");
  const fractional = searchParams.get("fractional") ?? "";
  const probability = parseFloat(searchParams.get("probability") ?? "0");

  let dec = 0, amer = 0, frac = "", prob = 0;

  if (decimal > 0) {
    dec = decimal;
    prob = 1 / decimal;
    amer = decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1);
    const n = Math.round((decimal - 1) * 100);
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(n, 100);
    frac = `${n / g}/${100 / g}`;
  } else if (american !== 0) {
    amer = american;
    dec = american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
    prob = 1 / dec;
    const n = Math.round((dec - 1) * 100);
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(n, 100);
    frac = `${n / g}/${100 / g}`;
  } else if (fractional) {
    const parts = fractional.split("/");
    if (parts.length === 2) {
      const num = parseInt(parts[0]);
      const den = parseInt(parts[1]);
      if (den > 0) {
        dec = num / den + 1;
        prob = 1 / dec;
        amer = dec >= 2 ? (dec - 1) * 100 : -100 / (dec - 1);
        frac = fractional;
      }
    }
  } else if (probability > 0) {
    prob = probability;
    dec = 1 / probability;
    amer = dec >= 2 ? (dec - 1) * 100 : -100 / (dec - 1);
    const n = Math.round((dec - 1) * 100);
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(Math.abs(n), 100);
    frac = `${Math.abs(n) / g}/${100 / g}`;
  }

  // Dutching calculator
  const stakes = searchParams.get("dutch")?.split(",").map(Number).filter(n => !isNaN(n) && n > 0);
  let dutching = null;
  if (stakes && stakes.length >= 2) {
    const totalImplied = stakes.reduce((s, o) => s + 1 / o, 0);
    const totalStake = 100;
    dutching = {
      selections: stakes.map(odds => ({
        odds,
        stake: Math.round((totalStake / odds / totalImplied) * 100) / 100,
        impliedProb: (1 / odds * 100).toFixed(1) + "%",
      })),
      totalStake,
      guaranteedReturn: Math.round(totalStake / totalImplied * 100) / 100,
      margin: ((totalImplied - 1) * 100).toFixed(2) + "%",
    };
  }

  return Response.json({
    decimal: Math.round(dec * 1000) / 1000,
    american: Math.round(amer),
    fractional: frac,
    impliedProbability: Math.round(prob * 10000) / 100,
    dutching,
  });
}
