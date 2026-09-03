const { collectSources } = require("../lib/context-sources");
const { buildEntityDossier } = require("../lib/entity-dossier");
const {
  buildWriterBrief,
  classifyTip,
  filterRelevantMaterials,
  normalizeDisclosure,
  normalizeLead,
  normalizeText,
  subjectFromTip,
} = require("../lib/writer-engine");
const { findWatchTarget } = require("../lib/watch-config");
const { loadOntologyGraph, loadRecentReportingLeads, searchDisclosures } = require("../lib/supabase");

function clean(value, maxLength) {
  return normalizeText(value).slice(0, maxLength);
}

function normalizedName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function graphDossier(graph, subject, target) {
  if (!graph?.nodes?.length) return null;
  const terms = [subject, target?.name, ...(target?.aliases || [])]
    .map(normalizedName)
    .filter((value) => value.length >= 2);
  const node = graph.nodes.find((candidate) => {
    const names = [candidate.canonical_name, ...(candidate.aliases || [])].map(normalizedName);
    return names.some((name) => terms.some((term) => name === term || (name.length >= 4 && term.length >= 4 && (name.includes(term) || term.includes(name)))));
  });
  return node ? buildEntityDossier(graph, node.entity_key) : null;
}

function mergeMaterials({ disclosures, sources, leads, subject, target }) {
  const rows = [
    ...(disclosures || []).map(normalizeDisclosure),
    ...(sources?.domestic || []).map(normalizeLead),
    ...(sources?.foreign || []).map(normalizeLead),
    ...(sources?.press_release || []).map(normalizeLead),
    ...(leads || []).map(normalizeLead),
  ];
  return filterRelevantMaterials(rows, subject, target);
}

async function settledValue(promise, fallback) {
  try {
    return await promise;
  } catch (_) {
    return fallback;
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ ok: false, error: "GET 또는 POST만 사용할 수 있습니다." });

  try {
    const input = req.method === "POST" ? (req.body || {}) : (req.query || {});
    const tip = clean(input.tip, 300);
    const format = clean(input.format || "auto", 20);
    const notes = clean(input.notes, 5000);
    if (tip.length < 2) return res.status(400).json({ ok: false, error: "확인할 제보나 기사 아이디어를 한 줄로 적어주세요." });

    const target = findWatchTarget(tip);
    const subject = clean(target?.name || subjectFromTip(tip), 80);
    if (subject.length < 2) return res.status(400).json({ ok: false, error: "기업·운용사·인물 이름을 찾지 못했습니다. 문장 앞에 취재 대상을 적어주세요." });
    const eventType = classifyTip(tip);
    const eventLabel = ({
      capital_call: "출자공고",
      selection_result: "운용사 선정",
      distress: "회생 파산 워크아웃",
      deal_process: "인수 매각 경영권",
      fund_formation: "펀드 결성",
      exit: "회수 엑시트",
      people_move: "인사 이동",
      investment: "투자 유치",
      financing: "자금조달 차환",
      general: "기업 주요 사건",
    })[eventType];
    const searchTerms = [subject, target?.name, ...(target?.aliases || [])].filter(Boolean);

    const [sources, disclosures, leads, graph] = await Promise.all([
      settledValue(collectSources({ corpName: subject, filerName: target?.name === subject ? "" : target?.name || "", eventLabel }), {
        domestic: [], foreign: [], press_release: [], providers: {}, queries: {},
      }),
      settledValue(searchDisclosures(searchTerms, 40), []),
      settledValue(loadRecentReportingLeads(30), []),
      settledValue(loadOntologyGraph(800), null),
    ]);

    const dossier = graphDossier(graph, subject, target);
    const materials = mergeMaterials({ disclosures, sources, leads, subject, target });
    const brief = buildWriterBrief({ tip, format, notes, subject, target, materials, dossier });

    return res.status(200).json({
      ok: true,
      ...brief,
      lookup: {
        dart_rows: disclosures.length,
        recent_leads: leads.length,
        domestic: sources.domestic.length,
        foreign: sources.foreign.length,
        press_release: sources.press_release.length,
      },
      providers: {
        ...sources.providers,
        supabase_disclosures: disclosures.length > 0,
        ontology: Boolean(graph),
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 500) });
  }
};
