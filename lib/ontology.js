const crypto = require("crypto");
const { WATCH_TARGETS } = require("./watch-config");

const DEAL_EVENTS = new Set([
  "capital_call",
  "selection_result",
  "investment",
  "fund_formation",
  "exit",
  "deal_process",
  "distress",
  "ownership",
]);

const ENTITY_TYPE_BY_CATEGORY = {
  ac: "ac",
  advisor: "advisor",
  ib: "financial_institution",
  lp: "lp",
  market: "market",
  pef: "pef",
  regulator: "regulator",
  special: "company",
  vc: "vc",
};

const RELATION_LABELS = {
  acquiring: "인수 추진",
  deal_party_of: "거래 관계",
  exiting_from: "회수 추진",
  invested_in: "투자",
  joined: "합류·선임",
  left: "퇴사·사임",
  linked_to_distress: "회생·재무위험 관련",
  manages_fund: "결성·운용",
  owns_stake_in: "지분 보유·변동",
  preferred_bidder_for: "우선협상대상자",
  promoted_at: "승진",
  selected_gp: "위탁운용사 선정",
  selling: "매각 추진",
  tender_offer_for: "공개매수",
};

function hash(value, length = 24) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, length);
}

function cleanName(value) {
  return String(value || "")
    .replace(/^\s*[\[({'\"‘“]+|[\])}'\"’”]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedName(value) {
  return cleanName(value)
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function entityKey(type, name) {
  return `${type}:${hash(normalizedName(name), 20)}`;
}

function sameName(left, right) {
  const a = normalizedName(left);
  const b = normalizedName(right);
  return Boolean(a && b && (a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)))));
}

function watchTargetsIn(text) {
  const haystack = normalizedName(text);
  return WATCH_TARGETS.filter((target) => [target.name, ...(target.aliases || [])]
    .map(normalizedName)
    .filter((term) => term.length >= 2)
    .some((term) => haystack.includes(term)));
}

function watchEntity(target) {
  if (!target) return null;
  return {
    canonical_name: target.name,
    entity_type: ENTITY_TYPE_BY_CATEGORY[target.category] || "organization",
    aliases: target.aliases || [],
    watch_priority: target.priority === "A" ? 100 : 0,
    metadata: { watch_id: target.id, watch_category: target.category },
  };
}

function suppliedTargetEntity(target) {
  if (!target?.name) return null;
  return {
    canonical_name: target.name,
    entity_type: ENTITY_TYPE_BY_CATEGORY[target.category] || "organization",
    aliases: target.aliases || [],
    watch_priority: target.priority === "A" ? 100 : 0,
    metadata: { watch_id: target.id || null, watch_category: target.category || null },
  };
}

function subjectEntity(item) {
  const name = cleanName(item.subject_name);
  if (!name || /^(선정|접수|공고|결과|안내|공지)/.test(name)) return null;
  return {
    canonical_name: name,
    entity_type: ["capital_call", "selection_result"].includes(item.source_type) ? "lp" : "organization",
    aliases: [],
    watch_priority: 0,
    metadata: { inferred_from: "official_title" },
  };
}

function leadingOrganization(title) {
  const text = String(title || "").replace(/^\s*\[[^\]]+\]\s*/, "");
  let candidate = cleanName(text.match(/^([^,，:]{2,38})[,，:]/)?.[1]);
  const quotedPrefix = candidate.match(/[’”']\s*([^’”']{2,24})$/)?.[1];
  if (quotedPrefix) candidate = cleanName(quotedPrefix);
  if (!candidate || candidate.split(/\s+/).length > 5) return null;
  if (/(선정|접수|공고|결과|모집|계획|발표|단독)$/.test(candidate)) return null;
  return candidate;
}

function fundNames(title) {
  const text = String(title || "");
  const values = [];
  for (const match of text.matchAll(/[‘“'\"]([^’”'\"]{2,50}펀드)[’”'\"]/g)) values.push(cleanName(match[1]));
  if (!values.length) {
    const match = text.match(/([0-9A-Za-z가-힣·&-]{2,24}(?:\s+[0-9A-Za-z가-힣·&-]{1,18}){0,2}펀드)/);
    if (match && !/^(신규|블라인드|사모|해당|관련)\s*펀드$/.test(match[1])) values.push(cleanName(match[1]));
  }
  return [...new Set(values.filter((name) => name.length >= 3))];
}

function peopleIn(title) {
  const text = String(title || "");
  const pattern = /([가-힣]{2,4})\s*(?:신임\s*)?(대표|부대표|대표이사|파트너|심사역|본부장|전무|상무|부사장|사장|회장)/g;
  const people = [];
  for (const match of text.matchAll(pattern)) {
    const name = cleanName(match[1]);
    if (/^(신임|전문|전문가|글로벌|투자|벤처|사외|공동)$/.test(name)) continue;
    people.push({ name, title: match[2] });
  }
  return people.filter((person, index) => people.findIndex((value) => value.name === person.name) === index);
}

function relationForDeal(title) {
  const text = String(title || "");
  if (/우선협상대상자|우협/.test(text)) return "preferred_bidder_for";
  if (/공개매수/.test(text)) return "tender_offer_for";
  if (/매각|매도/.test(text) && !/인수/.test(text)) return "selling";
  if (/인수|취득/.test(text)) return "acquiring";
  return "deal_party_of";
}

function dateOnly(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function buildOntology(items) {
  const nodes = new Map();
  const edges = new Map();
  const deals = new Map();
  const documents = new Map();
  const claims = new Map();
  const dealEvents = new Map();

  function addEntity(input, item, evidenceRole = "mentioned") {
    if (!input?.canonical_name || !input?.entity_type) return null;
    const name = cleanName(input.canonical_name);
    if (name.length < 2) return null;
    const key = entityKey(input.entity_type, name);
    const current = nodes.get(key) || {
      entity_key: key,
      canonical_name: name,
      entity_type: input.entity_type,
      aliases: [],
      watch_priority: 0,
      metadata: { source_signal_ids: [], evidence_roles: [] },
    };
    current.aliases = [...new Set([...(current.aliases || []), ...(input.aliases || [])])].filter((alias) => !sameName(alias, name));
    current.watch_priority = Math.max(current.watch_priority || 0, input.watch_priority || 0);
    current.metadata = { ...current.metadata, ...(input.metadata || {}) };
    current.metadata.source_signal_ids = [...new Set([...(current.metadata.source_signal_ids || []), item?.signal_id].filter(Boolean))].slice(-30);
    current.metadata.evidence_roles = [...new Set([...(current.metadata.evidence_roles || []), evidenceRole])];
    current.metadata.last_seen_at = item?.published_at || current.metadata.last_seen_at || null;
    nodes.set(key, current);
    return current;
  }

  function addEdge(from, to, relationType, item, dealKey = null, confidence = 4) {
    if (!from || !to || from.entity_key === to.entity_key) return null;
    const sourceSignalId = item.signal_id || hash(`${item.source_url}|${item.title}`, 20);
    const key = `relation:${hash(`${from.entity_key}|${relationType}|${to.entity_key}|${dealKey || ""}|${sourceSignalId}`)}`;
    const edge = {
      relation_key: key,
      from_entity_key: from.entity_key,
      to_entity_key: to.entity_key,
      relation_type: relationType,
      relation_label: RELATION_LABELS[relationType] || relationType,
      deal_key: dealKey,
      basis: item.title,
      confidence,
      valid_from: dateOnly(item.published_at),
      source_signal_id: sourceSignalId,
      source_rcept_no: item.rcept_no || null,
      metadata: {
        source_name: item.source_name || null,
        source_title: item.title,
        source_url: item.source_url,
        occurred_at: item.published_at || null,
      },
    };
    edges.set(key, edge);
    return edge;
  }

  function addDeal(item, owner, object) {
    if (!DEAL_EVENTS.has(item.event_type)) return null;
    const subject = object || owner;
    const fallback = normalizedName(item.title).slice(0, 50);
    const key = `deal:${hash(`${item.event_type}|${owner?.entity_key || ""}|${subject?.entity_key || fallback}`)}`;
    const label = {
      capital_call: "출자사업",
      selection_result: "운용사 선정",
      investment: "투자",
      fund_formation: "펀드 결성",
      exit: "회수",
      deal_process: "M&A 거래",
      distress: "회생·재무위험",
      ownership: "지분 변동",
    }[item.event_type] || "거래";
    const current = deals.get(key) || {
      deal_key: key,
      deal_name: `${subject?.canonical_name || owner?.canonical_name || "미분류"} ${label}`,
      deal_type: item.event_type,
      current_stage: item.event_label || label,
      status: "watching",
      target_entity_key: subject?.entity_key || null,
      estimated_value: null,
      currency: "KRW",
      summary: item.title,
      metadata: { source_signal_ids: [], participants: [] },
      source_signal_id: item.signal_id || null,
    };
    current.summary = item.title;
    current.current_stage = item.event_label || current.current_stage;
    current.metadata.source_signal_ids = [...new Set([...(current.metadata.source_signal_ids || []), item.signal_id].filter(Boolean))].slice(-30);
    current.metadata.participants = [...new Set([...(current.metadata.participants || []), owner?.entity_key, object?.entity_key].filter(Boolean))];
    current.metadata.last_seen_at = item.published_at || null;
    deals.set(key, current);
    return current;
  }

  for (const item of items || []) {
    if (!item?.title || !item?.source_url) continue;
    const mentionedTargets = watchTargetsIn(`${item.title} ${item.snippet || ""}`);
    const mainTarget = item.target
      ? WATCH_TARGETS.find((target) => target.id === item.target.id) || mentionedTargets[0]
      : mentionedTargets[0];
    const targetNode = addEntity(watchEntity(mainTarget) || suppliedTargetEntity(item.target), item, "watch_target");
    const subjectNode = addEntity(subjectEntity(item), item, "official_subject");
    const owner = subjectNode || targetNode;

    const leading = leadingOrganization(item.title);
    let companyNode = null;
    if (leading && !sameName(leading, owner?.canonical_name)) {
      companyNode = addEntity({ canonical_name: leading, entity_type: "company", aliases: [], metadata: { inferred_from: "headline_subject" } }, item, "headline_subject");
    }

    const fundNodes = fundNames(item.title).map((name) => addEntity({ canonical_name: name, entity_type: "fund", aliases: [] }, item, "fund_name"));
    const personNodes = peopleIn(item.title).map((person) => addEntity({ canonical_name: person.name, entity_type: "person", aliases: [], metadata: { title: person.title } }, item, "person_name"));
    for (const target of mentionedTargets) addEntity(watchEntity(target), item, "mentioned_watch_target");

    const object = item.event_type === "fund_formation" ? fundNodes[0] : companyNode;
    const deal = addDeal(item, owner || targetNode, object);
    const dealKey = deal?.deal_key || null;

    if (item.event_type === "investment" && targetNode && companyNode) addEdge(targetNode, companyNode, "invested_in", item, dealKey);
    if (item.event_type === "fund_formation" && targetNode && fundNodes[0]) addEdge(targetNode, fundNodes[0], "manages_fund", item, dealKey);
    if (item.event_type === "deal_process" && targetNode && companyNode) addEdge(targetNode, companyNode, relationForDeal(item.title), item, dealKey);
    if (item.event_type === "exit" && targetNode && companyNode) addEdge(targetNode, companyNode, "exiting_from", item, dealKey);
    if (item.event_type === "distress" && targetNode && companyNode) addEdge(targetNode, companyNode, "linked_to_distress", item, dealKey, 3);
    if (item.event_type === "ownership" && targetNode && companyNode) addEdge(targetNode, companyNode, "owns_stake_in", item, dealKey, 5);

    if (item.event_type === "selection_result" && subjectNode) {
      for (const target of mentionedTargets) {
        const gp = addEntity(watchEntity(target), item, "selected_gp");
        if (gp && gp.entity_key !== subjectNode.entity_key) addEdge(subjectNode, gp, "selected_gp", item, dealKey, 5);
      }
    }

    if (item.event_type === "people_move" && targetNode) {
      const relation = /퇴사|사임|이동|독립/.test(item.title) ? "left" : /승진/.test(item.title) ? "promoted_at" : "joined";
      for (const person of personNodes) addEdge(person, targetNode, relation, item, dealKey, 4);
    }

    const sourceKey = `source:${hash(item.source_url)}`;
    documents.set(sourceKey, {
      source_key: sourceKey,
      source_type: item.source_type || "other",
      source_name: item.source_name || null,
      title: item.title,
      source_url: item.source_url,
      published_at: item.published_at || null,
      excerpt: item.snippet || null,
      metadata: { signal_id: item.signal_id || null, related_count: item.related_count || 1 },
    });

    const claimKey = `claim:${hash(`${item.signal_id}|${item.event_type}`)}`;
    claims.set(claimKey, {
      claim_key: claimKey,
      subject_entity_key: (object || owner || targetNode)?.entity_key || null,
      deal_key: dealKey,
      predicate: item.event_type || "reported_event",
      value: {
        title: item.title,
        amounts: item.facts?.amounts || [],
        dates: item.facts?.dates || [],
        story_score: Number(item.story_score || 0),
        alert_grade: item.alert_grade || "P4",
      },
      source_key: sourceKey,
      source_signal_id: item.signal_id || null,
      source_rcept_no: item.rcept_no || null,
      verification_status: ["capital_call", "selection_result"].includes(item.source_type) ? "source_confirmed" : "unverified",
      valid_from: dateOnly(item.published_at),
    });

    if (deal && dateOnly(item.published_at)) {
      const eventKey = `event:${hash(`${deal.deal_key}|${item.signal_id}|${item.event_type}`)}`;
      dealEvents.set(eventKey, {
        event_key: eventKey,
        deal_key: deal.deal_key,
        source_signal_id: item.signal_id || null,
        source_rcept_no: item.rcept_no || null,
        event_date: dateOnly(item.published_at),
        event_type: item.event_type,
        headline: item.title,
        facts: [...(item.facts?.amounts || []), ...(item.facts?.dates || [])],
        evidence: [{ source_name: item.source_name || null, source_url: item.source_url }],
        confidence: ["capital_call", "selection_result"].includes(item.source_type) ? 5 : 3,
      });
    }
  }

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];
  const dealList = [...deals.values()];
  return {
    nodes: nodeList,
    edges: edgeList,
    deals: dealList,
    documents: [...documents.values()],
    claims: [...claims.values()],
    deal_events: [...dealEvents.values()],
    source_signal_ids: [...new Set((items || []).map((item) => item?.signal_id).filter(Boolean))],
    stats: {
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

function disclosureToLead(item) {
  const eventType = ({
    control_change: "deal_process",
    equity_acquisition: "investment",
    equity_disposal: "exit",
    merger_restructuring: "deal_process",
    distress_legal: "distress",
    performance_risk: "distress",
    fund_change: "fund_formation",
    ownership_report: "ownership",
  })[item?.analysis?.event_id] || "general";
  const text = `${item?.corp_name || ""} ${item?.flr_nm || ""} ${item?.report_nm || ""}`;
  const watched = watchTargetsIn(text)[0];
  const date = String(item?.rcept_dt || "");
  const publishedAt = /^\d{8}$/.test(date)
    ? new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+09:00`).toISOString()
    : null;
  const score = Number(item?.analysis?.score || 0);
  return {
    signal_id: `dart:${item?.rcept_no || hash(text, 20)}`,
    rcept_no: item?.rcept_no || null,
    title: `${item?.corp_name || "회사명 미상"}, ${item?.report_nm || "공시"}`,
    source_url: item?.url || "",
    source_name: "DART",
    source_type: "disclosure",
    published_at: publishedAt,
    snippet: item?.flr_nm ? `제출인 ${item.flr_nm}` : "",
    event_type: eventType,
    event_label: item?.analysis?.event_label || "공시",
    target: watched ? { id: watched.id, name: watched.name, category: watched.category, priority: watched.priority } : null,
    facts: { amounts: item?.analysis?.key_numbers || [], dates: [] },
    story_score: score,
    alert_grade: score >= 90 ? "P1" : score >= 70 ? "P2" : score >= 50 ? "P3" : "P4",
    interpretation: item?.analysis?.why || null,
    checkpoints: item?.analysis?.questions || [],
  };
}

module.exports = {
  buildOntology,
  cleanName,
  disclosureToLead,
  entityKey,
  fundNames,
  leadingOrganization,
  peopleIn,
  relationForDeal,
};
