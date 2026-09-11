'use strict';

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
    const u=new URL(value);
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
async function fetchPublisherFeeds({fetchFn=fetch,fresh=false,timeoutMs=9000}={}) {
  const settled=await Promise.allSettled(FEEDS.map(async feed=>{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    try {
      const headers={'User-Agent':'IB-News-Monitor/5.2','Accept':'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5'};
      if(fresh) headers['Cache-Control']='no-cache';
      const response=await fetchFn(feed.url,{signal:ctrl.signal,cache:fresh?'no-store':'default',headers});
      if(!response.ok) throw Error('PUBLISHER_RSS_'+response.status);
      return parseRss(await response.text(),feed.source,feed.id);
    } finally { clearTimeout(timer); }
  }));
  return {
    items:settled.flatMap(result=>result.status==='fulfilled'?result.value:[]),
    succeeded:settled.filter(result=>result.status==='fulfilled').length,
    failed:settled.filter(result=>result.status==='rejected').length,
    total:FEEDS.length,
  };
}

module.exports={FEEDS,parseRss,fetchPublisherFeeds};
