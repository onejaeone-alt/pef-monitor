const crypto = require('crypto');
const { collectReportingSignals } = require('../lib/reporting-signals');
const { persistReportingLeads } = require('../lib/supabase');
const {
  detectCrossSourceSequences,
  detectDartChanges,
  detectFormationGaps,
  detectKvicPlanChanges,
  detectRepeatGps,
} = require('../lib/clue-engine');
const { fetchKvicFunds, kvicNoticesFromLeads, loadDisclosureHistory, loadReportingLeadHistory } = require('../lib/clue-data');
const { buildCanonicalClues, SNAPSHOT_DATE } = require('../lib/canonical-clues');
const { attachFormation, buildGpStats, groupNotices } = require('../lib/motae-monitor');

function summary(items) {
  return (items || []).reduce((result, item) => {
    result[item.alert_grade] = (result[item.alert_grade] || 0) + 1;
    result[item.source_type] = (result[item.source_type] || 0) + 1;
    return result;
  }, { P1: 0, P2: 0, P3: 0, P4: 0 });
}

function prioritizeKvic(items) {
  const kvic = [];
  const others = [];
  for (const item of items || []) {
    const text = `${item.source_name || ''} ${item.title || ''}`;
    if (/한국벤처투자|KVIC|모태펀드/.test(text)) kvic.push(item);
    else others.push(item);
  }
  return [...kvic.slice(0, 4), ...others, ...kvic.slice(4)];
}

function mergeLeadHistory(current, history) {
  const map = new Map();
  for (const item of [...(current || []), ...(history || [])]) {
    if (!item?.signal_id) continue;
    if (!map.has(item.signal_id)) map.set(item.signal_id, item);
  }
  return [...map.values()].sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
}

function clueStats(items) {
  const detectors = {};
  const statuses = {};
  for (const item of items || []) {
    detectors[item.detector] = (detectors[item.detector] || 0) + 1;
    statuses[item.fact_status] = (statuses[item.fact_status] || 0) + 1;
  }
  return { total: items.length, detectors, statuses };
}

function sortClues(items) {
  const order = {
    lp_rule_change: 0,
    formation_pattern: 1,
    formation_gap: 2,
    kvic_plan_change: 3,
    dart_change: 4,
    market_pattern: 5,
    cross_source: 6,
  };
  return [...(items || [])].sort((a, b) =>
    String(b.sort_date || '').localeCompare(String(a.sort_date || '')) ||
    (order[a.detector] ?? 99) - (order[b.detector] ?? 99) ||
    String(a.headline || '').localeCompare(String(b.headline || ''), 'ko')
  );
}

function stableId(type, parts) {
  return crypto.createHash('sha1').update(`${type}|${(parts || []).join('|')}`).digest('hex').slice(0, 20);
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function uniqueSources(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    for (const source of item?.sources || []) {
      if (!source?.url || seen.has(source.url)) continue;
      seen.add(source.url);
      out.push(source);
    }
  }
  return out;
}

function sanitizeDiscoveryClue(clue) {
  const next = { ...clue, stage: '발견' };
  delete next.judgment;
  delete next.judgment_reason;
  return next;
}

function reportName(fact) {
  return String(fact || '').replace(/^현재 공시:\s*|^직전 동일 유형 공시:\s*/g, '').trim();
}

function materialDartClue(clue) {
  const facts = clue.confirmed_facts || [];
  const current = reportName(facts[0]);
  const previous = reportName(facts[1]);
  const text = `${current} ${previous} ${clue.changed_fact || ''} ${clue.one_line_signal || ''}`;
  const concreteDelta = /→/.test(text);
  const majorEvent = /공개매수|최대주주변경(?!을수반)|유상증자결정|전환사채|신주인수권|교환사채|타법인주식.*(?:취득|처분)|영업양수도|합병|분할|회생|파산|기업결합|주식양수도|경영권양수도/.test(text);
  const routineOwnership = /최대주주등소유주식변동신고서/.test(current) && !/최대주주변경(?!을수반)/.test(current);
  const sameReport = current && previous && current.replace(/\[(?:기재|첨부)?정정\]/g, '') === previous.replace(/\[(?:기재|첨부)?정정\]/g, '');
  const genericRepeat = /같은 유형의 공시가 다시 나왔습니다|두 원문의 조건과 숫자를 비교해야 합니다/.test(clue.changed_fact || '');

  if (routineOwnership) return false;
  if (sameReport && genericRepeat && !concreteDelta) return false;
  if (/정정/.test(text) && genericRepeat && !concreteDelta && !majorEvent) return false;
  return concreteDelta || majorEvent;
}

