import { fetchJson } from "../lib/http.js";

const BASE = "https://api.coingecko.com/api/v3";

export async function fetchCoinPrices(coinId, days = 2) {
  const url = `${BASE}/coins/${encodeURIComponent(
    coinId
  )}/market_chart?vs_currency=usd&days=${days}&interval=hourly`;
  const data = await fetchJson(url);

  const points = (data.prices || []).map(([ts, price]) => ({
    ts,
    price,
  }));

  return {
    source: "coingecko",
    coinId,
    points,
    lastPrice: points.at(-1)?.price ?? null,
    capturedAt: Date.now(),
  };
}
