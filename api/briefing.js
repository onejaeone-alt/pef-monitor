const { buildBriefing } = require("../lib/briefing");
const { buildOntology } = require("../lib/ontology");
const { collectReportingSignals } = require("../lib/reporting-signals");
const { loadRecentReportingLeads, persistBriefing, persistOntology, persistReportingLeads } = require("../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  try {
    const type = req.query.type === "weekly" ? "weekly" : "daily";
    const days = type === "weekly" ? 7 : 3;
    const collected = await collectReportingSignals({ days });
    const leadStorage = await persistReportingLeads(collected.items);
    let items = collected.items;
    if (leadStorage.ready) {
      const saved = await loadRecentReportingLeads(days).catch(() => []);
      if (saved.length) items = saved;
    }
    const briefing = buildBriefing(items, type, new Date());
    const [storage, ontologyStorage] = await Promise.all([
      persistBriefing(briefing),
      persistOntology(buildOntology(items)),
    ]);
    return res.status(200).json({ ok: true, ...briefing, providers: collected.providers, storage, ontology_storage: ontologyStorage, fetched_at: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
