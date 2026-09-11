'use strict';
const {attrs,decode,element,htmlBlocks,readLinks,createReader,safeUrl}=require('./public-document-reader');
const INSTITUTIONS=[
 {id:'fsc-releases',name:'금융위 정책 발표',url:'https://www.fsc.go.kr/no010101',category:'regulator',boards:['https://www.fsc.go.kr/no010101'],press:true},
 {id:'fss-releases',name:'금감원 벤처·사모 감독 발표',url:'https://www.fss.or.kr/fss/main/main.do',category:'regulator'},
 {id:'mss-releases',name:'중기부 벤처투자 정책',url:'https://www.mss.go.kr/site/smba/main.do',category:'regulator'},
 {id:'mohw-fund',name:'복지부 국민연금 기금운용위원회',url:'https://www.mohw.go.kr/',category:'regulator',scope:/국민연금|기금운용|수탁자책임|자산배분/},
 {id:'lp-apfs',name:'농업정책보험금융원',url:'https://www.apfs.kr/front/user/main.do',category:'lp'},
 {id:'lp-nps',name:'국민연금 기금운용본부',url:'https://fund.nps.or.kr/main.do',category:'lp'},
 {id:'lp-cw',name:'건설근로자공제회',url:'https://www.cw.or.kr/index.do',category:'lp'},
 {id:'lp-kic',name:'한국투자공사',url:'https://www.kic.kr/',category:'lp'},
 {id:'lp-ktcu',name:'한국교직원공제회',url:'https://www.ktcu.or.kr/index',category:'lp'},
 {id:'lp-poba',name:'대한지방행정공제회',url:'https://www.poba.or.kr/',category:'lp'},
 {id:'lp-geps',name:'공무원연금공단',url:'https://www.geps.or.kr/index',category:'lp'},
 {id:'lp-tp',name:'사학연금',url:'https://www.tp.or.kr/',category:'lp'},
 {id:'lp-mmaa',name:'군인공제회',url:'https://www.mmaa.or.kr/',category:'lp'},
 {id:'lp-sema',name:'과학기술인공제회',url:'https://www.sema.or.kr/',category:'lp'},
 {id:'lp-pmaa',name:'경찰공제회',url:'https://www.pmaa.or.kr/',category:'lp'},
 {id:'lp-koreapost',name:'우정사업본부',url:'https://www.koreapost.go.kr/',category:'lp'},
 {id:'lp-kbiz',name:'중소기업중앙회·노란우산',url:'https://www.kbiz.or.kr/',category:'lp'}
].map(x=>({...x,type:'institution'}));
const INVESTMENT=/벤처|사모(?:펀드|투자|주식|채권|집합투자)|대체투자|모태펀드|농식품.{0,12}(?:투자|펀드)|자본시장|기업금융|구조조정|기업지배|인수.?합병|\bPEF\b|\bVC\b|크레딧|기금운용|자산운용|자산배분|운용(?:계획|전략|성과|수익)|수익률|투자(?:전략|정책|계획|성과|로드쇼)|수탁자책임|스튜어드십|국민(?:참여)?성장펀드|생산적 금융|모험자본|토큰증권|증권|금융투자|PF|IPO|비상장/i;
const ACTION=/발표|브리핑|정책|제도|개선|개정|시행|도입|의결|확정|허용|인가|규제|규정|운용계획|투자계획|자산배분|운용전략|운용성과|수익률|기금운용위원회|위원회.{0,10}결과|투자.{0,12}(확대|전환)|출범|조성|판매/;
const ROUTINE=/위탁운용사.{0,20}선정|선정.{0,15}(?:공고|결과|계획)|접수(?:현황|결과|마감)|입찰|채용|교육생|양성과정|공모전|임직원.{0,10}채용|제안서.{0,10}마감|쉼터버스|퇴직공제금|부정수급|재해보험|손해평가|사회공헌|기부|복지행사/;
const clean=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function relevant(title,source){return (source.scope||INVESTMENT).test(title);}
function candidate(title,source,H){if(!relevant(title,source)||/특별기고|칼럼|성황리|성료/.test(title))return false;return H.isCandidate(title)||(!ROUTINE.test(title)&&ACTION.test(title));}
function indexLinks(html,base){
 const out=[];for(const m of html.matchAll(/<(?:a|button)\b[^>]*>[\s\S]*?<\/(?:a|button)>/gi)){
  const a=attrs(m[0]),title=clean(m[0]),action=a.onclick||(/^javascript:/i.test(a.href||'')?a.href:'');
  const hrefs=[a.href,a['data-url'],...(action.match(/["']((?:https?:\/\/|\/)[^"']+)["']/g)||[]).map(x=>x.slice(1,-1))].filter(Boolean);
  for(const href of hrefs){if(/^javascript:|^#/.test(href))continue;try{const url=safeUrl(new URL(href,base).href);if(url&&new URL(url).hostname===new URL(base).hostname)out.push({url,title,action});}catch(_){}}
 }
 return out.filter((x,i,a)=>a.findIndex(y=>y.url===x.url&&y.title===x.title)===i);
}
function boardLinks(html,base){return indexLinks(html,base).filter(x=>/^(?:공지사항|보도자료|보도·참고자료|보도참고자료|뉴스|공고·공지|기금공시|기금운용위원회 회의결과|홍보센터|채용·행사|농림수산식품모태펀드|알림사항|새소식|소식|공제회 소식)(?:\s*(?:더보기|바로가기))?$/.test(x.title)).slice(0,6);}
function items(html,base,source,H){
 const out=[],rows=[...html.matchAll(/<(tr|li)\b[^>]*>[\s\S]*?<\/\1>/gi)].map(m=>m[0]);
 for(const row of rows){const text=clean(row),rawDate=text.match(/20\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}/)?.[0];const published_at=H.dateIn(rawDate||'',null);
  for(const link of indexLinks(row,base)){const title=link.title.replace(/(?:\[?20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\]?|조회수\s*\d+)\s*$/,'').trim();if(candidate(title,source,H)&&!/\.(?:pdf|hwpx?|zip)$/i.test(title)&&!/(?:download|fileDown|down_file|comm\/getFile|\.pdf|\.hwpx?)/i.test(link.url)&&title.length<260)out.push({...link,title,published_at});}
 }
 return out.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i);
}
function announcement(meta,text,source,H){
 if(!relevant(meta.title,source)||ROUTINE.test(meta.title)||!ACTION.test(meta.title))return null;
 // A release's posted date is labelled as publication, never substituted for a future event date.
 const explicit=text.match(/(?:보도\s*시점|보도\s*일시|발표\s*일시|발표\s*일)\s*[:：|]?\s*([^\n]{0,120})/);
 const scheduled=explicit&&H.dateIn(explicit[1],meta.published_at),published=H.dateIn(meta.published_at||'',null);
 const date=scheduled||published;if(!date)return null;
 return {id:H.key(meta.url),title:meta.title,date,end_date:date,time:scheduled?H.timeIn(explicit[1]):'',kind:'announcement',status:scheduled&&date>=H.kstDay()?'scheduled':'published',date_basis:scheduled?'announced':'publication',venue:'',organizer:source.name,speakers:'',source_url:meta.url,source_id:source.id,source_name:source.name,evidence:scheduled?clean(explicit[0]):'공식 발표자료 게시일 '+published};
}
async function get(reader,url,deadline){const r=await reader.boundedFetch(url,{deadline,maxBytes:2000000});return /euc-kr|ks_c|cp949/i.test(r.contentType+r.buffer.subarray(0,2000).toString())?require('iconv-lite').decode(r.buffer,'cp949'):r.buffer.toString('utf8');}
async function inspect(ids){return Promise.all(ids.slice(0,5).map(async id=>{
 const source=INSTITUTIONS.find(x=>x.id===id);if(!source)return {id,error:'UNKNOWN_SOURCE'};
 try{const html=await get(createReader(),source.url,Date.now()+10000);return {id,url:source.url,links:boardLinks(html,source.url),actions:[...html.matchAll(/<(?:a|button)\b[^>]*>[\s\S]*?<\/(?:a|button)>/gi)].map(m=>({title:clean(m[0]),action:attrs(m[0]).onclick||attrs(m[0]).href||''})).filter(x=>/보도|공지|기금|뉴스|알림|자산|설명회|로드쇼|언론/.test(x.title)).slice(0,35),routes:[...new Set([...html.matchAll(/["']((?:\/[\w.-]+)+\.(?:do|jsp|asp)(?:\?[^"'<> ]*)?)["']/g)].map(m=>m[1]))].filter(u=>!/login|Login|auth|Auth/.test(u)).slice(0,35)};}catch(e){return {id,error:e.message};}
 }));}
