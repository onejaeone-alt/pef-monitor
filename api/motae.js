const { buildFundUrl, parseFundPayload } = require('../lib/kvic');
const { attachFormation, buildAccountStats, buildGpStats, groupNotices } = require('../lib/motae-monitor');

const KVIC_KEY = process.env.KVIC_API_KEY || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/,'');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  const path = `${SUPABASE_URL}/rest/v1/reporting_leads?select=${select}&source_name=eq.${encodeURIComponent('한국벤처투자')}&occurred_at=gte.${encodeURIComponent(since.toISOString())}&order=occurred_at.desc&limit=500`;
  const ctrl = new AbortController();
  const timeout = setTimeout(()=>ctrl.abort(),12000);
  try {
    const response = await fetch(path,{ signal:ctrl.signal, headers:supabaseHeaders() });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
    const rows = await response.json();
    return rows.map((row)=>row.raw_data?.raw_data || row.raw_data).filter((notice)=>notice && notice.notice_id && notice.stage);
  } finally { clearTimeout(timeout); }
}

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(()=>ctrl.abort(),18000);
  try {
    const response = await fetch(url,{ signal:ctrl.signal, headers:{Accept:'application/json,text/plain,*/*'} });
    if (!response.ok) throw new Error(`KVIC HTTP ${response.status}`);
    const text = await response.text();
    return JSON.parse(text);
  } finally { clearTimeout(timeout); }
}

async function fetchFunds(years) {
  if (!KVIC_KEY) return { items:[], ready:false, error:'KVIC_API_KEY_MISSING' };
  const settled = await Promise.allSettled(years.map(async (year)=>{
    const payload = await fetchJson(buildFundUrl(KVIC_KEY,{ fundType:'11', year }));
    const parsed = parseFundPayload(payload,'11');
    if (parsed.error) throw new Error(parsed.error.message || 'KVIC API 오류');
    return parsed.items;
  }));
  const items = settled.flatMap((result)=>result.status==='fulfilled'?result.value:[]);
  return { items, ready:settled.some((result)=>result.status==='fulfilled'), error:settled.every((result)=>result.status==='rejected')?'KVIC_FUND_FETCH_FAILED':null };
}

module.exports = async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
  try {
    const currentYear = new Date(Date.now()+9*3600*1000).getUTCFullYear();
    const years = [currentYear-1,currentYear];
    const [notices,fundResult] = await Promise.all([
      fetchSavedNotices().catch(()=>[]),
      fetchFunds(years).catch((error)=>({items:[],ready:false,error:String(error.message||error)})),
    ]);
    const grouped = groupNotices(notices);
    const groups = attachFormation(grouped,fundResult.items);
    const gpStats = buildGpStats(groups);
    const accountStats = buildAccountStats(groups);
    const selectedGroups = groups.filter((group)=>group.selection);
    const formationUnconfirmed = selectedGroups.filter((group)=>group.formation_status==='unconfirmed' || group.formation_status==='partial');
    const repeatGps = gpStats.filter((row)=>row.selected>=2);
    return res.status(200).json({
      ok:true,
      source:'supabase_cache',
      years,
      notice_count:notices.length,
      groups,
      gp_stats:gpStats,
      account_stats:accountStats,
      funds:fundResult.items,
      funds_ready:fundResult.ready,
      stats:{
        businesses:groups.length,
        in_progress:groups.filter((group)=>!group.selection).length,
        selected:selectedGroups.length,
        formation_confirmed:selectedGroups.filter((group)=>group.formation_status==='confirmed').length,
        formation_unconfirmed:formationUnconfirmed.length,
        repeat_gp:repeatGps.length,
      },
      needs_refresh:notices.length<5,
      fetched_at:new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ok:false,error:String(error.message||error)});
  }
};
