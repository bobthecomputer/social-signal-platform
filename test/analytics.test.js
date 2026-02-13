import test from "node:test";
import assert from "node:assert/strict";

import { rsi } from "../src/analytics/indicators.js";
import { detectMentionBurst } from "../src/analytics/burst.js";
import { eventImpact } from "../src/analytics/eventStudy.js";
import { simulateRsiLongOnly } from "../src/analytics/paperTrade.js";

test("RSI returns high value for monotonic uptrend", () => {
  const points = Array.from({ length: 20 }, (_, i) => ({ ts: i, price: 100 + i }));
  const value = rsi(points, 14);
  assert.equal(value, 100);
});

test("detectMentionBurst flags large latest spike", () => {
  const out = detectMentionBurst([0, 1, 0, 1, 0, 8], 2);
  assert.equal(out.burst, true);
  assert.ok(out.z > 2);
});

test("eventImpact computes forward return events", () => {
  const prices = Array.from({ length: 20 }, (_, i) => ({ ts: i * 1000, price: 100 + i }));
  const result = eventImpact({
    pricePoints: prices,
    eventTimestamps: [4000, 7000],
    forwardSteps: 3,
  });

  assert.equal(result.count, 2);
  assert.ok(Number.isFinite(result.meanForwardReturn));
});

test("simulateRsiLongOnly returns stats object", () => {
  const prices = Array.from({ length: 80 }, (_, i) => ({
    ts: i * 3600 * 1000,
    price: 100 + Math.sin(i / 4) * 8 + i * 0.15,
  }));

  const result = simulateRsiLongOnly(prices, { rsiLow: 40, holdSteps: 4, feeBps: 5 });

  assert.ok(result);
  assert.ok("tradeCount" in result);
  assert.ok("avgReturn" in result);
});
