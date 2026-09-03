const {
  buildBusinessTypeUrl,
  buildFundUrl,
  parseBusinessTypePayload,
  parseFundPayload,
} = require('../lib/kvic');
const { attachFormation, buildAccountStats, buildGpStats, groupNotices } = require('../lib/motae-monitor');

const KVIC_KEY = process.env.KVIC_API_KEY || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/,'');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);
  try {
    const response = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json,text/plain,*/*' } });
    if (!response.ok) throw new Error(`KVIC HTTP ${response.status}`);
    const text = await response.text();
    try { return JSON.parse(text); } catch (_) { throw new Error(`KVIC 응답을 JSON으로 해석하지 못했습니다: ${text.slice(0,120)}`); }
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('KVIC 응답 지연(20초 초과)');
    throw error;
  } finally { clearTimeout(timeout); }
}

function supabaseHeaders() {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  return headers;
}

async function fetchSavedNotices() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 2);
  const select = 'occurred_at,source_name,source_type,raw_data';
  const url = `${SUPABASE_URL}/rest/v1/reporting_leads?select=${select}&source_name=eq.${encodeURIComponent('한국벤처투자')}&occurred_at=gte.${encodeURIComponent(since.toISOString())}&order=occurred_at.desc&limit=500`;
  const ctrl = new AbortController();
  const timeout = setTimeout(()=>ctrl.abort(),12000);
  try {
    const response = await fetch(url,{ signal:ctrl.signal, headers:supabaseHeaders() });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
    const rows = await response.json();
    return rows.map(row=>row.raw_data?.raw_data || row.raw_data).filter(n=>n && n.notice_id && n.stage);
  } finally { clearTimeout(timeout); }
}

async function fetchFundsForYears(years) {
  const settled = await Promise.allSettled(years.map(async year => {
    const payload = await fetchJson(buildFundUrl(KVIC_KEY,{ fundType:'11', year }));
    const parsed = parseFundPayload(payload,'11');
    if (parsed.error) throw new Error(parsed.error.message || 'KVIC API 오류');
    return parsed.items;
  }));
  return {
    items: settled.flatMap(r=>r.status==='fulfilled'?r.value:[]),
    ready: settled.some(r=>r.status==='fulfilled'),
  };
}

async function dashboard(res) {
  const currentYear = new Date(Date.now()+9*3600*1000).getUTCFullYear();
  const years = [currentYear-1,currentYear];
  const [notices,fundResult] = await Promise.all([
    fetchSavedNotices().catch(()=>[]),
    fetchFundsForYears(years).catch(()=>({items:[],ready:false})),
  ]);
  const groups = attachFormation(groupNotices(notices),fundResult.items);
  const gpStats = buildGpStats(groups);
  const selected = groups.filter(g=>g.selection);
  return res.status(200).json({
    ok:true, mode:'dashboard', source:'supabase_cache', years, notice_count:notices.length,
    groups, gp_stats:gpStats, account_stats:buildAccountStats(groups), funds:fundResult.items, funds_ready:fundResult.ready,
    stats:{
      businesses:groups.length,
      in_progress:groups.filter(g=>!g.selection).length,
      selected:selected.length,
      formation_confirmed:selected.filter(g=>g.formation_status==='confirmed').length,
      formation_unconfirmed:selected.filter(g=>['unconfirmed','partial'].includes(g.formation_status)).length,
      repeat_gp:gpStats.filter(g=>g.selected>=2).length,
    },
    needs_refresh:notices.length<5,
    fetched_at:new Date().toISOString(),
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  try {
    if (!KVIC_KEY) return res.status(503).json({ ok:false, error:'Vercel 환경변수 KVIC_API_KEY가 필요합니다.' });
    const mode = String(req.query.mode || 'funds').toLowerCase();
    if (mode === 'dashboard') return dashboard(res);
    if (mode === 'types') {
      const payload = await fetchJson(buildBusinessTypeUrl(KVIC_KEY, req.query));
      const parsed = parseBusinessTypePayload(payload);
      if (parsed.error) return res.status(502).json({ok:false,error:parsed.error});
      return res.status(200).json({ok:true,mode:'types',items:parsed.items,count:parsed.items.length,fetched_at:new Date().toISOString()});
    }
    const fundType = String(req.query.fundType || req.query.fund_type || '11').trim();
    const payload = await fetchJson(buildFundUrl(KVIC_KEY, req.query));
    const parsed = parseFundPayload(payload,fundType);
    if (parsed.error) return res.status(502).json({ok:false,error:parsed.error});
    const items = parsed.items.sort((a,b)=>Number(b.year||0)-Number(a.year||0)||a.manager.localeCompare(b.manager,'ko'));
    return res.status(200).json({ok:true,mode:'funds',fund_type:fundType,filters:{year:req.query.year||req.query.y||null,field:req.query.fd||null,manager:req.query.mng||null,association_name:req.query.asn||null},items,count:items.length,fetched_at:new Date().toISOString()});
  } catch (error) {
    return res.status(500).json({ ok:false, error:String(error.message||error) });
  }
};
