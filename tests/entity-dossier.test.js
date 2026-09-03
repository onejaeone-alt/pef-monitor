const test = require("node:test");
const assert = require("node:assert/strict");
const { buildEntityDossier } = require("../lib/entity-dossier");
const { buildOntology } = require("../lib/ontology");
const { mergeCuratedGpKnowledge } = require("../lib/curated-gp-knowledge");

function lead(overrides = {}) {
  return {
    signal_id: "deal-1",
    title: "삼성물산, ESS 개발법인 투자 유치에 IMM인베스트먼트 우선협상대상자 선정",
    source_url: "https://example.com/deal",
    source_name: "테스트뉴스",
    source_type: "domestic_news",
    published_at: "2026-09-02T00:00:00Z",
    event_type: "deal_process",
    event_label: "M&A 절차",
    target: { id: "A-040", name: "IMM인베스트먼트", category: "vc", priority: "A" },
    facts: { amounts: [], dates: [] },
    story_score: 80,
    alert_grade: "P1",
    ...overrides,
  };
}

function sampleGraph() {
  return buildOntology([
    lead(),
    lead({
      signal_id: "fund-1",
      title: "IMM인베스트먼트, ‘한일융합펀드’ 조성",
      source_url: "https://example.com/fund",
      published_at: "2026-09-01T00:00:00Z",
      event_type: "fund_formation",
      event_label: "펀드 결성",
    }),
  ]);
}

test("운용사 취재파일에 직접 관계·거래·근거·질문을 묶는다", () => {
  const graph = sampleGraph();
  const imm = graph.nodes.find((node) => node.canonical_name === "IMM인베스트먼트");
  const dossier = buildEntityDossier(graph, imm.entity_key);

  assert.equal(dossier.type_label, "VC");
  assert.equal(dossier.relations.length, 2);
  assert.equal(dossier.deals.length, 2);
  assert.equal(dossier.evidence.some((item) => item.source_url === "https://example.com/deal"), true);
  assert.equal(dossier.questions.some((question) => question.includes("우선협상대상자")), true);
  assert.equal(dossier.summary.startsWith("IMM인베스트먼트와"), true);
  assert.equal(dossier.questions.some((question) => question.startsWith("IMM인베스트먼트가")), true);
});

test("거래 상대방에서 보면 관계를 역방향으로 설명한다", () => {
  const graph = sampleGraph();
  const samsung = graph.nodes.find((node) => node.canonical_name === "삼성물산");
  const dossier = buildEntityDossier(graph, samsung.entity_key);

  assert.equal(dossier.relations[0].relation_label, "우선협상대상자");
  assert.equal(dossier.relations[0].counterpart_name, "IMM인베스트먼트");
});

test("없는 대상은 빈 취재파일을 꾸미지 않는다", () => {
  assert.equal(buildEntityDossier(sampleGraph(), "company:missing"), null);
});

test("씨케이디창업투자 취재파일에 선정 이력과 공동 GP, 미확인 항목을 묶는다", () => {
  const graph = mergeCuratedGpKnowledge(buildOntology([]));
  const ckd = graph.nodes.find((node) => node.canonical_name === "씨케이디창업투자");
  const dossier = buildEntityDossier(graph, ckd.entity_key);

  assert.equal(graph.featured_entities[0].entity_key, ckd.entity_key);
  assert.equal(dossier.selection_history.length, 2);
  assert.equal(dossier.selection_history[0].mother_commitment, "100억원");
  assert.equal(dossier.selection_history[0].target_formation, "200억원");
  assert.equal(dossier.co_gps[0].name, "디티앤인베스트먼트");
  assert.equal(dossier.funds[0].name, "공식 조합명 확인 필요");
  assert.equal(dossier.unknowns.some((item) => item.includes("민간 LP")), true);
  assert.equal(dossier.questions.some((item) => item.includes("투자심사")), true);
  assert.equal(dossier.evidence.some((item) => item.source_name === "한국벤처투자"), true);
});
