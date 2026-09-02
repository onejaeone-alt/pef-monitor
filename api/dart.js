// 가벼운 폴백 API. 상세 분석 API가 실패해도 같은 기사감 규칙으로 목록을 만든다.
const DART_KEY = process.env.DART_API_KEY || "";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const { shouldInclude, sortByStoryValue, toMonitoredItem } = require("../lib/story-engine");

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${LIST_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`DART HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("DART 응답 지연(15초 초과) — 서버 지연 가능");
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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");

  try {
    if (!DART_KEY) return res.status(503).json({ ok: false, error: "Vercel 환경변수 DART_API_KEY가 필요합니다." });
    const days = Math.min(Math.max(parseInt(req.query.days || "7", 10), 1), 7);
    const bgn = kstDate(-(days - 1));
    const end = kstDate(0);
    const first = await fetchPage(bgn, end, 1);
    if (req.query.debug) return res.status(200).json({ ok: first.status === "000", dart_status: first.status, dart_message: first.message, total_count: first.total_count, sample: (first.list || []).slice(0, 2), range: { bgn, end } });
    if (first.status === "013") return res.status(200).json({ ok: true, items: [], summary: summary([]), scanned: 0, range: { bgn, end }, fetched_at: new Date().toISOString() });
    if (first.status !== "000") return res.status(502).json({ ok: false, error: `DART 오류 ${first.status}: ${first.message || ""}` });

    const watchTerms = String(req.query.watch || "").split(",").map((value) => value.trim()).filter((value) => value.length >= 2).slice(0, 50);
    const totalPage = Math.min(first.total_page || 1, 120);
    const all = [...(first.list || [])];
    const pages = [];
    for (let page = 2; page <= totalPage; page += 1) pages.push(page);
    for (let index = 0; index < pages.length; index += 10) {
      const results = await Promise.all(pages.slice(index, index + 10).map((page) => fetchPage(bgn, end, page).catch(() => null)));
      for (const result of results) if (result?.status === "000" && result.list) all.push(...result.list);
    }

    const seen = new Set();
    const items = [];
    for (const raw of all) {
      if (seen.has(raw.rcept_no)) continue;
      seen.add(raw.rcept_no);
      const item = toMonitoredItem(raw);
      if (shouldInclude(item, item.analysis, watchTerms)) items.push(item);
    }
    const sorted = sortByStoryValue(items);
    return res.status(200).json({
      ok: true,
      items: sorted,
      summary: summary(sorted),
      scanned: all.length,
      total_count: first.total_count,
      range: { bgn, end },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
