export async function fetchJson(url, { timeoutMs = 12000, headers = {} } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "social-signal-platform/0.1 (+local-mvp)",
        ...headers,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}