function selectDartClues(disclosures, limit = 5) {
  return detectDartChanges(disclosures)
    .filter((clue) => !/투자설명서\(집합투자증권\)|ETF|인덱스/.test((clue.confirmed_facts || []).join(' ')))
    .filter(materialDartClue)
    .sort((a, b) => String(b.sort_date || '').localeCompare(String(a.sort_date || '')))
    .slice(0, limit);
}

const OFFICIAL_SOURCE_RE = /dart\.fss\.or\.kr|vcs\.go\.kr|kvic|k-vic|한국벤처투자|fund\.nps\.or\.kr|kdb\.co\.kr|kgrowth|kofia|krx\.co\.kr|go\.kr|or\.kr/i;

const ALLOWED_RELATION_SEQUENCES = [
  ['회생·위험', 'M&A 절차'],
  ['M&A 절차', '핵심 인사'],
  ['출자공고', '운용사 선정'],
  ['운용사 선정', '펀드 결성'],
  ['핵심 인사', '펀드 결성'],
  ['펀드 결성', '투자'],
  ['펀드 결성', '회수'],
];

function strongCrossSourceClue(clue) {
  const line = String(clue.one_line_signal || '');
  const allowed = ALLOWED_RELATION_SEQUENCES.some(([before, after]) => line.includes(`${before} → ${after}`));
  if (!allowed) return false;
  const evidence = (clue.sources || []).filter((source) => !/blog|블로그|Traders Union/i.test(`${source.label || ''} ${source.url || ''}`));
  const hasOfficial = evidence.some((source) => OFFICIAL_SOURCE_RE.test(`${source.label || ''} ${source.url || ''}`));
  if (!hasOfficial) return false;
  if (evidence.length < 2) return false;
  return true;
}

function selectionDateFrom(clue) {
  return String(clue.previous_state || '').match(/(20\d{2}-\d{2}-\d{2})/)?.[1] || clue.sort_date || '';
}

function formationDeadlineFrom(clue) {
  return String(clue.one_line_signal || '').match(/(20\d{2}-\d{2}-\d{2})/)?.[1] || null;
}

function isFormationOverdue(clue) {
  return /기한 경과|지났/.test(`${clue.detector_label || ''} ${clue.one_line_signal || ''} ${clue.changed_fact || ''}`);
}

function isFormationImminentEnough(clue) {
  if (isFormationOverdue(clue)) return true;
  const date = formationDeadlineFrom(clue);
  if (!date) return false;
  const days = Math.ceil((new Date(`${date}T00:00:00+09:00`).getTime() - Date.now()) / 86400000);
  return days >= 0 && days <= 7;
}

