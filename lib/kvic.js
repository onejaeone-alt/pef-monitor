const FUND_TYPE_URL = "https://www.kvic.or.kr/api/fundType";
const BUSINESS_TYPE_URL = "https://www.kvic.or.kr/api/businessType";

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function extractError(payload) {
  if (!payload || typeof payload !== "object") return null;
  const code = payload.Code ?? payload.code ?? payload.RESULT_CODE ?? payload.resultCode;
  const message = payload.Message ?? payload.message ?? payload.RESULT_MESSAGE ?? payload.resultMessage;
  if (code && ["000", "001"].includes(String(code))) {
    return { code: String(code), message: cleanText(message) || "KVIC API 오류" };
  }
  return null;
}

function collectObjects(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;

  const keys = Object.keys(value);
  const looksLikeFund = ["year", "fd", "mng", "asn", "exp", "amt", "ca"].some((key) => keys.includes(key));
  const looksLikeBusinessType = ["fundName", "fundCode"].some((key) => keys.includes(key));
  if (looksLikeFund || looksLikeBusinessType) output.push(value);

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectObjects(child, output);
  }
  return output;
}

function normalizeFundItem(raw, fundType = "11") {
  return {
    fund_type: cleanText(fundType),
    year: cleanText(raw.year),
    field: cleanText(raw.fd),
    manager: cleanText(raw.mng),
    association_name: cleanText(raw.asn),
    expiry_date: cleanText(raw.exp) || null,
    amount_raw: cleanText(raw.amt),
    commitment_raw: cleanText(raw.ca),
    raw,
  };
}

function normalizeBusinessTypeItem(raw) {
  const first = cleanText(raw.fundName);
  const second = cleanText(raw.fundCode);
  const firstLooksCode = /^\d{2}$/.test(first);
  const secondLooksCode = /^\d{2}$/.test(second);
  return {
    fund_code: firstLooksCode ? first : secondLooksCode ? second : first,
    fund_name: firstLooksCode ? second : secondLooksCode ? first : second,
    raw,
  };
}

function parseFundPayload(payload, fundType = "11") {
  const error = extractError(payload);
  if (error) return { error, items: [] };
  const seen = new Set();
  const items = [];
  for (const raw of collectObjects(payload)) {
    if (!("mng" in raw || "asn" in raw || "year" in raw)) continue;
    const item = normalizeFundItem(raw, fundType);
    const key = [item.year, item.field, item.manager, item.association_name, item.expiry_date, item.amount_raw, item.commitment_raw].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return { error: null, items };
}

function parseBusinessTypePayload(payload) {
  const error = extractError(payload);
  if (error) return { error, items: [] };
  const seen = new Set();
  const items = [];
  for (const raw of collectObjects(payload)) {
    if (!("fundName" in raw || "fundCode" in raw)) continue;
    const item = normalizeBusinessTypeItem(raw);
    const key = `${item.fund_code}|${item.fund_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return { error: null, items };
}

function buildFundUrl(key, query = {}) {
  const params = new URLSearchParams({
    fundType: cleanText(query.fundType || query.fund_type || "11"),
    of: "1",
    key,
  });

  const year = cleanText(query.year || query.y);
  if (year) {
    // KVIC 문서는 year로 표기하지만 샘플 URL은 y를 사용한다. 양쪽을 함께 보낸다.
    params.set("year", year);
    params.set("y", year);
  }

  const passthrough = ["fd", "mng", "asn", "expS", "expE", "amtS", "amtE", "caS", "caE"];
  for (const name of passthrough) {
    const value = cleanText(query[name]);
    if (value) params.set(name, value);
  }
  return `${FUND_TYPE_URL}?${params.toString()}`;
}

function buildBusinessTypeUrl(key, query = {}) {
  const params = new URLSearchParams({
    bType: cleanText(query.bType || query.b_type || "0"),
    of: "1",
    key,
  });
  return `${BUSINESS_TYPE_URL}?${params.toString()}`;
}

module.exports = {
  BUSINESS_TYPE_URL,
  FUND_TYPE_URL,
  buildBusinessTypeUrl,
  buildFundUrl,
  parseBusinessTypePayload,
  parseFundPayload,
};
