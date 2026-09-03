const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOntology, disclosureToLead, fundNames, peopleIn } = require("../lib/ontology");

function lead(overrides = {}) {
  return {
    signal_id: "signal-1",
    title: "스페이스랩, 블루포인트서 시드 투자 유치",
    source_url: "https://example.com/story",
    source_name: "테스트뉴스",
    source_type: "domestic_news",
    published_at: "2026-09-02T00:00:00Z",
    event_type: "investment",
    event_label: "투자",
    target: { id: "A-045", name: "블루포인트파트너스", category: "ac", priority: "A" },
    facts: { amounts: [], dates: [] },
    story_score: 60,
    alert_grade: "P3",
    ...overrides,
  };
}

test("투자 기사에서 투자사와 피투자사를 연결한다", () => {
  const graph = buildOntology([lead()]);
  const names = new Map(graph.nodes.map((node) => [node.entity_key, node.canonical_name]));
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].relation_type, "invested_in");
  assert.equal(names.get(graph.edges[0].from_entity_key), "블루포인트파트너스");
  assert.equal(names.get(graph.edges[0].to_entity_key), "스페이스랩");
});

test("펀드 결성 기사에서 운용사와 펀드를 연결한다", () => {
  const graph = buildOntology([lead({
    signal_id: "signal-2",
    title: "IMM인베스트먼트 재팬, ‘한일융합펀드’ 조성",
    source_url: "https://example.com/fund",
    event_type: "fund_formation",
    event_label: "펀드 결성",
    target: { id: "A-040", name: "IMM인베스트먼트", category: "vc", priority: "A" },
  })]);
  assert.deepEqual(fundNames("IMM인베스트먼트 재팬, ‘한일융합펀드’ 조성"), ["한일융합펀드"]);
  assert.equal(graph.edges[0].relation_type, "manages_fund");
  assert.equal(graph.nodes.find((node) => node.entity_type === "fund").canonical_name, "한일융합펀드");
});

test("우선협상 기사에서 거래 관계와 근거를 남긴다", () => {
  const graph = buildOntology([lead({
    signal_id: "signal-3",
    title: "삼성물산, 미국 ESS 개발법인 투자 유치에 IMM인베스트먼트 우선협상대상자 선정",
    source_url: "https://example.com/deal",
    event_type: "deal_process",
    event_label: "M&A 절차",
    target: { id: "A-040", name: "IMM인베스트먼트", category: "vc", priority: "A" },
  })]);
  assert.equal(graph.edges[0].relation_type, "preferred_bidder_for");
  assert.equal(graph.edges[0].basis.includes("삼성물산"), true);
  assert.equal(graph.deals.length, 1);
  assert.equal(graph.deal_events.length, 1);
});

test("인사 기사에 실명이 있을 때만 사람 관계를 만든다", () => {
  const title = "SBVA, 김민수 파트너 영입";
  assert.deepEqual(peopleIn(title), [{ name: "김민수", title: "파트너" }]);
  const graph = buildOntology([lead({
    signal_id: "signal-4",
    title,
    source_url: "https://example.com/person",
    event_type: "people_move",
    event_label: "핵심 인사",
    target: { id: "A-039", name: "SBVA", category: "vc", priority: "A" },
  })]);
  assert.equal(graph.edges[0].relation_type, "joined");
  assert.equal(graph.nodes.some((node) => node.entity_type === "person" && node.canonical_name === "김민수"), true);
});

test("직함만 나온 인사 기사에서 벤처를 사람 이름으로 읽지 않는다", () => {
  assert.deepEqual(peopleIn("SBVA, 글로벌 투자 전문가 2인 벤처파트너로 영입"), []);
});

test("따옴표 속 설명 뒤의 실제 회사명만 남긴다", () => {
  const graph = buildOntology([lead({
    signal_id: "signal-quoted-company",
    title: "‘음악 데이터 기반 마케팅’ 사운독, 프라이머에서 투자 유치",
    source_url: "https://example.com/soundog",
    target: { id: "A-046", name: "프라이머", category: "ac", priority: "A" },
  })]);
  assert.equal(graph.nodes.some((node) => node.canonical_name === "사운독"), true);
  assert.equal(graph.nodes.some((node) => node.canonical_name.includes("음악 데이터")), false);
});

test("단순 동시 언급은 관계로 확정하지 않는다", () => {
  const graph = buildOntology([lead({
    signal_id: "signal-5",
    title: "IMM인베스트먼트와 KB인베스트먼트, 벤처 포럼 참석",
    source_url: "https://example.com/forum",
    event_type: "general",
    event_label: "관련 뉴스",
    target: { id: "A-040", name: "IMM인베스트먼트", category: "vc", priority: "A" },
  })]);
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.deals.length, 0);
});

test("DART 지분 공시도 감시대상과 기업 관계로 바꾼다", () => {
  const converted = disclosureToLead({
    rcept_no: "20260903000123",
    rcept_dt: "20260903",
    corp_name: "테스트기업",
    corp_code: "00123456",
    flr_nm: "MBK파트너스",
    report_nm: "주식등의대량보유상황보고서",
    url: "https://dart.fss.or.kr/test",
    analysis: { event_id: "ownership_report", event_label: "대량보유·주주 변동", score: 75, key_numbers: ["12.5%"] },
  });
  const graph = buildOntology([converted]);
  assert.equal(converted.event_type, "ownership");
  assert.equal(graph.edges[0].relation_type, "owns_stake_in");
  assert.equal(graph.claims[0].source_rcept_no, "20260903000123");
});
