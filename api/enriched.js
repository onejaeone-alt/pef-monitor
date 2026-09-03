const zlib = require("zlib");
const DART_KEY = process.env.DART_API_KEY || "";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const COMPANY_URL = "https://opendart.fss.or.kr/api/company.json";
const DOCUMENT_URL = "https://opendart.fss.or.kr/api/document.xml";
const { buildOntology, disclosureToLead } = require("../lib/ontology");
const { loadPreviousDisclosures, persistDisclosures, persistOntology } = require("../lib/supabase");
const {
  attachPreviousEvents,
  normalizeName,
  shouldInclude,
  sortByStoryValue,
  toMonitoredItem,
} = require("../lib/story-engine");

function kstDate(offsetDays = 0) {
  const date = new Date(Date.now() + 9 * 3600 * 1000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`DART HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("DART 응답 지연(15초 초과) — 서버 지연 가능");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPage(bgn, end, pageNo, corpCode = "") {
  const values = {
    crtfc_key: DART_KEY,
    bgn_de: bgn,
    end_de: end,
    page_no: String(pageNo),
    page_count: "100",
    sort: "date",
    sort_mth: "desc",
  };
  if (corpCode) values.corp_code = corpCode;
  return fetchJson(`${LIST_URL}?${new URLSearchParams(values)}`);
}

async function fetchCompanyProfile(corpCode) {
  const params = new URLSearchParams({ crtfc_key: DART_KEY, corp_code: corpCode });
  const profile = await fetchJson(`${COMPANY_URL}?${params}`);
  return profile.status === "000" ? profile : null;
}

async function fetchAllPages(bgn, end, first, corpCode = "", pageLimit = 120) {
  const totalPage = Math.min(first.total_page || 1, pageLimit);
  const all = [...(first.list || [])];
  const pages = [];
  for (let page = 2; page <= totalPage; page += 1) pages.push(page);
  const batchSize = corpCode ? 5 : 10;
  for (let index = 0; index < pages.length; index += batchSize) {
    const batch = pages.slice(index, index + batchSize);
    const results = await Promise.all(batch.map((page) => fetchPage(bgn, end, page, corpCode).catch(() => null)));
    for (const result of results) {
      if (result?.status === "000" && result.list) all.push(...result.list);
    }
  }
  return all;
}

function isExternalFiler(item) {
  const filer = normalizeName(item.flr_nm);
  const corp = normalizeName(item.corp_name);
  return Boolean(filer && corp && filer.length > 1 && filer !== corp && !filer.includes(corp) && !corp.includes(filer));
}

function attachConnections(items) {
  const byFiler = new Map();
  for (const item of items) {
    if (!isExternalFiler(item)) continue;
    const key = normalizeName(item.flr_nm);
    const current = byFiler.get(key) || { filer: item.flr_nm, companies: new Set() };
    current.companies.add(item.corp_name);
    byFiler.set(key, current);
  }

  return items.map((item) => {
    if (!isExternalFiler(item)) return { ...item, connections: [] };
    const linked = byFiler.get(normalizeName(item.flr_nm));
    const connections = [{
      name: item.flr_nm,
      relation: "이 회사 관련 공시 제출자",
      basis: "DART 제출자 정보",
      confidence: "공시확인",
    }];
    for (const company of linked?.companies || []) {
      if (company === item.corp_name) continue;
      connections.push({
        name: company,
        relation: `동일 제출자(${item.flr_nm})가 함께 공시한 회사`,
        basis: "동일 제출자 기반 연결 후보",
        confidence: "연결후보",
      });
    }
    return { ...item, connections: connections.slice(0, 6) };
  });
}

function historyConnections(history) {
  const filers = new Map();
  for (const item of history) {
    if (!isExternalFiler(item)) continue;
    const key = normalizeName(item.flr_nm);
    const current = filers.get(key) || {
      name: item.flr_nm,
      relation: "이 회사 관련 외부 공시 제출자",
      basis: "DART 제출자 정보",
      confidence: "공시확인",
      count: 0,
      latest_dt: item.rcept_dt,
    };
    current.count += 1;
    if (item.rcept_dt > current.latest_dt) current.latest_dt = item.rcept_dt;
    filers.set(key, current);
  }
  return [...filers.values()].sort((a, b) => b.count - a.count).slice(0, 12);
}

function endOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function unzipTextFiles(buffer) {
  const eocd = endOfCentralDirectory(buffer);
  if (eocd < 0) throw new Error("DART 원문 압축파일을 읽지 못했습니다.");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = [];

  for (let index = 0; index < entryCount && offset + 46 <= buffer.length; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;

    if (!/\.(xml|html?|xhtml|txt)$/i.test(name) || uncompressedSize > 12 * 1024 * 1024) continue;
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let output;
    if (method === 0) output = compressed;
    else if (method === 8) output = zlib.inflateRawSync(compressed);
    else continue;
    files.push({ name, text: output.toString("utf8") });
  }
  return files;
}

function decodeEntities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, key) => {
    if (key[0] === "#") {
      const hex = key[1]?.toLowerCase() === "x";
      const value = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return named[key.toLowerCase()] || whole;
  });
}

function plainText(xml) {
  return decodeEntities(String(xml || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(br|\/p|\/tr|\/td|\/li|\/div|\/table)[^>]*>/gi, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n"));
}

function extractDocumentFacts(files) {
  const keywords = ["취득", "처분", "양수", "양도", "최대주주", "경영권", "차입", "담보", "보증", "전환사채", "유상증자", "합병", "분할", "회생", "지분", "거래금액", "자금", "만기", "금리", "상대방"];
  const numberPattern = /\d[\d,]*(?:\.\d+)?\s*(?:조\s*원|억원|백만원|만원|원|%|배|주|개월|년)/g;
  const lines = [];
  const numbers = [];
  for (const file of files) {
    const text = plainText(file.text);
    numbers.push(...(text.match(numberPattern) || []));
    for (const raw of text.split(/\n+/)) {
      const line = raw.trim();
      if (line.length < 12 || line.length > 800) continue;
      const keywordHits = keywords.filter((keyword) => line.includes(keyword)).length;
      const hasNumber = numberPattern.test(line);
      numberPattern.lastIndex = 0;
      if (!keywordHits && !hasNumber) continue;
      lines.push({ text: line.slice(0, 360), score: keywordHits * 3 + (hasNumber ? 2 : 0) });
    }
  }
  const seen = new Set();
  const excerpts = lines
    .sort((a, b) => b.score - a.score)
    .filter((line) => {
      const key = line.text.replace(/\s+/g, " ").slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map((line) => line.text);
  return {
    numbers: [...new Set(numbers.map((number) => number.replace(/\s+/g, " ")))].slice(0, 20),
    excerpts,
    documents: files.map((file) => file.name).slice(0, 20),
  };
}

async function fetchDocumentFacts(rceptNo) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const params = new URLSearchParams({ crtfc_key: DART_KEY, rcept_no: rceptNo });
    const response = await fetch(`${DOCUMENT_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`DART 원문 HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 25 * 1024 * 1024) throw new Error("원문 파일이 너무 커서 자동 추출을 중단했습니다.");
    if (buffer.subarray(0, 1).toString() === "{") {
      const error = JSON.parse(buffer.toString("utf8"));
      throw new Error(`DART 오류 ${error.status}: ${error.message || "원문 조회 실패"}`);
    }
    return extractDocumentFacts(unzipTextFiles(buffer));
  } catch (error) {
    if (error.name === "AbortError") throw new Error("DART 원문 조회가 20초를 넘었습니다.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function summary(items) {
  return items.reduce((result, item) => {
    const bucket = item.analysis?.bucket || "archive";
    result[bucket] = (result[bucket] || 0) + 1;
    return result;
  }, { story: 0, verify: 0, archive: 0 });
}

function requestWatchlist(req) {
  return String(req.query.watch || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length >= 2)
    .slice(0, 50);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");

  try {
    if (!DART_KEY) {
      return res.status(503).json({ ok: false, code: "DART_API_KEY_MISSING", error: "Vercel 환경변수 DART_API_KEY가 필요합니다." });
    }

    if (req.query.action === "document") {
      const rceptNo = String(req.query.rcept_no || "");
      if (!/^\d{14}$/.test(rceptNo)) return res.status(400).json({ ok: false, error: "올바른 접수번호가 필요합니다." });
      const facts = await fetchDocumentFacts(rceptNo);
      return res.status(200).json({ ok: true, rcept_no: rceptNo, ...facts, fetched_at: new Date().toISOString() });
    }

    if (req.query.action === "company") {
      const corpCode = String(req.query.corp_code || "");
      if (!/^\d{8}$/.test(corpCode)) return res.status(400).json({ ok: false, error: "올바른 DART 고유번호가 필요합니다." });
      const historyDays = Math.min(Math.max(parseInt(req.query.history_days || "365", 10), 30), 730);
      const bgn = kstDate(-(historyDays - 1));
      const end = kstDate(0);
      const [first, profile] = await Promise.all([fetchPage(bgn, end, 1, corpCode), fetchCompanyProfile(corpCode).catch(() => null)]);
      if (first.status === "013") return res.status(200).json({ ok: true, profile, history: [], connections: [], range: { bgn, end } });
      if (first.status !== "000") return res.status(502).json({ ok: false, error: `DART 오류 ${first.status}: ${first.message || ""}` });
      const rawHistory = await fetchAllPages(bgn, end, first, corpCode, 20);
      const seen = new Set();
      const history = rawHistory
        .filter((item) => !seen.has(item.rcept_no) && seen.add(item.rcept_no))
        .map(toMonitoredItem)
        .sort((a, b) => b.rcept_no.localeCompare(a.rcept_no));
      return res.status(200).json({
        ok: true,
        profile,
        history: attachPreviousEvents(history).slice(0, 150),
        connections: historyConnections(history),
        range: { bgn, end },
        fetched_at: new Date().toISOString(),
      });
    }

    const days = Math.min(Math.max(parseInt(req.query.days || "7", 10), 1), 7);
    const bgn = kstDate(-(days - 1));
    const end = kstDate(0);
    const first = await fetchPage(bgn, end, 1);
    if (req.query.debug) return res.status(200).json({ ok: first.status === "000", dart_status: first.status, dart_message: first.message, total_count: first.total_count, sample: (first.list || []).slice(0, 2), range: { bgn, end } });
    if (first.status === "013") return res.status(200).json({ ok: true, items: [], scanned: 0, summary: summary([]), range: { bgn, end }, fetched_at: new Date().toISOString() });
    if (first.status !== "000") return res.status(502).json({ ok: false, error: `DART 오류 ${first.status}: ${first.message || ""}` });

    const all = await fetchAllPages(bgn, end, first);
    const watchTerms = requestWatchlist(req);
    const seen = new Set();
    const selected = [];
    for (const raw of all) {
      if (seen.has(raw.rcept_no)) continue;
      seen.add(raw.rcept_no);
      const item = toMonitoredItem(raw);
      if (shouldInclude(item, item.analysis, watchTerms)) selected.push(item);
    }

    const connected = attachConnections(selected);
    const previousRows = await loadPreviousDisclosures(connected).catch(() => []);
    const items = sortByStoryValue(attachPreviousEvents(connected, previousRows));
    const [storage, ontologyStorage] = await Promise.all([
      persistDisclosures(items, { source: "dart-story-desk", scanned: all.length }),
      persistOntology(buildOntology(items.map(disclosureToLead))),
    ]);
    return res.status(200).json({
      ok: true,
      items,
      summary: summary(items),
      storage,
      ontology_storage: ontologyStorage,
      scanned: all.length,
      total_count: first.total_count,
      range: { bgn, end },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
