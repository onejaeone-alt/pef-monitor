const crypto = require("crypto");
const { relationInsight } = require("./relation-insight");

const KVIC_SELECTION_URL = "https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5103";
const KVIC_SELECTION_TITLE = "모태펀드(특허계정) 2026년 6월 수시 출자사업 선정 결과";
const CURATED_SIGNAL_ID = "curated:kvic:5103";

function hash(value, length = 24) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, length);
}

function normalizedName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function entityKey(type, name) {
  return `${type}:${hash(normalizedName(name), 20)}`;
}

function relationKey(fromKey, relationType, toKey) {
  return `relation:${hash(`${fromKey}|${relationType}|${toKey}|${CURATED_SIGNAL_ID}`)}`;
}

function addUnique(items, nextItems, keyFor) {
  const byKey = new Map((items || []).map((item) => [keyFor(item), item]));
  for (const item of nextItems || []) byKey.set(keyFor(item), { ...(byKey.get(keyFor(item)) || {}), ...item });
  return [...byKey.values()];
}

const ckdProfile = {
  source_system: "정리된 취재자료",
  updated_at: "2026-09-03",
  summary: "씨케이디창업투자는 2026년 특허계정 IP 창업·사업화 분야에서 디티앤인베스트먼트와 공동 GP로 선정됐습니다. 모태출자액은 100억원, 의무결성액은 200억원입니다. 2025년 보건계정 공동 선정 이력은 기존 추적표에 남아 있으나 공식 원문을 다시 확인해야 합니다.",
  selection_history: [
    {
      selected_at: "2026-08-27",
      year: 2026,
      program: "모태펀드(특허계정) 2026년 6월 수시 출자사업",
      account: "특허계정",
      field: "IP 창업·사업화",
      status: "선정",
      co_gps: ["디티앤인베스트먼트"],
      mother_commitment: "100억원",
      target_formation: "200억원",
      formation_status: "결성 확인 전",
      verification_status: "공식 선정결과 확인",
      source_name: "한국벤처투자",
      source_title: KVIC_SELECTION_TITLE,
      source_url: KVIC_SELECTION_URL,
    },
    {
      selected_at: "2025-07",
      year: 2025,
      program: "모태펀드 보건계정 수시 출자사업",
      account: "보건계정",
      field: "임상3상",
      status: "공동 선정 이력",
      co_gps: ["메디톡스벤처투자"],
      mother_commitment: null,
      target_formation: null,
      formation_status: "원문 재확인 필요",
      verification_status: "기존 추적표 기록",
      source_name: "기존 LP 출자사업 추적표",
      source_title: "2025년 7월 보건계정 수시 출자 기록",
      source_url: null,
    },
  ],
  co_gps: [
    { name: "디티앤인베스트먼트", year: 2026, account: "특허계정", status: "공식 확인" },
    { name: "메디톡스벤처투자", year: 2025, account: "보건계정", status: "원문 재확인 필요" },
  ],
  funds: [
    {
      name: "공식 조합명 확인 필요",
      program: "2026 특허계정 IP 창업·사업화 분야",
      manager: "디티앤인베스트먼트·씨케이디창업투자(Co-GP)",
      status: "선정·결성 확인 전",
      mother_commitment: "100억원",
      target_formation: "200억원",
      actual_formation: null,
      formation_deadline: "선정 뒤 3개월 이내 여부 확인",
    },
  ],
  unknowns: [
    "선정 조합의 공식 명칭",
    "선정 뒤 3개월 안에 결성했는지와 실제 약정액",
    "민간 LP 명단과 기관별 출자확약액",
    "대표 펀드매니저와 두 GP의 심사·사후관리 역할 분담",
    "2025년 보건계정 선정 공고 원문과 당시 출자액",
  ],
  questions: [
    "디티앤인베스트먼트와 씨케이디창업투자는 투자심사와 사후관리를 어떻게 나눴나",
    "모태출자액 100억원 외에 민간 LP 100억원 이상을 어느 기관에서 확보했나",
    "공식 조합명과 대표 펀드매니저, 1차 결성일은 언제 확정하나",
    "2025년 메디톡스벤처투자와 공동 선정된 펀드는 실제로 얼마를 결성했고 얼마나 집행했나",
    "두 해 연속 다른 공동 GP를 택한 이유는 무엇인가",
  ],
  sources: [
    {
      title: KVIC_SELECTION_TITLE,
      source_name: "한국벤처투자",
      source_url: KVIC_SELECTION_URL,
      published_at: "2026-08-27",
      fact: "디티앤인베스트먼트·씨케이디창업투자 공동 선정, 모태출자액 100억원, 의무결성액 200억원",
      verification_status: "공식 원문",
    },
    {
      title: "2025년 7월 보건계정 수시 출자 기록",
      source_name: "기존 LP 출자사업 추적표",
      source_url: null,
      published_at: "2025-07",
      fact: "메디톡스벤처투자와 공동 선정 이력",
      verification_status: "원문 재확인 필요",
    },
  ],
};

