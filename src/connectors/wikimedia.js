import { fetchJson } from "../lib/http.js";

export async function fetchWikiPageviews(pageTitle, days = 14) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const fmt = (d) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate()
    ).padStart(2, "0")}00`;

  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(
    pageTitle
  )}/daily/${fmt(start)}/${fmt(end)}`;

  const data = await fetchJson(url);
  const points = (data?.items || []).map((x) => ({
    ts: Date.parse(x.timestamp?.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")) || null,
    views: x.views,
  }));

  return {
    source: "wikimedia",
    pageTitle,
    points,
    capturedAt: Date.now(),
  };
}
