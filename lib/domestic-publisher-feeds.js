'use strict';

const {createSourceCache}=require('./news-source-cache');
const publisherSourceCache=createSourceCache({maxEntries:64,maxBytes:8*1024*1024,maxInflight:24});

const FEEDS = [
  { id:'hankyung-all', source:'한국경제신문', url:'https://www.hankyung.com/feed/all-news' },
  { id:'hankyung-finance', source:'한국경제신문', url:'https://www.hankyung.com/feed/finance' },
  { id:'hankyung-economy', source:'한국경제신문', url:'https://www.hankyung.com/feed/economy' },
  { id:'hankyung-realestate', source:'한국경제신문', url:'https://www.hankyung.com/feed/realestate' },
];

function decodeEntities(value) {
  const named={amp:'&',apos:"'",gt:'>',lt:'<',nbsp:' ',quot:'"'};
  return String(value||'').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(whole,key)=>{
    if(key[0]==='#'){
      const hex=key[1]?.toLowerCase()==='x';
      const code=parseInt(key.slice(hex?2:1),hex?16:10);
      return Number.isFinite(code)?String.fromCodePoint(code):whole;
    }
    return named[key.toLowerCase()]||whole;
  });
}
function stripMarkup(value) {
  let text=String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');
  for(let i=0;i<2;i++) text=decodeEntities(text).replace(/<[^>]+>/g,' ');
  return text.replace(/\s+/g,' ').trim();
}
function tag(block,name) {
  const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=String(block||'').match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,'i'));
  return match?stripMarkup(match[1]):'';
}
function normalizeDate(value) {
  const d=new Date(value||'');
  return Number.isNaN(d.getTime())?null:d.toISOString();
}
function normalizeLink(value) {
  try {
    const u=new URL(value,'https://www.hankyung.com');
    if(!/^https?:$/.test(u.protocol)) return '';
    u.hash='';
    return u.href;
  } catch { return ''; }
}
function parseRss(xml,source,feedId) {
  const blocks=String(xml||'').match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)||[];
  return blocks.map(block=>({
    category:'domestic', language:'ko', source_name:source,
    title:tag(block,'title'), source_url:normalizeLink(tag(block,'link')),
    published_at:normalizeDate(tag(block,'pubDate')||tag(block,'dc:date')),
    snippet:tag(block,'description').slice(0,500),
    provider:'publisher_rss', provider_feed:feedId,
  })).filter(item=>item.title&&item.source_url);
}
function kstDays(days=3,now=Date.now()) {
  const count=Math.max(1,Math.min(7,Number(days)||3)),out=[];
  for(let offset=0;offset<count;offset++){
    const d=new Date(now+9*3600000-offset*86400000);
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}
function sitemapUrl(day){const [y,m,d]=String(day).split('-');return `https://www.hankyung.com/sitemap/${y}/${m}/${d}`;}
function sitemapPublishedAt(day){return new Date(`${day}T00:00:00+09:00`).toISOString();}
function parseSitemap(html,day) {
  const out=[],seen=new Set(),pattern=/<a\b[^>]*href=["']([^"']*\/article\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while((match=pattern.exec(String(html||'')))){
    const source_url=normalizeLink(match[1]),title=stripMarkup(match[2]);
    if(!source_url||!title||seen.has(source_url))continue;
    seen.add(source_url);
    out.push({category:'domestic',language:'ko',source_name:'한국경제신문',title,source_url,published_at:sitemapPublishedAt(day),snippet:'',provider:'publisher_sitemap',provider_feed:'hankyung-sitemap'});
  }
  return out;
}
async function fetchOne(url,{fetchFn,fresh,timeoutMs,accept}){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const headers={'User-Agent':'IB-News-Monitor/5.3','Accept':accept};
    if(fresh)headers['Cache-Control']='no-cache';
    const response=await fetchFn(url,{signal:ctrl.signal,cache:fresh?'no-store':'default',headers});
    if(!response.ok)throw Error('PUBLISHER_HTTP_'+response.status);
    return await response.text();
  }finally{clearTimeout(timer);}
}
async function fetchPublisherFeeds({fetchFn=fetch,fresh=false,timeoutMs=9000,days=3,now=Date.now(),sourceCache=publisherSourceCache}={}) {
  const sitemapDays=kstDays(days,now);
  const sources=[
    ...FEEDS.map(feed=>({id:feed.id,kind:'rss',url:feed.url,accept:'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',parse:xml=>parseRss(xml,feed.source,feed.id)})),
    ...sitemapDays.map(day=>({id:'hankyung-sitemap:'+day,kind:'sitemap',url:sitemapUrl(day),accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',parse:html=>parseSitemap(html,day)})),
  ];
  // RSS and dated sitemap requests are independent; start both groups together.
  const settled=await Promise.allSettled(sources.map(source=>sourceCache.get(source.url,
    async()=>{
      const body=await fetchOne(source.url,{fetchFn,fresh,timeoutMs,accept:source.accept});
      if(source.kind==='rss'&&!/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>[\s\S]*<\/channel\s*>[\s\S]*<\/rss\s*>/i.test(body)) throw new Error('PUBLISHER_INVALID_RSS');
      const items=source.parse(body);
      // An empty sitemap cannot be distinguished safely from an HTML error or
      // changed markup. Preserve the previous snapshot until articles parse again.
      if(!items.length&&(source.kind==='sitemap'||/<item\b/i.test(body))) throw new Error('PUBLISHER_UNREADABLE_'+source.kind.toUpperCase());
      return items;
    },{fresh})));
  const sourceStatus=settled.map((result,index)=>{
    const {value,...status}=result.status==='fulfilled'?result.value:{failed:true,stale:false,from_cache:false,fetched_at:null,attempted_at:new Date().toISOString(),error:String(result.reason?.message||result.reason).slice(0,240)};
    return {source:sources[index].id,provider:'publisher_'+sources[index].kind,...status};
  });
  const rssSucceeded=sourceStatus.filter(source=>source.provider==='publisher_rss'&&!source.failed).length;
  const sitemapSucceeded=sourceStatus.filter(source=>source.provider==='publisher_sitemap'&&!source.failed).length;
  return {
    items:settled.flatMap(result=>result.status==='fulfilled'?result.value.value:[]),
    succeeded:rssSucceeded+sitemapSucceeded,
    available:settled.filter(result=>result.status==='fulfilled').length,
    failed:sourceStatus.filter(source=>source.failed).length,
    total:FEEDS.length+sitemapDays.length,
    rss_succeeded:rssSucceeded,rss_failed:FEEDS.length-rssSucceeded,
    sitemap_succeeded:sitemapSucceeded,sitemap_failed:sitemapDays.length-sitemapSucceeded,
    source_status:sourceStatus,
  };
}

module.exports={FEEDS,parseRss,parseSitemap,kstDays,sitemapUrl,fetchPublisherFeeds};
