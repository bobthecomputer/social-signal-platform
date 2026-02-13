import { fetchCoinPrices } from "../connectors/coingecko.js";
import { fetchBinancePrices } from "../connectors/binance.js";
import { fetchRedditRecent } from "../connectors/reddit.js";
import { fetchGdeltArticles } from "../connectors/gdelt.js";
import { fetchWikiPageviews } from "../connectors/wikimedia.js";
import { returnsFromPrices, rsi, realizedVolatility } from "../analytics/indicators.js";
import { simulateRsiLongOnly } from "../analytics/paperTrade.js";
import { detectMentionBurst, zScore, authorConcentration } from "../analytics/burst.js";
import { eventImpact } from "../analytics/eventStudy.js";

const coinMeta = {
  bitcoin: { ticker: "BTC", wiki: "Bitcoin" },
  ethereum: { ticker: "ETH", wiki: "Ethereum" },
  solana: { ticker: "SOL", wiki: "Solana" },
  dogecoin: { ticker: "DOGE", wiki: "Dogecoin" },
  ripple: { ticker: "XRP", wiki: "XRP" },
  cardano: { ticker: "ADA", wiki: "Cardano" },
};

async function fetchPriceSeriesWithFallback(coinId) {
  try {
    return await fetchCoinPrices(coinId, 2);
  } catch (coingeckoError) {
    const fallback = await fetchBinancePrices(coinId, 72);
    return {
      ...fallback,
      fallbackFrom: `coingecko_failed:${String(coingeckoError)}`,
    };
  }
}

function containsTerm(text, term) {
  return text.toLowerCase().includes(term.toLowerCase());
}

function hourBucketsFromPosts(posts, matcher, hours = 24) {
  const now = Date.now();
  const buckets = new Array(hours).fill(0);

  for (const p of posts) {
    if (!p.createdAt) continue;
    const ageMs = now - p.createdAt;
    if (ageMs < 0 || ageMs > hours * 3600 * 1000) continue;

    const hourIndex = hours - 1 - Math.floor(ageMs / (3600 * 1000));
    if (hourIndex < 0 || hourIndex >= hours) continue;

    const blob = `${p.title}\n${p.text}`;
    if (matcher(blob)) buckets[hourIndex] += 1;
  }

  return buckets;
}

function eventTimesFromWindows(windows) {
  const mean = windows.reduce((a, n) => a + n, 0) / (windows.length || 1);
  const variance = windows.reduce((a, n) => a + (n - mean) ** 2, 0) / (windows.length || 1);
  const std = Math.sqrt(variance);

  const now = Date.now();
  const events = [];

  windows.forEach((count, idx) => {
    if (count >= mean + 2 * std && count > 0) {
      const hoursAgo = windows.length - 1 - idx;
      events.push(now - hoursAgo * 3600 * 1000);
    }
  });

  return events;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function signalScore({ rsi14, mentionZ, attentionZ, realizedVolatility: vol }) {
  let score = 50;

  if (Number.isFinite(rsi14) && rsi14 <= 30) score += 8;
  if (Number.isFinite(rsi14) && rsi14 >= 70) score -= 6;
  if (Number.isFinite(mentionZ)) score += clamp(mentionZ, -3, 3) * 4;
  if (Number.isFinite(attentionZ)) score += clamp(attentionZ, -3, 3) * 2;
  if (Number.isFinite(vol)) score -= clamp(vol * 1000, 0, 10);

  return clamp(Math.round(score), 0, 100);
}

export async function runIngestionAndAnalytics({ store, settings }) {
  const watchlist = settings.watchlist || [];
  const redditSubreddits = settings.redditSubreddits || [];

  const redditPayloads = await Promise.all(
    redditSubreddits.map(async (sub) => {
      try {
        return await fetchRedditRecent(sub, 50);
      } catch (error) {
        return { source: "reddit", subreddit: sub, posts: [], error: String(error) };
      }
    })
  );

  const allPosts = redditPayloads.flatMap((r) => r.posts || []);

  const summaries = [];

  for (const coinId of watchlist) {
    const meta = coinMeta[coinId] || { ticker: coinId.toUpperCase(), wiki: coinId };

    let priceData;
    try {
      priceData = await fetchPriceSeriesWithFallback(coinId);
    } catch (error) {
      summaries.push({
        coinId,
        error: `price fetch failed: ${String(error)}`,
      });
      continue;
    }

    const returns = returnsFromPrices(priceData.points);
    const currentRsi = rsi(priceData.points, 14);
    const vol = realizedVolatility(returns);

    const matchedPosts = allPosts.filter((p) => {
      const blob = `${p.title}\n${p.text}`;
      return containsTerm(blob, coinId) || containsTerm(blob, meta.ticker);
    });

    const windows = hourBucketsFromPosts(
      matchedPosts,
      () => true,
      24
    );

    const mentionBurst = detectMentionBurst(windows, settings.thresholds?.socialBurstZ ?? 2.5);
    const mentionZ = zScore(windows);
    const eventTimestamps = eventTimesFromWindows(windows);
    const impact = eventImpact({
      pricePoints: priceData.points,
      eventTimestamps,
      forwardSteps: 6,
    });

    let newsCount = 0;
    try {
      const gdelt = await fetchGdeltArticles(`${coinId} OR ${meta.ticker}`, 50);
      newsCount = gdelt.articles.length;
      await store.writeJson(`${coinId}-gdelt.json`, gdelt);
    } catch {
      // non-fatal for MVP
    }

    let attentionZ = null;
    try {
      const wiki = await fetchWikiPageviews(meta.wiki, 14);
      const views = wiki.points.map((p) => p.views).filter((n) => Number.isFinite(n));
      attentionZ = views.length ? zScore(views) : null;
      await store.writeJson(`${coinId}-wiki.json`, wiki);
    } catch {
      // non-fatal for MVP
    }

    const concentration = authorConcentration(matchedPosts);
    const score = signalScore({
      rsi14: currentRsi,
      mentionZ,
      attentionZ,
      realizedVolatility: vol,
    });

    const paperTrade = simulateRsiLongOnly(priceData.points, {
      rsiLow: settings.thresholds?.rsiOversold ?? 30,
      holdSteps: 6,
      feeBps: 10,
      period: 14,
    });

    const summary = {
      coinId,
      ticker: meta.ticker,
      capturedAt: Date.now(),
      priceSource: priceData.source,
      lastPrice: priceData.lastPrice,
      signalScore: score,
      indicators: {
        rsi14: currentRsi,
        realizedVolatility: vol,
      },
      paperTrade,
      social: {
        mentionWindows24h: windows,
        mentionZ,
        mentionBurst,
        authorConcentration: concentration,
        redditPostsScanned: allPosts.length,
        matchedPosts: matchedPosts.length,
        newsCount,
        attentionZ,
      },
      eventImpact6h: impact,
    };

    summaries.push(summary);
    await store.writeJson(`${coinId}-prices.json`, priceData);
    await store.appendJsonArray(`${coinId}-summaries.json`, summary, 500);
  }

  const snapshot = {
    generatedAt: Date.now(),
    settingsUsed: settings,
    summaries,
  };

  await store.writeJson("latest-snapshot.json", snapshot);

  return snapshot;
}
