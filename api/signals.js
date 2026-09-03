const { collectReportingSignals } = require("../lib/reporting-signals");
const { persistReportingLeads } = require("../lib/supabase");

function summary(items) {
  return (items || []).reduce((result, item) => {
    result[item.alert_grade] = (result[item.alert_grade] || 0) + 1;
    result[item.source_type] = (result[item.source_type] || 0) + 1;
    return result;
  }, { P1: 0, P2: 0, P3: 0, P4: 0 });
}

function prioritizeKvic(items) {
  const kvic = [];
  const others = [];
  for (const item of items || []) {
    const text = `${item.source_name || ""} ${item.title || ""}`;
    if (/한국벤처투자|KVIC|모태펀드/.test(text)) kvic.push(item);
    else others.push(item);
  }
  // 화면의 실시간 수집함이 상위 8건만 보여주므로 최신 모태펀드 단서가 묻히지 않게
  // 최대 4건을 앞쪽에 배치하고 나머지는 기존 기사감 순서를 유지한다.
  return [...kvic.slice(0, 4), ...others, ...kvic.slice(4)];
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const days = Math.min(Math.max(parseInt(req.query.days || "7", 10), 1), 14);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "40", 10), 5), 100);
    const collected = await collectReportingSignals({ days });
    const items = prioritizeKvic(collected.items).slice(0, limit);
    const storage = await persistReportingLeads(items);
    return res.status(200).json({
      ok: true,
      items,
      summary: summary(items),
      providers: collected.providers,
      storage,
      range: { days },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
