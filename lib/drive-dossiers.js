const { entityKey } = require("./ontology");
const snapshot = require("./drive-dossier-data.json");
const vcacSnapshot = require("./vcac-dossier-data");
const masterExtraSnapshot = require("./vcac-master-extra-data");
const pefSnapshot = require("./pef-master-data");
const pefExtraSnapshot = require("./pef-master-extra-data");
const pefFundClockSnapshot = require("./pef-fund-clock-data");
const pefKoreaInvestmentSnapshot = require("./pef-korea-investment-data");
const { WATCH_TARGETS } = require("./watch-config");

const WATCH_ENTITY_TYPES = {
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

const TYPE_LABELS = {
  ac: "AC",
  advisor: "자문사",
  company: "기업",
  financial_institution: "금융기관",
  lp: "LP",
  market: "시장기관",
  pef: "PEF",
  regulator: "감독·정책기관",
  vc: "VC",
};

const NEWS_MATCH_ENTITY_TYPES = new Set([
  "ac",
  "advisor",
  "company",
  "financial_institution",
  "lp",
  "market",
  "pef",
  "regulator",
  "vc",
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function unique(items, keyFor = (item) => String(item || "")) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shorten(value, length = 86) {
  const text = String(value || "").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function plainMarkdown(value) {
  return String(value || "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`/g, "")
    .trim();
}

function preparedItems() {
  // 상세 기업카드 → 핵심 VC·AC → 개체 마스터 보강 → PEF 하우스 → 펀드 시계 → 글로벌 한국투자 순으로 합친다.
  // 같은 기관이 여러 원천에 있으면 앞쪽의 더 상세한 데이터가 우선한다.
  const combined = [
    ...(snapshot.items || []),
    ...(vcacSnapshot.items || []),
    ...(masterExtraSnapshot.items || []),
    ...(pefSnapshot.items || []),
    ...(pefExtraSnapshot.items || []),
    ...(pefFundClockSnapshot.items || []),
    ...(pefKoreaInvestmentSnapshot.items || []),
  ];
  const seenNames = new Set();
  return combined
    .filter((item) => {
      const key = normalize(item.canonical_name);
      if (!key || seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .map((item) => {
      const status = item.current_status || (item.drive_sections || []).flatMap((section) => section.items || []);
      const unknowns = status
        .filter((entry) => /미확인|확인필요|보도불일치/.test(entry.label || ""))
        .map((entry) => entry.text);
      return {
        ...item,
        entity_key: entityKey(item.entity_type, item.canonical_name),
        current_status: status,
        unknowns,
        summary: item.summary || status.slice(0, 2).map((entry) => entry.text).join(" "),
      };
    });
}

const DRIVE_DOSSIERS = preparedItems();

function matchCandidates() {
  const candidates = new Map();
  for (const item of DRIVE_DOSSIERS) {
    if (NEWS_MATCH_ENTITY_TYPES.has(item.entity_type)) candidates.set(normalize(item.canonical_name), item);
  }
  for (const target of WATCH_TARGETS) {
    const key = normalize(target.name);
    const existing = candidates.get(key);
    if (existing) {
      candidates.set(key, {
        ...existing,
        aliases: unique([...(existing.aliases || []), ...(target.aliases || [])]),
      });
      continue;
    }
    const entityType = WATCH_ENTITY_TYPES[target.category] || "organization";
    candidates.set(key, {
      canonical_name: target.name,
      aliases: target.aliases || [],
      entity_type: entityType,
      entity_key: entityKey(entityType, target.name),
      type_label: TYPE_LABELS[entityType] || "취재대상",
    });
  }
  return [...candidates.values()];
}

const DOSSIER_MATCH_CANDIDATES = matchCandidates();
const MATCH_TERM_COUNTS = DOSSIER_MATCH_CANDIDATES.reduce((counts, item) => {
  for (const value of [item.canonical_name, ...(item.aliases || [])]) {
    const term = normalize(value);
    if (term.length < 2) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return counts;
}, new Map());

function containsTerm(text, value) {
  const term = normalize(value);
  if (term.length < 2) return false;
  const hasKorean = /[가-힣]/.test(term);
  if (hasKorean || term.length >= 5) return normalize(text).includes(term);
  const raw = String(text || "").toLowerCase().normalize("NFKC");
  const literal = String(value || "").toLowerCase().normalize("NFKC").trim();
  if (!literal) return false;
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^0-9a-z])${escaped}(?=$|[^0-9a-z])`, "i").test(raw);
}

function matchDossiersInText(text, limit = 6) {
  const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 12);
  return DOSSIER_MATCH_CANDIDATES
    .map((item) => {
      const canonical = normalize(item.canonical_name);
      const terms = [item.canonical_name, ...(item.aliases || [])]
        .map((value) => ({ value, normalized: normalize(value) }))
        .filter((entry) => entry.normalized.length >= 2 && containsTerm(text, entry.value))
        .filter((entry) => entry.normalized === canonical || MATCH_TERM_COUNTS.get(entry.normalized) === 1)
        .sort((left, right) => right.normalized.length - left.normalized.length);
      if (!terms.length) return null;
      const canonicalMatch = terms.some((entry) => entry.normalized === canonical);
      return { item, score: (canonicalMatch ? 1000 : 500) + terms[0].normalized.length };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score
      || left.item.canonical_name.localeCompare(right.item.canonical_name, "ko"))
    .slice(0, safeLimit)
    .map(({ item }) => ({
      entity_key: item.entity_key,
      canonical_name: item.canonical_name,
      entity_type: item.entity_type,
      type_label: item.type_label || TYPE_LABELS[item.entity_type] || "취재대상",
    }));
}

function profileFor(item) {
  return {
    company_id: item.company_id,
    source_system: item.source_system,
    updated_at: item.basis_date,
    latest_issue_at: item.latest_issue_at,
    type_label: item.type_label,
    identification_status: item.identification_status,
    summary: item.summary,
    current_status: item.current_status,
    drive_sections: item.drive_sections || [],
    connections: (item.connections || []).map(plainMarkdown),
    decision_boundary: item.decision_boundary || null,
    next_updates: item.next_updates || [],
    questions: item.questions || [],
    unknowns: item.unknowns || [],
    sources: item.sources || [],
    drive_file_name: item.file_name,
  };
}

function mergeProfiles(previous = {}, next = {}) {
  return {
    ...previous,
    ...next,
    selection_history: previous.selection_history || next.selection_history || [],
    co_gps: previous.co_gps || next.co_gps || [],
    funds: previous.funds || next.funds || [],
    questions: unique([...(next.questions || []), ...(previous.questions || [])]),
    unknowns: unique([...(next.unknowns || []), ...(previous.unknowns || [])]),
    sources: unique(
      [...(next.sources || []), ...(previous.sources || [])],
      (item) => item.source_url || `${item.title}|${item.fact || ""}`,
    ),
  };
}

function priorityScore(value) {
  if (value === "A") return 3;
  if (value === "B") return 2;
  if (value === "C") return 1;
  return Number(value || 0);
}

function mergeDriveDossiers(graph) {
  const source = graph || {};
  const nodes = new Map((source.nodes || []).map((node) => [node.entity_key, node]));
  const dossiers = { ...(source.dossiers || {}) };

  for (const target of WATCH_TARGETS) {
    const entityType = WATCH_ENTITY_TYPES[target.category] || "organization";
    if (!NEWS_MATCH_ENTITY_TYPES.has(entityType)) continue;
    const targetKey = entityKey(entityType, target.name);
    const current = nodes.get(targetKey) || {};
    nodes.set(targetKey, {
      ...current,
      entity_key: targetKey,
      canonical_name: target.name,
      entity_type: entityType,
      aliases: unique([...(current.aliases || []), ...(target.aliases || [])]),
      watch_priority: Math.max(Number(current.watch_priority || 0), 3),
      metadata: {
        ...(current.metadata || {}),
        watch_target: true,
      },
    });
  }

  for (const item of DRIVE_DOSSIERS) {
    const current = nodes.get(item.entity_key) || {};
    nodes.set(item.entity_key, {
      entity_key: item.entity_key,
      canonical_name: item.canonical_name,
      entity_type: item.entity_type,
      aliases: unique([...(current.aliases || []), ...(item.aliases || [])]),
      watch_priority: Math.max(Number(current.watch_priority || 0), priorityScore(item.watch_priority)),
      metadata: {
        ...(current.metadata || {}),
        drive_card: Boolean(item.file_name),
        master_profile: !item.file_name,
        company_id: item.company_id,
        drive_basis_date: item.basis_date,
        latest_issue_at: item.latest_issue_at,
        source_system: item.source_system,
      },
    });
    dossiers[item.entity_key] = mergeProfiles(dossiers[item.entity_key], profileFor(item));
  }

  const nodeList = [...nodes.values()];
  return {
    ...source,
    nodes: nodeList,
    dossiers,
    dossier_count: DRIVE_DOSSIERS.length,
    stats: {
      ...(source.stats || {}),
      entities: nodeList.length,
      companies: nodeList.filter((node) => node.entity_type === "company").length,
      houses: nodeList.filter((node) => ["pef", "vc", "ac"].includes(node.entity_type)).length,
      funds: nodeList.filter((node) => node.entity_type === "fund").length,
      people: nodeList.filter((node) => node.entity_type === "person").length,
    },
  };
}

function searchScore(item, query) {
  const name = normalize(item.canonical_name);
  const aliases = (item.aliases || []).map(normalize);
  const haystack = normalize([
    item.type_label,
    ...item.current_status.map((entry) => entry.text),
    ...(item.connections || []),
    ...(item.questions || []),
  ].join(" "));
  if (name === query) return 1000;
  if (aliases.includes(query)) return 950;
  if (name.startsWith(query)) return 850;
  if (aliases.some((alias) => alias.startsWith(query))) return 800;
  if (name.includes(query)) return 700;
  if (aliases.some((alias) => alias.includes(query))) return 650;
  if (haystack.includes(query)) return 400;
  return 0;
}

function searchDriveDossiers(query, limit = 12) {
  const term = normalize(query);
  if (!term) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 20);
  return DRIVE_DOSSIERS
    .map((item) => ({ item, score: searchScore(item, term) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score
      || String(right.item.latest_issue_at || "").localeCompare(String(left.item.latest_issue_at || ""))
      || left.item.canonical_name.localeCompare(right.item.canonical_name, "ko"))
    .slice(0, safeLimit)
    .map(({ item }) => ({
      entity_key: item.entity_key,
      canonical_name: item.canonical_name,
      aliases: item.aliases || [],
      type_label: item.type_label,
      updated_at: item.basis_date,
      latest_issue_at: item.latest_issue_at,
      status_text: shorten(item.current_status[0]?.text || item.summary, 96),
      highlight: shorten(item.unknowns[0] || item.current_status[1]?.text || "취재파일 보기", 96),
    }));
}

function dateOnly(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function featuredScore(item) {
  const confirmed = item.current_status.filter((entry) => /확인|회사발표|보도/.test(entry.label || "")).length;
  const unresolved = item.current_status.filter((entry) => /미확인|확인필요|보도불일치/.test(entry.label || "")).length;
  return confirmed * 3 + unresolved * 2 + (item.connections || []).length + (item.sources || []).length;
}

function selectFeaturedDossiers(graph = {}, options = {}) {
  if (!graph.nodes && (graph.now || graph.days || graph.limit)) {
    options = graph;
    graph = {};
  }
  const now = new Date(options.now || Date.now());
  const days = Math.min(Math.max(Number(options.days) || 14, 1), 30);
  const limit = Math.min(Math.max(Number(options.limit) || 6, 1), 8);
  const cutoff = new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const activity = new Map();
  const addActivity = (key, date, title, label = null) => {
    const day = dateOnly(date);
    if (!key || !day) return;
    const current = activity.get(key);
    if (!current || day >= current.date) activity.set(key, { date: day, title, label });
  };
  for (const node of graph.nodes || []) {
    addActivity(node.entity_key, node.metadata?.last_seen_at, null, null);
  }
  for (const edge of graph.edges || []) {
    const date = edge.metadata?.occurred_at || edge.valid_from;
    addActivity(edge.from_entity_key, date, edge.basis, edge.relation_label);
    addActivity(edge.to_entity_key, date, edge.basis, edge.relation_label);
  }
  for (const deal of graph.deals || []) {
    const date = deal.metadata?.last_seen_at;
    for (const key of deal.metadata?.participants || []) addActivity(key, date, deal.summary, deal.current_stage);
    addActivity(deal.target_entity_key, date, deal.summary, deal.current_stage);
  }
  return DRIVE_DOSSIERS
    .map((item) => {
      const live = activity.get(item.entity_key);
      const latestIssueAt = [item.latest_issue_at, live?.date].filter(Boolean).sort().at(-1) || null;
      return { item, live, latest_issue_at: latestIssueAt };
    })
    .filter((entry) => entry.latest_issue_at && entry.latest_issue_at >= cutoff)
    .sort((left, right) => String(right.latest_issue_at).localeCompare(String(left.latest_issue_at))
      || featuredScore(right.item) - featuredScore(left.item)
      || left.item.canonical_name.localeCompare(right.item.canonical_name, "ko"))
    .slice(0, limit)
    .map(({ item, live, latest_issue_at: latestIssueAt }) => ({
      entity_key: item.entity_key,
      canonical_name: item.canonical_name,
      type_label: item.type_label,
      status_text: shorten(live?.title || item.current_status[0]?.text || item.summary, 78),
      highlight: shorten(item.unknowns[0] || item.current_status[1]?.text || "취재파일 보기", 78),
      updated_at: latestIssueAt,
    }));
}

module.exports = {
  DRIVE_DOSSIERS,
  matchDossiersInText,
  mergeDriveDossiers,
  searchDriveDossiers,
  selectFeaturedDossiers,
};
