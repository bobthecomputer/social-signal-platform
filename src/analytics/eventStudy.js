export function nearestIndex(points, ts) {
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    const dist = Math.abs(points[i].ts - ts);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export function forwardReturn(points, startIndex, steps = 6) {
  const from = points[startIndex]?.price;
  const to = points[startIndex + steps]?.price;
  if (!from || !to) return null;
  return (to - from) / from;
}

export function eventImpact({ pricePoints, eventTimestamps, forwardSteps = 6 }) {
  const impacts = [];

  for (const ts of eventTimestamps) {
    const idx = nearestIndex(pricePoints, ts);
    if (idx < 0) continue;
    const fwd = forwardReturn(pricePoints, idx, forwardSteps);
    if (fwd === null) continue;
    impacts.push({
      ts,
      idx,
      forwardReturn: fwd,
    });
  }

  if (!impacts.length) {
    return {
      count: 0,
      medianForwardReturn: null,
      meanForwardReturn: null,
      impacts,
    };
  }

  const values = impacts.map((i) => i.forwardReturn).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];
  const mean = values.reduce((a, n) => a + n, 0) / values.length;

  return {
    count: impacts.length,
    medianForwardReturn: median,
    meanForwardReturn: mean,
    impacts,
  };
}
