(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./news-reader-core'));else root.IBDiscovery=factory(root.NewsReaderCore);})(typeof globalThis!=='undefined'?globalThis:this,function(News){
'use strict';
const VERSION='dart-review-1.7',DAY=86400000;
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const unique=a=>[...new Set(a.filter(Boolean))];
const date=v=>/^\d{8}$/.test(String(v))?String(v).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):/T/.test(String(v))&&Number.isFinite(Date.parse(v))?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,10):String(v||'').slice(0,10);
const today=(now=Date.now())=>new Date(now+9*3600000).toISOString().slice(0,10);
const age=(v,now)=> (Date.parse(today(now))-Date.parse(date(v)))/DAY;
const recent=(v,now,days=7)=>age(v,now)>=0&&age(v,now)<days;
function hash(v){let h=2166136261;for(const c of String(v)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function safeUrl(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch(_){return '';}}
function sources(rows){const seen=new Set();return (rows||[]).filter(s=>{const u=safeUrl(s.url);if(!u||seen.has(u))return false;seen.add(u);return true;});}
function validReview(item,r){return r?.ok&&r.version===VERSION&&r.rcept_no===item.rcept_no;}
function dartCandidates(items,now=Date.now()){
 return (items||[]).filter(x=>/^\d{14}$/.test(x.rcept_no)&&recent(x.rcept_dt,now)&&!['periodic','ownership_report','routine_security','liquidation'].includes(x.event_id)&&
  (/공개매수|타법인.*(?:취득|처분)|유형자산.*처분|최대주주변경|합병|영업양수도|회생|파산/.test(x.report_nm)||x.scope_kind==='watch'&&/유상증자|전환사채|교환사채|차입|담보|보증/.test(x.report_nm)))
 .sort((a,b)=>Number(b.scope_kind==='watch')-Number(a.scope_kind==='watch')||String(b.rcept_no).localeCompare(String(a.rcept_no)));
}
function fieldText(f){return `${f.label}: ${f.value}${f.unit&&!String(f.value).includes(f.unit)?' '+f.unit:''}`;}
function dartClue(x,r){
 if(!validReview(x,r))return null;
 const fields=(r.current_fields||[]).filter(f=>f.evidence_id&&f.source?.source_id==='dart:'+x.rcept_no);
 const changes=(r.changes||[]).filter(f=>f.evidence_id&&f.source?.source_id==='dart:'+x.rcept_no);
 const money=fields.filter(f=>f.topic==='money'),parties=fields.filter(f=>f.topic==='party');
 const investor=(r.parties||[]).some(p=>parties.some(f=>f.evidence_id===p.evidence_id))||parties.some(f=>/투자합자회사|벤처투자조합|신기술(?:사업)?투자조합|기관전용사모|일반사모(?:부동산|특별자산|집합)?투자/.test(f.value));
 if(x.scope_kind!=='watch'&&!investor&&!/공개매수|최대주주변경|합병|영업양수도/.test(x.report_nm))return null;
 // A filing title or an existing investor relationship alone cannot become a discovery.
 if(!changes.length&&(!parties.length||!money.length&&!/공개매수/.test(x.report_nm)))return null;
 const facts=changes.length?changes.map(f=>`${f.label}: ${f.before} → ${f.after}`):[...money,...parties,...fields.filter(f=>/목적/.test(f.label))].map(fieldText);
 const disposal=/처분|매각/.test(x.report_nm),bid=/공개매수/.test(x.report_nm);
 const question=disposal?'처분금액 가운데 실제 회수한 금액은 얼마이며, 투자원가·잔여 지분과 비교하면 회수 성과는 어떤가?':bid?'공개매수자의 자금 조달은 확약됐나? 기존 주주의 참여 의사와 잔여 지분 처리 계획은 무엇인가?':'거래금액 중 자기자금과 차입금은 각각 얼마이며, 납입·종결의 선행 조건은 무엇인가?';
 return {clue_id:'dart-'+x.rcept_no,detector:'dart_deal',detector_label:changes.length?'공시 조건 변경':'새 거래 확인',fact_status:'단서',sort_date:date(x.rcept_dt),detected_at:date(x.rcept_dt),headline:x.corp_name+' · '+x.report_nm,
  one_line_signal:facts.slice(0,2).join(' · '),changed_fact:facts.slice(0,3).join(' · '),previous_state:changes.length?'같은 공시의 정정표와 대조':'이전 거래 조건과는 아직 비교하지 않았습니다.',
  reason:changes.length?'원문 정정표에서 조건 차이를 추출했습니다.':'원문에서 거래 조건을 추출했습니다. 자금 조달이나 회수 성과를 확인할 근거입니다.',
  confirmed_facts:[],extracted_facts:facts,reported:[],unknowns:[question],questions:[question,...(r.questions||[]).map(q=>q.question).slice(0,2)],contacts:unique([x.corp_name,...parties.map(f=>f.value)]).slice(0,5),
  next_action:x.corp_name+' 공시 담당자에게 '+(disposal?'실제 회수액과 투자원가':'자금 확약과 거래 종결 조건')+' 확인',entities:[x.corp_name],
  sources:[{label:'DART 원문 · 자동 추출 검수 전',url:r.url||'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+x.rcept_no,date:date(x.rcept_dt)}],
  evidence:[...changes,...fields],dart_review_receipts:[x.rcept_no],background_relationships:x.reporting_context?.relationships||[],stage:'발견',lane:'current'};
}
const QUESTIONS={risk:'거래 중단이나 자금 차질이 계약 당사자의 손실·상환 일정에 어떤 영향을 주나?',bid:'바뀐 가격·조건에 대해 원매자와 주요 주주는 어떤 입장인가?',lp:'변경된 요건 때문에 새로 지원할 수 있거나 지원이 어려워진 GP는 어디인가?',dispute:'법적 쟁점이 거래 종결 조건과 일정에 직접 영향을 주나?',fund:'기한·조건 변경에 동의한 LP는 누구이며, 실제 약정액은 목표액과 얼마나 차이 나나?',exclusive:'보도된 거래 단계와 조건을 당사자가 확인하나? 아직 보도되지 않은 자금 조달·회수 조건은 무엇인가?'};
function newsClues(items,now=Date.now(),issues=[]){
 const out=[],seen=new Set();
 const clusters=new Map();for(const issue of issues)for(const row of issue.items||[])clusters.set(row.source_url,issue);
 for(const x of items||[]){
  if(!recent(x.published_at,now)||!safeUrl(x.source_url)||x.source_type==='press_release')continue;
  // Public-property administration and central-bank bond operations are not company deals.
  if(/수목원|국가정원|공원\s*재개장|(?:국채|보유채권).{0,25}매각|\b(?:gilt|treasury bond)\b/i.test(x.title)&&!/사모펀드|PEF|인수금융|운용사|펀드\s*회수/i.test(x.title))continue;
  const official=['capital_call','selection_result'].includes(x.source_type);
  const reasons=News.focusReasons(x,{}).filter(r=>QUESTIONS[r.id]);if(!reasons.length)continue;
  const cluster=clusters.get(x.source_url),key=cluster?'issue:'+cluster.issue_id:norm(x.title);if(seen.has(key))continue;seen.add(key);
  const reason=reasons.find(r=>r.id!=='exclusive')||reasons[0],foreign=x.source_type==='foreign_news',title=x.title_ko||x.title,question=QUESTIONS[reason.id];
  out.push({clue_id:'followup-'+hash(x.source_url),detector:official?'official_followup':'news_followup',detector_label:official?'공고 후속 확인':foreign?'외신 후속취재':'보도 후속취재',fact_status:official?'단서':'보도',sort_date:date(x.published_at),detected_at:date(x.published_at),headline:title,one_line_signal:x.source_name+' · '+reason.label,reason:reason.label+'에 해당하는 표현이 제목에 있습니다. 본문과 당사자 확인이 필요합니다.',confirmed_facts:[],reported:official?[]:[x.source_name+' 보도: '+title],extracted_facts:official?[title]:[],questions:[question],unknowns:[question],contacts:[x.target?.name||x.source_name,'해당 거래·출자 담당자'],entities:unique([x.target?.name,...(x.related_entities||[]).map(e=>e.canonical_name)]),next_action:question,sources:[{label:x.source_name+(foreign&&!x.title_ko?' · 번역 미확보':''),url:x.source_url,date:date(x.published_at)}],news_scope:foreign?'foreign':'domestic',original_title:foreign?x.title:undefined,stage:'발견',lane:'current'});
  const clue=out[out.length-1];if(cluster)clue.related_sources=sources((cluster.items||[]).filter(n=>n.source_url!==x.source_url).map(n=>({label:'유사 보도 · 세부 거래 조건은 원문 대조',title:n.title,url:n.source_url})));
 }
 return out;
}
function calendarClues(events,now=Date.now()){
 return (events||[]).filter(e=>e.status==='scheduled'&&age(e.date,now)<=0&&age(e.date,now)>=-7&&safeUrl(e.source_url)&&e.evidence&&(!/마감|선정결과/.test(e.title)||/설명회|간담회|브리핑|세미나/.test(e.title))).map(e=>{
  const news=e.source_type==='news',question=/PF|사업장/.test(e.title)?'사업장의 정상화를 위해 얼마를 투입했고, 기존 채권자와 펀드는 손익을 어떻게 나누나?':/생산적 금융|자본시장/.test(e.title)?'벤처·사모 투자로 자금을 유도할 구체적인 제도 변경과 적용 시점은 무엇인가?':e.kind==='announcement'?'이번 발표에서 달라지는 투자·출자 요건과 적용 시점은 무엇인가?':'주요 발표자의 투자 대상·회수 계획은 무엇이며, 현장에서 어떤 조건까지 확인할 수 있나?';
  return {clue_id:'schedule-'+e.id,detector:'reporting_opportunity',detector_label:e.kind==='announcement'?'중요 발표 준비':'현장 취재 준비',fact_status:news?'보도':'단서',sort_date:e.date,detected_at:e.date,event_date:e.date,headline:e.title,one_line_signal:[e.date,e.time,e.venue||'장소 미확인'].filter(Boolean).join(' · '),reason:'7일 안에 예정된 '+(e.kind==='announcement'?'발표':'취재 행사')+'입니다.',confirmed_facts:[],extracted_facts:news?[]:[e.evidence],reported:news?[e.evidence]:[],questions:[question],unknowns:unique([!e.time&&'시각',!e.venue&&e.kind==='event'&&'장소','참석·취재 가능 여부']),contacts:unique([e.organizer,e.speakers,e.source_name]),entities:unique([e.organizer,e.source_name]),next_action:e.kind==='announcement'?'담당 부서에 발표자료 공개 시각과 질의 창구 확인':'주최 측에 취재 등록·장소를 확인하고 발표자 질문 준비',sources:[{label:e.source_name,url:e.source_url,date:e.date}],stage:'발견',lane:'current'};
 });
}
function build({dart=[],reviews={},news=[],newsIssues=[],foreign=[],official=[],calendar=[],canonical=[]}={},now=Date.now()){
 const fresh=[...dartCandidates(dart,now).map(x=>dartClue(x,reviews[x.rcept_no])).filter(Boolean),...newsClues([...news,...foreign,...official],now,newsIssues),...calendarClues(calendar,now)];
 const used=new Set(fresh.flatMap(x=>x.sources.map(s=>s.url)));
 const old=canonical.filter(x=>!x.sources?.some(s=>used.has(s.url))).map(x=>({...x,lane:recent(x.sort_date,now)?'current':'background',reason:'자료 기준일 '+date(x.sort_date)+' · 기존 분석의 후속 확인',sources:sources(x.sources)}));
 const out=[...fresh,...old].filter(x=>x.sources.length),seen=new Set();
 for(const clue of out){
  if(clue.detector!=='dart_deal'&&clue.detector!=='reporting_opportunity')continue;
  const matches=[...news,...foreign].filter(n=>recent(n.published_at,now)&&clue.entities.some(e=>norm(e).length>=3&&norm(n.title).includes(norm(e)))).slice(0,2);
  clue.related_sources=sources(matches.map(n=>({label:'같은 기업·기관 보도 · 동일 사건 여부 미확인',title:n.title_ko||n.title,url:n.source_url})));
 }
 return out.filter(x=>{const key=x.clue_id;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>Number(b.lane==='current')-Number(a.lane==='current')||String(b.sort_date).localeCompare(String(a.sort_date)));
}
function shortlist(rows,limit=12){
 const current=rows.filter(x=>x.lane==='current'),groups=[['dart_deal','dart_change'],['news_followup'],['official_followup','lp_rule_change','kvic_plan_change','formation_gap','formation_pattern','market_pattern','cross_source'],['reporting_opportunity']];
 const selected=[];for(const types of groups)selected.push(...current.filter(x=>types.includes(x.detector)).sort((a,b)=>a.event_date?String(a.event_date).localeCompare(String(b.event_date)):String(b.sort_date).localeCompare(String(a.sort_date))).slice(0,3));
 for(const x of current)if(selected.length<limit&&!selected.includes(x))selected.push(x);
 return selected.slice(0,limit);
}
function mergeProject(rows,clue,now=new Date().toISOString()){
 if(!Array.isArray(rows))throw Error('기존 취재 목록을 읽지 못했습니다.');
 const id='project-'+clue.clue_id,old=rows.find(x=>x.project_id===id),next={...(old||{project_id:id,clue_id:clue.clue_id,status:'진행중',notes:'',judgment:null,judgment_history:[],created_at:now}),title:old?.title||clue.headline,clue,updated_at:now};
 if(clue.dart_review_receipts)next.dart_review_receipts=unique([...(old?.dart_review_receipts||[]),...clue.dart_review_receipts]);
 return {id,rows:old?rows.map(x=>x.project_id===id?next:x):[next,...rows]};
}
return {VERSION,date,today,safeUrl,validReview,dartCandidates,dartClue,newsClues,calendarClues,build,shortlist,mergeProject};
});
