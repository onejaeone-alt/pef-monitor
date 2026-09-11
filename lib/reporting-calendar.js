'use strict';
const crypto = require('node:crypto');
const {createReader, decode, attrs, htmlBlocks, element} = require('./public-document-reader');
const {parseGoogleNewsRss} = require('./context-sources');
const DAY=86400000, TTL=30*60000, VERSION=6;
const TOPIC=/자본시장|사모(?:펀드|투자|집합투자)|벤처|대체투자|기업(?:금융|구조|지배|가치|회생)|구조조정|회생절차|상법|인수.?합병|M&A|\bPEF\b|\bVC\b|private market|private equity|크레딧|국민성장펀드|생산적 금융|모험자본|금융투자|투자은행|상장제도|증권|스튜어드십|공시제도|밸류업|핀테크|토큰증권|PF|부동산금융/i;
const EVENT=/컨퍼런스|콘퍼런스|세미나|포럼|토론회|공청회|간담회|설명회|발표회|서밋|summit|conference|교류회|네트워킹|투자\s*위크|핀테크\s*위크|엑스포|박람회|밋업|meetup|데모\s*데이|demo\s*day|딜\s*데이|IR(?:\b|행사|데이)|MUST\s*Round|Super\s*Return|워크숍/i;
// An actual explanation session remains eligible even when its subject is an LP mandate.
const EXCLUDE=/채용|교육생|양성과정|교육과정|참관단|포상|공모전/;
const SOURCES=require('./reporting-calendar-sources').SOURCES;
const ROUTINE=/출자사업|위탁운용사|선정\s*결과|접수.{0,8}마감|입찰|청약/;
function isCandidate(title){return !EXCLUDE.test(title)&&!/성황리|성료|개최\s*결과/.test(title)&&EVENT.test(title);}
const clean=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const key=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,20);
const kstDay=(now=Date.now())=>new Date(Number(now)+9*3600000).toISOString().slice(0,10);
function validDate(y,m,d){const s=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return /^20\d{2}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;}
function normalizeDates(s){return String(s||'').replace(/(?<!\d)([23]\d)\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})(?!\d)/g,'20$1.$2.$3').replace(/[’‘'ʼ](\d{2})(?=\s*[년.\/\-])/g,'20$1').replace(/(\d{1,2})\.(?=\s*\([월화수목금토일]\))/g,'$1');}
function dateIn(s,reference){
 const m=normalizeDates(s).match(/(?:(20\d{2})\s*[년.\-/]\s*)?(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?/);
 if(!m)return null;const ref=new Date(reference);if(!m[1]&&(!/^20\d{2}[-/.]/.test(String(reference||''))||Number.isNaN(+ref)))return null;
 let y=+(m[1]||ref.getUTCFullYear());if(!m[1]&&ref.getUTCMonth()===11&&+m[2]===1)y++;
 return validDate(y,+m[2],+m[3]);
}
function structuredText(text){return String(text||'').replace(/\(\s*(일\s*시|장\s*소|주\s*최|주\s*관|참\s*석(?:자)?)\s*\)\s*[:：]?\s*/g,'\n$1: ');}
function eventDate(text,reference){
 const lines=normalizeDates(structuredText(text)).split(/\n/);
 for(let i=0;i<lines.length;i++){
  const l=lines[i],label=/(?:일\s*시|행사\s*(?:일|기간)|개최\s*(?:일|기간)|발표\s*일)\s*[:：|]/.exec(l);
  if(!label||/(접수|신청|등록|제출)\s*(일시|기간)/.test(l.slice(0,label.index+label[0].length)))continue;
  const value=l.slice(label.index+label[0].length), evidence=value+' '+(lines[i+1]||'');
  const date=dateIn(evidence,reference);if(date)return {date,evidence:clean(evidence).slice(0,240)};
 }
 for(let i=0;i<lines.length;i++){
  // Permit wrapped prose, but never use a neighbouring notice or an application deadline.
  const l=lines[i]+' '+(lines[i+1]||'');
  if(l.length>1400||!EVENT.test(l)||!/개최(?:할|될|한다|하며|하오니|합니다|되는|된다|하고자|할 예정| 예정)|열(?:릴|리는|린다| 예정)/.test(l))continue;
  const m=l.match(/(?:오는\s*)?(?:(20\d{2})\s*[년.]\s*)?(\d{1,2})\s*[월.]\s*(\d{1,2})\s*일?/);
  if(!m||/(접수|신청|등록|제출|모집).{0,12}$/.test(l.slice(0,m.index))||/^\s*(?:에\s*)?(?:따르면|밝혔|발표했)/.test(l.slice(m.index+m[0].length)))continue;
  const date=dateIn(m[0],reference);if(date)return {date,evidence:clean(l).slice(Math.max(0,m.index-20),m.index+240)};
 }
 return null;
}
function field(text,label){return clean((structuredText(text).match(new RegExp('(?:^|\\n)\\s*[□■○ㅇㆍ•*✅\\-]?\\s*(?:'+label+')\\s*[:：|]\\s*([^\\n]+)'))||[])[1]).slice(0,180);}
function timeIn(s){const m=s.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*[~～–\-]\s*([01]?\d|2[0-3]):([0-5]\d))?/);if(m&&!(m[1]==='00'&&m[2]==='00'))return `${m[1].padStart(2,'0')}:${m[2]}`+(m[3]?`–${m[3].padStart(2,'0')}:${m[4]}`:'');const k=s.match(/(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);return k&&+k[2]<=12?`${String(+k[2]%12+(k[1]==='오후'?12:0)).padStart(2,'0')}:${String(k[3]||0).padStart(2,'0')}`:'';}
function endDate(evidence,start){const s=normalizeDates(evidence).replace(/\([월화수목금토일]\)/g,'');const m=s.match(/\d{1,2}\s*[월/.]\s*\d{1,2}일?\s*(?:[~～–\-]|부터)\s*(?:(\d{1,2})\s*[월/.]\s*)?(\d{1,2})일?/);if(!m)return start;const month=+(m[1]||start.slice(5,7));const year=+start.slice(0,4)+(month<+start.slice(5,7)?1:0);const end=validDate(year,month,+m[2]);return end&&end>=start&&Date.parse(end)-Date.parse(start)<=14*DAY?end:start;}
function makeEvent(meta,text,extra={}){
 if(EXCLUDE.test(meta.title)||(meta.source_id!=='kcmi'&&!isCandidate(meta.title)))return null;
 const titleReference=meta.title.match(/20\d{2}/)?.[0];const reference=meta.published_at||(titleReference?titleReference+'-01-01':null);let when=eventDate(text,reference);
 if(!when&&meta.source_id==='kvca'&&/개최|참가\s*안내/.test(meta.title)&&!/모집|마감|신청기한/.test(meta.title)){
  const parenthetical=meta.title.match(/[(（]([^()]*\d{1,2}[월/.]\s*\d{1,2}[^()]*)[)）]/)?.[1];
  const date=/^\s*[~～]/.test(parenthetical||'')?null:dateIn(parenthetical||'',reference);if(date)when={date,evidence:meta.title};
 }
 if(!when)return null;
 const titleYear=meta.title.match(/\b(20\d{2})(?:년|년도|\b)/)?.[1];
 if(titleYear&&titleYear!==when.date.slice(0,4))return null;
 const proseVenue=when.evidence.match(/(?:서울|부산|인천|대전|여의도|양재)[^,\n]{0,65}?(?:센터|호텔|회의실|전시장|홀|회관|청사|BEXCO)(?:\s*\([^)]*\))?(?=에서)/)?.[0];
 return {id:key(meta.url),title:meta.title.slice(0,200),date:when.date,end_date:endDate(when.evidence,when.date),time:timeIn(when.evidence),kind:'event',venue:field(text,'장\\s*소|지\\s*역')||proseVenue||'',organizer:field(text,'주\\s*최(?:·주관)?|주\\s*관'),speakers:field(text,'연사|발표자|토론자|참\\s*석\\s*자'),source_url:meta.url,source_name:meta.source_name,source_id:meta.source_id,evidence:when.evidence,status:/취소/.test(meta.title)?'cancelled':/연기/.test(meta.title)?'postponed':'scheduled',...extra};
}
function parseFsc(html,source){const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)],events=[];let matched=0;
 for(const row of rows){const cols=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>clean(m[1]));const at=cols.findIndex(c=>/^20\d{2}-\d{2}-\d{2}$/.test(c));if(at<0)continue;matched++;const date=cols[at],title=cols[at+2]||'';if(!TOPIC.test(title)||/주간업무|국무회의/.test(title)||(ROUTINE.test(title)&&!EVENT.test(title)))continue;const venue=title.match(/\(([^()]+)\)\s*$/)?.[1]||'';events.push({id:key(source.id+date+title),title:title.replace(/\s*\([^()]+\)\s*$/,''),date,time:timeIn(cols[at+1]||''),venue,organizer:'금융위원회',speakers:source.id==='fsc-chair'?'금융위원장':'금융위 부위원장',kind:EVENT.test(title)||/현장|방문/.test(title)?'event':'announcement',source_id:source.id,source_name:source.name,source_url:source.url,evidence:clean(cols.slice(at).join(' · ')).slice(0,160),status:'scheduled'});}
 if(!matched)throw Error('SCHEDULE_FORMAT_CHANGED');return events;}
