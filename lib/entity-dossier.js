const TYPE_LABELS = {
  ac: "AC",
  advisor: "자문사",
  company: "기업",
  financial_institution: "금융기관",
  fund: "펀드",
  lp: "LP",
  market: "시장기관",
  organization: "기관",
  pef: "PEF",
  person: "인물",
  regulator: "감독·정책기관",
  vc: "VC",
};

const INVERSE_LABELS = {
  acquiring: "인수 주체",
  co_gp_with: "공동 GP",
  exiting_from: "회수 추진 주체",
  invested_in: "투자자",
  joined: "합류 인물",
  left: "퇴사·사임 인물",
  linked_to_distress: "회생·재무위험 관련",
  manages_fund: "운용사",
  owns_stake_in: "주주·지분 보유자",
  preferred_bidder_for: "우선협상대상자",
  promoted_at: "승진 인물",
  selected_gp: "선정기관",
  selling: "매도자",
  tender_offer_for: "공개매수자",
};

const NEWS_SOURCE_TYPES = new Set(["domestic_news", "foreign_news", "press_release"]);

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withParticle(name, afterFinal, afterVowel) {
  const value = String(name || "");
  const last = value.charCodeAt(value.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${value}${hasFinal ? afterFinal : afterVowel}`;
}

function baseQuestions(type, name) {
  if (["pef", "vc", "ac"].includes(type)) return [
    `${withParticle(name, "이", "가")} 현재 모집 중인 펀드의 목표액과 실제 약정액은 얼마인가`,
    "앵커 LP와 출자 확약을 받은 기관은 어디인가",
    "검토 중인 신규 투자와 매각 대상은 무엇인가",
    "기존 포트폴리오 가운데 차환·추가 투자·회수가 필요한 곳은 어디인가",
    "최근 합류하거나 퇴사한 핵심 인력이 맡았던 펀드와 거래는 무엇인가",
  ];
  if (type === "lp") return [
    `${name}의 올해 출자계획과 아직 집행하지 않은 금액은 얼마인가`,
    "전략별 출자액과 선정할 위탁운용사 수는 몇 곳인가",
    "재출자 제한, 최소 결성액, 결성 시한은 어떻게 정했나",
    "기존 출자펀드 가운데 성과와 소진율이 낮은 곳은 어디인가",
    "다음 공고와 최종 선정 결과는 언제 발표하나",
  ];
  if (type === "fund") return [
    `${name}의 목표 결성액과 현재 약정액은 얼마인가`,
    "GP와 앵커 LP, 주요 출자자는 누구인가",
    "1차·최종 클로징 시점과 최소 결성 조건은 무엇인가",
    "투자기간·존속기간과 주력 투자 분야는 어떻게 정했나",
    "현재까지 집행한 투자와 남은 드라이파우더는 얼마인가",
  ];
  if (type === "person") return [
    `${withParticle(name, "이", "가")} 현재 맡은 직책과 담당 펀드·투자 분야는 무엇인가`,
    "직전 소속에서 담당한 주요 거래와 포트폴리오는 무엇인가",
    "함께 이동한 인력과 새 조직에서 맡을 역할은 무엇인가",
    "독립계 운용사 설립이나 신규 펀드 결성 계획이 있는가",
  ];
  return [
    `${name}의 현재 최대주주와 주요 재무적투자자는 누구인가`,
    "진행 중인 투자 유치·매각·인수 절차는 어느 단계인가",
    "거래금액과 지분율, 자금조달 방식은 어떻게 정했나",
    "대주단·인수금융 주선사와 주요 만기는 언제인가",
    "최근 공시나 보도 이후 달라진 상대방·금액·일정은 무엇인가",
  ];
}

function relationQuestions(relations, name) {
  const types = new Set((relations || []).map((relation) => relation.relation_type));
  const questions = [];
  if (types.has("preferred_bidder_for")) questions.push(`${withParticle(name, "이", "가")} 우선협상대상자로 선정된 거래의 가격과 배타적 협상기간은 얼마인가`);
  if (types.has("invested_in")) questions.push("투자금액·밸류에이션·신주와 구주 비중은 각각 얼마인가");
  if (types.has("manages_fund")) questions.push("펀드의 실제 약정액, LP 구성, 1차·최종 클로징 시점은 언제인가");
  if (types.has("selected_gp")) questions.push("선정 뒤 실제 결성액과 민간 LP, 결성 시한 충족 여부는 어떻게 확인됐나");
  if (types.has("co_gp_with")) questions.push("공동 GP 사이의 투자심사·사후관리·관리보수 배분은 어떻게 정했나");
  if (types.has("owns_stake_in")) questions.push("직전 보고보다 지분율과 보유 목적이 어떻게 달라졌나");
  if (types.has("linked_to_distress")) questions.push("법원·채권단 일정과 대주주 추가 지원 계획은 어떻게 정했나");
  if (types.has("joined") || types.has("left") || types.has("promoted_at")) questions.push("인사 이동이 담당 펀드와 진행 중인 거래에 어떤 영향을 주나");
  return questions;
}

function buildEntityDossier(graph, entityKey) {
  const source = graph || {};
  const nodes = new Map((source.nodes || []).map((node) => [node.entity_key, node]));
  const entity = nodes.get(entityKey);
  if (!entity) return null;
  const profile = source.dossiers?.[entityKey] || null;

  const relations = (source.edges || [])
    .filter((edge) => edge.from_entity_key === entityKey || edge.to_entity_key === entityKey)
    .map((edge) => {
      const outgoing = edge.from_entity_key === entityKey;
      const counterpartKey = outgoing ? edge.to_entity_key : edge.from_entity_key;
      const counterpart = nodes.get(counterpartKey);
      return {
        relation_key: edge.relation_key,
        relation_type: edge.relation_type,
        relation_label: outgoing ? edge.relation_label : INVERSE_LABELS[edge.relation_type] || edge.relation_label,
        direction: outgoing ? "out" : "in",
        counterpart_key: counterpartKey,
        counterpart_name: counterpart?.canonical_name || "미분류",
        counterpart_type: counterpart?.entity_type || "organization",
        confidence: Number(edge.confidence || 0),
        valid_from: edge.valid_from || null,
        basis: edge.basis || null,
        source_signal_id: edge.source_signal_id || null,
        source_type: edge.metadata?.source_type || null,
        source_name: edge.metadata?.source_name || null,
        source_title: edge.metadata?.source_title || edge.basis || null,
        source_url: edge.metadata?.source_url || null,
        occurred_at: edge.metadata?.occurred_at || edge.valid_from || null,
      };
    })
    .sort((a, b) => b.confidence - a.confidence || String(b.occurred_at || "").localeCompare(String(a.occurred_at || "")));

  const deals = (source.deals || [])
    .filter((deal) => deal.target_entity_key === entityKey || (deal.metadata?.participants || []).includes(entityKey))
    .map((deal) => ({
      deal_key: deal.deal_key,
      deal_name: deal.deal_name,
      deal_type: deal.deal_type,
      current_stage: deal.current_stage,
      status: deal.status,
      summary: deal.summary,
      last_seen_at: deal.metadata?.last_seen_at || null,
      sources: deal.metadata?.sources || [],
      source_signal_ids: deal.metadata?.source_signal_ids || [],
    }))
    .sort((a, b) => String(b.last_seen_at || "").localeCompare(String(a.last_seen_at || "")));

  const relationEvidence = relations.map((relation) => ({
    title: relation.source_title,
    source_type: relation.source_type,
    source_name: relation.source_name,
    source_url: relation.source_url,
    published_at: relation.occurred_at,
    fact: `${relation.relation_label} · ${relation.counterpart_name}`,
  }));
  const dealEvidence = deals.flatMap((deal) => (deal.sources || []).map((sourceItem) => ({
    title: sourceItem.title || deal.summary,
    source_type: sourceItem.source_type || null,
    source_name: sourceItem.source_name || null,
    source_url: sourceItem.source_url || null,
    published_at: sourceItem.published_at || deal.last_seen_at,
    fact: deal.current_stage || deal.deal_type,
  })));
  const profileEvidence = (profile?.sources || []).map((item) => ({
    title: item.title,
    source_type: item.source_type || null,
    source_name: item.source_name,
    source_url: item.source_url,
    published_at: item.published_at,
    fact: item.fact,
    verification_status: item.verification_status || null,
  }));
  const evidence = uniqueBy([...profileEvidence, ...relationEvidence, ...dealEvidence], (item) => item.source_url || `${item.title}|${item.published_at}`)
    .filter((item) => item.title)
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));

  const sourceSignalIds = new Set([
    ...(entity.metadata?.source_signal_ids || []),
    ...relations.map((relation) => relation.source_signal_id),
    ...deals.flatMap((deal) => deal.source_signal_ids || []),
  ].filter(Boolean));
  const relatedNews = uniqueBy((source.documents || [])
    .filter((document) => NEWS_SOURCE_TYPES.has(document.source_type))
    .filter((document) => sourceSignalIds.has(document.metadata?.signal_id))
    .map((document) => ({
      source_key: document.source_key,
      source_type: document.source_type,
      source_name: document.source_name,
      title: document.title,
      source_url: document.source_url,
      published_at: document.published_at,
      excerpt: document.excerpt,
      related_count: Number(document.metadata?.related_count || 1),
    })), (item) => item.source_url || `${item.title}|${item.published_at}`)
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")))
    .slice(0, 20);

  const questions = uniqueBy([
    ...(profile?.questions || []),
    ...relationQuestions(relations, entity.canonical_name),
    ...baseQuestions(entity.entity_type, entity.canonical_name),
  ], (question) => question).slice(0, 7);

  return {
    entity,
    type_label: profile?.type_label || TYPE_LABELS[entity.entity_type] || "기관·기업",
    summary: profile?.summary || `${withParticle(entity.canonical_name, "과", "와")} 직접 연결된 관계 ${relations.length}건, 거래 ${deals.length}건, 근거 자료 ${evidence.length}건을 찾았습니다.`,
    data_basis: profile?.source_system || "최근 공개자료",
    updated_at: profile?.updated_at || entity.metadata?.last_seen_at || null,
    latest_issue_at: profile?.latest_issue_at || entity.metadata?.latest_issue_at || entity.metadata?.last_seen_at || null,
    company_id: profile?.company_id || entity.metadata?.company_id || null,
    identification_status: profile?.identification_status || null,
    current_status: profile?.current_status || [],
    drive_sections: profile?.drive_sections || [],
    connections: profile?.connections || [],
    decision_boundary: profile?.decision_boundary || null,
    next_updates: profile?.next_updates || [],
    drive_file_name: profile?.drive_file_name || null,
    selection_history: profile?.selection_history || [],
    co_gps: profile?.co_gps || [],
    funds: profile?.funds || [],
    unknowns: profile?.unknowns || [],
    relations,
    deals,
    related_news: relatedNews,
    evidence,
    questions,
    stats: {
      relations: relations.length,
      deals: deals.length,
      news: relatedNews.length,
      evidence: evidence.length,
      selections: profile?.selection_history?.length || 0,
      funds: profile?.funds?.length || 0,
      unknowns: profile?.unknowns?.length || 0,
    },
  };
}

module.exports = { buildEntityDossier };
