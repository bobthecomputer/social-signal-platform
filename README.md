# Social-Signal Market Analytics & Alerting Platform (MVP)

This project is an executable MVP focused on three modules:

1. **Impact Measurement** (event-study style):
   - Detect social bursts
   - Measure forward return distributions after bursts
2. **Forecast Support** (not financial advice):
   - Regime/context indicators (RSI, volatility, attention)
   - Explainability-first signal cards
3. **Decision Support**:
   - Alert inbox with reason text
   - Risk-oriented language (volatility / manipulation awareness)

## Implemented so far

### Backend
- Node.js HTTP API (`src/server.js`)
- Connector layer:
  - CoinGecko market data (with Binance fallback when needed)
  - Reddit recent posts
  - GDELT news docs
  - Wikimedia pageviews
- Analytics:
  - RSI(14)
  - Realized volatility
  - Mention burst z-score
  - Social concentration proxy (manipulation-risk heuristic input)
  - Composite signal score (0-100)
  - Event impact (forward-return stats after social burst events)
  - Lightweight paper-trading simulation (RSI long-only)
- Alert engine:
  - Overbought/Oversold
  - Social burst
  - Attention spike
  - Historical impact summary
  - Alert confidence score + evidence payload
  - Mode-aware filtering (`quiet` | `normal` | `aggressive`)
- File-backed store (`data/*.json`) for reproducible snapshots

### Frontend
- Single-page dashboard (`public/`):
  - Explainability cards per asset
  - Alert inbox with confidence + evidence drill-down
  - 24h social event timeline
  - User controls for watchlist, mode, and thresholds
  - "Run pipeline" and "Save settings" flows

### Tests
- Unit tests for analytics core (`node --test`)

## Quick start

```bash
cd social-signal-platform
npm install
npm start
```

Open: `http://localhost:8787`

## Desktop (Tauri)

This project now includes a Tauri desktop shell (`src-tauri/`) and uses the in-repo logo assets for app icons and in-app branding.

```bash
cd social-signal-platform
npm install
npm run tauri:dev
```

Notes:
- `tauri:dev` launches the Node backend via `beforeDevCommand` and opens the desktop app.
- Browser mode and desktop mode both use the same API endpoints.

Run analytics once:
- Click **Run pipeline** in UI
- or `POST /api/ingest/run`

## API

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/snapshot`
- `POST /api/ingest/run`

## Suggested next iteration

### 48h
- Add connector-level caching and rate-limit aware retries
- Add richer manipulation heuristics (cross-channel sync + account-age/proxy quality)
- Add source-health panel (latency, failures, freshness)

### Week 1
- Add paper-trading simulator with fee/slippage assumptions
- Add scheduled ingestion/alerts with cron
- Add notification delivery (Telegram/Discord/webhook)

### Month 1
- Add model governance:
  - experiment registry
  - walk-forward harness
  - leakage checks
  - strategy scorecards

### Month 2+
- Add pluggable connectors for exchange WebSocket and paid social APIs
- Add richer front-end charting and multi-asset dashboards

## Important

This is an analytics and research tool. It does **not** provide personalized investment advice.
