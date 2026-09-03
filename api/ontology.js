const { buildOntology } = require('../lib/ontology');
const { collectReportingSignals } = require('../lib/reporting-signals');
const { loadRecentReportingLeads, persistOntology, persistReportingLeads } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || '14', 10), 7), 14);
    const forceRefresh = String(req.query.refresh || '') === '1';

    // 평소에는 이미 수집해 둔 최근 단서를 먼저 사용한다.
    // 관계 페이지를 열 때마다 뉴스·공식 사이트를 다시 긁지 않는다.
    let items = forceRefresh ? [] : await loadRecentReportingLeads(days).catch(() => []);
    let providers = { stored_reporting_leads: items.length > 0 };
    let refreshed = false;

    if (!items.length || forceRefresh) {
      const collected = await collectReportingSignals({ days });
      items = collected.items || [];
      providers = collected.providers || {};
      refreshed = true;
      await persistReportingLeads(items).catch(() => ({ ready: false }));
      const saved = await loadRecentReportingLeads(days).catch(() => []);
      if (saved.length) items = saved;
    }

    // 화면용 관계지도는 요청 기간 자료만으로 다시 만든다.
    const graph = buildOntology(items);
    const storage = await persistOntology(graph).catch(() => ({ ready: false }));
    return res.status(200).json({
      ok: true,
      ...graph,
      storage,
      providers,
      refreshed,
      range: { days },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
