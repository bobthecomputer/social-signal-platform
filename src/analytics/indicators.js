export function returnsFromPrices(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].price;
    const cur = points[i].price;
    out.push({
      ts: points[i].ts,
      ret: prev ? (cur - prev) / prev : 0,
    });
  }
  return out;
}

export function rsi(points, period = 14) {
  if (points.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = points.length - period; i < points.length; i++) {
    const delta = points[i].price - points[i - 1].price;
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function realizedVolatility(returnPoints) {
  if (!returnPoints.length) return null;
  const mean = returnPoints.reduce((a, x) => a + x.ret, 0) / returnPoints.length;
  const variance =
    returnPoints.reduce((a, x) => a + (x.ret - mean) ** 2, 0) /
    returnPoints.length;
  return Math.sqrt(variance);
}
