import { fetchJson } from "../lib/http.js";

export async function fetchGdeltArticles(query, maxRecords = 75) {
  const encoded = encodeURIComponent(query);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded}&mode=ArtList&format=json&maxrecords=${maxRecords}&sort=datedesc`;
  const data = await fetchJson(url);

  const articles = (data?.articles || []).map((a) => ({
    title: a.title,
    source: a.source,
    domain: a.domain,
    language: a.language,
    url: a.url,
    socialImage: a.socialimage,
    publishedAt: Date.parse(a.seendate || a.date || "") || null,
  }));

  return {
    source: "gdelt",
    query,
    articles,
    capturedAt: Date.now(),
  };
}
