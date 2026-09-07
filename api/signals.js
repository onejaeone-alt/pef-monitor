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
  return {
    total: items.length,
    detectors,
    statuses,
    additional_reporting: items.filter((item) => item.judgment === '추가취재').length,
  };
}

function sortClues(items) {
  return [...(items || [])].sort((a, b) =>
    String(b.sort_date || '').localeCompare(String(a.sort_date || '')) ||
    String(a.detector || '').localeCompare(String(b.detector || ''))
  );
}

function dartPriority(clue) {
  const text = `${clue.changed_fact || ''} ${(clue.confirmed_facts || []).join(' ')}`;
  let score = 0;
  if (/→/.test(text)) score += 5;
  if ((clue.sources || []).length >= 2) score += 3;
  if (/공개매수|최대주주|유상증자|전환사채|채무보증|차입|회생|매각|인수/.test(text)) score += 2;
  if (/투자설명서\(집합투자증권\)|ETF|인덱스/.test(text)) score -= 8;
  return score;
}

function selectDartClues(disclosures, limit = 10) {
  return detectDartChanges(disclosures)
    .filter((clue) => !/투자설명서\(집합투자증권\)|ETF|인덱스/.test((clue.confirmed_facts || []).join(' ')))
    .sort((a, b) => dartPriority(b) - dartPriority(a) || String(b.sort_date || '').localeCompare(String(a.sort_date || '')))
    .slice(0, limit);
}

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
  const evidence = clue.sources || [];
  const nonNoise = evidence.filter((source) => !/blog|블로그|Traders Union/i.test(`${source.label || ''} ${source.url || ''}`));
  if (nonNoise.length < 2) return false;
  if (/한국벤처투자 · 서로 다른 사건 신호/.test(clue.headline || '')) return false;
  return true;
}

function canonicalCollisionKey(clue) {
  const entities = (clue.entities || []).slice(0, 3).join('|');
  if (clue.detector === 'gp_repeat') return `gp_repeat|${entities}`;
  if (clue.detector === 'formation_gap') return `formation_gap|${entities}|${clue.previous_state || ''}`;
  return null;
}

function balancedClues({ disclosures, leads, groups, gpStats }) {
  const canonical = sortClues(buildCanonicalClues());
  const canonicalKeys = new Set(canonical.map(canonicalCollisionKey).filter(Boolean));
  const dynamicGp = sortClues(detectRepeatGps(gpStats, groups))
    .filter((clue) => !canonicalKeys.has(canonicalCollisionKey(clue)))
    .slice(0, 4);
  const dynamicFormation = sortClues(detectFormationGaps(groups))
    .filter((clue) => !canonicalKeys.has(canonicalCollisionKey(clue)))
    .slice(0, 4);
  const buckets = {
    canonical,
    kvic_plan_change: sortClues(detectKvicPlanChanges(groups)).slice(0, 6),
    gp_repeat_dynamic: dynamicGp,
    formation_gap_dynamic: dynamicFormation,
    cross_source: sortClues(detectCrossSourceSequences(leads).filter(strongCrossSourceClue)).slice(0, 5),
    dart_change: selectDartClues(disclosures, 10),
  };
  const merged = Object.values(buckets).flat();
  const seen = new Set();
  const items = sortClues(merged).filter((clue) => {
    if (!clue?.clue_id || seen.has(clue.clue_id)) return false;
    seen.add(clue.clue_id);
    return true;
  }).slice(0, 40);
  return {
    items,
    detector_candidates: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])),
    canonical_count: canonical.length,
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
      canonical_clues: selected.canonical_count,
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
      default_judgment: '추가취재',
      principle: '새 자료 자체보다 이전 상태와 비교해 달라진 사실·반복 패턴·관계 연결을 먼저 찾습니다.',
      canonical_rule: '통합 감시목록을 정본으로 사용하고 웹앱의 정본 기반 단서는 원본 셀 주소를 보존한 읽기 전용 파생 캐시입니다.',
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
