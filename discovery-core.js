(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./news-reader-core'));else root.IBDiscovery=factory(root.NewsReaderCore);})(typeof globalThis!=='undefined'?globalThis:this,function(News){
'use strict';
const VERSION='dart-review-1.7',DAY=86400000;
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const unique=a=>[...new Set(a.filter(Boolean))];
const date=v=>/^\d{8}$/.test(String(v))?String(v).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):/T/.test(String(v))&&Number.isFinite(Date.parse(v))?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,10):String(v||'').slice(0,10);
const today=(now=Date.now())=>new Date(now+9*3600000).toISOString().slice(0,10);
const age=(v,now)=>(Date.parse(today(now))-Date.parse(date(v)))/DAY;
const daysUntil=(v,now)=>(Date.parse(date(v))-Date.parse(today(now)))/DAY;
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
const GENERIC_ENTITY=/^(?:PEF|VC|AC|LP|M&A|사모펀드|벤처캐피탈|자산운용사|증권사|금융권|금융업계|투자은행|IB)$/i;
const DISTRESS_CUE=/회생|파산|청산|회생계획|법원|DIP|긴급운영자금|채권|폐점|자산처분|재매각|매각\s*절차|워크아웃|기한이익상실|EOD/i;
const DEAL_CUE=/인수|매각|공개매수|경영권|우선협상|우협|본계약|SPA|실사|인수금융|거래\s*종결|기업결합|잔여지분/i;
const DEAL_NEXT_CUE=/우선협상|우협|본계약|SPA|실사|인수금융|자금조달|거래\s*종결|기업결합|승인|잔여지분/i;
function storyEntity(x){
 const values=unique([x?.target?.name,...(x?.related_entities||[]).map(e=>e?.canonical_name)]).map(clean);
 return values.find(v=>norm(v).length>=3&&!GENERIC_ENTITY.test(v))||'';
}
function storyPitchClues(items,now=Date.now()){
 const grouped=new Map();
 for(const x of items||[]){
  if(!recent(x.published_at,now)||!safeUrl(x.source_url)||x.source_type==='press_release')continue;
  const entity=storyEntity(x);if(!entity)continue;
  const key=norm(entity),rows=grouped.get(key)||{entity,items:[]};
  if(!rows.items.some(r=>r.source_url===x.source_url))rows.items.push(x);grouped.set(key,rows);
 }
 const out=[];
 for(const {entity,items:raw} of grouped.values()){
  const rows=[...raw].sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
  const dayCount=new Set(rows.map(r=>date(r.published_at))).size,sourceCount=new Set(rows.map(r=>r.source_name).filter(Boolean)).size;
  const titles=rows.map(r=>r.title_ko||r.title),joined=titles.join(' '),distressRows=rows.filter(r=>DISTRESS_CUE.test(r.title_ko||r.title));
  const enoughDistress=distressRows.length>=2&&sourceCount>=2&&(dayCount>=2||rows.length>=3);
  const enoughDeal=rows.length>=3&&sourceCount>=2&&dayCount>=2&&DEAL_CUE.test(joined)&&DEAL_NEXT_CUE.test(joined);
  let story_mode='',article_pitch='',requirements=[],comparison=[];
  if(enoughDistress){
   story_mode='시나리오';
   const hasRehab=/회생/.test(joined),hasBankruptcy=/파산|청산/.test(joined),hasSale=/매각|재매각|자산처분|폐점/.test(joined);
   article_pitch=hasRehab&&hasSale?`[가제] ${entity} 회생 이후 다음은…재매각·자산처분·채권 회수 시나리오`:hasBankruptcy?`[가제] ${entity} 파산 땐 누가 먼저 돈 받나…자산처분·채권 회수 시나리오`:`[가제] ${entity} 위기 다음 단계는…법원 절차·자산 처분·채권 회수 시나리오`;
   requirements=['법원 결정·회생계획 등 공식 문서 기준 다음 절차와 주요 기한','매각·처분 대상 자산과 실제 현금 유입 규모','담보권·공익채권·회생채권 등 채권자별 변제 순위와 회수 가능액','기존 주주·대주주·PEF가 추가로 부담하거나 남겨둔 이해관계','영업·협력사·대주단에 다음 단계가 미치는 영향'];
   comparison=['과거 대형 기업 회생·파산에서 매각과 채권 회수가 진행된 순서','같은 업종 또는 PEF 포트폴리오의 회생·매각 사례'];
  }else if(enoughDeal){
   story_mode='거래 후속';
   article_pitch=`[가제] ${entity} 거래, 이제 남은 건…가격·인수금융·본계약·종결 조건 점검`;
   requirements=['매도자·원매자와 거래 대상 지분, 확인된 가격 또는 가격 범위','인수금융·자기자금 등 실제 자금조달 구조','실사·본계약·기업결합 승인 등 종결 전 남은 조건','기존 주주와 잔여 지분 처리, 공동투자자 또는 LP 이해관계','거래 종결 예상 일정과 무산될 반증 조건'];
   comparison=['같은 업종의 최근 거래 가격·밸류에이션','동일 원매자·매도자의 과거 거래에서 인수금융과 종결까지 걸린 기간'];
  }else continue;
  const latest=date(rows[0].published_at),reported=rows.slice(0,5).map(r=>`${r.source_name||'매체'} 보도: ${r.title_ko||r.title}`),refs=sources(rows.slice(0,6).map(r=>({label:r.source_name||'관련 보도',url:r.source_url,date:date(r.published_at)})));
  const why=`최근 7일 ${dayCount}일에 걸쳐 ${rows.length}건, ${sourceCount}개 매체의 관련 보도가 이어졌습니다. 같은 사실을 한 번 더 전하기보다 다음 절차와 이해관계자별 돈·위험 이동을 확인할 시점입니다.`;
  out.push({clue_id:'story-'+story_mode+'-'+hash(norm(entity)),detector:'story_pitch',detector_label:'기사 제안',fact_status:'추론',sort_date:latest,detected_at:latest,headline:entity+' 관련 보도 흐름',one_line_signal:`${rows.length}건 · ${sourceCount}개 매체 · ${dayCount}일`,reason:why,story_mode,article_pitch,why_today:why,story_requirements:requirements,comparison_targets:comparison,confirmed_facts:[],reported,extracted_facts:[],questions:[requirements[0],requirements[1]],unknowns:requirements,contacts:unique([entity,'회사·법률/재무 담당자',story_mode==='시나리오'?'주요 채권자·매각 주관사':'거래 상대방·인수금융 주선사']),entities:[entity],next_action:`${entity} 관련 공식 문서와 당사자 확인으로 '${article_pitch.replace(/^\[가제\]\s*/,'')}' 취재 가능성 검증`,sources:refs,stage:'기사 제안',lane:'current'});
 }
 return out.sort((a,b)=>String(b.sort_date).localeCompare(String(a.sort_date)));
}
function calendarStory(e,now){
 const d=daysUntil(e.date,now);if(!Number.isFinite(d)||d<0||d>3)return {};
 const title=clean(e.title),isAnnouncement=e.kind==='announcement'||/발표|브리핑|설명회|간담회|공청회/.test(title),tag=d===0?'오늘':`D-${d}`;
 if(!isAnnouncement)return {};
 const bdc=/\bBDC\b|기업성장집합투자기구/i.test(title+' '+clean(e.evidence));
 if(bdc){
  return {story_mode:d===0?'당일 해설':'사전 랩업',article_pitch:`[가제] BDC 규제 발표 ${tag}…누가 운용하고 어디에 투자하나, 시행 전 쟁점 총정리`,why_today:d===0?'오늘 BDC 관련 발표가 예정돼 있습니다. 기존 규정과 발표 내용을 바로 대조할 수 있도록 운용 구조와 업계 쟁점을 먼저 정리할 시점입니다.':`${d}일 뒤 BDC 관련 발표가 예정돼 있습니다. 발표 당일 속보와 겹치기 전에 현행 규정, 운용사 준비 상황, 시장의 쟁점을 정리할 시점입니다.`,story_requirements:['현행 BDC 규정과 이번 발표에서 확인할 변경 항목을 조문·규정 단위로 대조','인가·등록 주체와 실제 상품 준비 중인 운용사·VC의 참여 계획 확인','주투자비율·투자대상·대출·평가·공시·상장/유동성 구조 가운데 핵심 규제 확인','운용사·VC·증권사에 수익성, 상품 출시 일정, 제도 보완 요구 확인','정책 목적과 시장 우려를 가를 반대 사례·해외 사례 확인'],comparison_targets:['이전 금융위·금감원 BDC 설명회와 하위규정','미국 BDC와 영국 VCT의 구조 차이','초기 운용사들의 참여 의사 변화']};
 }
 return {story_mode:d===0?'당일 해설':'사전 랩업',article_pitch:`[가제] ${title} ${tag}…발표 전에 봐야 할 돈·규칙·시장 쟁점`,why_today:d===0?'오늘 예정된 발표입니다. 발표 직후 바뀐 내용을 비교할 수 있도록 현행 제도와 이해관계자 입장을 먼저 정리할 시점입니다.':`${d}일 뒤 예정된 발표입니다. 당일 속보 전에 현행 제도, 예상 쟁점, 영향을 받는 시장 참여자의 입장을 취재해 둘 시점입니다.`,story_requirements:['현재 적용 중인 제도·기준과 발표에서 확인할 변경 항목','직접 영향을 받는 GP·LP·운용사·기업의 범위','돈·지배력·위험·규칙 가운데 실제로 이동하는 항목','업계 이해관계자 최소 2곳의 사전 반응과 서로 다른 관점','발표 뒤 즉시 확인할 숫자·시행일·경과규정'],comparison_targets:['직전 유사 정책 발표와 실제 시행 결과','같은 제도를 먼저 적용한 국내외 비교 사례']};
}
function calendarClues(events,now=Date.now()){
 return (events||[]).filter(e=>e.status==='scheduled'&&age(e.date,now)<=0&&age(e.date,now)>=-7&&safeUrl(e.source_url)&&e.evidence&&(!/마감|선정결과/.test(e.title)||/설명회|간담회|브리핑|세미나/.test(e.title))).map(e=>{
  const news=e.source_type==='news',question=/PF|사업장/.test(e.title)?'사업장의 정상화를 위해 얼마를 투입했고, 기존 채권자와 펀드는 손익을 어떻게 나누나?':/생산적 금융|자본시장/.test(e.title)?'벤처·사모 투자로 자금을 유도할 구체적인 제도 변경과 적용 시점은 무엇인가?':e.kind==='announcement'?'이번 발표에서 달라지는 투자·출자 요건과 적용 시점은 무엇인가?':'주요 발표자의 투자 대상·회수 계획은 무엇이며, 현장에서 어떤 조건까지 확인할 수 있나?';
  const story=calendarStory(e,now);
  return {clue_id:'schedule-'+e.id,detector:'reporting_opportunity',detector_label:story.article_pitch?'기사 타이밍':e.kind==='announcement'?'중요 발표 준비':'현장 취재 준비',fact_status:news?'보도':'단서',sort_date:e.date,detected_at:e.date,event_date:e.date,headline:e.title,one_line_signal:[e.date,e.time,e.venue||'장소 미확인'].filter(Boolean).join(' · '),reason:story.why_today||'7일 안에 예정된 '+(e.kind==='announcement'?'발표':'취재 행사')+'입니다.',confirmed_facts:[],extracted_facts:news?[]:[e.evidence],reported:news?[e.evidence]:[],questions:[question],unknowns:unique([!e.time&&'시각',!e.venue&&e.kind==='event'&&'장소','참석·취재 가능 여부']),contacts:unique([e.organizer,e.speakers,e.source_name]),entities:unique([e.organizer,e.source_name]),next_action:e.kind==='announcement'?'담당 부서에 발표자료 공개 시각과 질의 창구 확인':'주최 측에 취재 등록·장소를 확인하고 발표자 질문 준비',sources:[{label:e.source_name,url:e.source_url,date:e.date}],stage:story.article_pitch?'기사 제안':'발견',lane:'current',...story};
 });
}
function build({dart=[],reviews={},news=[],newsIssues=[],foreign=[],official=[],calendar=[],canonical=[]}={},now=Date.now()){
 const series=storyPitchClues([...news,...foreign],now);
 const fresh=[...series,...dartCandidates(dart,now).map(x=>dartClue(x,reviews[x.rcept_no])).filter(Boolean),...newsClues([...news,...foreign,...official],now,newsIssues),...calendarClues(calendar,now)];
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
 const current=rows.filter(x=>x.lane==='current'),groups=[['story_pitch','reporting_opportunity'],['dart_deal','dart_change'],['news_followup'],['official_followup','lp_rule_change','kvic_plan_change','formation_gap','formation_pattern','market_pattern','cross_source']];
 const selected=[];for(const types of groups)selected.push(...current.filter(x=>types.includes(x.detector)).sort((a,b)=>{if(a.event_date||b.event_date){const ad=a.event_date||'9999-99-99',bd=b.event_date||'9999-99-99';if(ad!==bd)return ad.localeCompare(bd);}return String(b.sort_date||'').localeCompare(String(a.sort_date||''));}).slice(0,3));
 for(const x of current)if(selected.length<limit&&!selected.includes(x))selected.push(x);
 return selected.slice(0,limit);
}
function mergeProject(rows,clue,now=new Date().toISOString()){
 if(!Array.isArray(rows))throw Error('기존 취재 목록을 읽지 못했습니다.');
 const id='project-'+clue.clue_id,old=rows.find(x=>x.project_id===id),next={...(old||{project_id:id,clue_id:clue.clue_id,status:'진행중',notes:'',judgment:null,judgment_history:[],created_at:now}),title:old?.title||clue.article_pitch||clue.headline,clue,updated_at:now};
 if(clue.dart_review_receipts)next.dart_review_receipts=unique([...(old?.dart_review_receipts||[]),...clue.dart_review_receipts]);
 return {id,rows:old?rows.map(x=>x.project_id===id?next:x):[next,...rows]};
}
return {VERSION,date,today,daysUntil,safeUrl,validReview,dartCandidates,dartClue,newsClues,storyPitchClues,calendarStory,calendarClues,build,shortlist,mergeProject};
});
