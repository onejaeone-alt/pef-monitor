const { parseGoogleNewsRss } = require('../lib/context-sources');
const { fetchPublisherFeeds } = require('../lib/domestic-publisher-feeds');
const { findWatchTarget, WATCH_TARGETS } = require('../lib/watch-config');
const { matchDossiersInText } = require('../lib/drive-dossiers');
const { fetchJakMembers, isJakMemberSource, FALLBACK_JAK_MEMBERS } = require('../lib/jak-members'); // NEWS_READER_INTEGRATED
const { clusterIssues, eventLabel, queries, shouldKeep, theme } = require('../lib/news-monitor');
const { createSourceCache } = require('../lib/news-source-cache');

// Normal reads share each source for 60 seconds, with at most 30 minutes of
// last-good data on failure. These bounded caches live only in this instance.
const newsSourceCache = createSourceCache();
const memberSourceCache = createSourceCache({ttlMs:6*3600000,maxStaleMs:7*86400000,maxEntries:1,maxBytes:256*1024,maxValueBytes:256*1024,maxInflight:2});

async function fetchMembership(fresh) {
  let fallback;
  try {
    return await memberSourceCache.get('jak-members',async()=>{
      const members=await fetchJakMembers();
      if(members.source!=='official') {fallback=members;throw new Error('JAK official member list unavailable');}
      return members;
    },{fresh});
  } catch(error) {
    const names=FALLBACK_JAK_MEMBERS||[];
    return {value:fallback||{names,count:names.length,source:'fallback'},fetched_at:null,attempted_at:new Date().toISOString(),from_cache:true,stale:true,failed:true,error:String(error.message||error)};
  }
}
function sourceStatus(source,provider,result) {
  if(result.status==='rejected') return {source,provider,failed:true,stale:false,from_cache:false,fetched_at:null,attempted_at:new Date().toISOString(),error:String(result.reason?.message||result.reason).slice(0,240)};
  const {value,...status}=result.value;
  return {source,provider,...status};
}

