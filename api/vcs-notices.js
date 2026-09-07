const { buildListUrl, parseVcsListPage, mergeVcsItems } = require('../lib/vcs-notices');

async function fetchText(url, timeoutMs=12000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(()=>ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; PEF-Monitor/3.2; +https://pef-monitor.vercel.app)',
      },
    });
    if (!response.ok) throw new Error(`VCS HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

async function collectPage(page) {
  const url = buildListUrl(page,10);
  try {
    const html = await fetchText(url);
    const parsed = parseVcsListPage(html,page);
    return { page, url, ok: parsed.items.length > 0, ...parsed, error:null };
  } catch (error) {
    return { page, url, ok:false, total:0, items:[], error:String(error.message||error).slice(0,240) };
  }
}

module.exports = async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
  const requested = Math.max(1,Math.min(10,Number(req.query.pages||5)||5));
  try {
    const pages=[];
    for (let page=1; page<=requested; page+=1) pages.push(await collectPage(page));
    const items=mergeVcsItems(pages);
    const total=pages.find(x=>x.total)?.total || items.length;
    const organizations=[...new Set(items.map(x=>x.organization).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    const open=items.filter(x=>x.status==='open').length;
    const errors=pages.filter(x=>x.error).map(x=>({page:x.page,error:x.error}));
    const ok=items.length>0;
    return res.status(ok?200:502).json({
      ok,
      source:'VCS 벤처투자종합포털 출자공고',
      source_url:buildListUrl(1,10),
      requested_pages:requested,
      parsed_pages:pages.filter(x=>x.ok).length,
      total,
      count:items.length,
      open_count:open,
      organizations,
      items,
      errors,
      fetched_at:new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ok:false,error:String(error.message||error)});
  }
};