function mergeCuratedGpKnowledge(graph) {
  const source = graph || {};
  const ckdKey = entityKey("vc", "씨케이디창업투자");
  const dtnKey = entityKey("vc", "디티앤인베스트먼트");
  const kvicKey = entityKey("lp", "한국벤처투자");
  const fundKey = entityKey("fund", "2026 특허계정 IP 창업·사업화 공동운용 펀드");
  const dealKey = `deal:${hash("kvic-5103-ckd-dtn-selection")}`;
  const sourceKey = `source:${hash(KVIC_SELECTION_URL)}`;

  const nodes = addUnique(source.nodes, [
    {
      entity_key: ckdKey,
      canonical_name: "씨케이디창업투자",
      entity_type: "vc",
      aliases: ["씨케이창투", "CKD창업투자"],
      watch_priority: 100,
      metadata: { curated: true, featured: true, last_seen_at: "2026-08-27", source_signal_ids: [CURATED_SIGNAL_ID], evidence_roles: ["selected_gp"] },
    },
    {
      entity_key: dtnKey,
      canonical_name: "디티앤인베스트먼트",
      entity_type: "vc",
      aliases: ["DTN인베스트먼트", "DTN Investment"],
      watch_priority: 100,
      metadata: { curated: true, last_seen_at: "2026-08-27", source_signal_ids: [CURATED_SIGNAL_ID], evidence_roles: ["selected_gp"] },
    },
    {
      entity_key: kvicKey,
      canonical_name: "한국벤처투자",
      entity_type: "lp",
      aliases: ["KVIC", "모태펀드"],
      watch_priority: 100,
      metadata: { curated: true, last_seen_at: "2026-08-27", source_signal_ids: [CURATED_SIGNAL_ID], evidence_roles: ["selection_authority"] },
    },
    {
      entity_key: fundKey,
      canonical_name: "2026 특허계정 IP 창업·사업화 공동운용 펀드",
      entity_type: "fund",
      aliases: [],
      watch_priority: 0,
      metadata: { curated: true, provisional_name: true, last_seen_at: "2026-08-27", source_signal_ids: [CURATED_SIGNAL_ID], evidence_roles: ["selected_fund"] },
    },
  ], (item) => item.entity_key);

  const edgeBase = {
    deal_key: dealKey,
    confidence: 5,
    valid_from: "2026-08-27",
    source_signal_id: CURATED_SIGNAL_ID,
    source_rcept_no: null,
    basis: KVIC_SELECTION_TITLE,
    metadata: {
      source_name: "한국벤처투자",
      source_title: KVIC_SELECTION_TITLE,
      source_url: KVIC_SELECTION_URL,
      occurred_at: "2026-08-27",
      curated: true,
    },
  };
  const edges = addUnique(source.edges, [
    { ...edgeBase, relation_key: relationKey(kvicKey, "selected_gp", ckdKey), from_entity_key: kvicKey, to_entity_key: ckdKey, relation_type: "selected_gp", relation_label: "위탁운용사 선정" },
    { ...edgeBase, relation_key: relationKey(kvicKey, "selected_gp", dtnKey), from_entity_key: kvicKey, to_entity_key: dtnKey, relation_type: "selected_gp", relation_label: "위탁운용사 선정" },
    { ...edgeBase, relation_key: relationKey(ckdKey, "co_gp_with", dtnKey), from_entity_key: ckdKey, to_entity_key: dtnKey, relation_type: "co_gp_with", relation_label: "공동 GP" },
    { ...edgeBase, relation_key: relationKey(ckdKey, "manages_fund", fundKey), from_entity_key: ckdKey, to_entity_key: fundKey, relation_type: "manages_fund", relation_label: "공동운용" },
    { ...edgeBase, relation_key: relationKey(dtnKey, "manages_fund", fundKey), from_entity_key: dtnKey, to_entity_key: fundKey, relation_type: "manages_fund", relation_label: "공동운용" },
  ].map((edge) => ({ ...edge, ...relationInsight(edge.relation_type) })), (item) => item.relation_key);

  const deals = addUnique(source.deals, [{
    deal_key: dealKey,
    deal_name: "2026 특허계정 IP 창업·사업화 분야 운용사 선정",
    deal_type: "selection_result",
    current_stage: "공동 GP 선정·결성 확인 전",
    status: "watching",
    target_entity_key: fundKey,
    estimated_value: 10000000000,
    currency: "KRW",
    summary: "디티앤인베스트먼트·씨케이디창업투자 공동 선정. 모태출자액 100억원, 의무결성액 200억원.",
    source_signal_id: CURATED_SIGNAL_ID,
    metadata: {
      source_signal_ids: [CURATED_SIGNAL_ID],
      participants: [ckdKey, dtnKey, kvicKey, fundKey],
      last_seen_at: "2026-08-27",
      curated: true,
      sources: [{ title: KVIC_SELECTION_TITLE, source_name: "한국벤처투자", source_url: KVIC_SELECTION_URL, published_at: "2026-08-27" }],
    },
  }], (item) => item.deal_key);

  const documents = addUnique(source.documents, [{
    source_key: sourceKey,
    source_type: "selection_result",
    source_name: "한국벤처투자",
    title: KVIC_SELECTION_TITLE,
    source_url: KVIC_SELECTION_URL,
    published_at: "2026-08-27",
    excerpt: "씨케이디창업투자·디티앤인베스트먼트 공동 선정, 모태출자액 100억원, 의무결성액 200억원",
    metadata: { signal_id: CURATED_SIGNAL_ID, curated: true },
  }], (item) => item.source_key);

  const nodeList = nodes;
  const edgeList = edges;
  const dealList = deals;
  return {
    ...source,
    nodes: nodeList,
    edges: edgeList,
    deals: dealList,
    documents,
    dossiers: { ...(source.dossiers || {}), [ckdKey]: ckdProfile },
    featured_entities: addUnique(source.featured_entities, [{
      entity_key: ckdKey,
      canonical_name: "씨케이디창업투자",
      type_label: "VC·GP",
      status_text: "2026 특허계정 공동 선정",
      highlight: "모태 100억원 · 의무결성 200억원",
      updated_at: "2026-09-03",
    }], (item) => item.entity_key),
    source_signal_ids: [...new Set([...(source.source_signal_ids || []), CURATED_SIGNAL_ID])],
    stats: {
      ...(source.stats || {}),
      entities: nodeList.length,
      companies: nodeList.filter((node) => node.entity_type === "company").length,
      houses: nodeList.filter((node) => ["pef", "vc", "ac"].includes(node.entity_type)).length,
      funds: nodeList.filter((node) => node.entity_type === "fund").length,
      people: nodeList.filter((node) => node.entity_type === "person").length,
      deals: dealList.length,
      relations: edgeList.length,
    },
  };
}

module.exports = { ckdProfile, entityKey, mergeCuratedGpKnowledge };