async function collect(source,reader,deadline,previous,H){
 const events=[],pending=[],stats={pages:0,candidates:0,processed:0,dated:0,unresolved:0,failed:0,remaining:0,checks:{...(previous?.checks||{})},boards:[]};
 const home=await get(reader,source.url,deadline);stats.pages++;
 const boards=source.boards?.length?source.boards.map(url=>({url,title:'보도자료'})):boardLinks(home,source.url);
 stats.boards=boards.map(x=>({url:x.url,title:x.title}));let found=items(home,source.url,source,H);
 const pages=await Promise.allSettled(boards.filter(x=>x.url!==source.url).map(async x=>({html:await get(reader,x.url,deadline),url:x.url})));
 for(const p of pages)if(p.status==='fulfilled'){stats.pages++;found.push(...items(p.value.html,p.value.url,source,H));}else stats.failed++;
 if(!boards.length&&!found.length)throw Error('OFFICIAL_BOARD_NOT_LOCATED');
 found=found.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).filter(x=>!x.published_at||Date.parse(x.published_at)>=Date.now()-180*86400000);
 stats.candidates=found.length;found.sort((a,b)=>(stats.checks[a.url]||'').localeCompare(stats.checks[b.url]||''));
 const chosen=found.slice(0,16);stats.remaining=found.length-chosen.length;stats.processed_urls=chosen.map(x=>x.url);
 let cursor=0;await Promise.all(Array.from({length:Math.min(3,chosen.length)},async()=>{while(cursor<chosen.length){const x=chosen[cursor++];stats.processed++;const meta={...x,source_id:source.id,source_name:source.name};let reason='DATE_UNCONFIRMED';
  try{const body=await get(reader,x.url,deadline),text=htmlBlocks(body).map(b=>b.text).join('\n').split(/(?:^|\n)\s*(?:이전글|다음글)/)[0];meta.published_at=meta.published_at||text.match(/(?:등록일|작성일|게시일|일자)\s*[:：|]?\s*(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})/)?.[1];
   let e=H.makeEvent(meta,text);if(!e)e=announcement(meta,text,source,H);
   if(!e)for(const a of readLinks(body,x.url).filter(a=>/pdf|hwpx/i.test(a.title+' '+a.url)).slice(0,2)){const d=await reader.read({...a,found_by:'official_attachment'},deadline);if(d.read_ok){e=H.makeEvent(meta,d.text)||announcement(meta,d.text,source,H);if(e){e.attachment_url=a.url;break;}}else reason=d.read_error||reason;}
   stats.checks[x.url]=new Date().toISOString();if(e){events.push(e);continue;}
  }catch(e){stats.failed++;reason=e.message;}
  if(H.isCandidate(x.title))pending.push({id:H.key(x.url),title:x.title,source_url:x.url,source_id:source.id,source_name:source.name,published_at:x.published_at,checked_at:new Date().toISOString(),reason});
 }}));
 stats.dated=events.length;stats.unresolved=pending.length;stats.checks=Object.fromEntries(Object.entries(stats.checks).slice(-120));return {events,pending,stats};
}
module.exports={INSTITUTIONS,INVESTMENT,ACTION,candidate,items,boardLinks,indexLinks,announcement,collect,inspect};
