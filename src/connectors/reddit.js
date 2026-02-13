import { fetchJson } from "../lib/http.js";

function normalizePost(p) {
  return {
    id: p.id,
    subreddit: p.subreddit,
    title: p.title,
    text: p.selftext || "",
    score: p.score,
    comments: p.num_comments,
    createdAt: Math.floor((p.created_utc || 0) * 1000),
    permalink: `https://reddit.com${p.permalink}`,
  };
}

export async function fetchRedditRecent(subreddit, limit = 50) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${limit}`;
  const data = await fetchJson(url);
  const posts = (data?.data?.children || []).map((c) => normalizePost(c.data));

  return {
    source: "reddit",
    subreddit,
    posts,
    capturedAt: Date.now(),
  };
}
