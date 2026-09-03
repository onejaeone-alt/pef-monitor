const { buildOntology } = require('../lib/ontology');
const { collectReportingSignals } = require('../lib/reporting-signals');
const { loadRecentReportingLeads, persistOntology, persistReportingLeads } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || '14', 10), 7), 14);
    const collected = await collectReportingSignals({ days });
    const leadStorage = await persistReportingLeads(collected.items);
    let items = collected.items;
    if (leadStorage.ready) {
      const saved = await loadRecentReportingLeads(days).catch(() => []);
      if (saved.length) items = saved;
    }
    // 화면용 관계지도는 항상 요청 기간의 최신 자료로 다시 만든다.
    // 과거 관계는 Supabase에 보존하되 여기에는 섞지 않는다.
    const graph = buildOntology(items);
    const storage = await persistOntology(graph);
    return res.status(200).json({ ok: true, ...graph, storage, providers: collected.providers, range: { days }, fetched_at: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
