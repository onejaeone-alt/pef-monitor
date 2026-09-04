const {
  buildBusinessTypeUrl,
  buildFundUrl,
  parseBusinessTypePayload,
  parseFundPayload,
} = require('../lib/kvic');
const { LIST_URL, managerCandidates, parseDetailPage, parseListPage } = require('../lib/kvic-notices');
const { attachFormation, buildAccountStats, buildGpStats, groupNotices } = require('../lib/motae-monitor');
const { buildKstartupUrl, buildManagerUrl, parseKstartup, parseManagers } = require('../lib/policy-sources');

const KVIC_KEY = process.env.KVIC_API_KEY || '';
const DATA_GO_KEY = process.env.DATA_GO_KR_SERVICE_KEY || '';
const KSTARTUP_KEY = process.env.KSTARTUP_API_KEY || DATA_GO_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/,'');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; PEF-Monitor/3.1; +https://pef-monitor.vercel.app)',
      },
    });
    if (!response.ok) throw new Error(`KVIC page HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

async function fetchPdfText(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PEF-Monitor/3.1)' },
    });
    if (!response.ok) throw new Error(`KVIC PDF HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) throw new Error('KVIC PDF 10MB 초과');
    if (buffer.slice(0,4).toString() !== '%PDF') throw new Error('KVIC PDF 형식 아님');
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(buffer);
    return String(parsed.text || '').slice(0,60000);
  } finally { clearTimeout(timeout); }
}

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

async function collectPolicySource(source, key, url, parser) {
  if (!key) return { source, ready:false, items:[], total:0, error:'API_KEY_MISSING' };
  try {
    const parsed = parser(await fetchJson(url));
    return { source, ready:!parsed.error, ...parsed };
  } catch (error) {
    return { source, ready:false, items:[], total:0, error:String(error.message || error) };
  }
}

async function policy(req, res) {
  const page = req.query.page || 1;
  const perPage = req.query.perPage || 100;
  const sources = await Promise.all([
    collectPolicySource('KVIC 자조합 운용사정보', DATA_GO_KEY, buildManagerUrl(DATA_GO_KEY,{page,perPage}), parseManagers),
    collectPolicySource('K-Startup 사업공고', KSTARTUP_KEY, buildKstartupUrl(KSTARTUP_KEY,{page,perPage}), parseKstartup),
  ]);
  const ok = sources.some(source => source.ready);
  return res.status(ok ? 200 : 502).json({ ok, sources, diagnostics:{ data_go_key:Boolean(DATA_GO_KEY), kstartup_key:Boolean(KSTARTUP_KEY) }, fetched_at:new Date().toISOString() });
}

function supabaseHeaders() {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  return headers;
}