const GOOGLE_NEWS_URL = 'https://news.google.com/rss/search';
function googleNewsUrl(query) { const params = new URLSearchParams({ q: query, hl: 'ko', gl: 'KR', ceid: 'KR:ko' }); return `${GOOGLE_NEWS_URL}?${params}`; }
async function fetchText(url, timeoutMs = 12000, fresh = false) { const ctrl = new AbortController(); const timeout = setTimeout(() => ctrl.abort(), timeoutMs); try { const headers = { 'User-Agent': 'IB-News-Monitor/5.2' }; if (fresh) headers['Cache-Control'] = 'no-cache'; const response = await fetch(url, { signal: ctrl.signal, cache: fresh ? 'no-store' : 'default', headers }); if (!response.ok) throw new Error(`News HTTP ${response.status}`); return await response.text(); } finally { clearTimeout(timeout); } }
function parseNewsResponse(xml) {
  // A successful HTTP response may still be a consent, bot-check or error page.
  // Keep a valid empty RSS channel valid, but never cache HTML as an empty feed.
  if(!/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>[\s\S]*<\/channel\s*>[\s\S]*<\/rss\s*>/i.test(xml)) throw new Error('NEWS_INVALID_RSS');
  const items=parseGoogleNewsRss(xml,'domestic','ko');
  if(/<item\b/i.test(xml)&&!items.length) throw new Error('NEWS_UNREADABLE_RSS');
  return items;
}
function normalizeTitle(value) { return String(value || '').toLowerCase().replace(/[^0-9a-z가-힣]/g,'').slice(0,160); }
function ageHours(value) { const time = new Date(value || '').getTime(); if (!Number.isFinite(time)) return Infinity; return Math.max(0, (Date.now() - time) / 3600000); }
function cssString(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function relativeTime(value) { const time = new Date(value || '').getTime(); if (!Number.isFinite(time)) return ''; const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000)); if (minutes < 1) return '방금'; if (minutes < 60) return `${minutes}분 전`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}시간 전`; return `${Math.floor(hours / 24)}일 전`; }
function tickerText(item) { const source = cssString(item?.source_name || '뉴스'); const title = cssString(item?.title || ''); const time = cssString(relativeTime(item?.published_at)); return `[${source}] ${title}${time ? `  ·  ${time}` : ''}`; }
function tickerCss(items) { const rows = (items || []).slice(0, 10); const fallback = '[뉴스] 새 기사를 불러오는 중입니다.'; const separator = '                    '; const stream = rows.length ? rows.map(tickerText).join(separator) : fallback; const doubled = `${stream}${separator}${stream}${separator}`; const duration = Math.max(40, rows.length * 6.5); return `
.topbar{overflow-x:clip}
.topbar::before{content:"${doubled}";display:inline-flex;align-items:center;width:max-content;min-width:max-content;margin:-18px -26px 8px;padding:0 22px;height:24px;line-height:24px;background:#050505;color:#fff;font-size:10.5px;font-weight:760;letter-spacing:-.015em;white-space:pre;animation:ibLatestTicker ${duration}s linear infinite;will-change:transform;transform:translateX(0)}
@keyframes ibLatestTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media(max-width:760px){.topbar::before{margin:-18px -14px 7px;padding:0 14px;height:23px;line-height:23px;font-size:10px}}
@media(prefers-reduced-motion:reduce){.topbar::before{animation-duration:180s}}
`; }
function disableResponseCache(res) { res.setHeader('Cache-Control', 'no-store, max-age=0'); res.setHeader('CDN-Cache-Control', 'no-store'); res.setHeader('Vercel-CDN-Cache-Control', 'no-store'); }
function boundedInt(value, fallback, min, max) { const n = parseInt(value, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
function searchMatch(item, q) { if (!q) return true; const hay = [item.source_url,item.title,item.source_name,item.snippet,item.theme_label,item.event_label].map(value=>String(value||'').toLowerCase()).join(' '); return q.split(/\s+/).filter(Boolean).every(term=>hay.includes(term)); }
module.exports = async (req, res) => {
  if (req.query && Object.prototype.hasOwnProperty.call(req.query,'reader')) return require('../lib/news-reader-account').handle(req,res);
  const readerFeed = String(req.query?.feed || '') === 'reader';
  const NewsReader = readerFeed ? require('../news-reader-core') : null;
  if (req.method && req.method !== 'GET') return res.status(405).json({ok:false,error:'GET only'});
  if (String(req.query?.feed || '') === 'calendar') return require('../lib/reporting-calendar').handle(req, res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.query.scope === 'foreign') return require('../lib/foreign-news').handle(req,res);
  const format = String(req.query.format || '').toLowerCase();
  const fresh = String(req.query.refresh || '') === '1';
  if (fresh) disableResponseCache(res); else res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-News-Refresh', fresh ? 'live' : 'cached-allowed');
  try {
    const days = boundedInt(req.query.days, 7, 1, 14), limit = boundedInt(req.query.limit, 240, 40, 500), q = String(req.query.q || '').trim().toLowerCase().slice(0,180), queryList = queries(days);
    const [membership, settled, publisher] = await Promise.all([fetchMembership(fresh),Promise.allSettled(queryList.map(query=>newsSourceCache.get(googleNewsUrl(query),async()=>{
      const xml=await fetchText(googleNewsUrl(query),12000,fresh); return parseNewsResponse(xml);
    },{fresh}))),fetchPublisherFeeds({fresh,days})]);
    const jak=membership.value, succeeded=settled.filter(result=>result.status==='fulfilled'&&!result.value.failed).length;
    const available=settled.filter(result=>result.status==='fulfilled').length+(publisher.available??publisher.succeeded);
    if(!available) throw new Error('뉴스 수집원에 연결하지 못했습니다.');
    const partial=succeeded<queryList.length||publisher.failed>0||membership.failed;
    // Useful partial results retain a short public cache; explicit refresh and
    // complete failure remain no-store. Never hide the failed/stale source state.
    if(partial&&!fresh) res.setHeader('Cache-Control','s-maxage=15, stale-while-revalidate=30');
    const sourceStatuses=[...settled.map((result,index)=>sourceStatus('google-news:'+index,'google_news_rss',result)),...(publisher.source_status||[])];
    const fetchedTimes=sourceStatuses.map(source=>source.fetched_at).filter(Boolean).sort();
    const attemptedTimes=sourceStatuses.map(source=>source.attempted_at).filter(Boolean).sort();
    const sourceCacheStatus={cached_sources:sourceStatuses.filter(source=>source.from_cache).length,stale_sources:sourceStatuses.filter(source=>source.stale).length,oldest_source_fetched_at:fetchedTimes[0]||null,latest_source_fetched_at:fetchedTimes.at(-1)||null,attempted_at:attemptedTimes.at(-1)||null,sources:[...sourceStatuses,sourceStatus('jak-members','membership',{status:'fulfilled',value:membership})]};
    const raw=[...settled.flatMap(result=>result.status==='fulfilled'?result.value.value:[]),...publisher.items];
    const seenUrl = new Set(), seenTitle = new Set(), items = [];
    for (const item of raw) {
      const cleanUrl = String(item.source_url || '').replace(/[?#].*$/,''), key = normalizeTitle(item.title);
      if (!cleanUrl || !key || seenUrl.has(cleanUrl) || seenTitle.has(key)) continue;
      seenUrl.add(cleanUrl); seenTitle.add(key);
      const text = `${item.title} ${item.snippet || ''}`, target = findWatchTarget(text, WATCH_TARGETS), relatedEntities = matchDossiersInText(text, 6), [theme_id, theme_label] = theme(text);
      const assessed = NewsReader ? NewsReader.assess({...item, target, related_entities:relatedEntities}) : null;
      let relevance = assessed && assessed.status !== 'relevant' && theme_id !== 'other' ? {status:'relevant',reason:'마켓인 공통 레이더 범위'} : assessed;
      const directProbe = Boolean(q && searchMatch({...item,theme_label,event_label:eventLabel(text)},q) && isJakMemberSource(item.source_name,jak.names));
      if (!shouldKeep(item, target, jak.names) && !(relevance?.status === 'relevant' && isJakMemberSource(item.source_name, jak.names)) && !directProbe) continue;
      if (directProbe && relevance?.status !== 'relevant') relevance={status:'relevant',reason:'직접 수집 확인'};
      items.push({signal_id: `${Date.parse(item.published_at || 0)}-${items.length}`,published_at: item.published_at,source_type: 'domestic_news', source_name: item.source_name, title: item.title,source_url: item.source_url, snippet: item.snippet || '', provider:item.provider || 'google_news_rss',target: target ? { id: target.id, name: target.name, category: target.category } : null,related_entities: relatedEntities, theme_id, theme_label,event_label: eventLabel(text), jak_member: true, relevance});
    }
    items.sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
    const inRange = items.filter(item => { const t=Date.parse(item.published_at); return !Number.isFinite(t) || (t>=Date.now()-days*86400000 && t<=Date.now()+300000); });
    const eligible = inRange.filter(item => item.relevance?.status === 'relevant'), review = inRange.filter(item => item.relevance?.status !== 'relevant');
    const filteredEligible = q ? eligible.filter(item=>searchMatch(item,q)) : eligible, filteredReview = q ? review.filter(item=>searchMatch(item,q)) : review, filteredRange = q ? inRange.filter(item=>searchMatch(item,q)) : inRange;
    const limitedItems = (readerFeed ? filteredEligible : filteredRange).slice(0,limit), reviewItems = readerFeed ? filteredReview.slice(0,limit) : [];
    if (format === 'ticker-css') { res.setHeader('Content-Type', 'text/css; charset=utf-8'); return res.status(200).send(tickerCss(limitedItems)); }
    const issues = clusterIssues(limitedItems), ongoing = issues.filter(issue=>issue.ongoing).slice(0,30), newIssues = issues.filter(issue=>!issue.ongoing && ageHours(issue.latest_seen) <= 30).slice(0,40), recentIssues = issues.filter(issue=>!ongoing.includes(issue) && !newIssues.includes(issue)).slice(0,80), latest24h = limitedItems.filter(item=>ageHours(item.published_at) <= 24).length;
    return res.status(200).json({ok: true, items: limitedItems, review_items: reviewItems, issues,sections: { ongoing, new_issues: newIssues, recent: recentIssues },stats: { scanned: raw.length, kept: limitedItems.length, issue_count: issues.length, ongoing_count: ongoing.length, new_issue_count: newIssues.length, latest_24h: latest24h },source_policy: { name: '한국기자협회 회원사', member_count: jak.count, member_source: jak.source,member_cached:membership.from_cache,member_stale:membership.stale,member_fetched_at:membership.fetched_at },queries: queryList.length,providers: { google_news_rss: succeeded > 0, publisher_rss: publisher.rss_succeeded > 0, publisher_sitemap:publisher.sitemap_succeeded > 0, publisher_feeds:publisher.succeeded, jak_members: jak.source === 'official' },collection_status: { refresh: fresh, partial, succeeded, failed: queryList.length - succeeded,publisher_succeeded:publisher.succeeded,publisher_failed:publisher.failed,publisher_sitemap_succeeded:publisher.sitemap_succeeded,publisher_sitemap_failed:publisher.sitemap_failed,...sourceCacheStatus,truncated:eligible.length>limit || review.length>limit, relevant_count:eligible.length, review_count:review.length },range: { days }, fetched_at:sourceCacheStatus.latest_source_fetched_at,responded_at:new Date().toISOString()});
  } catch (error) {
    disableResponseCache(res);
    if (format === 'ticker-css') { res.setHeader('Content-Type', 'text/css; charset=utf-8'); return res.status(200).send('.topbar{overflow-x:clip}.topbar::before{content:"[뉴스] 불러오지 못했습니다";display:flex;align-items:center;margin:-18px -26px 8px;padding:0 22px;height:24px;line-height:24px;background:#050505;color:#fff;font-size:10.5px;font-weight:760;white-space:nowrap}'); }
    return res.status(500).json({ ok: false, error:String(error.message||error) });
  }
};
