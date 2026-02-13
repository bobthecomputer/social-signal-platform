const statusEl = document.querySelector("#status");
const runBtn = document.querySelector("#runBtn");
const reloadBtn = document.querySelector("#reloadBtn");
const saveSettingsBtn = document.querySelector("#saveSettingsBtn");

const isTauri =
  typeof window !== "undefined" &&
  (Boolean(window.__TAURI__) ||
    Boolean(window.__TAURI_INTERNALS__) ||
    /tauri/i.test(navigator.userAgent || ""));

const API_BASE = isTauri ? "http://127.0.0.1:8787" : "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

const watchlistInput = document.querySelector("#watchlistInput");
const modeInput = document.querySelector("#modeInput");
const rsiHighInput = document.querySelector("#rsiHighInput");
const rsiLowInput = document.querySelector("#rsiLowInput");
const burstInput = document.querySelector("#burstInput");
const attentionInput = document.querySelector("#attentionInput");

const cardsEl = document.querySelector("#cards");
const alertsEl = document.querySelector("#alerts");
const timelineEl = document.querySelector("#timeline");
const cardTpl = document.querySelector("#cardTpl");

function fmtPct(n) {
  if (!Number.isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(2)}%`;
}

function fmtNum(n, d = 2) {
  if (!Number.isFinite(n)) return "n/a";
  return n.toFixed(d);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function setSettingsForm(settings) {
  watchlistInput.value = (settings.watchlist || []).join(",");
  modeInput.value = settings.mode || "normal";
  rsiHighInput.value = settings.thresholds?.rsiOverbought ?? 70;
  rsiLowInput.value = settings.thresholds?.rsiOversold ?? 30;
  burstInput.value = settings.thresholds?.socialBurstZ ?? 2.5;
  attentionInput.value = settings.thresholds?.attentionSpikeZ ?? 2;
}

function readSettingsForm() {
  return {
    watchlist: watchlistInput.value,
    mode: modeInput.value,
    thresholds: {
      rsiOverbought: Number(rsiHighInput.value),
      rsiOversold: Number(rsiLowInput.value),
      socialBurstZ: Number(burstInput.value),
      attentionSpikeZ: Number(attentionInput.value),
    },
  };
}

function renderCards(summaries = []) {
  clear(cardsEl);

  for (const s of summaries) {
    const node = cardTpl.content.cloneNode(true);
    const card = node.querySelector(".card");
    const h3 = node.querySelector("h3");
    const ul = node.querySelector("ul");

    h3.textContent = `${s.ticker || s.coinId} · $${fmtNum(s.lastPrice, 4)} · score ${fmtNum(s.signalScore, 0)}`;

    const rows = [
      `Source: ${s.priceSource || "n/a"}`,
      `RSI(14): ${fmtNum(s.indicators?.rsi14, 1)}`,
      `Realized vol: ${fmtNum(s.indicators?.realizedVolatility, 4)}`,
      `Social z-score: ${fmtNum(s.social?.mentionZ, 2)}`,
      `Attention z-score: ${fmtNum(s.social?.attentionZ, 2)}`,
      `Concentration: ${fmtNum(s.social?.authorConcentration, 2)}`,
      `Posts matched: ${s.social?.matchedPosts ?? 0}`,
      `Event impact median: ${fmtPct(s.eventImpact6h?.medianForwardReturn)}`,
      `Paper avg return: ${fmtPct(s.paperTrade?.avgReturn)}`,
      `Paper win rate: ${fmtPct(s.paperTrade?.winRate)}`,
      `Paper trades: ${s.paperTrade?.tradeCount ?? 0}`,
    ];

    for (const row of rows) {
      const li = document.createElement("li");
      li.textContent = row;
      ul.appendChild(li);
    }

    if (s.social?.mentionBurst?.burst) card.classList.add("highlight");
    if ((s.signalScore || 0) >= 60) card.classList.add("strong");

    cardsEl.appendChild(node);
  }
}

function renderAlerts(alerts = []) {
  clear(alertsEl);

  if (!alerts.length) {
    const li = document.createElement("li");
    li.textContent = "No active alerts in current mode.";
    li.className = "alert info";
    alertsEl.appendChild(li);
    return;
  }

  for (const a of alerts) {
    const li = document.createElement("li");
    li.className = `alert ${a.level}`;

    const line1 = document.createElement("div");
    line1.className = "alert-title";
    line1.textContent = `[${a.coinId?.toUpperCase?.() || "SYSTEM"}] ${a.message}`;

    const line2 = document.createElement("div");
    line2.className = "alert-meta";
    line2.textContent = `type=${a.type} · confidence=${fmtNum(a.confidence, 2)}`;

    li.appendChild(line1);
    li.appendChild(line2);

    if (Array.isArray(a.evidence) && a.evidence.length) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "why this alert";
      details.appendChild(summary);

      const ev = document.createElement("ul");
      ev.className = "evidence";
      for (const item of a.evidence) {
        const e = document.createElement("li");
        e.textContent = `${item.field}: ${
          typeof item.value === "number" ? fmtNum(item.value, 4) : item.value
        }`;
        ev.appendChild(e);
      }
      details.appendChild(ev);
      li.appendChild(details);
    }

    alertsEl.appendChild(li);
  }
}

function renderTimeline(summaries = []) {
  clear(timelineEl);

  for (const s of summaries) {
    const wrap = document.createElement("div");
    wrap.className = "line";

    const title = document.createElement("h4");
    title.textContent = s.ticker || s.coinId;
    wrap.appendChild(title);

    const bar = document.createElement("div");
    bar.className = "bar";

    const windows = s.social?.mentionWindows24h || [];
    const max = Math.max(1, ...windows);
    for (const v of windows) {
      const dot = document.createElement("span");
      dot.style.height = `${Math.max(4, Math.round((v / max) * 36))}px`;
      if (v > 0) dot.classList.add("active");
      bar.appendChild(dot);
    }

    wrap.appendChild(bar);
    timelineEl.appendChild(wrap);
  }
}

async function saveSettings() {
  const payload = readSettingsForm();
  const res = await fetch(apiUrl("/api/settings"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  setSettingsForm(data.settings);
}

async function loadSnapshot() {
  const res = await fetch(apiUrl("/api/snapshot"));
  const data = await res.json();
  setSettingsForm(data.settings);
  renderCards(data.snapshot?.summaries || []);
  renderAlerts(data.alerts || []);
  renderTimeline(data.snapshot?.summaries || []);
}

async function runPipeline() {
  setStatus("running...");
  runBtn.disabled = true;
  try {
    await fetch(apiUrl("/api/ingest/run"), { method: "POST" });
    await loadSnapshot();
    setStatus("updated");
  } catch (error) {
    setStatus(`error: ${error.message}`);
  } finally {
    runBtn.disabled = false;
  }
}

saveSettingsBtn.addEventListener("click", async () => {
  setStatus("saving settings...");
  try {
    await saveSettings();
    setStatus("settings saved");
  } catch (error) {
    setStatus(`error: ${error.message}`);
  }
});

reloadBtn.addEventListener("click", async () => {
  setStatus("reloading...");
  try {
    await loadSnapshot();
    setStatus("ready");
  } catch (error) {
    setStatus(`error: ${error.message}`);
  }
});

runBtn.addEventListener("click", runPipeline);
loadSnapshot().finally(() => setStatus("ready"));
