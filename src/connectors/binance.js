import { fetchJson } from "../lib/http.js";

const symbolMap = {
  bitcoin: "BTCUSDT",
  ethereum: "ETHUSDT",
  solana: "SOLUSDT",
  dogecoin: "DOGEUSDT",
  ripple: "XRPUSDT",
  cardano: "ADAUSDT",
};

export async function fetchBinancePrices(coinId, limit = 72) {
  const symbol = symbolMap[coinId];
  if (!symbol) throw new Error(`No Binance symbol mapping for ${coinId}`);

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`;
  const data = await fetchJson(url);

  const points = (data || []).map((k) => ({
    ts: Number(k[0]),
    price: Number(k[4]), // close price
  }));

  return {
    source: "binance",
    coinId,
    symbol,
    points,
    lastPrice: points.at(-1)?.price ?? null,
    capturedAt: Date.now(),
  };
}
