const { buildEntityDossier } = require("../lib/entity-dossier");
const { buildOntology } = require("../lib/ontology");
const { collectReportingSignals } = require("../lib/reporting-signals");
const {
  loadOntologyGraph,
  persistOntology,
  persistReportingLeads,
} = require("../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");

  const entityKey = String(req.query.entity_key || "").trim();
  if (!entityKey || entityKey.length > 120) {
    return res.status(400).json({ ok: false, error: "확인할 기업·운용사·펀드·인물을 골라주세요." });
  }

  try {
    let graph = await loadOntologyGraph(800).catch(() => null);
    let dossier = graph ? buildEntityDossier(graph, entityKey) : null;
    let storage = null;

    if (!dossier) {
      const collected = await collectReportingSignals({ days: 14 });
      await persistReportingLeads(collected.items).catch(() => ({ ready: false }));
      graph = buildOntology(collected.items);
      storage = await persistOntology(graph).catch(() => ({ ready: false }));
      dossier = buildEntityDossier(graph, entityKey);
    }

    if (!dossier) {
      return res.status(404).json({ ok: false, error: "최근 단서에서 이 대상의 취재파일을 찾지 못했습니다." });
    }

    return res.status(200).json({
      ok: true,
      ...dossier,
      storage,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
