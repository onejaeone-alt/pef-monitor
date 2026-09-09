'use strict';
const {parseGoogleNewsRss}=require('./context-sources');
const T=require('../news-taxonomy');
const Translation=require('./news-translation');
const SOURCES=['Reuters','Bloomberg','Financial Times','The Wall Street Journal','WSJ','CNBC','Private Equity International','PE Hub','Buyouts','Private Equity Wire','Private Debt Investor','Venture Capital Journal','PitchBook','TechCrunch','Crunchbase News','DealStreetAsia','Nikkei Asia','AsianInvestor','Pensions & Investments','Infrastructure Investor','Secondaries Investor'];
const normalize=s=>String(s||'').toLowerCase().replace(/^the\s+/,'').replace(/[^a-z0-9]/g,'');
const allowed=new Set(SOURCES.map(normalize));
function queries(days){return [
 '"private equity" OR buyout OR "take-private"',
 '"merger" OR "acquisition" OR "takeover"',
 '"venture capital" OR "startup funding" OR "series B" OR "series C"',
 '"private equity" "fund" OR "venture capital" "fund" OR "final close"',
 '"limited partners" OR "pension fund" "private equity" OR "sovereign wealth fund"',
 '"private credit" OR "acquisition financing" OR "continuation fund" OR "secondaries"',
 '("private equity" OR "venture capital") (partner OR appoints OR leaves OR regulation)',
 '("Asia" OR "Korea" OR "Japan") ("private equity" OR "venture capital" OR "buyout")'
 ].map(q=>`(${q}) when:${days}d`);}
function inScope(item){return /\b(?:private equity|venture capital|buyouts?|takeovers?|take-private|mergers?|acquisitions?|acquir\w+|M&A|IPO|initial public offering|secondar\w+|continuation fund|private credit|private debt|limited partners?|pension fund|sovereign wealth|fundrais\w+|funding|series [a-f]|investment bank|leveraged loan|refinanc\w+)\b/i.test(item.title+' '+item.snippet)||/\bfund\b.*\b(?:rais\w+|clos\w+|launch\w+|commit\w+)\b|\b(?:rais\w+|clos\w+|launch\w+|commit\w+)\b.*\bfund\b/i.test(item.title);}
function noCache(res){for(const h of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])res.setHeader(h,'no-store');}
async function handle(req,res,{translateItems=Translation.translateItems}={}){
 if(req.query.translation){const translation=await Translation.lookup(String(req.query.translation)).catch(()=>null);return res.status(translation?200:404).json({ok:!!translation,translation});}
 const fresh=req.query.refresh==='1';
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120');if(fresh)noCache(res);
 res.setHeader('X-News-Refresh',fresh?'live':'cached-allowed');
 const bounded=(x,d,min,max)=>Number.isFinite(parseInt(x,10))?Math.min(max,Math.max(min,parseInt(x,10))):d;
 const days=bounded(req.query.days,7,1,14),limit=bounded(req.query.limit,400,40,500),qs=queries(days),now=Date.now();
 try{
 const results=await Promise.allSettled(qs.map(async q=>{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  try{const params=new URLSearchParams({q,hl:'en-US',gl:'US',ceid:'US:en'});const r=await fetch('https://news.google.com/rss/search?'+params,{signal:ctrl.signal,cache:fresh?'no-store':'default',headers:{'User-Agent':'IB-News-Monitor/6.0',...(fresh?{'Cache-Control':'no-cache'}:{})}});if(!r.ok)throw Error('RSS HTTP '+r.status);const xml=await r.text();if(!/<rss[\s>]/i.test(xml))throw Error('Invalid RSS');return parseGoogleNewsRss(xml,'foreign','en');}finally{clearTimeout(timer);}
 }));
 const succeeded=results.filter(x=>x.status==='fulfilled').length;if(!succeeded)throw Error('외신 수집원에 연결하지 못했습니다.');
 const partial=succeeded<qs.length;if(partial)noCache(res);
 const raw=results.flatMap(x=>x.status==='fulfilled'?x.value:[]),seen=new Set(),items=[];
 for(const x of raw){const t=Date.parse(x.published_at);if(!Number.isFinite(t)||t<now-days*86400000||t>now+300000||!allowed.has(normalize(x.source_name))||!inScope(x))continue;
 const key=x.title.toLowerCase().replace(/[^a-z0-9]/g,'');if(seen.has(x.source_url)||seen.has(key))continue;seen.add(x.source_url);seen.add(key);
 const category=T.classify(x);items.push({...x,source_type:'foreign_news',news_scope:'foreign',fact_status:'보도',related_entities:[],theme_id:category.category_id,theme_label:category.category_label,event_label:category.category_label,relevance:{status:'relevant',reason:'해외 IB·투자업계 보도'}});
 }
 items.sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
 const translated=await translateItems(items.slice(0,limit));
 if(translated.status.failed)noCache(res);
 return res.status(200).json({ok:true,scope:'foreign',translation:translated.status,items:translated.items,review_items:[],issues:[],source_policy:{name:'해외 경제·투자 전문매체',sources:SOURCES,language:'en'},providers:{google_news_rss:true},collection_status:{refresh:fresh,partial,succeeded,failed:qs.length-succeeded,truncated:items.length>limit},range:{days},stats:{scanned:raw.length,kept:Math.min(limit,items.length)},fetched_at:new Date().toISOString()});
 }catch(e){noCache(res);return res.status(502).json({ok:false,scope:'foreign',error:e.message});}
}
module.exports={handle,queries,inScope,SOURCES};