function collapseFormationClues(rows) {
  const eligible = (rows || []).filter(isFormationImminentEnough);
  const grouped = new Map();
  const standalone = [];

  for (const clue of eligible) {
    if (!isFormationOverdue(clue)) {
      standalone.push(clue);
      continue;
    }
    const lp = (clue.entities || [])[1] || 'LP 미상';
    const date = selectionDateFrom(clue);
    const key = `${lp}|${date}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(clue);
  }

  const collapsed = [];
  for (const [key, group] of grouped.entries()) {
    if (group.length === 1) {
      collapsed.push(group[0]);
      continue;
    }
    const [lp, selected] = key.split('|');
    const gps = uniq(group.map((clue) => (clue.entities || [])[0]));
    collapsed.push({
      clue_id: stableId('formation_pattern', [lp, selected, ...gps]),
      detector: 'formation_pattern',
      detector_label: '동시 결성상태 확인',
      fact_status: '단서',
      detected_at: group[0].detected_at,
      sort_date: group[0].sort_date,
      headline: `${lp} · ${selected} 선정 ${group.length}개 GP 결성상태 동시 확인 필요`,
      one_line_signal: `${gps.join('·')} 등 ${group.length}개 GP가 정본상 1차 예상 결성기한을 넘겼지만 연장·철회·조합등록 여부가 아직 확인되지 않았습니다.`,
      previous_state: `${selected} ${lp} 선정 · 같은 선정일의 ${group.length}개 GP를 묶어 비교`,
      changed_fact: `개별 건 ${group.length}개가 모두 결성 확인 대기 상태로 남아 있어 단일 GP 문제가 아니라 공통 연장·민간 LP 매칭 상황인지 확인할 필요가 생겼습니다.`,
      axes: {
        money: '각 GP의 실제 약정액·민간 LP 확약액과 공통 부족분 존재 여부 확인',
        control: '공동GP·대표PM·핵심운용역 변경이 있었는지 비교',
        risk: '개별 지연인지 동일 출자사업의 공통 결성 리스크인지 확인',
        rule: '연장 승인 기준과 선정취소·철회 처리 기준이 동일하게 적용됐는지 확인',
      },
      entities: [lp, ...gps],
      confirmed_facts: uniq(group.flatMap((clue) => clue.confirmed_facts || [])),
      reported: [],
      unknowns: ['각 GP의 실제 결성·조합등록 여부', '연장 승인 여부와 승인일', '실제 약정액·납입액', '공통 민간 LP 모집 난항 여부'],
      hypothesis: '같은 시기 선정된 복수 GP가 동시에 결성 확인 대기 상태라면 개별 운용사 문제가 아니라 해당 출자사업의 민간 LP 매칭 또는 연장 운용 관행과 연결됐을 가능성',
      falsification: '각 GP가 이미 정상 결성·등록됐거나 공고 원문의 실제 기한이 서로 달라 공통 패턴이 성립하지 않으면 가설을 기각',
      compare_cases: ['같은 선정일에 기한 내 결성된 GP', '직전 연도 동일 계정의 선정→결성 소요기간'],
      sources: uniqueSources(group),
      contacts: [lp, ...gps],
      questions: ['해당 선정분 가운데 현재 미결성·연장 승인 상태인 GP는 정확히 몇 곳인가', '연장은 일괄적으로 적용됐나 개별 심사였나', '각 GP의 현재 실제 약정액과 조합등록일은 언제인가', '민간 LP 모집에서 공통적으로 지연된 요인이 있었나'],
      next_action: `${lp}에 ${group.length}개 GP의 연장 승인·조합등록 현황을 일괄 확인한 뒤 각 GP에 실제 약정액과 민간 LP 상황을 교차확인`,
    });
  }

  return [...collapsed, ...standalone];
}

function aggregateRepeatGps(rows) {
  const list = rows || [];
  if (list.length < 4) return [];
  const gps = uniq(list.map((clue) => (clue.entities || [])[0]));
  const lps = uniq(list.flatMap((clue) => (clue.entities || []).slice(1)));
  return [{
    clue_id: stableId('market_repeat_gp', [...gps, ...lps]),
    detector: 'market_pattern',
    detector_label: '반복선정 시장패턴',
    fact_status: '단서',
    detected_at: list.map((x) => x.detected_at).sort().reverse()[0],
    sort_date: list.map((x) => x.sort_date).sort().reverse()[0],
    headline: `2026 공식 LP 반복선정 GP ${gps.length}곳 포착`,
    one_line_signal: `${gps.join('·')} 등 ${gps.length}개 GP가 2026년 정본에서 서로 다른 공식 LP 2곳 이상에 겹쳐 선정됐습니다.`,
    previous_state: `개별 GP 선정 결과를 따로 보던 상태`,
    changed_fact: `복수 공식 LP에서 반복 선정된 GP군이 ${gps.length}곳으로 묶이면서 특정 하우스가 아니라 시장 차원의 선정 집중 여부를 비교할 수 있게 됐습니다.`,
    axes: {
      money: '기관 LP 자금이 일부 GP군에 반복 배정되는 정도와 실제 배정액 집중도 확인',
      control: '동일 대표PM·핵심운용역이 여러 LP 선정에서 반복되는지 확인',
      risk: '반복 선정이 실제 결성·납입 성공으로 이어지는지 확인',
      rule: '서로 다른 LP의 선정기준에서 공통적으로 유리하게 작용한 조건이 있는지 비교',
    },
    entities: [...gps, ...lps],
    confirmed_facts: [`정본상 복수 공식 LP 선정 GP ${gps.length}곳`, `관련 공식 LP ${lps.length}곳`],
    reported: [],
    unknowns: ['전체 선정 GP 중 복수 LP 선정 비중', '지원 횟수를 감안한 실제 선정률', '반복 선정 GP와 비선정 GP의 트랙레코드·키맨 차이', '선정 후 실제 결성률과 배정액'],
    hypothesis: '서로 다른 기관 LP의 선정 결과가 일부 GP군에 반복해서 겹친다면 LP별 독립 심사에도 공통적으로 유리하게 작용하는 트랙레코드·키맨·펀드규모 기준이 있을 가능성',
    falsification: '전체 선정 GP를 분모로 비교했을 때 복수 LP 선정이 흔한 현상이거나 지원 횟수를 감안한 선정률 차이가 크지 않다면 집중 패턴 가설을 약화',
    compare_cases: ['2026 전체 선정 GP의 공식 LP 수 분포', '2025 동일 지표', '반복 선정 GP의 실제 결성률'],
    sources: uniqueSources(list),
    contacts: [...lps, ...gps.slice(0, 4)],
    questions: ['2026 전체 선정 GP 중 서로 다른 공식 LP 2곳 이상에 선정된 비중은 얼마인가', 'LP별로 공통적으로 중시한 트랙레코드·키맨 요건은 무엇인가', '반복 선정 GP의 실제 펀드 결성 성과도 더 높았나'],
    next_action: '2026 전체 선정 GP를 분모로 공식 LP 수 분포를 만든 뒤 2025와 비교해 반복선정이 실제 집중 현상인지 먼저 검증',
  }];
}

function compressCanonicalClues(canonical) {
  const rows = canonical || [];
  const rules = rows.filter((clue) => clue.detector === 'lp_rule_change');
  const formations = collapseFormationClues(rows.filter((clue) => clue.detector === 'formation_gap'));
  const repeatPattern = aggregateRepeatGps(rows.filter((clue) => clue.detector === 'gp_repeat'));
  // GP·LP 이동은 2025 부분 백필이 완결될 때까지 메인 발견함에서 제외한다.
  return [...rules, ...formations, ...repeatPattern];
}

function canonicalCollisionKey(clue) {
  const entities = (clue.entities || []).slice(0, 3).join('|');
  if (clue.detector === 'gp_repeat' || clue.detector === 'market_pattern') return `gp_repeat|${entities}`;
  if (clue.detector === 'formation_gap' || clue.detector === 'formation_pattern') return `formation_gap|${entities}|${clue.previous_state || ''}`;
  return null;
}

function balancedClues({ disclosures, leads, groups, gpStats }) {
  const rawCanonical = sortClues(buildCanonicalClues());
  const canonical = sortClues(compressCanonicalClues(rawCanonical));
  const canonicalKeys = new Set(rawCanonical.map(canonicalCollisionKey).filter(Boolean));

  const dynamicFormation = collapseFormationClues(
    sortClues(detectFormationGaps(groups)).filter((clue) => !canonicalKeys.has(canonicalCollisionKey(clue)))
  ).slice(0, 2);

  const dynamicRepeat = aggregateRepeatGps(
    sortClues(detectRepeatGps(gpStats, groups)).filter((clue) => !canonicalKeys.has(canonicalCollisionKey(clue)))
  );

  const buckets = {
    canonical,
    kvic_plan_change: sortClues(detectKvicPlanChanges(groups)).slice(0, 2),
    formation_dynamic: dynamicFormation,
    repeat_dynamic: dynamicRepeat,
    cross_source: sortClues(detectCrossSourceSequences(leads).filter(strongCrossSourceClue)).slice(0, 1),
    dart_change: selectDartClues(disclosures, 5),
  };

  const seen = new Set();
  const items = sortClues(Object.values(buckets).flat())
    .filter((clue) => {
      if (!clue?.clue_id || seen.has(clue.clue_id)) return false;
      seen.add(clue.clue_id);
      return true;
    })
    .slice(0, 10)
    .map(sanitizeDiscoveryClue);

  return {
    items,
    detector_candidates: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])),
    canonical_raw_count: rawCanonical.length,
    canonical_primary_count: canonical.length,
  };
}

async function buildClueResponse(req, res, days) {
  const collected = await collectReportingSignals({ days });
  const storage = await persistReportingLeads(collected.items);

  const [historyResult, disclosureResult, fundResult] = await Promise.allSettled([
    loadReportingLeadHistory(730, 900),
    loadDisclosureHistory(365, 900),
    fetchKvicFunds(),
  ]);

  const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const disclosures = disclosureResult.status === 'fulfilled' ? disclosureResult.value : [];
  const funds = fundResult.status === 'fulfilled' ? fundResult.value : { ready: false, items: [], error: String(fundResult.reason || 'KVIC fund load failed') };
  const leads = mergeLeadHistory(collected.items, history);
  const notices = kvicNoticesFromLeads(leads);
  const groups = attachFormation(groupNotices(notices), funds.items || []);
  const gpStats = buildGpStats(groups, funds.items || []);
  const selected = balancedClues({ disclosures, leads, groups, gpStats });
  const clues = selected.items;

  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  return res.status(200).json({
    ok: true,
    mode: 'clues',
    items: clues,
    stats: clueStats(clues),
    source_counts: {
      canonical_clues_raw: selected.canonical_raw_count,
      canonical_clues_primary: selected.canonical_primary_count,
      fresh_signals: collected.items.length,
      historical_signals: history.length,
      disclosures: disclosures.length,
      kvic_notices: notices.length,
      kvic_groups: groups.length,
      gp_rows: gpStats.length,
      kvic_funds: funds.items?.length || 0,
    },
    diagnostics: {
      providers: collected.providers,
      reporting_storage: storage,
      history_ready: historyResult.status === 'fulfilled',
      disclosure_ready: disclosureResult.status === 'fulfilled',
      fund_ready: Boolean(funds.ready),
      fund_error: funds.error || null,
      detector_candidates: selected.detector_candidates,
      canonical_snapshot_date: SNAPSHOT_DATE,
    },
    policy: {
      article_score_used: false,
      automatic_article_grade_used: false,
      article_judgment_performed: false,
      principle: 'AI 발견은 기사 여부를 판단하지 않습니다. 이전 상태와 비교해 실질 변화가 있거나 복수 건이 시장 패턴으로 묶일 때만 메인 발견함에 올립니다.',
      suppression_rule: '단순 반복 공시, 백필 미완료로 생긴 LP 이동 추정, 공식 근거 없는 뉴스 간 연결, 중복 개별 카드는 메인 발견함에서 제외합니다.',
      canonical_rule: '통합 감시목록을 정본으로 사용하고 정본 기반 단서는 원본 셀 주소를 보존합니다.',
    },
    range: { current_days: days, history_days: 730, disclosure_days: 365 },
    fetched_at: new Date().toISOString(),
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const days = Math.min(Math.max(parseInt(req.query.days || '7', 10), 1), 14);
    const mode = String(req.query.mode || 'signals').toLowerCase();
    if (mode === 'clues') return buildClueResponse(req, res, days);

    const limit = Math.min(Math.max(parseInt(req.query.limit || '40', 10), 5), 100);
    const collected = await collectReportingSignals({ days });
    const items = prioritizeKvic(collected.items).slice(0, limit);
    const storage = await persistReportingLeads(items);
    return res.status(200).json({
      ok: true,
      items,
      summary: summary(items),
      providers: collected.providers,
      storage,
      range: { days },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
