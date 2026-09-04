const NUGU_MONEY_ENDPOINT = "https://nugu-backend.vercel.app/reviews";
const NUGU_MONEY_SOURCE_URL = "https://nugu.money/";
const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

let responseCache = {
  fetchedAt: 0,
  items: [],
};

function cleanText(value, maxLength = 1200) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeInvestorName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/주식회사|유한책임회사|유한회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function normalizeInvestorCore(value) {
  return normalizeInvestorName(value).replace(
    /(?:파트너스|인베스트먼트|벤처스|캐피탈|기술투자|프라이빗에쿼티|피이)$/,
    "",
  );
}

function numberInRange(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(Math.max(number, min), max);
}

function normalizeReview(review) {
  if (!review || typeof review !== "object") return null;
  const text = cleanText(review.review, 600);
  if (!text) return null;
  const rating = numberInRange(review.rating, 0, 10);
  return {
    review: text,
    rating,
    funding: review.funding === true || String(review.funding).toLowerCase() === "true",
  };
}

function normalizeFirm(item) {
  if (!item || typeof item !== "object") return null;
  const key = cleanText(item.key, 120);
  const fundName = cleanText(item.fundName || item.key, 120);
  if (!key && !fundName) return null;

  const reviews = Array.isArray(item.content)
    ? item.content.map(normalizeReview).filter(Boolean)
    : [];
  const ratingAverage = numberInRange(item.ratingAverage, 0, 10);
  const suppliedTotal = numberInRange(item.ratingTotal, 0, Number.MAX_SAFE_INTEGER);

  return {
    key: key || fundName,
    fund_name: fundName || key,
    rating_average: ratingAverage,
    rating_total: suppliedTotal === null ? reviews.length : Math.trunc(suppliedTotal),
    reviews,
  };
}

function parseNuguPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.reviews)
        ? payload.reviews
        : [];
  return rows.map(normalizeFirm).filter(Boolean);
}

function findFirm(items, query) {
  const normalizedQuery = normalizeInvestorName(query);
  if (!normalizedQuery) return null;

  const exact = (items || []).find((item) =>
    [item.key, item.fund_name].some((name) => normalizeInvestorName(name) === normalizedQuery),
  );
  if (exact) return exact;

  const queryCore = normalizeInvestorCore(query);
  if (queryCore.length < 3) return null;
  const coreMatches = (items || []).filter((item) =>
    [item.key, item.fund_name].some((name) => normalizeInvestorCore(name) === queryCore),
  );
  return coreMatches.length === 1 ? coreMatches[0] : null;
}

async function fetchNuguItems({
  fetchImpl = globalThis.fetch,
  force = false,
  now = Date.now,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const currentTime = now();
  if (!force && responseCache.items.length && currentTime - responseCache.fetchedAt < CACHE_TTL_MS) {
    return responseCache.items;
  }
  if (typeof fetchImpl !== "function") throw new Error("fetch를 사용할 수 없습니다.");

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(NUGU_MONEY_ENDPOINT, {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });
    if (response.status === 304 && responseCache.items.length) return responseCache.items;
    if (!response.ok) throw new Error(`누구머니 응답 오류: ${response.status}`);
    const items = parseNuguPayload(await response.json());
    responseCache = { fetchedAt: currentTime, items };
    return items;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function publicProfile(firm, reviewLimit, fetchedAt) {
  if (!firm) {
    return {
      ready: true,
      found: false,
      provider: "누구머니",
      source_url: NUGU_MONEY_SOURCE_URL,
      fetched_at: fetchedAt,
    };
  }
  return {
    ready: true,
    found: true,
    provider: "누구머니",
    investor_name: firm.fund_name,
    rating_average: firm.rating_average,
    review_count: firm.rating_total,
    review_excerpts: firm.reviews.slice(0, reviewLimit),
    source_url: NUGU_MONEY_SOURCE_URL,
    fetched_at: fetchedAt,
  };
}

async function getNuguMoneyProfile(query, { reviewLimit = 3, ...fetchOptions } = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(reviewLimit, 10) || 3, 0), 5);
  const items = await fetchNuguItems(fetchOptions);
  return publicProfile(findFirm(items, query), safeLimit, new Date().toISOString());
}

function resetNuguMoneyCache() {
  responseCache = { fetchedAt: 0, items: [] };
}

module.exports = {
  NUGU_MONEY_ENDPOINT,
  NUGU_MONEY_SOURCE_URL,
  fetchNuguItems,
  findFirm,
  getNuguMoneyProfile,
  normalizeInvestorName,
  parseNuguPayload,
  resetNuguMoneyCache,
};
