function rankLevel(level) {
  return { high: 3, warn: 2, info: 1 }[level] || 0;
}

function makeAlert({ level, coinId, type, message, evidence = [], baseConfidence = 0.5 }) {
  const confidence = Math.max(0, Math.min(1, baseConfidence + evidence.length * 0.08));
  return {
    level,
    coinId,
    type,
    message,
    confidence,
    evidence,
    ts: Date.now(),
  };
}

function passModeFilter(alert, mode) {
  if (mode === "aggressive") return true;
  if (mode === "quiet") return alert.level === "high" || alert.level === "warn";
  return true;
}

export function buildAlerts(snapshot, settings) {
  const alerts = [];
  const thresholds = settings?.thresholds || {};
  const mode = settings?.mode || "normal";

  for (const s of snapshot.summaries || []) {
    if (s.error) {
      alerts.push(
        makeAlert({
          level: "warn",
          coinId: s.coinId,
          type: "data_error",
          message: `Data unavailable: ${s.error}`,
          evidence: [{ field: "error", value: s.error }],
          baseConfidence: 0.9,
        })
      );
      continue;
    }

    const rsi = s.indicators?.rsi14;
    const mentionZ = s.social?.mentionZ;
    const attentionZ = s.social?.attentionZ;
    const concentration = s.social?.authorConcentration;

    if (Number.isFinite(rsi) && rsi >= (thresholds.rsiOverbought ?? 70)) {
      alerts.push(
        makeAlert({
          level: "info",
          coinId: s.coinId,
          type: "overbought_signal",
          message: `${s.ticker} RSI(14) is ${rsi.toFixed(1)} (overbought zone).`,
          evidence: [{ field: "rsi14", value: rsi }],
          baseConfidence: 0.62,
        })
      );
    }

    if (Number.isFinite(rsi) && rsi <= (thresholds.rsiOversold ?? 30)) {
      alerts.push(
        makeAlert({
          level: "info",
          coinId: s.coinId,
          type: "oversold_signal",
          message: `${s.ticker} RSI(14) is ${rsi.toFixed(1)} (oversold zone).`,
          evidence: [{ field: "rsi14", value: rsi }],
          baseConfidence: 0.62,
        })
      );
    }

    if (Number.isFinite(mentionZ) && mentionZ >= (thresholds.socialBurstZ ?? 2.5)) {
      alerts.push(
        makeAlert({
          level: "high",
          coinId: s.coinId,
          type: "social_burst",
          message: `${s.ticker} mentions are elevated (z=${mentionZ.toFixed(2)}). Volatility risk may be higher.`,
          evidence: [
            { field: "mentionZ", value: mentionZ },
            { field: "matchedPosts", value: s.social?.matchedPosts ?? 0 },
          ],
          baseConfidence: 0.74,
        })
      );
    }

    if (
      Number.isFinite(concentration) &&
      concentration >= (thresholds.manipulationConcentration ?? 0.6) &&
      Number.isFinite(mentionZ) &&
      mentionZ >= 1.5
    ) {
      alerts.push(
        makeAlert({
          level: "high",
          coinId: s.coinId,
          type: "manipulation_risk",
          message: `${s.ticker} has concentrated social activity (concentration=${concentration.toFixed(2)}). Possible coordinated narrative risk.`,
          evidence: [
            { field: "authorConcentration", value: concentration },
            { field: "mentionZ", value: mentionZ },
          ],
          baseConfidence: 0.78,
        })
      );
    }

    if (Number.isFinite(attentionZ) && attentionZ >= (thresholds.attentionSpikeZ ?? 2)) {
      alerts.push(
        makeAlert({
          level: "info",
          coinId: s.coinId,
          type: "attention_spike",
          message: `${s.ticker} Wikipedia attention is elevated (z=${attentionZ.toFixed(2)}).`,
          evidence: [{ field: "attentionZ", value: attentionZ }],
          baseConfidence: 0.58,
        })
      );
    }

    if ((s.eventImpact6h?.count || 0) > 0) {
      const med = s.eventImpact6h.medianForwardReturn;
      if (Number.isFinite(med)) {
        alerts.push(
          makeAlert({
            level: "info",
            coinId: s.coinId,
            type: "historical_impact",
            message: `Similar social bursts historically had median 6-step forward return of ${(med * 100).toFixed(2)}% for ${s.ticker}.`,
            evidence: [
              { field: "impactCount", value: s.eventImpact6h.count },
              { field: "medianForwardReturn", value: med },
            ],
            baseConfidence: 0.57,
          })
        );
      }
    }

    const paperAvg = s.paperTrade?.avgReturn;
    const paperTrades = s.paperTrade?.tradeCount || 0;
    if (Number.isFinite(paperAvg) && paperAvg > 0 && paperTrades >= 3) {
      alerts.push(
        makeAlert({
          level: "info",
          coinId: s.coinId,
          type: "paper_edge",
          message: `${s.ticker} paper strategy shows positive average return (${(paperAvg * 100).toFixed(2)}%) over ${paperTrades} trades.`,
          evidence: [
            { field: "paperAvgReturn", value: paperAvg },
            { field: "paperTradeCount", value: paperTrades },
            { field: "paperWinRate", value: s.paperTrade?.winRate },
          ],
          baseConfidence: 0.56,
        })
      );
    }
  }

  return alerts
    .filter((a) => passModeFilter(a, mode))
    .sort((a, b) => rankLevel(b.level) - rankLevel(a.level) || b.confidence - a.confidence);
}
