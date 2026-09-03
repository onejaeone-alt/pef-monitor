const DART_KEY = process.env.DART_API_KEY || "";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const { toMonitoredItem } = require("../lib/story-engine");

function kstDate(offsetDays = 0) {
  const date = new Date(Date.now() + 9 * 3600 * 1000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchPage(bgn, end, pageNo) {
  const params = new URLSearchParams({
    crtfc_key: DART_KEY,
    bgn_de: bgn,
    end_de: end,
    page_no: String(pageNo),
    page_count: "100",
    sort: "date",
    sort_mth: "desc",
  });
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const response = await fetch(`${LIST_URL}?${params}`, { signal: ctrl.signal });
    if (!response.ok) throw new Error(`DART HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sourceMaterial(item) {
  const title = String(item.report_nm || "");
  if (/투자설명서\(집합투자증권\)|증권신고서\(집합투자증권\)|효력발생안내.*집합투자증권/.test(title)) return false;
  const event = item.analysis?.event_id || "general";
  if (["general", "periodic"].includes(event)) return false;
  return true;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
  try {
    if (!DART_KEY) return res.status(503).json({ ok: false, error: "Vercel 환경변수 DART_API_KEY가 필요합니다." });
    const days = Math.min(Math.max(parseInt(req.query.days || "1", 10), 1), 7);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "400", 10), 50), 600);
    const bgn = kstDate(-(days - 1));
    const end = kstDate(0);
    const first = await fetchPage(bgn, end, 1);
    if (first.status === "013") return res.status(200).json({ ok: true, items: [], scanned: 0, range: { bgn, end } });
    if (first.status !== "000") throw new Error(`DART 오류 ${first.status}: ${first.message || ""}`);
    const totalPage = Math.min(first.total_page || 1, 80);
    const all = [...(first.list || [])];
    for (let start = 2; start <= totalPage; start += 8) {
      const pages = Array.from({ length: Math.min(8, totalPage - start + 1) }, (_, i) => start + i);
      const settled = await Promise.all(pages.map((page) => fetchPage(bgn, end, page).catch(() => null)));
      for (const result of settled) if (result?.status === "000" && result.list) all.push(...result.list);
    }
    const seen = new Set();
    const items = [];
    for (const raw of all) {
      if (seen.has(raw.rcept_no)) continue;
      seen.add(raw.rcept_no);
      const item = toMonitoredItem(raw);
      if (!sourceMaterial(item)) continue;
      items.push({
        ...item,
        monitor_reason: item.analysis?.why || "거래·자금·지배구조 변화 확인용 공시",
      });
    }
    items.sort((a, b) => String(b.rcept_no).localeCompare(String(a.rcept_no)));
    return res.status(200).json({ ok: true, items: items.slice(0, limit), scanned: all.length, matched: items.length, range: { bgn, end }, fetched_at: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
