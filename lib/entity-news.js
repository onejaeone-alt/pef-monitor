const { parseGoogleNewsRss } = require("./context-sources");
const { FALLBACK_JAK_MEMBERS, isJakMemberSource } = require("./jak-members");

const GOOGLE_NEWS_URL = "https://news.google.com/rss/search";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function unique(values, keyFor = (value) => normalize(value)) {
  const seen = new Set();
  return (values || []).filter((value) => {
    const key = keyFor(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function entityTerms(entity) {
  return unique([entity?.canonical_name, ...(entity?.aliases || [])])
    .map(clean)
    .filter((term) => normalize(term).length >= 2)
    .slice(0, 6);
}

function quoted(value) {
  return `"${clean(value).replace(/["\\]/g, " ")}"`;
}

function buildEntityNewsQuery(entity) {
  const terms = entityTerms(entity);
  return terms.length ? `(${terms.map(quoted).join(" OR ")})` : "";
}

function googleNewsUrl(query) {
  const params = new URLSearchParams({ q: query, hl: "ko", gl: "KR", ceid: "KR:ko" });
  return `${GOOGLE_NEWS_URL}?${params}`;
}

function containsTerm(text, term) {
  const value = clean(term);
  if (!value) return false;
  if (/^[a-z0-9&.-]+$/i.test(value)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(String(text || ""));
  }
  return normalize(text).includes(normalize(value));
}

function matchesEntityNews(item, entity) {
  const text = `${item?.title || ""} ${item?.snippet || item?.excerpt || ""}`;
  return entityTerms(entity).some((term) => containsTerm(text, term));
}

function newsKey(item) {
  const url = String(item?.source_url || "").replace(/[?#].*$/, "");
  return url || normalize(item?.title);
}

function mergeEntityNews(existing, fetched, limit = 5) {
  return unique([...(fetched || []), ...(existing || [])], newsKey)
    .sort((left, right) => String(right.published_at || "").localeCompare(String(left.published_at || "")))
    .slice(0, Math.max(1, Number(limit) || 5));
}

async function fetchText(url, fetchImpl, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "IB-Entity-News/1.0" },
    });
    if (!response.ok) throw new Error(`Entity news HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLatestEntityNews(entity, options = {}) {
  const limit = Math.max(1, Number(options.limit) || 5);
  const existing = options.existing || [];
  const query = buildEntityNewsQuery(entity);
  if (!query) return mergeEntityNews(existing, [], limit);

  const fetchImpl = options.fetchImpl || fetch;
  const xml = await fetchText(googleNewsUrl(query), fetchImpl, options.timeoutMs || 12000);
  const fetched = parseGoogleNewsRss(xml, "domestic", "ko")
    .filter((item) => matchesEntityNews(item, entity))
    .filter((item) => isJakMemberSource(item.source_name, FALLBACK_JAK_MEMBERS))
    .map((item) => ({
      source_type: "domestic_news",
      source_name: item.source_name,
      title: item.title,
      source_url: item.source_url,
      published_at: item.published_at,
      excerpt: item.snippet || "",
      related_count: 1,
    }));

  return mergeEntityNews(existing, fetched, limit);
}

module.exports = {
  buildEntityNewsQuery,
  entityTerms,
  fetchLatestEntityNews,
  matchesEntityNews,
  mergeEntityNews,
};