function parseWeekly(text,meta){const out=[];let date=null;for(const line of text.split(/\n/)){const s=clean(line);if(/^[◇◆■□▶▷○*\-\s]*(?:\d{1,2}월\s*)?\d{1,2}일\s*[（(][월화수목금토일]/.test(s)){date=dateIn(s,meta.published_at);if(!date){const d=s.match(/(\d{1,2})일/);const ref=new Date(meta.published_at);if(d&&!Number.isNaN(+ref))date=validDate(ref.getUTCFullYear(),ref.getUTCMonth()+1,+d[1]);}continue;}if(!date||!TOPIC.test(s)||EXCLUDE.test(s)||(ROUTINE.test(s)&&!EVENT.test(s))||s.length>350||!/^[◇◆■□▶▷○ㅇ△▲*\-]|보도|발표|브리핑|간담회/.test(s))continue;
 const title=s.replace(/^[◇◆■□▶▷○ㅇ△▲*\-\s]+/,'');out.push({id:key(meta.url+date+title),title,date,time:timeIn(s),kind:EVENT.test(s)?'event':'announcement',venue:'',organizer:'',speakers:'',source_id:meta.source_id,source_name:meta.source_name,source_url:meta.url,evidence:s.slice(0,160),status:'scheduled'});}return out;}
function eventIdentity(e){
 const named=[...(e.evidence||'').matchAll(/[「｢『“'"]([^「｢『“'"」｣』”]{6,100})[」｣』”'"]/g)].map(m=>m[1]).find(x=>EVENT.test(x));
 return (named||e.title).replace(/\s|[「」『』“”]/g,'');
}
function mergeEvents(previous,fresh,now=Date.now()){const map=new Map(previous.map(e=>[e.id,e]));for(const e of fresh){const old=map.get(e.id);const changed=old&&['date','time','venue','status'].some(k=>old[k]!==e[k]);map.set(e.id,{...e,checked_at:new Date(now).toISOString(),...(changed?{changed_at:new Date(now).toISOString(),previous_date:old.date}:old?.changed_at?{changed_at:old.changed_at,previous_date:old.previous_date}:{})});}
 const seen=new Set();return [...map.values()].filter(e=>(e.end_date||e.date)>=kstDay(now-7*DAY)&&e.date<=kstDay(now+180*DAY)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).filter(e=>{const k=e.date+eventIdentity(e);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,300);}
function pageText(html){const main=element(html,t=>t==='main')||html;return main.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<\/(?:p|div|li|tr|h[1-6]|section)>|<br\s*\/?\s*>/gi,'\n').split(/\n+/).map(clean).filter(Boolean).join('\n');}
function links(html,base){return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].flatMap(m=>{const a=attrs(m[0]);try{const u=new URL(a.href,base);if(!/^https?:$/.test(u.protocol)||u.username||u.password)return [];return [{url:u.href,title:clean(m[0])}];}catch(_){return [];}});}
async function collect(source,reader,deadline,previous){return require('./reporting-calendar-sources').collect(source,reader,deadline,previous,{pageText,links,clean,key,kstDay,dateIn,makeEvent,parseFsc,parseWeekly,isCandidate,TOPIC});}
async function cacheRequest(method,payload){const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!secret)throw Error('CACHE_UNAVAILABLE');const headers={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),Prefer:'resolution=merge-duplicates'};const r=await fetch(base+'/rest/v1/reporting_calendar_cache'+(method==='GET'?'?cache_key=eq.ib_events&select=payload':'?on_conflict=cache_key'),{method,headers,signal:AbortSignal.timeout(4000),...(payload?{body:JSON.stringify({cache_key:'ib_events',payload,updated_at:payload.updated_at})}:{})});if(!r.ok)throw Error('CACHE_UNAVAILABLE');return method==='GET'?(await r.json())[0]?.payload:null;}
let memory=null,inflight=null;
async function getCalendar(){
 if(memory?.version===VERSION&&Date.now()-Date.parse(memory.updated_at)<TTL)return memory;
 if(inflight)return inflight;
 inflight=(async()=>{
  let old=memory;try{const stored=await cacheRequest('GET');if(stored&&(!old||stored.updated_at>old.updated_at))old=stored;}catch(_){}
  if(old?.version===VERSION&&Date.now()-Date.parse(old.updated_at)<TTL)return memory=old;
  const reader=createReader(),deadline=Date.now()+38000;
  const results=await Promise.allSettled(SOURCES.map(s=>collect(s,reader,deadline,old?.sources?.find(x=>x.id===s.id))));
  const now=Date.now(),fresh=[],pending=[];
  const sources=results.map((r,i)=>{
   const s=SOURCES[i],prev=old?.sources?.find(x=>x.id===s.id);
   if(r.status==='fulfilled'){fresh.push(...r.value.events);pending.push(...r.value.pending,...(old?.version===VERSION?old.pending||[]:[]).filter(x=>x.source_id===s.id&&!r.value.stats.processed_urls?.includes(x.source_url)&&Date.parse(x.checked_at||0)>now-7*DAY));}
   else pending.push(...(old?.pending||[]).filter(x=>x.source_id===s.id));
   return {id:s.id,name:s.name,url:s.url||'https://news.google.com/search?q='+encodeURIComponent(s.query),ok:r.status==='fulfilled',error:r.status==='rejected'?String(r.reason?.message||'SOURCE_UNAVAILABLE').slice(0,80):null,count:r.status==='fulfilled'?r.value.events.length:0,...(r.status==='fulfilled'?r.value.stats:{checks:prev?.checks||{},cursor:prev?.cursor||0}),checked_at:new Date(now).toISOString(),last_success_at:r.status==='fulfilled'?new Date(now).toISOString():prev?.last_success_at||null};
  });
  const events=mergeEvents(old?.events||[],fresh,now),dated=new Set(events.map(e=>e.source_url));
  const payload={version:VERSION,events,pending:pending.filter((e,i,a)=>!dated.has(e.source_url)&&a.findIndex(x=>x.source_url===e.source_url)===i).slice(0,100),sources,updated_at:new Date(now).toISOString(),persistent:true};
  try{await cacheRequest('POST',payload);}catch(_){payload.persistent=false;}return memory=payload;
 })();try{return await inflight;}finally{inflight=null;}
}
async function handle(req,res){try{const payload=await getCalendar();res.setHeader('Cache-Control','public, max-age=60, s-maxage=120');return res.status(200).json({ok:true,...payload,sources:payload.sources.map(({checks,processed_urls,...s})=>s),today:kstDay()});}catch(_){return res.status(503).json({ok:false,error:'일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'});}}
module.exports={handle,getCalendar,pageText,endDate,kstDay,validDate,dateIn,eventDate,makeEvent,parseFsc,parseWeekly,mergeEvents,TOPIC,EXCLUDE,EVENT,isCandidate,eventIdentity,SOURCES};
