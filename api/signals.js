const { collectReportingSignals } = require('../lib/reporting-signals');
const { persistReportingLeads } = require('../lib/supabase');
const { buildClues } = require('../lib/clue-engine');
const { fetchKvicFunds, kvicNoticesFromLeads, loadDisclosureHistory, loadReportingLeadHistory } = require('../lib/clue-data');
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
  const clues = buildClues({ disclosures, leads, groups, gpStats });

  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  return res.status(200).json({
    ok: true,
    mode: 'clues',
    items: clues,
    stats: clueStats(clues),
    source_counts: {
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
    },
    policy: {
      article_score_used: false,
      automatic_article_grade_used: false,
      default_judgment: '추가취재',
      principle: '새 자료 자체보다 이전 상태와 비교해 달라진 사실·반복 패턴·관계 연결을 먼저 찾습니다.',
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
