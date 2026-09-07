const { buildFundUrl, parseFundPayload, recentFundWindow } = require('./kvic');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KVIC_KEY = process.env.KVIC_API_KEY || '';

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers() {
  const result = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (SUPABASE_KEY.startsWith('eyJ')) result.Authorization = `Bearer ${SUPABASE_KEY}`;
  return result;
}

async function request(path, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { signal: ctrl.signal, headers: headers() });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function loadReportingLeadHistory(days = 730, limit = 800) {
  if (!configured()) return [];
  const safeDays = Math.min(Math.max(Number(days) || 730, 1), 1095);
  const safeLimit = Math.min(Math.max(Number(limit) || 800, 50), 1000);
  const since = new Date(Date.now() - safeDays * 86400000).toISOString();
  const select = 'signal_id,occurred_at,source_type,source_name,title,source_url,target_id,target_name,target_category,event_type,key_numbers,key_dates,interpretation,checkpoints,raw_data';
  const rows = await request(`reporting_leads?select=${select}&occurred_at=gte.${encodeURIComponent(since)}&order=occurred_at.desc&limit=${safeLimit}`);
  return rows.map((row) => ({
    ...(row.raw_data || {}),
    signal_id: row.signal_id,
    published_at: row.occurred_at,
    source_type: row.source_type,
    source_name: row.source_name,
    title: row.title,
    source_url: row.source_url,
    target: row.target_id ? { id: row.target_id, name: row.target_name, category: row.target_category } : null,
    subject_name: row.target_id ? null : row.target_name,
    event_type: row.event_type,
    facts: { amounts: row.key_numbers || [], dates: row.key_dates || [] },
    interpretation: row.interpretation,
    checkpoints: row.checkpoints || [],
  }));
}

async function loadDisclosureHistory(days = 365, limit = 800) {
  if (!configured()) return [];
  const safeDays = Math.min(Math.max(Number(days) || 365, 1), 1095);
  const safeLimit = Math.min(Math.max(Number(limit) || 800, 50), 1000);
  const since = new Date(Date.now() - safeDays * 86400000).toISOString().slice(0, 10);
  const select = 'rcept_no,corp_code,corp_name,report_nm,receipt_date,dart_url,event_type,raw_data';
  return request(`disclosures?select=${select}&receipt_date=gte.${since}&order=receipt_date.desc&limit=${safeLimit}`);
}

async function fetchKvicFunds() {
  if (!KVIC_KEY) return { ready: false, items: [], years: [], latest_year: null, error: 'KVIC_API_KEY_MISSING' };
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);
  try {
    const response = await fetch(buildFundUrl(KVIC_KEY, { fundType: '11' }), { signal: ctrl.signal, headers: { Accept: 'application/json,text/plain,*/*' } });
    if (!response.ok) throw new Error(`KVIC HTTP ${response.status}`);
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch (_) { throw new Error('KVIC 펀드 현황 응답을 JSON으로 해석하지 못했습니다.'); }
    const parsed = parseFundPayload(payload, '11');
    if (parsed.error) throw new Error(parsed.error.message || 'KVIC API 오류');
    const recent = recentFundWindow(parsed.items, 3);
    return { ready: true, ...recent, total: parsed.items.length, error: null };
  } catch (error) {
    return { ready: false, items: [], years: [], latest_year: null, error: String(error.message || error) };
  } finally {
    clearTimeout(timeout);
  }
}

function kvicNoticesFromLeads(leads) {
  const seen = new Set();
  const notices = [];
  for (const lead of leads || []) {
    if (lead.source_name !== '한국벤처투자') continue;
    const raw = lead.raw_data || {};
    if (!raw.stage || !raw.title) continue;
    const key = raw.notice_id || lead.signal_id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    notices.push(raw);
  }
  return notices;
}

module.exports = {
  fetchKvicFunds,
  kvicNoticesFromLeads,
  loadDisclosureHistory,
  loadReportingLeadHistory,
};
