export function zScore(series) {
  if (!series.length) return null;
  const mean = series.reduce((a, n) => a + n, 0) / series.length;
  const variance = series.reduce((a, n) => a + (n - mean) ** 2, 0) / series.length;
  const std = Math.sqrt(variance);
  const latest = series.at(-1);
  if (!std) return 0;
  return (latest - mean) / std;
}

export function detectMentionBurst(windows, threshold = 2.5) {
  const z = zScore(windows);
  return {
    z,
    threshold,
    burst: z !== null && z >= threshold,
    latest: windows.at(-1) || 0,
  };
}

export function authorConcentration(posts) {
  // MVP proxy: concentration by subreddit as pseudo-source concentration
  const total = posts.length;
  if (!total) return 0;
  const grouped = posts.reduce((acc, p) => {
    acc[p.subreddit] = (acc[p.subreddit] || 0) + 1;
    return acc;
  }, {});
  const maxShare = Math.max(...Object.values(grouped)) / total;
  return maxShare;
}