async function fetchSavedNotices() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { items: [], ready: false, error: 'SUPABASE_NOT_CONFIGURED' };
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 2);
  const select = 'occurred_at,source_name,source_type,raw_data';
  const url = `${SUPABASE_URL}/rest/v1/reporting_leads?select=${select}&source_name=eq.${encodeURIComponent('한국벤처투자')}&occurred_at=gte.${encodeURIComponent(since.toISOString())}&order=occurred_at.desc&limit=500`;
  const ctrl = new AbortController();
  const timeout = setTimeout(()=>ctrl.abort(),12000);
  try {
    const response = await fetch(url,{ signal:ctrl.signal, headers:supabaseHeaders() });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${(await response.text()).slice(0,200)}`);
    const rows = await response.json();
    return {
      items: rows.map(row=>row.raw_data?.raw_data || row.raw_data).filter(n=>n && n.notice_id && n.stage),
      ready: true,
      error: null,
    };
  } catch (error) {
    return { items: [], ready: false, error: String(error.message || error).slice(0,300) };
  } finally { clearTimeout(timeout); }
}

function firstPdf(detail) {
  return (detail?.attachments || []).find(item =>
    /\.pdf(?:$|\?)/i.test(item.filename || '') || /pdf|fileDown/i.test(`${item.label || ''} ${item.url || ''}`)
  );
}

async function hydrateLiveNotice(notice) {
  if (!notice.detail_resolvable) {
    return { ...notice, aggregate: {}, attachments: [], manager_candidates: [], live_list_only: true };
  }
  try {
    const detailHtml = await fetchText(notice.source_url, 9000);
    const detail = parseDetailPage(detailHtml, notice);
    let pdfText = '';
    let pdfError = null;
    if (['application','document_review','selection'].includes(detail.stage)) {
      const pdf = firstPdf(detail);
      if (pdf) {
        try { pdfText = await fetchPdfText(pdf.url); }
        catch (error) { pdfError = String(error.message || error).slice(0,200); }
      }
    }
    const managers = managerCandidates(`${detail.page_text || ''}\n${pdfText}`);
    return {
      ...detail,
      manager_candidates: managers,
      attachment_text: pdfText || null,
      attachment_parse_error: pdfError,
      live_list_only: false,
    };
  } catch (_) {
    return { ...notice, aggregate: {}, attachments: [], manager_candidates: [], live_list_only: true };
  }
}

async function mapLimited(items, concurrency, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try { output[index] = await worker(items[index]); }
      catch (_) { output[index] = items[index]; }
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},run));
  return output;
}

async function fetchLiveNotices() {
  try {
    const html = await fetchText(LIST_URL);
    const parsed = parseListPage(html, LIST_URL);
    const candidates = (parsed.notices || [])
      .filter(n => ['plan','application','document_review','selection'].includes(n.stage))
      .slice(0, 18);
    const priority = [...candidates].sort((a,b) => {
      const rank = {selection:4,document_review:3,application:2,plan:1};
      return (rank[b.stage]||0)-(rank[a.stage]||0) || String(b.posted_date||'').localeCompare(String(a.posted_date||''));
    });
    const hydrateTargets = new Set(priority.slice(0,6).map(n => n.notice_id));
    const items = await mapLimited(candidates,3,notice =>
      hydrateTargets.has(notice.notice_id)
        ? hydrateLiveNotice(notice)
        : Promise.resolve({ ...notice, aggregate:{}, attachments:[], manager_candidates:[], live_list_only:true })
    );
    return {
      items,
      ready: candidates.length > 0,
      list_count: candidates.length,
      manager_notice_count: items.filter(n => (n.manager_candidates || []).length > 0).length,
      manager_candidate_count: items.reduce((sum,n)=>sum+(n.manager_candidates?.length||0),0),
      error: candidates.length ? null : 'KVIC_LIST_PARSED_ZERO',
    };
  } catch (error) {
    return { items: [], ready: false, list_count: 0, manager_notice_count:0, manager_candidate_count:0, error: String(error.message || error).slice(0,300) };
  }
}

function mergeNotices(saved, live) {
  const map = new Map();
  const score = n => (n?.manager_candidates?.length || 0) * 10 + (n?.attachment_text ? 5 : 0) + (n?.aggregate && Object.values(n.aggregate).some(Boolean) ? 2 : 0) + (n?.detail_resolvable ? 1 : 0);
  for (const notice of [...(live || []), ...(saved || [])]) {
    if (!notice?.title || !notice?.posted_date || !notice?.stage) continue;
    const key = `${notice.posted_date}|${notice.stage}|${String(notice.business_key || notice.title).replace(/\s+/g,' ')}`;
    const current = map.get(key);
    if (!current || score(notice) >= score(current)) map.set(key, notice);
  }
  return [...map.values()].sort((a,b)=>String(b.posted_date||'').localeCompare(String(a.posted_date||'')));
}

async function fetchFundsForYears(years) {
  if (!KVIC_KEY) return { items: [], ready: false, error: 'KVIC_API_KEY_MISSING' };
  const settled = await Promise.allSettled(years.map(async year => {
    const payload = await fetchJson(buildFundUrl(KVIC_KEY,{ fundType:'11', year }));
    const parsed = parseFundPayload(payload,'11');
    if (parsed.error) throw new Error(parsed.error.message || 'KVIC API 오류');
    return parsed.items;
  }));
  return {
    items: settled.flatMap(r=>r.status==='fulfilled'?r.value:[]),
    ready: settled.some(r=>r.status==='fulfilled'),
    error: settled.every(r=>r.status==='rejected') ? 'KVIC_FUND_FETCH_FAILED' : null,
  };
}

async function dashboard(res) {
  const currentYear = new Date(Date.now()+9*3600*1000).getUTCFullYear();
  const years = [currentYear-1,currentYear];
  const [savedResult, liveResult, fundResult] = await Promise.all([
    fetchSavedNotices(),
    fetchLiveNotices(),
    fetchFundsForYears(years).catch(error=>({items:[],ready:false,error:String(error.message||error)})),
  ]);
  const notices = mergeNotices(savedResult.items, liveResult.items);
  const groups = attachFormation(groupNotices(notices),fundResult.items);
  const gpStats = buildGpStats(groups,fundResult.items);
  const selected = groups.filter(g=>g.selection);
  return res.status(200).json({
    ok:true,
    mode:'dashboard',
    source: savedResult.items.length ? (liveResult.items.length ? 'supabase+live_kvic' : 'supabase_cache') : 'live_kvic',
    years,
    notice_count:notices.length,
    saved_notice_count:savedResult.items.length,
    live_notice_count:liveResult.items.length,
    groups,
    gp_stats:gpStats,
    account_stats:buildAccountStats(groups),
    funds:fundResult.items,
    funds_ready:fundResult.ready,
    diagnostics:{
      supabase_ready:savedResult.ready,
      supabase_error:savedResult.error,
      live_ready:liveResult.ready,
      live_error:liveResult.error,
      live_list_count:liveResult.list_count,
      live_manager_notices:liveResult.manager_notice_count,
      live_manager_candidates:liveResult.manager_candidate_count,
      gp_count:gpStats.length,
      fund_api_gp_count:new Set((fundResult.items||[]).map(f=>String(f.manager||'').trim()).filter(Boolean)).size,
      fund_error:fundResult.error || null,
    },
    stats:{
      businesses:groups.length,
      in_progress:groups.filter(g=>!g.selection).length,
      selected:selected.length,
      formation_confirmed:selected.filter(g=>g.formation_status==='confirmed').length,
      formation_unconfirmed:selected.filter(g=>['unconfirmed','partial'].includes(g.formation_status)).length,
      repeat_gp:gpStats.filter(g=>g.selected>=2).length,
    },
    needs_refresh:savedResult.items.length<5 || !liveResult.manager_candidate_count,
    fetched_at:new Date().toISOString(),
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const mode = String(req.query.mode || 'funds').toLowerCase();
    res.setHeader('Cache-Control', mode === 'dashboard' ? 'no-store' : 's-maxage=1800, stale-while-revalidate=3600');
    if (mode === 'dashboard') return dashboard(res);
    if (mode === 'policy') return policy(req, res);
    if (!KVIC_KEY) return res.status(503).json({ ok:false, error:'Vercel 환경변수 KVIC_API_KEY가 필요합니다.' });
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
