'use strict';
// Public retrieval only. No user cookies, credentials, proxy rotation or paywall bypass.
const crypto = require('node:crypto');
const OFFICIAL = ['kvic.or.kr','k-vic.co.kr','vcs.go.kr','nps.or.kr','kgrowth.or.kr','kdb.co.kr','mss.go.kr','korea.kr','fsc.go.kr','fss.or.kr','kcmi.re.kr','kvca.or.kr','assembly.go.kr','nanet.go.kr'];
const MEDIA = ['edaily.co.kr','thebell.co.kr','dealsite.co.kr','hankyung.com','mk.co.kr','sedaily.com','newsis.com','yna.co.kr','yonhapnewstv.co.kr','platum.kr','venturesquare.net','mt.co.kr','fnnews.com','bloter.net','newstof.com','biz.chosun.com','news1.kr'];
const SEARCH = ['news.google.com','openapi.naver.com'];
const clean = x => String(x ?? '').replace(/\s+/g,' ').trim();
const hash = x => crypto.createHash('sha256').update(x).digest('hex').slice(0,20);
const inDomain = (h,ds) => ds.some(d=>h===d||h.endsWith('.'+d));
function publicKind(value) { try { const u=new URL(value); if(!['http:','https:'].includes(u.protocol)||u.port||u.username||u.password)return 'blocked'; return inDomain(u.hostname,OFFICIAL)?'official':inDomain(u.hostname,MEDIA)?'media':SEARCH.includes(u.hostname)?'search':'blocked'; }catch(_){return 'blocked';} }
function safeUrl(value) { try {const u=new URL(value);if(publicKind(value)==='blocked'||/(?:^|\/)(?:admin|login|signin|logout|mypage|sorry|consent)(?:[/.?]|$)/i.test(u.pathname))return null;if([...u.searchParams.keys()].some(k=>/^(key|api_key|token|access_token|crtfc_key|serviceKey|auth)$/i.test(k)))return null;u.protocol='https:';u.hash='';return u.href;}catch(_){return null;} }
function decode(v) {return String(v||'').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|lsquo|rsquo|ldquo|rdquo|ndash|mdash);/gi,(m,k)=>{if(k[0]==='#'){const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',ndash:'–',mdash:'—'})[k.toLowerCase()]||m;});}
function attrs(tag) {const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))out[m[1].toLowerCase()]=decode(m[2]??m[3]);return out;}
function element(html, predicate) {
  const tags=/<([a-z][a-z0-9:-]*)\b[^>]*>/gi;let m;
  while((m=tags.exec(html))){if(!predicate(m[1].toLowerCase(),attrs(m[0])))continue;
    const name=m[1], re=new RegExp(`<(/?)${name}\\b[^>]*>`,'gi');re.lastIndex=tags.lastIndex;let depth=1,n;
    while((n=re.exec(html))){depth+=n[1]?-1:(/\/>$/.test(n[0])?0:1);if(!depth)return html.slice(tags.lastIndex,n.index);}
  }return '';
}
function articleData(html) {
  const found=[];
  function walk(v,depth=0){if(depth>8||!v||typeof v!=='object')return;if(Array.isArray(v)){for(const x of v.slice(0,80))walk(x,depth+1);return;}if(/Article|NewsArticle|ReportageNewsArticle|BlogPosting/.test(String(v['@type']||'')))found.push(v);if(v['@graph'])walk(v['@graph'],depth+1);}
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch(_){}}
  return found;
}
function htmlBlocks(html,kind='official') {
  const structured=articleData(html);if(structured.some(x=>x.isAccessibleForFree===false||x.isAccessibleForFree==='false'))throw new Error('PAYWALL_OR_LOGIN');
  const bare=html.replace(/<(script|style|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi,' ');
  const blocked=/로그인이 필요|회원만 열람|접근 권한이 없|유료회원 전용|구독자 전용|잘못된 접근입니다|Access Denied|Just a moment|자동입력 방지/i;
  if(blocked.test(bare)||/g-recaptcha|cf-chl-|captcha-form/i.test(html))throw new Error('ACCESS_LIMITED');
  const names=/^(articleBody|articleBodyContents|article-view-content-div|newsView|news_body_area|news_body|newsBody|article_body|article-content|article_content|view-content|view_content|board_view_con|board-view-content|board-content|board_view_content|board-detail-content|view_cont|contentView)$/i;
  let core=element(bare,(_,a)=>a.itemprop==='articleBody'||names.test(a.id||'')||(a.class||'').split(/\s+/).some(c=>names.test(c)));
  if(!core)core=element(bare,t=>t==='article');
  const ld=structured.find(x=>typeof x.articleBody==='string'&&x.articleBody.length>150);
  let extractor='article_container';
  if(!core&&ld){core=ld.articleBody;extractor='public_article_jsonld';}
  if(!core&&kind==='media')throw new Error('ARTICLE_BODY_NOT_LOCATED');
  if(!core){core=element(bare,t=>t==='main')||element(bare,t=>t==='body')||bare;extractor='official_page_text';}
  const text=decode(core.replace(/<\/(?:p|div|li|tr|h[1-6]|section)>|<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:td|th)>/gi,' | ').replace(/<[^>]*>/g,' ')).split(/\n+/).map(clean).filter(Boolean).join('\n');
  if(blocked.test(text)||text.replace(/\s/g,'').length<(kind==='media'?150:50))throw new Error('BODY_UNREADABLE');
  const blocks=[{location:'웹 본문',text:text.slice(0,90000)}];blocks.extractor=extractor;blocks.truncated=text.length>90000;return blocks;
}
function publicationDate(html) {for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const a=attrs(m[0]);if(/^(article:published_time|datePublished|pubdate)$/i.test(a.property||a.name||a.itemprop||'')&&/^20\d{2}-\d{2}-\d{2}/.test(a.content||''))return a.content;}for(const x of articleData(html))if(/^20\d{2}-\d{2}-\d{2}/.test(x.datePublished||''))return x.datePublished;return null;}
function readLinks(html,base) {
  const out=[],seen=new Set(),parent=new URL(base),id=parent.searchParams.get('id');
  for(const m of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
    const a=attrs(m[0]),href=a.href||'';if(!href||/^#|^javascript:/i.test(href))continue;
    let url;try{url=safeUrl(new URL(href,base).href);}catch(_){continue;}if(!url||publicKind(url)!=='official'||seen.has(url))continue;
    const u=new URL(url),label=clean(decode(m[0].replace(/<[^>]*>/g,' ')));
    if(!/fileDown|download|attach|\.(pdf|hwpx?)(?:$|[?#])/i.test(u.pathname))continue;
    if(inDomain(parent.hostname,['kvic.or.kr'])&&id&&u.searchParams.has('boardDataNo')&&u.searchParams.get('boardDataNo')!==id)continue;
    const vicinity=clean(decode(html.slice(Math.max(0,m.index-1000),m.index).replace(/<[^>]*>/g,' ')));
    const filename=vicinity.match(/([^<>]{3,220}\.(?:pdf|hwpx?|zip))\s*(?:바로보기)?\s*$/i)?.[1];
    seen.add(url);out.push({url,title:filename||label||'첨부파일',parent_url:base});
  }return out.slice(0,12);
}
function sniff(buffer) {
  const prefix=buffer.subarray(0,1024);const off=prefix.indexOf('%PDF-');
  if(off>=0&&/^\s*$/.test(prefix.subarray(0,off).toString('utf8').replace(/^\ufeff/,'')))return {format:'pdf',offset:off};
  if(buffer.subarray(0,8).toString('hex')==='d0cf11e0a1b11ae1')return {format:'hwp_binary'};
  if(buffer.subarray(0,4).toString('hex')==='504b0304')return {format:'zip'};
  if(/^\s*(?:\ufeff)?\s*</.test(prefix.toString('utf8')))return {format:'html'};
  return {format:'unknown'};
}
function filename(disposition) {const m=String(disposition||'').match(/filename\*?\s*=\s*(?:UTF-8'')?["']?([^"';]+)/i);if(!m)return '';try{return clean(decodeURIComponent(m[1].replace(/\+/g,' '))).slice(0,240);}catch(_){return clean(m[1]).slice(0,240);}}
function decodeBuffer(b,type='') {const charset=(String(type).match(/charset\s*=\s*["']?([^;"'\s]+)/i)||b.subarray(0,3000).toString('ascii').match(/charset\s*=\s*["']?([^;"'\s>]+)/i))?.[1]||'utf-8';if(/euc-kr|ks_c_5601|cp949|windows-949/i.test(charset))return require('iconv-lite').decode(b,'cp949');return b.toString('utf8');}
function parseRpcResponse(text) {
  function walk(v,depth=0){if(depth>8)return null;if(Array.isArray(v)){if(v[0]==='garturlres'&&typeof v[1]==='string')return v[1];for(const x of v){const r=walk(x,depth+1);if(r)return r;}}else if(typeof v==='string'&&v.includes('garturlres')){try{return walk(JSON.parse(v),depth+1);}catch(_){}}return null;}
  for(const line of text.split(/\r?\n/)){if(!line.trim().startsWith('['))continue;try{const result=walk(JSON.parse(line));if(result)return result;}catch(_){}}
  return null;
}
function createReader({fetchImpl=(...a)=>fetch(...a),parsePdf,zipEntries}={}) {
  const docs=new Map(),sessions=new Map(),resolutions=new Map();let googleRetryAt=0;
  async function boundedFetch(value,{deadline=Date.now()+6500,maxBytes=5000000,headers={},redirects=0,method='GET',body,anonymousSession=false,referrer='',sessionKey=''}={}) {
    const url=safeUrl(value);if(!url)throw new Error('PUBLIC_HOST_NOT_ALLOWED');const u=new URL(url),remaining=Math.min(6500,deadline-Date.now());if(remaining<=0)throw new Error('RESEARCH_TIME_LIMIT');
    if(method!=='GET'&&!(method==='POST'&&u.hostname==='news.google.com'&&u.pathname==='/_/DotsSplashUi/data/batchexecute'))throw new Error('METHOD_NOT_ALLOWED');
    const send={'User-Agent':'IB-Reporting-Radar/1.1 (public source review)'};
    // The only caller-provided secret headers allowed are to the existing Naver API host.
    for(const [k,v] of Object.entries(headers))if(/^accept(?:-language)?$|^content-type$/i.test(k)||(u.hostname==='openapi.naver.com'&&/^x-naver-client-(id|secret)$/i.test(k)))send[k]=v;
    let parent=null;try{parent=new URL(safeUrl(referrer));}catch(_){}
    if(parent&&parent.origin===u.origin)send.Referer=parent.href;
    const jarKey=sessionKey&&safeUrl(sessionKey)&&new URL(sessionKey).origin===u.origin?sessionKey:'';
    const session=sessions.get(jarKey);
    if(anonymousSession&&jarKey&&u.hostname==='www.kvic.or.kr'&&session?.expires>Date.now())send.Cookie=session.cookie;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),remaining);
    try{
      const r=await fetchImpl(url,{redirect:'manual',signal:controller.signal,headers:send,method,...(method==='POST'?{body}: {})});
      if(anonymousSession&&jarKey&&u.hostname==='www.kvic.or.kr'&&r.status===200){const values=(r.headers.getSetCookie?.()||[]).map(s=>s.split(';')[0]).filter(s=>/^JSESSIONID=[A-Za-z0-9._-]{1,240}$/.test(s));if(values.length)sessions.set(jarKey,{cookie:values.join('; '),expires:Date.now()+90000});}
      if([301,302,303,307,308].includes(r.status)){await r.body?.cancel();if(redirects>=3)throw new Error('REDIRECT_LIMIT');const next=safeUrl(new URL(r.headers.get('location')||'',url).href);if(!next)throw new Error('REDIRECT_NOT_PUBLIC');return boundedFetch(next,{deadline,maxBytes,redirects:redirects+1,anonymousSession:anonymousSession&&new URL(next).origin===u.origin,referrer:new URL(next).origin===u.origin?referrer:'',sessionKey:new URL(next).origin===u.origin?sessionKey:''});}
      if(!r.ok){await r.body?.cancel();if(r.status===429&&u.hostname==='news.google.com')googleRetryAt=Date.now()+300000;throw new Error(`HTTP_${r.status}`);}
      if(Number(r.headers.get('content-length')||0)>maxBytes){await r.body?.cancel();throw new Error('DOCUMENT_TOO_LARGE');}
      let size=0;const chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>maxBytes){controller.abort();throw new Error('DOCUMENT_TOO_LARGE');}chunks.push(chunk);}
      return {url,buffer:Buffer.concat(chunks),contentType:r.headers.get('content-type')||'',filename:filename(r.headers.get('content-disposition'))};
    }catch(e){throw new Error(e.name==='AbortError'?'SOURCE_TIMEOUT':e.message);}finally{clearTimeout(timer);}
  }
  async function resolveNews(url,deadline) {
    const u=new URL(url),id=u.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]{16,1800})$/)?.[1];if(u.hostname!=='news.google.com'||!id)throw new Error('ORIGINAL_URL_UNRESOLVED');
    const cached=resolutions.get(id);if(cached?.expires>Date.now())return cached.url;if(googleRetryAt>Date.now())throw new Error('SEARCH_RATE_LIMIT_PAUSED');
    let next=null;const decoded=Buffer.from(id,'base64url').toString('utf8').match(/https?:\/\/[^\x00-\x20"<>]+/);if(decoded)next=safeUrl(decoded[0]);
    if(!next){const page=await boundedFetch(`https://news.google.com/articles/${id}?hl=ko&gl=KR&ceid=KR:ko`,{deadline,maxBytes:1500000});if(['official','media'].includes(publicKind(page.url)))next=page.url;
      else {const html=page.buffer.toString('utf8');if(/captcha-form|g-recaptcha|consent.google.com\/m\?|Before you continue to Google/i.test(html))throw new Error('SEARCH_ACCESS_LIMITED');
        const raw=html.match(/data-n-au=["']([^"']+)/)?.[1];if(raw)next=safeUrl(decode(raw));
        if(!next){const sig=html.match(/data-n-a-sg=["']([A-Za-z0-9_-]{1,1024})["']/)?.[1],ts=html.match(/data-n-a-ts=["'](\d{1,15})["']/)?.[1];if(!sig||!ts)throw new Error('ORIGINAL_URL_UNRESOLVED');
          const inner=['garturlreq',[["X","X",["X","X"],null,null,1,1,'KR:ko',null,1,null,null,null,null,null,0,1],'X','X',1,[1,1,1],1,1,null,0,0,null,0],id,Number(ts),sig];
          const payload=new URLSearchParams({'f.req':JSON.stringify([[['Fbv4je',JSON.stringify(inner),null,'generic']]])}).toString();
          const rpc=await boundedFetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',{deadline,method:'POST',body:payload,maxBytes:200000,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}});next=safeUrl(parseRpcResponse(rpc.buffer.toString('utf8')));
        }
      }
    }
    if(!next||!['official','media'].includes(publicKind(next)))throw new Error('ORIGINAL_HOST_NOT_ALLOWED');resolutions.set(id,{url:next,expires:Date.now()+600000});while(resolutions.size>100)resolutions.delete(resolutions.keys().next().value);return next;
  }
  async function extractPdf(buffer) {
    const blocks=[];let count=0;
    const parse=parsePdf||require('pdf-parse/lib/pdf-parse');
    const parsed=await parse(buffer,{max:24,pagerender:async page=>{const content=await page.getTextContent();const rows=[];let y=null,line=[];for(const item of content.items){const yy=item.transform?.[5];if(y!==null&&Math.abs(yy-y)>2){rows.push(line.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' '));line=[];}line.push({x:item.transform?.[4]||0,text:item.str});y=yy;}if(line.length)rows.push(line.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' '));const text=rows.map(clean).filter(Boolean).join('\n');blocks.push({location:`PDF ${page.pageNumber||++count}쪽`,text});return text;}});
    return {blocks,page_count:parsed.numpages,read_pages:blocks.length,truncated:parsed.numpages>blocks.length,format:'pdf',extractor:'pdf_text_layer'};
  }
  async function extractArchive(buffer) {
    const entries=zipEntries?zipEntries(buffer):new (require('adm-zip'))(buffer).getEntries();
    if(entries.length>100)throw new Error('ARCHIVE_LIMIT');let total=0;
    for(const e of entries){total+=e.header.size;if(e.header.size>12000000||total>24000000)throw new Error('ARCHIVE_LIMIT');if(e.header.flags&1)throw new Error('ENCRYPTED_ATTACHMENT');}
    const sections=entries.filter(e=>/^Contents\/section\d+\.xml$/i.test(e.entryName)).sort((a,b)=>a.entryName.localeCompare(b.entryName,undefined,{numeric:true}));
    if(!sections.length)throw new Error('ARCHIVE_FORMAT_NOT_SUPPORTED');
    const blocks=[];for(const e of sections.slice(0,12)){let data;if(zipEntries)data=e.getData();else {const compressed=e.getCompressedData();if(e.header.method===0)data=compressed;else if(e.header.method===8)data=require('node:zlib').inflateRawSync(compressed,{maxOutputLength:Math.min(12000000,e.header.size+1)});else throw new Error('ARCHIVE_COMPRESSION_NOT_SUPPORTED');}if(data.length!==e.header.size||data.length>12000000)throw new Error('ARCHIVE_LIMIT');const xml=data.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('XML_DECLARATION_NOT_ALLOWED');const paras=[...xml.matchAll(/<(?:hp:|p:)p\b[^>]*>([\s\S]*?)<\/(?:hp:|p:)p>/g)].map(m=>clean(decode([...m[1].matchAll(/<(?:hp:|p:)t\b[^>]*>([\s\S]*?)<\/(?:hp:|p:)t>/g)].map(t=>t[1]).join(' ')))).filter(Boolean);blocks.push({location:`HWPX ${e.entryName}`,text:paras.join('\n').slice(0,90000)});}
    return {blocks,page_count:null,read_pages:null,truncated:sections.length>12,format:'hwpx',extractor:'hwpx_section_text'};
  }
  async function read(meta,deadline=Date.now()+20000) {
    const original=meta.url||meta.source_url;const source={source_id:hash(String(original)),url:original,title:clean(meta.title||meta.label||'공개자료'),published_at:meta.published_at||null,reference_as_of:meta.reference_as_of||null,publisher:meta.publisher||meta.source_name||'',kind:publicKind(original),found_by:meta.found_by||'public_source_index',read_ok:false,access:'link_only',text:'',blocks:[]};
    if(!safeUrl(original))return {...source,access:'not_fetched',read_error:'PUBLIC_HOST_NOT_ALLOWED'};
    const attempts=[];
    try{
      if(source.kind==='search'){const resolved=await resolveNews(original,Math.min(deadline,Date.now()+12000));source.discovery_url=original;source.url=resolved;source.source_id=hash(resolved);source.kind=publicKind(resolved);attempts.push('publisher_url_resolved');}
      const key=source.url,cached=docs.get(key);if(cached?.expires>Date.now())return {...source,...cached.value,cache_hit:true,discovery_url:source.discovery_url};
      let referrer='',anonymousSession=false;
      if(meta.parent_url&&new URL(source.url).hostname==='www.kvic.or.kr'&&/fileDown/i.test(new URL(source.url).pathname)){
        const parent=safeUrl(meta.parent_url);if(!parent||new URL(parent).origin!==new URL(source.url).origin||new URL(parent).searchParams.get('id')!==new URL(source.url).searchParams.get('boardDataNo'))throw new Error('ATTACHMENT_PARENT_MISMATCH');
        referrer=parent;anonymousSession=true;await boundedFetch(parent,{deadline,anonymousSession:true,sessionKey:parent,maxBytes:1500000});attempts.push('public_parent_session');
      }
      const r=await boundedFetch(source.url,{deadline,anonymousSession,referrer,sessionKey:referrer});
      const kind=sniff(r.buffer);source.format=kind.format;source.content_type=r.contentType;source.byte_length=r.buffer.length;if(r.filename)source.filename=r.filename;
      source.url=r.url;source.kind=publicKind(r.url);source.source_id=hash(r.url);let extracted,links=[];
      if(kind.format==='pdf')extracted=await extractPdf(r.buffer.subarray(kind.offset));
      else if(kind.format==='zip')extracted=await extractArchive(r.buffer);
      else if(kind.format==='hwp_binary')throw new Error('HWP_BINARY_NOT_SUPPORTED');
      else{
        const html=decodeBuffer(r.buffer,r.contentType);
        if(meta.found_by==='official_attachment')throw new Error(/잘못된 접근|로그인|접근 권한/.test(html)?'ATTACHMENT_ACCESS_LIMITED':'ATTACHMENT_NOT_A_DOCUMENT');
        const blocks=htmlBlocks(html,source.kind);links=readLinks(html,r.url);const published=publicationDate(html);if(published)source.published_at=published;
        const boardDate=html.match(/작성일자[\s\S]{0,150}?(20\d{2}-\d{2}-\d{2})/);if(!source.published_at&&boardDate)source.published_at=boardDate[1];
        extracted={blocks,format:'html',page_count:null,read_pages:null,truncated:blocks.truncated||false,extractor:blocks.extractor};
      }
      const text=extracted.blocks.map(b=>b.text).join('\n');if(text.replace(/\s/g,'').length<50)throw new Error('SCANNED_OR_EMPTY_DOCUMENT');
      const value={...source,...extracted,text,links,read_ok:true,access:'body',read_error:null,content_hash:hash(r.buffer),retrieved_at:new Date().toISOString(),attempts};docs.set(key,{value,expires:Date.now()+600000});while(docs.size>24)docs.delete(docs.keys().next().value);return value;
    }catch(e){return {...source,access:source.kind==='search'?'headline_only':'unread',read_error:clean(e.message).slice(0,80),attempts,retrieved_at:new Date().toISOString()};}
  }
  return {boundedFetch,read,resolveNews};
}
module.exports={OFFICIAL,MEDIA,publicKind,safeUrl,decode,attrs,element,articleData,htmlBlocks,publicationDate,readLinks,sniff,filename,parseRpcResponse,createReader};
