const defaultThresholds = {
  rsiOverbought: 70,
  rsiOversold: 30,
  socialBurstZ: 2.5,
  attentionSpikeZ: 2,
  manipulationConcentration: 0.6,
};

const defaultMode = "normal";
const allowedModes = new Set(["quiet", "normal", "aggressive"]);

function toList(value, fallback) {
  if (!value) return [...fallback];
  if (Array.isArray(value)) return value.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [...fallback];
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function defaultSettingsFromConfig(config) {
  return {
    watchlist: [...config.watchlist],
    redditSubreddits: [...config.redditSubreddits],
    thresholds: { ...defaultThresholds },
    mode: defaultMode,
  };
}

export function normalizeSettings(input, defaults) {
  const safe = input || {};
  return {
    watchlist: toList(safe.watchlist, defaults.watchlist),
    redditSubreddits: toList(safe.redditSubreddits, defaults.redditSubreddits),
    thresholds: {
      rsiOverbought: toNumber(safe.thresholds?.rsiOverbought, defaults.thresholds.rsiOverbought),
      rsiOversold: toNumber(safe.thresholds?.rsiOversold, defaults.thresholds.rsiOversold),
      socialBurstZ: toNumber(safe.thresholds?.socialBurstZ, defaults.thresholds.socialBurstZ),
      attentionSpikeZ: toNumber(safe.thresholds?.attentionSpikeZ, defaults.thresholds.attentionSpikeZ),
      manipulationConcentration: toNumber(
        safe.thresholds?.manipulationConcentration,
        defaults.thresholds.manipulationConcentration
      ),
    },
    mode: allowedModes.has(safe.mode) ? safe.mode : defaults.mode,
  };
}

export function mergeSettings(previous, patch, defaults) {
  const draft = {
    ...previous,
    ...patch,
    thresholds: {
      ...(previous?.thresholds || {}),
      ...(patch?.thresholds || {}),
    },
  };
  return normalizeSettings(draft, defaults);
}
