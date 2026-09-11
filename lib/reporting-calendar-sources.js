'use strict';
const {attrs,readLinks,htmlBlocks}=require('./public-document-reader');
const {parseGoogleNewsRss}=require('./context-sources');
const DAY=86400000;
const SOURCES=[
 ...require('./reporting-calendar-institutions').INSTITUTIONS,
 {id:'kgrowth-notice',name:'한국성장금융 출자사업 설명회',type:'growth',url:'https://www.kgrowth.or.kr/notice.asp?str_type=1&tab=1',pages:3},
 {id:'kgrowth-other',name:'한국성장금융 공시·기타 행사',type:'growth',url:'https://www.kgrowth.or.kr/notice.asp?str_type=2&tab=2',pages:3},
 {id:'kgrowth-press',name:'한국성장금융 발표·보도자료',type:'growth',url:'https://www.kgrowth.or.kr/notice.asp?str_type=3&tab=3',pages:3},
 {id:'kcmi',name:'자본시장연구원 행사',type:'kcmi',url:'https://www.kcmi.re.kr/',organizer:'자본시장연구원'},
 {id:'kvca',name:'벤처캐피탈협회·유관기관 행사',type:'kvca',url:'https://www.kvca.or.kr/Program/board/list.html?a_cd=5&a_gb=board&a_item=0&sm=3_1',limit:48},
 {id:'kvic-investment',name:'한국벤처투자 출자사업 설명회',type:'kvic',url:'https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice'},
 {id:'kvic-other',name:'한국벤처투자 기타 공지',type:'kvic',url:'https://www.kvic.or.kr/notice/kvic-notice/other-notice'},
 {id:'kvic-press',name:'한국벤처투자 보도자료',type:'kvic',url:'https://www.kvic.or.kr/notice/kvic-news/press-release'},
 {id:'kvic-related',name:'한국벤처투자 유관기관 소식',type:'kvic',url:'https://www.kvic.or.kr/notice/kvic-notice/related-organization-news'},
 {id:'kofia',name:'금융투자협회·유관기관 설명회',type:'kofia',url:'https://www.kofia.or.kr/brd/m_17/list.do'},
 {id:'nars-seminar',name:'국회입법조사처 세미나·토론회',type:'nars',url:'https://www.nars.go.kr/event/list.do?cmsCode=CM0032',organizer:'국회입법조사처'},
 {id:'nars-meeting',name:'국회입법조사처 전문가 간담회',type:'nars',url:'https://www.nars.go.kr/event/list.do?cmsCode=CM0033',organizer:'국회입법조사처'},
 {id:'fsc-chair',name:'금융위원장 일정',type:'fsc',url:'https://www.fsc.go.kr/fsc020301'},
 {id:'fsc-vice',name:'금융위 부위원장 일정',type:'fsc',url:'https://www.fsc.go.kr/fsc030201'},
 {id:'assembly',name:'국회 토론회·공청회 보도',query:'국회 (자본시장 OR 사모펀드 OR 벤처투자 OR 기업지배구조 OR 상법) (토론회 OR 공청회 OR 세미나) when:30d'},
 {id:'policy',name:'금융위·금감원 주간 발표 예고',query:'(금융위 OR 금감원) (주간일정 OR 주요 일정 OR 주간보도계획) when:10d'},
 {id:'industry',name:'IB·대체투자 행사 보도',query:'(사모펀드 OR 대체투자 OR 벤처캐피탈 OR "private markets") (컨퍼런스 OR 포럼 OR 간담회 OR 설명회 OR 세미나) 개최 when:60d'},
 {id:'policy-finance-events',name:'성장금융·산은·캠코·예탁원 행사 보도',query:'(성장금융 OR 한국벤처투자 OR 산업은행 OR 캠코 OR 예탁결제원) (설명회 OR 투자밋업 OR IR OR 포럼 OR 간담회 OR 발표회) when:90d'}
];
function canonical(url,type){const u=new URL(url);u.hash='';if(type==='growth'){const idx=u.searchParams.get('idx'),str=u.searchParams.get('str_type');u.search='';u.searchParams.set('idx',idx);if(str)u.searchParams.set('str_type',str);}return u.href;}
function boardCandidates(html,source,H){
 const out=[],rows=[...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(x=>x[0]);
 const accept=x=>source.type==='growth'?/notice_view\.asp/.test(x.url):source.type==='kvca'?/listbody\.html/.test(x.url):source.type==='kofia'?/\/brd\/m_17\/view\.do/.test(x.url):source.type==='kvic'?new URL(x.url).searchParams.has('id'):false;
 for(const row of rows){
  const text=H.clean(row),published_at=H.dateIn(text.match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/)?.[0]||'',null);
  let found=H.links(row,source.url).filter(accept);
  if(source.type==='kvic'&&!found.length){
   const id=row.match(/(?:[?&]id=|boardDataNo=)(\d+)/)?.[1]||row.match(/(?:fn_view|goView|view|detail|goDetail|fnDetail|moveDetail)[A-Za-z0-9_]*\s*\(\s*['"]?(\d{3,})/i)?.[1]||row.match(/(?:onclick|href)\s*=\s*["'][^"']*?\(\s*['"]?(\d{3,})/i)?.[1];
   const labels=[...row.matchAll(/<(?:td|a)\b[^>]*>([\s\S]*?)<\/(?:td|a)>/gi)].map(m=>H.clean(m[1])).filter(t=>H.isCandidate(t));
   const title=labels.sort((a,b)=>a.length-b.length)[0];
   if(id&&title)found=[{url:source.url+'?id='+id,title}];
  }
  for(const x of found)if(H.isCandidate(x.title))out.push({...x,url:canonical(x.url,source.type),published_at});
 }
 // Some boards render lists rather than table rows.
 for(const x of H.links(html,source.url).filter(accept))if(H.isCandidate(x.title)&&!out.some(y=>y.url===canonical(x.url,source.type)))out.push({...x,url:canonical(x.url,source.type),published_at:null});
 return out.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i);
}
function parseNars(html,source,H){
 const text=H.pageText(html),events=[];
 // This board explicitly lists the event date followed by its venue (not a post date).
 const re=/\[(?:세미나|토론회|전문가\s*간담회|간담회|공청회)\]\s*([^\n]+)\s*\n\s*(20\d{2}\.\d{2}\.\d{2})\s*\|?\s*장소\s*:\s*([^\n|]+)/g;
 let matched=0;for(const m of text.matchAll(re)){matched++;const title=H.clean(m[0].split('\n')[0]);if(!H.TOPIC.test(title))continue;const date=H.dateIn(m[2],null);if(date)events.push({id:H.key(source.id+date+title),title,date,end_date:date,time:'',kind:'event',venue:H.clean(m[3]),organizer:source.organizer,speakers:'',source_id:source.id,source_name:source.name,source_url:source.url,evidence:H.clean(m[0]),status:'scheduled'});}
 if(!matched&&!/등록된.{0,10}(없|않)/.test(text))throw Error('EVENT_LIST_CHANGED');return events;
}
function articleText(body,source,H){
 let text=source.type==='kcmi'?H.pageText(body):htmlBlocks(body).map(b=>b.text).join('\n');
 // A neighbouring notice can contain a different event or date.
 return text.split(/(?:^|\n)\s*(?:다음글|이전글|다음\s*글|이전\s*글)(?=\s|[:：|]|$)/)[0];
}
function pageUrls(html,source,H){
 const base=new URL(source.url),out=[];
 for(const x of H.links(html,source.url)){
  const u=new URL(x.url);if(u.origin!==base.origin||u.pathname!==base.pathname||!/^\d{1,2}$/.test(x.title))continue;
  if([...u.searchParams.keys()].some(k=>/^(page|pageIndex|pageNo|curPage|nPage)$/i.test(k))&&u.href!==base.href)out.push(u.href);
 }
 // Classic ASP board pagination submits this same public page parameter.
 if(source.type==='growth')for(let page=2;page<=(source.pages||1);page++){const u=new URL(source.url);u.searchParams.set('page',page);out.push(u.href);}
 return [...new Set(out)].slice(0,2);
}
async function mapLimit(items,n,fn){let index=0;const result=new Array(items.length);await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(index<items.length){const i=index++;result[i]=await fn(items[i],i);}}));return result;}
async function collect(source,reader,deadline,previous,H){
 if(source.type==='institution')return require('./reporting-calendar-institutions').collect(source,reader,deadline,previous,H);
 const events=[],pending=[],stats={pages:0,candidates:0,processed:0,dated:0,unresolved:0,failed:0,remaining:0,checks:{...(previous?.checks||{})}};
 async function get(url){const r=await reader.boundedFetch(url,{deadline,maxBytes:2000000});return /euc-kr|ks_c|cp949/i.test(r.contentType+r.buffer.subarray(0,1500).toString())?require('iconv-lite').decode(r.buffer,'cp949'):r.buffer.toString('utf8');}
 const done=()=>({events,pending,stats:{...stats,dated:events.length,unresolved:pending.length}});
 if(source.type==='fsc'){events.push(...H.parseFsc(await get(source.url),source));stats.pages=1;return done();}
 let candidates=[],html='';
 if(source.query){
  const url='https://news.google.com/rss/search?'+new URLSearchParams({q:source.query,hl:'ko',gl:'KR',ceid:'KR:ko'});
  const rss=parseGoogleNewsRss(await get(url),'calendar','ko');stats.pages=1;
  candidates=rss.filter(x=>source.id==='policy'?/금융위|금감원|금융당국/.test(x.title)&&/주간|주요\s*일정|보도계획/.test(x.title):H.isCandidate(x.title)&&(source.id!=='assembly'||H.TOPIC.test(x.title))).map(x=>({...x,url:x.source_url}));
 }else{
  html=await get(source.url);stats.pages=1;
  if(source.type==='nars'){events.push(...parseNars(html,source,H));return done();}
  if(source.type==='kcmi'){
   candidates=[...new Set([...html.matchAll(/seminar_program\?eno=\d+/g)].map(m=>new URL(m[0],'https://www.kcmi.re.kr/seminar/').href))].slice(0,5).map(url=>({url,title:''}));
   if(!candidates.length)throw Error('EVENT_LIST_CHANGED');
  }else{
   candidates=boardCandidates(html,source,H);
   const pages=await Promise.allSettled(pageUrls(html,source,H).map(get));
   for(const page of pages){if(page.status==='fulfilled'){stats.pages++;candidates.push(...boardCandidates(page.value,source,H));}else stats.failed++;}
   if(!/<(?:tr|li)\b/i.test(html)||/Access Denied|Just a moment|잘못된 접근입니다/i.test(html))throw Error('EVENT_LIST_CHANGED');
  }
 }
 candidates=candidates.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).filter(x=>!x.published_at||Date.parse(x.published_at)>=Date.now()-180*DAY);
 stats.candidates=candidates.length;
 // Revisit upcoming notices daily; rotate the rest so an old post with a future event is not permanently capped out.
 candidates.sort((a,b)=>{
  const score=x=>{const d=H.dateIn(x.title,x.published_at);return (d&&d>=H.kstDay()?3:0)+(!stats.checks[x.url]?2:Date.now()-Date.parse(stats.checks[x.url])>DAY?1:0);};
  return score(b)-score(a)||(stats.checks[a.url]||'').localeCompare(stats.checks[b.url]||'');
 });
 const selected=candidates.slice(0,source.limit||(source.query?6:12));stats.remaining=Math.max(0,candidates.length-selected.length);stats.processed_urls=selected.map(x=>x.url);
 await mapLimit(selected,4,async x=>{
  const meta={...x,source_id:source.id,source_name:source.name};let body='',text='',event=null,reason='DATE_UNCONFIRMED';stats.processed++;
  try{
   if(Date.now()>deadline-500)throw Error('SOURCE_TIMEOUT');
   if(source.query){
    const doc=await reader.read(meta,deadline);if(!doc.read_ok)throw Error(doc.read_error||'ARTICLE_UNAVAILABLE');
    meta.url=doc.url;meta.published_at=doc.published_at||meta.published_at;text=doc.text;
    if(source.id==='policy'){events.push(...H.parseWeekly(text,meta));stats.checks[x.url]=new Date().toISOString();return;}
   }else{
    body=await get(x.url);text=articleText(body,source,H);
    meta.title=meta.title||H.clean(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).split('|')[0].trim();
    meta.published_at=meta.published_at||text.match(/(?:작성일(?:자)?|등록일|게시일)\s*[:：|]?\s*(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})/)?.[1];
   }
   event=H.makeEvent(meta,text);
   if(!event&&body){
    const attachments=readLinks(body,x.url).concat(H.links(body,x.url).filter(l=>/down_file\.asp/i.test(l.url)).map(l=>({...l,parent_url:x.url}))).filter(l=>/\.pdf|\.hwpx/i.test(l.title+' '+l.url)).slice(0,2);
    for(const a of attachments){const doc=await reader.read({...a,found_by:'official_attachment'},deadline);if(doc.read_ok){event=H.makeEvent(meta,doc.text);if(event){event.attachment_url=a.url;break;}}else reason=doc.read_error||reason;}
   }
   stats.checks[x.url]=new Date().toISOString();
   if(event){
    event.organizer=event.organizer||source.organizer||'';
    event.access_note=text.split(/\n/).find(l=>/비회원사는 참가할 수 없습니다|초청자.{0,10}한정|현장등록 불가/.test(l))?.slice(0,240)||'';
    if(source.type==='kcmi'){event.speakers=H.clean(text.match(/\[토론자\]([\s\S]{0,650}?)(?:목록으로|NEWS LETTER)/)?.[1]).slice(0,300);event.venue=event.venue||H.clean(text.match(/(?:여의도\s*)?(?:서울\s*)?[가-힣A-Za-z]+호텔[^\n]{0,40}(?:룸|홀)/)?.[0]);}
    const registration=H.links(body,x.url).concat(source.type==='kcmi'?H.links(html,source.url):[]).find(l=>/^(참가신청(?: 하기)?|참가 신청|신청하기|사전등록|참여링크)$/.test(l.title)||/^https:\/\/event-us\.kr\//.test(l.url));
    if(registration)event.registration_url=registration.url;
    events.push(event);return;
   }
  }catch(e){stats.failed++;reason=String(e.message||'DETAIL_UNAVAILABLE').slice(0,80);}
  // Keep recent undated candidates visible, rather than silently claiming collection succeeded.
  if(source.id!=='policy'&&!/개최했다|개최하였다|성황리에|성료/.test(text)&&meta.title&&(!meta.published_at||Date.parse(meta.published_at)>=Date.now()-90*DAY))pending.push({id:H.key(x.url),title:meta.title,source_url:meta.url,source_id:source.id,source_name:source.name,published_at:meta.published_at||null,checked_at:new Date().toISOString(),reason});
 });
 const candidateUrls=new Set(candidates.map(x=>x.url));stats.checks=Object.fromEntries(Object.entries(stats.checks).filter(([url])=>candidateUrls.has(url)).slice(0,200));
 return done();
}
module.exports={SOURCES,collect,boardCandidates,parseNars,pageUrls,articleText};
