import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { FileStore } from "./store/fileStore.js";
import { runIngestionAndAnalytics } from "./services/pipeline.js";
import { buildAlerts } from "./services/alertEngine.js";
import {
  defaultSettingsFromConfig,
  normalizeSettings,
  mergeSettings,
} from "./services/settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const dataDir = path.resolve(rootDir, config.dataDir);

const store = new FileStore(dataDir);
await store.init();

const settingsDefaults = defaultSettingsFromConfig(config);
let settings = normalizeSettings(await store.readJson("settings.json", settingsDefaults), settingsDefaults);
await store.writeJson("settings.json", settings);

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function text(res, status, payload) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(payload);
}

async function parseBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

async function serveStatic(res, file = "index.html") {
  try {
    const resolved = path.normalize(file).replace(/^\/+/, "");
    const full = path.join(publicDir, resolved);

    const ext = path.extname(full);
    const contentType =
      ext === ".js"
        ? "application/javascript"
        : ext === ".css"
          ? "text/css"
          : "text/html";

    const data = await readFile(full, "utf8");
    res.writeHead(200, { "content-type": `${contentType}; charset=utf-8` });
    res.end(data);
  } catch {
    text(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;

  try {
    if (route === "GET /api/health") {
      return json(res, 200, {
        ok: true,
        service: "social-signal-platform",
        now: Date.now(),
        watchlist: settings.watchlist,
      });
    }

    if (route === "GET /api/settings") {
      return json(res, 200, { settings });
    }

    if (route === "POST /api/settings") {
      const body = await parseBody(req);
      settings = mergeSettings(settings, body, settingsDefaults);
      await store.writeJson("settings.json", settings);
      return json(res, 200, { ok: true, settings });
    }

    if (route === "GET /api/snapshot") {
      const snapshot = await store.readJson("latest-snapshot.json", {
        generatedAt: null,
        settingsUsed: settings,
        summaries: [],
      });
      const alerts = buildAlerts(snapshot, settings);
      return json(res, 200, { settings, snapshot, alerts });
    }

    if (route === "POST /api/ingest/run") {
      const snapshot = await runIngestionAndAnalytics({ store, settings });
      const alerts = buildAlerts(snapshot, settings);
      await store.writeJson("latest-alerts.json", {
        generatedAt: Date.now(),
        settings,
        alerts,
      });

      return json(res, 200, {
        ok: true,
        generatedAt: snapshot.generatedAt,
        summaryCount: snapshot.summaries.length,
        alertCount: alerts.length,
      });
    }

    if (route === "GET /") return serveStatic(res, "index.html");
    if (route === "GET /app.js") return serveStatic(res, "app.js");
    if (route === "GET /styles.css") return serveStatic(res, "styles.css");

    return text(res, 404, "Not found");
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: String(error),
    });
  }
});

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Social Signal Platform running on http://localhost:${config.port}`);
});
