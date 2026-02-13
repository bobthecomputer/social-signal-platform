export const config = {
  port: Number(process.env.PORT || 8787),
  dataDir: process.env.DATA_DIR || "./data",
  watchlist: (process.env.WATCHLIST || "bitcoin,ethereum,solana")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  redditSubreddits: (process.env.REDDIT_SUBS || "CryptoCurrency,Bitcoin,ethtrader")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
