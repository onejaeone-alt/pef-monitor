const { buildOntology } = require("../lib/ontology");
const { collectReportingSignals } = require("../lib/reporting-signals");
const {
  loadOntologyGraph,
  loadRecentReportingLeads,
  persistOntology,
  persistReportingLeads,
} = require("../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");

  try {
    const days = Math.min(Math.max(parseInt(req.query.days || "30", 10), 7), 30);
    const collected = await collectReportingSignals({ days: Math.min(days, 14) });
    const leadStorage = await persistReportingLeads(collected.items);
    let items = collected.items;
    if (leadStorage.ready) {
      const saved = await loadRecentReportingLeads(days).catch(() => []);
      if (saved.length) items = saved;
    }

    const liveGraph = buildOntology(items);
    const storage = await persistOntology(liveGraph);
    const graph = storage.ready
      ? await loadOntologyGraph(500).catch(() => liveGraph)
      : liveGraph;

    return res.status(200).json({
      ok: true,
      ...graph,
      storage,
      providers: collected.providers,
      range: { days },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
