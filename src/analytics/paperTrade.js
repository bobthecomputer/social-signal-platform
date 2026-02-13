import { rsi } from "./indicators.js";

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function simulateRsiLongOnly(points, {
  rsiLow = 30,
  holdSteps = 6,
  feeBps = 10,
  period = 14,
} = {}) {
  const trades = [];
  const fee = feeBps / 10000;

  for (let i = period; i < points.length - holdSteps; i++) {
    const slice = points.slice(i - period, i + 1);
    const localRsi = rsi(slice, period);
    if (!Number.isFinite(localRsi) || localRsi > rsiLow) continue;

    const entry = points[i].price;
    const exit = points[i + holdSteps].price;
    if (!entry || !exit) continue;

    const gross = (exit - entry) / entry;
    const net = gross - fee * 2;

    trades.push({
      entryTs: points[i].ts,
      exitTs: points[i + holdSteps].ts,
      entry,
      exit,
      rsi: localRsi,
      netReturn: net,
    });
  }

  const values = trades.map((t) => t.netReturn);
  const wins = values.filter((v) => v > 0).length;

  return {
    tradeCount: trades.length,
    winRate: trades.length ? wins / trades.length : null,
    avgReturn: trades.length ? values.reduce((a, n) => a + n, 0) / trades.length : null,
    medianReturn: median(values),
    feeBps,
    holdSteps,
  };
}
