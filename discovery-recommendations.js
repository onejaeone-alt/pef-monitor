(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DiscoveryRecommendations=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// This engine proposes reporting directions. A title is evidence of what was
// reported, never proof of a transaction's economics or an unreported cause.
const VERSION='editorial-rules-1',DAY=86400000;
const clean=v=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim():'';
const arr=v=>Array.isArray(v)?v:[];
const unique=a=>[...new Set(a.filter(Boolean))];
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
function hash(v){let h=2166136261;for(const c of v){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
function url(v){try{const u=new URL(v);if(!/^https?:$/.test(u.protocol)||u.username||u.password)return '';for(const k of [...u.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|oc)$/i.test(k))u.searchParams.delete(k);return u.href;}catch{return '';}}
function day(v){if(/^\d{8}$/.test(String(v)))return String(v).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3');const n=typeof v==='number'?v:v instanceof Date?v.getTime():Date.parse(v);if(!Number.isFinite(n))return '';return /^\d{4}-\d{2}-\d{2}$/.test(String(v))?v:new Date(n+9*3600000).toISOString().slice(0,10);}
const age=(d,now)=>(Date.parse(day(now))-Date.parse(day(d)))/DAY;
const recent=(r,now,days=7)=>age(r.date,now)>=0&&age(r.date,now)<=days;
const NOISE=/농지|국가정원|수목원|재개장|소각장|국고채|국채\s*(?:모집|발행|매각)|목표주가|투자의견|상한가|주가.{0,12}(?:급등|상승|하락)|소식에.{0,8}(?:들썩|上)|\[(?:사설|그래픽|포토)|채용|봉사활동|할인행사|기념식|업무협약|MOU|교육과정|실무교육|홈오너|임차인|경품|발표평가\s*통과자|기업\s*설명회|수주|신축공사|총괄책임자\s*선임/i;
const GENERIC=/^(?:PEF?|VC|GP|LP|M&A|IB|사모펀드|펀드|금융위(?:원회)?|공정위|공정거래위원회|금융감독원|금융당국|당국|정부|업계|국내|해외|기업|회사|운용사|대주주|최대주주|사모펀드와|한국|韓|中|美|시그널|단독|속보|공식|지분|경영권|기업금융|인수금융|잔여지분|위탁운용사|브랜드|부동산|골프장|시장|행동주의|주주배정|제3자배정|기업결합|독립|통|분리|부분|지분매각|서브웨이샌드위치|금리|고금리|벤처투자회사|의무|국민성장펀드에|약국체인|국민|유망|혁신기업|인수의향서|공모채|출자사업|총|기존|본격화|본사|온라인|생산적금융)$/i;
const LP=/국민연금|교직원공제회|행정공제회|군인공제회|과학기술인공제회|공무원연금|사학연금|한국벤처투자|모태펀드|한국성장금융|성장금융|산업은행|기업은행|\bIBK\b|\bKDB\b|산은|기은|우정사업본부|국부펀드|한국투자공사|\bKIC\b|삼성생명|삼성화재|한화생명|교보생명|보험사/i;
const GP=/파트너스|인베스트먼트|프라이빗에쿼티|캐피탈|벤처스|벤처투자|맥쿼리|한앤컴퍼니|어피니티|칼라일|블랙스톤|(?:^|\s)(?:MBK|IMM|KKR|TPG|EQT|CVC|베인|스틱)(?:\b|$)|PE$/i;
const CORE=/사모펀드|PEF|프라이빗|벤처투자|위탁운용|출자|모태펀드|펀드레이징|세컨더리|컨티뉴에이션|블라인드펀드|인수금융|경영권|공개매수|\bBDC\b|private equity|private credit|buyout|fundrais/i;
const ACTION=/인수|매각|공개매수|출자|위탁운용|결성|펀드레이징|자금모집|자금조달|차환|회사채|회수|엑시트|IPO|상장|기업결합|경영권|유상증자|회생|워크아웃|분리|분할|손절|규제|개정안|선정계획|acquisition|buyout|fundrais/i;
const LP_ACTION=/출자|위탁운용|자산배분|대체투자|펀드\s*결성|펀드.*선정|선정.*펀드|투자.*IPO\s*지원|재약정|약정액|분배금/;
const MONEY=/\d[\d,.]*(?:\s*(?:조|천|억|만))+(?:\s*원|\s*달러)?|\d[\d,.]*\s*%/;
const SECTORS=[['외식·식품',/외식|프랜차이즈|식품|급식|식자재|샌드위치|피자|치킨/],['패션·뷰티',/아웃도어|패션|뷰티|화장품|코스메틱|의류/],['헬스케어',/헬스케어|바이오|의료|제약|약국/],['반도체',/반도체|웨이퍼|팹리스/],['소프트웨어',/소프트웨어|SaaS|클라우드/],['물류',/물류|택배/],['에너지',/재생에너지|수력발전|태양광|풍력|열분해유/],['미디어',/방송|언론사|미디어|신문사/]];
const METHODS=[['공개매수',/공개매수/],['기업공개',/IPO|기업공개|상장/],['부분 매각',/부분매각|일부.{0,8}매각|소수지분|잔여지분/],['분리 매각',/분리|분할|쪼개|독립매각/],['경영권 매각',/경영권.{0,6}매각|매각|손절/]];
function keyEntity(v){return norm(v).replace(/^맥쿼리(?:자산운용그룹한국|pe)?$/,'맥쿼리').replace(/^mbk파트너스$/,'mbk').replace(/^배달의민족$/,'배민').replace(/^(?:한국산업은행|산은|kdb)$/,'산업은행').replace(/^(?:ibk기업은행|기은|ibk)$/,'기업은행');}
function validEntity(v){return v&&v.length>=2&&v.length<=35&&!GENERIC.test(v)&&!/^\d/.test(v)&&!/[?!…]/.test(v)&&!/(?:억|조|만)(?:달러|원)|규모$|^투자\s*뒤|^금리\s*오르자|^(?:커지는|짧아진|높아진|늘어난|줄어든|불거진|할인해|참여해|확보해|취득해|넘겨|받아|팔아|사들여|할인가|회생기업|나선|자본|달러|원화|엔화|만기|후순위|부채|계약|최종|독립매각|수익증권|차입금|부분|분리|상환|최대주주로)$/.test(v);}
function mentioned(text,name){const n=keyEntity(name);if(/^[a-z0-9]+$/.test(n))return new RegExp('(^|[^a-z0-9가-힣])'+n+'([^a-z0-9가-힣]|$)','i').test(text);return norm(text).includes(norm(name))||norm(text).includes(n);}
function plainTitle(v){return clean(v).replace(/\[[^\]]*\]/g,'').replace(/[‘’“”"'「」『』]/g,'').replace(/\((?:종합|종합\d보|속보)\)/g,'').trim();}
function lexicalEntities(title){
 const t=plainTitle(title),out=[];
 const first=t.match(/^([A-Za-z가-힣0-9][A-Za-z가-힣0-9·& -]{1,32}),/);if(first)out.push(first[1].trim());
 for(const m of t.matchAll(/([A-Za-z가-힣][A-Za-z가-힣0-9·-]{1,30})\s+(?:지분|경영권)\s*[0-9.,~%]*/g))out.push(m[1]);
 const object=/([A-Za-z가-힣][A-Za-z가-힣0-9·-]{1,30})(?:을|를|의)?\s+(?:(?:지분|경영권)\s*)?(?:공개매수|인수(?:전|금융)?(?!\s*부담)|매각|회생|차환|유상증자|손절|결성|분리)/g;
 for(const m of t.matchAll(object)){let name=m[1].replace(/(?:에서|으로|에게)$/,'');if(/(?:그룹|은행|펀드)에$/.test(name))continue;out.push(name);}
 return unique(out).filter(validEntity);
}
function actions(t){const a=[];if(/출자|위탁운용|자산배분|선정계획/.test(t))a.push('출자·선정');if(/펀드.*결성|블라인드펀드|펀드레이징|fundrais/i.test(t))a.push('펀드 조성');if(/철회|무산|실패|해제/.test(t))a.push('거래 중단');if(/매각|회수|엑시트|손절|IPO|기업공개/.test(t))a.push('회수');if(/인수|투자\s*계약|투자\s*완료/.test(t)&&!a.includes('거래 중단'))a.push('투자');if(/차환|인수금융|회사채|유상증자/.test(t))a.push('자금 조달');return unique(a);}
function normalize(x,kind,now){
 if(!x||typeof x!=='object')return null;const title=clean(x.title_ko||x.title),link=url(x.source_url||x.url),date=day(x.published_at||x.date);
 if(!title||!link||!date||NOISE.test(title)||/인수한다면|인수했다면|인수할\s*경우/.test(title)||age(date,now)>90||age(date,now)<(kind==='calendar'?-7:0))return null;
 const summary=clean(x.summary||x.snippet||x.description),body=clean(x.body_text||x.content_text),text=[title,summary,body.slice(0,3000)].filter(Boolean).join(' ');
 if(!ACTION.test(text)&&!CORE.test(text)&&kind!=='dart')return null;
 const explicit=arr(x.related_entities).map(e=>({name:clean(e?.canonical_name||e?.name),type:e?.entity_type||e?.type||''}));
 if(x.target?.name)explicit.unshift({name:clean(x.target.name),type:x.target.category||''});
 const entities=unique([...explicit.filter(e=>!['regulator'].includes(e.type)).map(e=>e.name),...lexicalEntities(title)]).filter(validEntity);
 const official=kind==='official'||['capital_call','selection_result'].includes(x.source_type);
 return {title,url:link,date,publisher:clean(x.source_name||x.publisher||x.label)||'출처',text,summary,body,kind,official,scheduled:kind==='calendar'&&x.status==='scheduled',entities,explicit,read_level:body?'body':summary?'summary':'title',actions:actions(text),sector:SECTORS.find(([,re])=>re.test(text))?.[0]||'',method:METHODS.find(([,re])=>re.test(text))?.[0]||'',raw:x};
}
function collect(input,now){
 const rows=[];
 for(const [key,kind] of [['news','news'],['foreign','foreign'],['official','official'],['calendar','calendar']])for(const x of arr(input[key])){const r=normalize(x,kind,now);if(r)rows.push(r);}
 // Old analytical claims are not re-labelled as today's news. Only an actual
 // dated source title can enter the same evidence path as a collected article.
 for(const c of arr(input.canonical))for(const s of arr(c?.sources))if(s?.title){const r=normalize({...s,source_name:s.label},'canonical',now);if(r)rows.push(r);}
 // DART form fields alone do not identify the issuer's role or the target of
 // a transaction. They remain available in the DART/inbox views, but cannot
 // originate editorial pitches until those roles have been resolved.
 // Entity mentions must occur in the title/text. Feed target metadata often
 // describes a watchlist institution, not the company in this particular deal.
 const vocabulary=unique(rows.flatMap(r=>r.entities)).filter(validEntity).sort((a,b)=>b.length-a.length);
 for(const r of rows){
  r.entities=unique([...r.entities.filter(e=>mentioned(r.text,e)),...vocabulary.filter(e=>mentioned(r.text,e))]);
  r.gps=r.entities.filter(e=>GP.test(e)&&!LP.test(e));
  r.lp=r.title.match(LP)?.[0]||r.entities.find(e=>LP.test(e))||(r.raw.theme_id==='lp'?r.entities[0]:'')||'';
  r.category=r.lp&&LP_ACTION.test(r.text)?'lp':/인수금융|회사채|차환|크레딧|private credit/i.test(r.text)?'finance':r.gps.length||/사모펀드|PEF|private equity/i.test(r.text)?'pef':/벤처투자|VC|스타트업/i.test(r.text)?'vc':'ma';
  r.assets=r.entities.filter(e=>!r.gps.includes(e)&&!LP.test(e));
  const lexical=lexicalEntities(r.title),leading=plainTitle(r.title).match(/^([^,]+),/)?.[1],objects=lexical.filter(e=>e!==leading&&!GP.test(e)&&!LP.test(e));
  const asset=objects.find(e=>r.assets.includes(e))||r.assets.find(e=>r.title.includes(e));
  r.subject=asset||r.entities[0]||r.lp;
  r.lp_track=r.text.match(/세컨더리|크레딧|벤처|블라인드|생산적금융|넥스트스테이지/)?.[0]||'';
  r.lp_formation=/펀드.*결성|투자.*IPO\s*지원/.test(r.text);
  const joint=/기업은행|기은/.test(r.title)&&/산업은행|산은/.test(r.title)&&/1200|1천200/.test(r.title);
  if(joint){r.lp='기업은행·산업은행';r.lp_track='넥스트스테이지';}
  r.case_key=r.category==='lp'?keyEntity(r.lp)+'-'+r.lp_track+'-'+(r.lp_formation?'formation':'selection'):asset?keyEntity(asset):r.gps[0]?keyEntity(r.gps[0]):norm(plainTitle(r.title));
 }
 const result=[],byUrl=new Map(),byTitle=new Map();
 for(const r of rows.sort((a,b)=>b.date.localeCompare(a.date))){const titleKey=norm(plainTitle(r.title)),old=byUrl.get(r.url)||byTitle.get(titleKey);if(old){if(r.body&&!old.body||r.summary&&!old.summary)Object.assign(old,{body:r.body,summary:r.summary,text:r.text,read_level:r.read_level});continue;}result.push(r);byUrl.set(r.url,r);byTitle.set(titleKey,r);}
 return result;
}
function uniqueTitles(rows){const seen=new Set();return rows.filter(r=>{const k=norm(plainTitle(r.title));if(seen.has(k))return false;seen.add(k);return true;});}
function references(rows){return uniqueTitles(rows).slice(0,8).map(r=>({url:r.url,label:r.publisher,title:r.title,date:r.date,read_level:r.read_level}));}
function facts(rows){return uniqueTitles(rows).slice(0,5).map(r=>({text:r.summary?r.title+' — '+r.summary.slice(0,350):r.title,url:r.url,label:r.publisher,date:r.date,read_level:r.read_level}));}
function dimensions(rows,type,now){
 const cases=unique(rows.map(r=>r.case_key)).length,rich=rows.filter(r=>r.read_level!=='title').length,latest=rows[0],days=age(latest.date,now),comparison=['lp_comparison','gp_sequence','sector_investment','exit_comparison'].includes(type);
 const joined=rows.map(r=>r.text).join(' '),interaction=/유상증자/.test(joined)&&/인수|매각|새\s*최대주주/.test(joined)||/공개매수/.test(joined)&&/실패|무산|해제/.test(joined);
 const specificity=Math.min(30,18+(comparison?6:0)+(interaction?5:0)+(MONEY.test(joined)?3:0)+(rich?3:0)+(rows.length>1?3:0));
 const importance=rows.some(r=>r.category==='lp')?25:rows.some(r=>r.category==='pef')?24:rows.some(r=>r.category==='finance')?/인수금융|PEF|사모펀드/.test(joined)?23:16:21;
 const timeliness=latest.scheduled?Math.max(12,20+days):days<=1?20:days<=3?17:days<=7?14:8;
 const evidence=Math.min(15,5+Math.min(5,rich*3)+(cases>1?3:0)+(rows.some(r=>r.official||r.kind==='dart')?2:0));
 // Similar reports are coverage, not independent confirmation. Titles alone
 // cannot establish independent reporting or a comparable historical baseline.
 // Attention stays bounded at 5 until both can be measured reliably.
 const attention=Math.min(5,unique(rows.map(r=>r.publisher)).length+Math.min(2,Math.max(0,cases-1)));
 return {specificity,importance,timeliness,evidence,attention};
}
function make(type,typeLabel,rows,detail,now){
 rows=uniqueTitles([...rows].sort((a,b)=>b.date.localeCompare(a.date)));const scoreBreakdown=dimensions(rows,type,now),score=Object.values(scoreBreakdown).reduce((s,v)=>s+v,0),caseCount=unique(rows.map(r=>r.case_key)).length;
 const refs=references(rows),ev=facts(rows),latest=rows[0],newest=latest.date,category=detail.category||(rows.some(r=>r.category==='pef')?'pef':latest.category);
 const why=detail.why_now||`${newest} 관련 ${latest.official?'공고':'보도'}가 나왔습니다. ${detail.timing||'지금 알려진 내용과 거래 당사자의 다음 선택을 함께 다룰 시점입니다.'}`;
 const reasons=[detail.reason||typeLabel+'로 다룰 공통 주제와 취재 질문이 있습니다.',`${caseCount}개 사건 · 중복 제목을 제외한 자료 ${rows.length}건`,rows.every(r=>r.read_level==='title')?'현재 확보한 제목을 근거로 만든 취재 방향입니다.':'제목과 수집한 본문·요약에 있는 내용을 근거로 했습니다.'];
 return {clue_id:'recommendation-'+type+'-'+hash(detail.identity||rows.map(r=>r.case_key).sort().join('|')),detector:'recommendation',detector_label:typeLabel,lane:'current',category,type,type_label:typeLabel,headline:detail.headline,article_pitch:detail.headline,pitch_summary:detail.summary,why_now:why,why_today:why,comparison_axis:detail.axis,questions:detail.questions||[],sort_date:newest,detected_at:newest,event_date:latest.scheduled?newest:undefined,sources:refs,evidence:ev,score,score_breakdown:scoreBreakdown,ranking_reasons:reasons,case_count:caseCount,source_count:refs.length,coverage_count:rows.length,research_topic:detail.topic||undefined,entities:unique(rows.flatMap(r=>r.entities)),one_line_signal:detail.summary,reason:why,reported:ev.map(e=>e.label+': '+e.text),confirmed_facts:[],unknowns:[],stage:'기사 제안',fact_status:'기사 방향',read_level:rows.every(r=>r.read_level==='title')?'title':'mixed',analysis_at:new Date(now).toISOString(),rules_version:VERSION};
}
function groups(rows,fn){const m=new Map();for(const r of rows){for(const k of arr(fn(r))){if(!k)continue;const values=m.get(k)||[];values.push(r);m.set(k,values);}}return m;}
function allocationPitches(rows,now){
 const eligible=rows.filter(r=>r.category==='lp'&&LP_ACTION.test(r.text));const out=[];
 for(const [key,set] of groups(eligible,r=>[r.case_key])){
  if(!set.some(r=>recent(r,now))||!set.some(r=>MONEY.test(r.text)||/사모|벤처|세컨더리|크레딧|위탁운용사|선정계획/.test(r.text)))continue;
  const head=set[0],name=head.lp,area=head.lp_track||head.text.match(/사모투자|사모펀드/)?.[0]||'',forming=head.lp_formation;
  if(/재약정|분배금|약정액/.test(head.text)&&!/위탁운용|선정계획/.test(head.text)){
   out.push(make('lp_strategy','LP 자금 운용',set,{identity:key,category:'lp',topic:name,headline:`${name}의 사모투자 자금, 회수와 재투자 계획은`,summary:'보도된 약정·분배 관련 소식을 LP의 자금 운용 계획과 연결합니다. 자료에 있는 금액과 현재 상태를 정리하고, 다음 출자에서 투자 분야와 시기를 어떻게 정할지 취재하는 기사입니다.',axis:'약정 현황 · 분배 일정 · 다음 출자 계획',questions:['회수·약정 자금의 일정은 다음 출자 계획에 어떤 영향을 주나?'],reason:'명시된 LP의 약정·분배 활동을 다음 출자 계획과 연결할 수 있습니다.'},now));continue;
  }
  out.push(make('lp_selection','LP 출자·선정',set,{identity:key,category:'lp',topic:name.includes('·')?undefined:name,headline:forming?`${name} ${area?area+' ':''}펀드, 어떤 기업에 투자 기회가 열리나`:`${name} ${area?area+' ':''}출자, 어떤 운용사에 기회가 열리나`,summary:forming?`${name}의 펀드 조성 소식을 투자 대상과 지원 단계의 관점에서 풉니다. 공개된 규모·지원 목적을 정리하고, 실제 투자를 맡을 운용사의 전략을 취재하는 기사입니다.`:`${name}의 출자·선정 소식을 GP의 지원 전략으로 풀어봅니다. 수집한 자료에 나온 투자 분야와 조건을 정리하고, 어떤 운용사가 참여할 수 있는지 묻는 기사입니다.`,axis:forming?'투자 대상 · 지원 단계 · 운용 방식':'출자 분야 · 운용사 선정 기준 · 지원 가능한 GP',questions:forming?['이번 펀드가 투자할 기업의 단계와 자금 용도는 무엇인가?','운용사는 투자 대상과 회수 시점을 어떻게 정하나?']:['이번 출자에서 운용사가 갖춰야 할 경쟁력은 무엇인가?','지원하려는 GP는 어떤 투자 전략을 제안하나?'],reason:'구체적인 LP와 출자·펀드 조성 자료가 있어 자금의 쓰임을 다룰 수 있습니다.'},now));
 }
 // Co-sponsored fund formation reports are not separate LP allocation notices.
 const comparable=eligible.filter(r=>/출자|위탁운용|선정계획|자산배분/.test(r.text)),institutions=unique(comparable.map(r=>keyEntity(r.lp)));
 if(institutions.length>=2&&comparable.some(r=>recent(r,now))){const set=comparable.slice(0,8),names=unique(set.map(r=>keyEntity(r.lp))).slice(0,3);out.push(make('lp_comparison','LP 비교',set,{identity:institutions.sort().join('|'),category:'lp',headline:`${names.join('·')}, 출자 분야와 GP 선택 기준은`,summary:'같은 시기 나온 LP의 출자 자료를 투자 분야와 운용사 요건별로 나눠 비교합니다. 개별 선정 공고를 넘어, GP가 어느 출자사업에 맞춰 자금 모집을 준비할 수 있는지 다룹니다.',axis:'기관별 투자 분야 · 선정 요건 · 공개된 배정 규모',questions:['기관별 투자 목적과 지원 가능한 GP의 범위는 어떻게 다른가?'],reason:`서로 다른 LP ${institutions.length}곳의 출자 자료를 같은 항목으로 비교할 수 있습니다.`},now));}
 return out;
}
function groupedPitches(rows,now){
 const out=[];
 for(const [gp,set] of groups(rows,r=>r.gps.map(keyEntity))){
  const actionSet=unique(set.flatMap(r=>r.actions)),cases=unique(set.map(r=>r.case_key));if(cases.length<2||actionSet.length<2||!set.some(r=>recent(r,now)))continue;
  const name=set.flatMap(r=>r.gps).filter(e=>keyEntity(e)===gp).sort((a,b)=>a.length-b.length)[0],labels=actionSet.slice(0,2).join('·'),assets=unique(set.map(r=>r.subject).filter(e=>keyEntity(e)!==gp)).slice(0,2);
  out.push(make('gp_sequence','GP 거래 비교',set,{identity:gp,category:'pef',topic:name,headline:`${name}의 ${assets.length>=2?assets.join('·')+' 거래':labels}, 추진 상황이 갈린 이유는`,summary:`${name}가 최근 관여한 서로 다른 거래를 묶습니다. 보도된 대상 사업과 진행 상태를 비교하고, 거래마다 달랐던 조건과 투자 판단의 근거를 취재하는 기사입니다.`,axis:'거래별 대상 사업 · 진행 상황 · 투자 판단의 근거',questions:['각 거래에서 운용사가 우선하는 조건은 무엇인가?','서로 다른 거래에 공통으로 적용한 투자 기준이 있나?'],reason:`한 GP의 서로 다른 ${cases.length}개 사건에서 ${labels} 관련 자료를 확보했습니다.`},now));
 }
 for(const [sector,set] of groups(rows.filter(r=>r.sector),r=>[r.sector])){
  const investments=set.filter(r=>age(r.date,now)<=30&&/인수|투자\s*(?:계약|완료|유치)/.test(r.text)&&r.category!=='lp'),cases=unique(investments.map(r=>r.case_key)),gps=unique(investments.flatMap(r=>r.gps.map(keyEntity)));
  if(cases.length>=3&&gps.length>=2&&investments.some(r=>recent(r,now))){out.push(make('sector_investment','업종별 투자 비교',investments,{identity:sector,headline:`${sector}에 투자한 PEF들, 서로 다른 투자 대상과 전략`,summary:`수집한 ${sector} 투자 사례 ${cases.length}건을 사업모델과 인수 목적에 따라 나눕니다. 업계 전체의 증가세를 단정하지 않고, 각 투자자가 어느 사업에 가치를 뒀는지 비교하는 기사입니다.`,axis:'투자 대상의 사업모델 · 지분과 경영 참여 · 인수 목적',questions:['각 투자자는 해당 기업의 어떤 사업에서 성장 여지를 보나?'],reason:`같은 업종에서 서로 다른 투자자 ${gps.length}곳과 ${cases.length}개 사건이 연결됩니다.`},now));}
  const exits=set.filter(r=>r.method&&/매각|회수|엑시트|IPO|기업공개|손절/.test(r.text)),exitCases=unique(exits.map(r=>r.case_key)),methods=unique(exits.map(r=>r.method));
  if(exitCases.length>=2&&methods.length>=2&&exits.some(r=>recent(r,now))){out.push(make('exit_comparison','회수 방식 비교',exits,{identity:sector,headline:`${sector} 기업의 ${methods.slice(0,2).join('·')}, 회수 방식은 왜 갈리나`,summary:`같은 업종의 ${exitCases.length}개 사례를 매각·상장 방식별로 비교합니다. 현재 공개된 거래 상황을 출발점으로, 투자자가 선택한 회수 방식의 차이를 취재하는 기사입니다.`,axis:'회수 방식 · 거래 진행 단계 · 매도자가 남기는 지분',questions:['해당 회수 방식을 택한 이유와 다른 선택지의 차이는 무엇인가?'],reason:'같은 업종에서 서로 다른 회수 방식이 나타나 비교 질문을 만들 수 있습니다.'},now));}
 }
 return out;
}
function eventPitches(rows,now){
 const out=[];
 for(const [key,set] of groups(rows.filter(r=>!r.scheduled&&r.category!=='lp'),r=>[r.case_key])){
  if(!set.some(r=>recent(r,now)))continue;const head=set[0],name=head.subject;if(!validEntity(name))continue;
  const text=set.map(r=>r.text).join(' '),specific=CORE.test(text)||set.some(r=>r.gps.length)||/인수|경영권|기업결합|회생|차환|회사채/.test(text);if(!specific)continue;
  let headline,summary,axis,questions,type='event_explainer',label='거래 해설';
  if(/공개매수/.test(text)&&/무산|실패|해제|철회/.test(text)){
   type='event_change';label='거래 변화';headline=`${name} 공개매수 무산 이후, 인수자와 기존 주주의 선택은`;
   summary='공개매수 무산 보도를 출발점으로 인수 계획과 주주 선택을 다룹니다. 무산 원인을 단정하지 않고, 인수자와 주요 주주가 이제 어떤 선택을 검토하는지 취재하는 기사입니다.';axis='인수 계획 · 주요 주주의 의사 · 남은 거래 선택지';questions=['인수자는 다른 방식의 거래를 검토하나?','주요 주주는 기존 지분을 어떻게 운용할 계획인가?'];
  }else if(/유상증자/.test(text)&&/인수|매각|새\s*최대주주/.test(text)){
   headline=`${name} 새 주인과 유상증자, 인수 뒤 자금은 어디에 쓰이나`;summary='새 주주 등장과 유상증자 소식을 함께 놓고 인수 이후의 자본 확충을 다룹니다. 확인된 거래와 증자 계획을 정리하고 새 주주의 사업 계획에 필요한 자금 규모·용도를 취재하는 기사입니다.';axis='경영권 이전 · 자본 확충 · 사업에 투입할 자금';questions=['새 주주는 인수 이후 어떤 사업에 자금을 투입하려 하나?','유상증자 자금의 용도와 기존 차입금 처리는 어떻게 연결되나?'];
  }else if(/분리|분할|쪼개|독립매각/.test(text)){
   headline=`${name} 분리 매각 구상, 함께 팔 때와 달라지는 것은`;summary='분리 매각을 다룬 보도에서 출발해 매각 단위가 달라질 때의 사업 구성을 설명합니다. 확정 여부와 현재 알려진 구상을 구분하고, 원매자가 평가할 사업·자산의 범위를 취재하는 기사입니다.';axis='매각 단위 · 묶여 있는 사업 · 원매자의 인수 목적';questions=['매각 대상을 나누면 사업 운영과 매수자 검토 범위는 어떻게 달라지나?'];
  }else if(/기업결합|사전심사/.test(text)){
   headline=`${name} 인수 심사, 결합 뒤 사업 구조에서 따져볼 쟁점`;summary='인수 심사 착수 소식을 인수 전후 사업 구조의 차이로 풀어봅니다. 관련 기업의 기존 사업이 어디서 만나고, 인수자가 어떤 결합 효과를 기대하는지 취재하는 기사입니다.';axis='기존 사업의 관계 · 인수 목적 · 결합 뒤 경쟁 구도';questions=['인수자와 대상 기업은 사업을 어떤 방식으로 결합하려 하나?','거래 당사자와 경쟁사의 견해는 어디서 갈리나?'];
  }else if(/인수금융|차환|회사채/.test(text)){
   label='자금 조달 해설';headline=`${name} 자금 조달, 만기와 자금 용도로 읽는 재무 전략`;summary='수집한 조달 보도를 자금 용도와 상환 일정의 관점에서 정리합니다. 공개된 금액·만기·목적을 중심으로 조달 구조를 설명하고, 차입 조건이 투자 여력에 미칠 영향을 묻는 기사입니다.';axis='조달 목적 · 만기 구성 · 차입 비용';questions=['새 조달 자금은 투자와 기존 채무 상환에 각각 어떻게 쓰이나?'];
  }else if(/공개매수/.test(text)){
   headline=`${name} 공개매수, 주요 주주의 선택과 지분 구도는`;summary='공개매수와 지분 거래 소식을 주주별 선택의 관점에서 풉니다. 보도된 참여·매각 사실을 정리하고, 거래 후 남는 지분과 투자자의 다음 계획을 취재하는 기사입니다.';axis='주요 주주의 선택 · 거래 이후 지분 · 투자 계획';questions=['참여하거나 지분을 보유하기로 한 주주는 각각 어떤 판단을 했나?'];
  }else if(/회생|워크아웃/.test(text)){
   headline=`${name} 재편, 원매자는 어떤 사업과 자산을 보나`;summary='회생·재편과 인수 관련 보도를 사업의 지속 가능성이라는 질문으로 묶습니다. 공개된 매각 구상을 정리하고 원매자가 평가할 핵심 사업과 운영 자금 수요를 취재하는 기사입니다.';axis='매각 대상 · 핵심 사업 · 필요한 운영 자금';questions=['인수 이후 유지할 사업과 추가로 필요한 자금은 무엇인가?'];
  }else if(/인수|매각|경영권/.test(text)&&(/본계약|인수\s*계약|우선협상|주관사|인수전|의향서|지분.*\d|\d.*지분|무상감자/.test(text)||set.length>=2)){
   const focus=/무상감자/.test(text)?'무상감자, 인수 이후 자본 확충은':/주관사|인수전|의향서/.test(text)?'인수전, 원매자가 평가할 핵심 사업은':/지분/.test(text)?'지분 인수, 지배력과 투자 부담은':/본계약|인수\s*계약/.test(text)?'인수 계약, 새 주인이 그리는 사업 방향은':'거래, 매도자의 회수와 인수자의 투자 논리는';
   headline=`${name} ${focus}`;summary='수집한 거래 보도에 나온 단계와 대상 사업을 정리하고, 양측의 투자 판단을 취재하는 기사입니다. 매도자가 회수를 추진하는 배경과 원매자가 인수 이후 투입할 자금·사업 계획을 묻습니다.';axis='거래 대상 사업 · 매도자의 회수 계획 · 원매자의 인수 목적';questions=['매도자와 원매자는 이 사업의 가치와 향후 투자 부담을 각각 어떻게 보나?'];
  }else continue;
  out.push(make(type,label,set,{identity:key,headline,summary,axis,questions,topic:name,reason:'구체적인 거래 당사자와 최근 사건이 있어 그 의미를 풀어볼 수 있습니다.'},now));
 }
 return out;
}
function schedulePitches(rows,now){
 const out=[];for(const r of rows.filter(r=>r.scheduled&&age(r.date,now)<=0&&age(r.date,now)>=-7)){
  if(!CORE.test(r.text)||/교육|콘퍼런스|컨퍼런스|설명회/.test(r.title)&&!r.summary&&!r.raw.evidence)continue;
  const d=-age(r.date,now);out.push(make('scheduled','예정된 발표·행사',[r],{identity:r.url+r.date,headline:`${r.title}…투자·운용 현장에서 물어볼 쟁점`,summary:'예정된 발표·행사의 의제를 투자자와 운용사의 선택에 연결하는 사전 기사입니다. 발표가 끝난 것처럼 결과를 쓰지 않고, 공지된 주제에서 업계가 알고 싶은 질문을 정리합니다.',axis:'공개된 의제 · 영향을 받는 투자자 · 현장의 질문',questions:['공지된 의제에서 LP·GP의 투자 판단에 직접 영향을 줄 내용은 무엇인가?'],why_now:`${r.date} ${d===0?'오늘':d+'일 뒤'} 예정된 일정입니다.`,reason:'7일 안에 예정된 일정과 공개된 의제가 있습니다.'},now));}return out;
}
function choose(candidates,limit){
 const left=[...candidates].sort((a,b)=>b.score-a.score||b.sort_date.localeCompare(a.sort_date)||a.clue_id.localeCompare(b.clue_id)),selected=[];
 while(left.length&&selected.length<limit){
  let best=-1,bestValue=-Infinity;
  for(let i=0;i<left.length;i++){const p=left[i];const overlap=selected.some(s=>s.sources.some(a=>p.sources.some(b=>a.url===b.url)));if(overlap)continue;
   const diversity=(selected.some(s=>s.category===p.category)?0:5)+(selected.some(s=>s.type===p.type)?0:3),value=p.score+diversity;if(value>bestValue){best=i;bestValue=value;}}
  if(best<0)break;selected.push(left.splice(best,1)[0]);
 }
 return selected;
}
function build(input={},options={}){
 if(!input||typeof input!=='object')return [];const parsed=options.now===undefined?Date.now():options.now instanceof Date?options.now.getTime():typeof options.now==='number'?options.now:Date.parse(options.now);const now=Number.isFinite(parsed)?parsed:Date.now(),limit=Number.isFinite(options.limit)?Math.max(0,Math.min(30,Math.floor(options.limit))):5;
 const rows=collect(input,new Date(now).toISOString());const proposals=[...allocationPitches(rows,now),...groupedPitches(rows,now),...eventPitches(rows,now),...schedulePitches(rows,now)];
 return choose(proposals,limit);
}
return {VERSION,build};
});
