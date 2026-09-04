const DART_KEY = process.env.DART_API_KEY || "";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const { toMonitoredItem } = require("../lib/story-engine");
const { buildFamilies, enrich, shouldKeep } = require("../lib/dart-monitor");
const { loadStorageStatus } = require("../lib/supabase");

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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
  try {
    if (req.query.action === "storage-status") {
      res.setHeader("Cache-Control", "no-store");
      const storage = await loadStorageStatus();
      return res.status(200).json({ ok: true, storage, checked_at: new Date().toISOString() });
    }
    if (!DART_KEY) return res.status(503).json({ ok: false, error: "Vercel 환경변수 DART_API_KEY가 필요합니다." });
    const days = Math.min(Math.max(parseInt(req.query.days || "3", 10), 1), 14);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "500", 10), 50), 800);
    const bgn = kstDate(-(days - 1));
    const end = kstDate(0);
    const first = await fetchPage(bgn, end, 1);
    if (first.status === "013") return res.status(200).json({ ok: true, items: [], families: [], scanned: 0, range: { bgn, end } });
    if (first.status !== "000") throw new Error(`DART 오류 ${first.status}: ${first.message || ""}`);

    const totalPage = Math.min(Number(first.total_page || 1), 100);
    const all = [...(first.list || [])];
    for (let start = 2; start <= totalPage; start += 8) {
      const pages = Array.from({ length: Math.min(8, totalPage - start + 1) }, (_, i) => start + i);
      const settled = await Promise.all(pages.map((page) => fetchPage(bgn, end, page).catch(() => null)));
      for (const result of settled) if (result?.status === "000" && result.list) all.push(...result.list);
    }

    const seen = new Set();
    const items = [];
    for (const raw of all) {
      if (!raw?.rcept_no || seen.has(raw.rcept_no)) continue;
      seen.add(raw.rcept_no);
      const monitored = toMonitoredItem(raw);
      if (!shouldKeep(monitored)) continue;
      items.push(enrich(monitored));
    }
    items.sort((a, b) => String(b.rcept_no).localeCompare(String(a.rcept_no)));
    const limitedItems = items.slice(0, limit);
    const families = buildFamilies(limitedItems);
    const groupCounts = limitedItems.reduce((acc,item)=>{
      acc[item.group_id] = (acc[item.group_id] || 0) + 1;
      return acc;
    },{});
    const tierCounts = limitedItems.reduce((acc,item)=>{
      acc[item.tier] = (acc[item.tier] || 0) + 1;
      return acc;
    },{});

    return res.status(200).json({
      ok: true,
      items: limitedItems,
      families,
      scanned: all.length,
      matched: items.length,
      group_counts: groupCounts,
      tier_counts: tierCounts,
      family_count: families.length,
      correction_families: families.filter((x)=>x.correction_count>0).length,
      range: { bgn, end, days },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
