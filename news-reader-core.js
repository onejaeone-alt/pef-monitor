/* Shared display rules and personal reading state. No article-value scoring. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NewsReaderCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KINDS=['read','opened','bookmark','hidden','override','watch'];
const clean=v=>String(v??'').normalize('NFKC').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const time=v=>Number.isFinite(Date.parse(v))?Date.parse(v):0;
function url(v){try{const u=new URL(v);if(!/^https?:$/.test(u.protocol)||u.username||u.password)return '';u.hash='';return u.href;}catch{return '';}}
const key=x=>url(x?.source_url);
const revision=x=>clean(x?.title).slice(0,600)+'|'+(time(x?.published_at)?new Date(x.published_at).toISOString():'');
function assess(item){
 const t=clean(item?.title||item?.headline),context=clean(item?.snippet);
 if(scope(item)==='foreign')return {status:'relevant',reason:'해외 IB·투자업계 보도'};
 const business=t.replace(/예상\s*인수\s*결과|인수\s*결과|보험\s*인수|인수파출소|인수동|인수봉|인수인계|인수분해|인수위원회|인수위|인수단/g,'');
 const deal=/인수|매각|M&A|인수합병|경영권|공개매수|우선협상|본입찰|예비입찰|합병|의결권|주주행동|행동주의|주총|주주총회|지분\s*(?:투자|처분|인수)/i.test(business);
 const capital=/회사채|공모채|전환사채|교환사채|신주인수권부사채|신종자본증권|유상증자|인수금융|메자닌|리파이낸싱|차환|유동성\s*(?:위기|부족)|회생|워크아웃|파산|채무불이행|신용등급|환헤지|FX스와프|프로젝트\s*파이낸싱|\bPF\b/i.test(t);
 const fund=/출자\s*(?:사업|공고|계획|기준|약정|확약|규모|요청|액)|(?:GP|운용사|위탁운용사).{0,16}(?:선정|모집)|(?:펀드|조합).{0,25}(?:결성|조성|클로징|연장|무산|(?:목표액|목표\s*규모|관리보수|성과보수).{0,8}(?:축소|하향|변경|인하))|펀드레이징|LP\s*확약|주목적\s*투자/i.test(t);
 const investment=/투자\s*유치|후속\s*투자|신규\s*투자|투자\s*결정|시리즈\s*[A-F]|시드\s*투자|세컨더리|엑시트|\bIPO\b|상장\s*(?:추진|예비|심사|철회)|벤처투자.{0,20}(?:회복|증가|감소|조원|억원)|사모투자/i.test(t);
 const industry=/PEF|사모펀드|벤처캐피탈|벤처투자|운용사|운용역|운용인력|심사역|기금운용|\bVC\b|\bCVC\b|액셀러레이터|창업기획자|투자은행/i.test(t);
 const institution=industry||!!item?.target||!!item?.related_entities?.length||/공제회|국민연금|한국벤처투자|한국성장금융|산업은행/.test(t);
 const people=institution&&/영입|선임|취임|사임|퇴사|퇴직|이동|이탈|독립|조직\s*개편|해외거점|사무소|신생\s*운용사|본부장|파트너/.test(t);
 const policy=(industry||/출자|투자|기금운용/.test(t))&&/법안|법률|시행령|규제|제도|세제|과세|감독|선정\s*기준|가점|이해충돌/.test(t);
 const event=deal||capital||fund||investment||people||policy;
 const civic=/기초연금|연금\s*(?:가입|수급|신청|추납)|국민연금.{0,20}(?:가입|추납)|치매.{0,15}(?:재산|관리)|수해복구|봉사활동|복지\s*(?:협약|확대)|교직원\s*복지|의료\s*할인|병원.{0,30}협약|보이스피싱\s*예방|지방계약\s*워크숍/.test(t);
 const falseAcquisition=/예상\s*인수\s*결과|인수파출소|인수동|인수봉|보험\s*가입|보험\s*인수/.test(t);
 const unrelated=/LP\s*(?:음반|판)|레코드판|폴리에틸렌|폴리프로필렌|인수분해|국제단위계/.test(t);
 if((civic||falseAcquisition||unrelated)&&!event)return {status:'excluded',reason:civic?'가입·복지·행사 안내':falseAcquisition?'기업 인수가 아닌 동음이의어':'취재 분야와 다른 의미의 검색어'};
 if(/주식\s*추천|오늘의\s*종목|목표주가/.test(t)&&!fund&&!people&&!policy&&!capital&&!deal)return {status:'excluded',reason:'종목 추천·시세 안내'};
 if(event)return {status:'relevant',reason:fund?'출자·펀드 진행':capital?'조달·신용 변화':people?'운용인력·조직':policy?'투자·출자 규칙':deal?'거래·지배력':'투자·회수'};
 if(industry)return {status:'relevant',reason:'운용업계 동향·해설'};
 return {status:'review',reason:context?'제목만으로 관련성 판단 어려움':'기관명 외에 취재 관련 표현 부족'};
}
function scope(x){return x?.news_scope==='foreign'||x?.source_type==='foreign_news'?'foreign':'domestic';}
// Match editorial labels, never ordinary phrases such as 단독 입찰 or 단독주택.
function exclusive(x){return scope(x)==='domestic'&&/(?:[\[【(〈「]\s*단독(?:보도)?\s*[\]】)〉」]|^\s*단독(?:보도)?\s*[:：])/.test(clean(x?.title||x?.headline));}
function snapshot(x){
 const u=key(x);if(!u)return null;
 return {news_scope:scope(x),source_type:scope(x)==='foreign'?'foreign_news':'domestic_news',source_url:u,title_ko:clean(x.title_ko).slice(0,900),snippet_ko:clean(x.snippet_ko).slice(0,1500),translation_provider:clean(x.translation_provider).slice(0,80),title:clean(x.title||'제목 확인 필요').slice(0,600),source_name:clean(x.source_name).slice(0,100),published_at:time(x.published_at)?new Date(x.published_at).toISOString():null,
 related_entities:(Array.isArray(x.related_entities)?x.related_entities:[]).filter(e=>e&&e.entity_key).slice(0,8).map(e=>({entity_key:clean(e.entity_key).slice(0,160),canonical_name:clean(e.canonical_name).slice(0,160),entity_type:clean(e.entity_type).slice(0,40),type_label:clean(e.type_label).slice(0,160)}))};
}
const empty=()=>Object.fromEntries(KINDS.map(k=>[k,Object.create(null)]));
function validate(change){
 if(!change||!KINDS.includes(change.kind))throw Error('지원하지 않는 개인 기록');
 const kind=change.kind,k=kind==='watch'?clean(change.key).slice(0,160):url(change.key);
 if(!k||(kind!=='watch'&&k.length>4096))throw Error('기록 주소 확인 필요');
 if(change.value===null)return {kind,key:k,value:null};
 const v=change.value;if(!v||typeof v!=='object'||Array.isArray(v))throw Error('기록 형식 확인 필요');
 const at=time(v.at)?new Date(v.at).toISOString():new Date().toISOString();
 if(kind==='watch'){
  const query=clean(v.query).slice(0,120),entity_key=clean(v.entity_key).slice(0,160);
  if(!query&&!entity_key)throw Error('추적할 이름 또는 검색어 필요');
  return {kind,key:k,value:{query,entity_key,label:clean(v.label||query||entity_key).slice(0,120),at}};
 }
 if(kind==='override')return {kind,key:k,value:{category:clean(v.category).slice(0,50),at}};
 if(kind==='read')return {kind,key:k,value:{revision:clean(v.revision).slice(0,900),at}};
 if(kind==='opened')return {kind,key:k,value:{at}};
 const article=snapshot({...v.article,source_url:k});
 return {kind,key:k,value:{at,article}};
}
function apply(state,changes){const next=empty();KINDS.forEach(k=>Object.assign(next[k],state?.[k]||{}));for(const c of changes.map(validate)){if(c.value===null)delete next[c.kind][c.key];else next[c.kind][c.key]=c.value;}return next;}
function unread(item,state){return state?.read?.[key(item)]?.revision!==revision(item);}
function watchMatches(item,watch){
 if(watch.entity_key)return (item.related_entities||[]).some(e=>e.entity_key===watch.entity_key);
 const text=clean([item.title,item.title_ko].filter(Boolean).join(' ')).toLowerCase();const terms=clean(watch.query).toLowerCase().split(/\s+/).filter(Boolean);
 return terms.length>0&&terms.every(term=>/^\d+호$/.test(term)?new RegExp('(^|[^0-9])'+term+'(?![0-9])').test(text):text.includes(term));
}
function matchingWatches(item,state){return Object.values(state?.watch||{}).filter(w=>watchMatches(item,w));}
// A review queue based on explicit headline signals, not an article-value or fact-change score.
function focusReasons(item,state){
 const t=clean(item?.title), reasons=[];
 if(assess(item).status!=='relevant')return reasons;
 const add=(id,label,pattern,priority)=>{const match=t.match(pattern);if(match)reasons.push({id,label,evidence:match[0],priority});};
 // Do not promote columns, price roundups, personal property or hypothetical outcomes.
 if(/\[(?:기고|칼럼|사설|열린세상|모닝 리포트|홍콩 특징주)\]|아파트|단독주택|노인\s*일자리|노인일자리|보장\s*매각\s*프로그램|\b(?:opinion|explainer)\b/i.test(t))return reasons;
 if(exclusive(item)||scope(item)==='foreign'&&/^exclusive\s*[:：-]/i.test(t))reasons.push({id:'exclusive',label:'단독 보도',evidence:scope(item)==='foreign'?'Exclusive':'단독',priority:5});
 const speculative=/(?:가능성|전망|관측|되나|할까|할\s*수|한다면|사실무근|부인|\?|？)|\b(?:could|might|may|if|denies?|not)\b/i.test(t);
 if(!speculative){
  add('risk','거래·자금 차질',/(?:인수|매각|합병|투자|상장|펀드|출자|차환|조달).{0,22}(?:무산|철회|결렬|중단|실패)|(?:회생|파산)\s*(?:신청|절차|개시)|채무불이행|디폴트|신용등급.{0,12}하향|\b(?:files? for bankruptcy|defaults? on|deal collapses|terminates? (?:the )?(?:merger|deal))\b/i,5);
  // A notice, successful closing or routine selection is not an editorial lead by itself.
  // Require a reported departure from the ordinary process; never infer one from size or recency.
  add('bid','입찰 경쟁·조건 변경',/(?:인수|매각|입찰|공개매수).{0,18}(?:가격|조건|매수가|매각가).{0,8}(?:변경|인상|인하|상향|하향)|(?:공개매수|본입찰|예비입찰).{0,18}(?:맞불|경쟁\s*격화|반발|불참|유찰|재입찰)|\b(?:raises?|increases?|cuts?)\b.{0,18}\b(?:takeover bid|offer price)\b|\brival (?:takeover )?bid\b/i,4);
  add('lp','출자 조건·선정 절차 변경',/(?:출자|선정|운용사|GP).{0,12}(?:조건|기준|비율|보수|의무|요건).{0,12}(?:변경|완화|강화|축소|상향|하향|폐지)|(?:출자\s*사업|운용사\s*선정|GP\s*선정).{0,12}(?:취소|중단|연기|재공고|유찰|번복)|(?:출자|운용사|GP).{0,18}(?:특혜|이해충돌)|\b(?:GP|manager) selection\b.{0,18}\b(?:cancelled|delayed|conflict of interest)\b/i,4);
  add('dispute','경영권·법적 쟁점',/경영권.{0,20}(?:분쟁|승소|패소|수성)|(?:경영권|인수|매각|주총|주주총회).{0,20}(?:가처분|소송)|(?:인수|합병|M&A|공개매수|사모펀드).{0,18}(?:입법|법안\s*통과|규제\s*강화)|\b(?:proxy fight|antitrust (?:probe|approval|lawsuit))\b/i,4);
  add('fund','펀드 기한·조건 변경',/(?:펀드|조합).{0,18}(?:만기|결성기한|결성시한).{0,8}연장|(?:펀드|조합).{0,18}(?:목표액|목표\s*규모|관리보수|성과보수).{0,8}(?:축소|하향|변경|인하)|\bfund\b.{0,25}\b(?:extends? (?:its )?(?:term|fundraising deadline)|cuts? (?:its )?target)\b/i,4);
  if(reasons.length&&/입찰|공개매수|출자|청약|주총|주주총회|\btender\b|\bbid\b/i.test(t))add('schedule','일정 확인',/오늘|내일|D-[0-7](?!\d)|접수\s*마감|청약\s*마감|\btomorrow\b/i,0);
 }
 if(reasons.length){const matches=matchingWatches(item,state);if(matches.length)reasons.unshift({id:'watch',label:'관심 검색어 일치',evidence:matches.map(w=>w.label||w.query||w.entity_key).join(' · '),priority:0});}
 return reasons;
}
function focus(rows,state,{now=Date.now(),days=7,limit=5,related=new Map()}={}){
 const candidates=[];
 // Korea calendar day (UTC+9), independent of the browser's timezone or list period.
 const seoulDay=ms=>Math.floor((ms+9*3600000)/86400000),today=seoulDay(now);
 for(const row of rows||[]){
  const item=row.lead,k=key(item),published=time(item?.published_at);
  if(!k||state.hidden?.[k]||!published||published>now+300000||published<now-days*86400000||seoulDay(published)!==today)continue;
  const reasons=focusReasons(item,state).filter(r=>r.id!=='schedule'||now-published<=86400000);
  if(!reasons.some(r=>r.id!=='watch'))continue;
  const priority=Math.max(...reasons.map(r=>r.priority))+(reasons.some(r=>r.id==='watch')?2:0)-Math.floor(Math.max(0,now-published)/86400000)*0.5;
  candidates.push({rowId:row.id,item,reasons,priority,published});
 }
 candidates.sort((a,b)=>b.priority-a.priority||b.published-a.published||key(a.item).localeCompare(key(b.item)));
 const selected=[],seen=new Set(),titles=new Set(),types=new Map(),deferred=[];
 const take=c=>{
  const k=key(c.item),title=clean(c.item.title).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
  if(seen.has(k)||titles.has(title))return;
  selected.push(c);titles.add(title);seen.add(k);
  for(const item of related.get(k)||[])seen.add(key(item));
 };
 // Keep the first screen varied without relaxing the editorial eligibility rules.
 for(const c of candidates){
  const type=c.reasons.find(r=>r.id!=='watch').id;
  if((types.get(type)||0)>=2){deferred.push(c);continue;}
  const before=selected.length;take(c);if(selected.length>before)types.set(type,(types.get(type)||0)+1);
  if(selected.length>=limit)break;
 }
 for(const c of deferred){if(selected.length>=limit)break;take(c);}
 return selected.slice(0,Math.max(0,limit)).map(({priority,published,...entry})=>entry);
}
function mergePool(items,state,view){
 if(view!=='saved'&&view!=='hidden')return items||[];
 const bucket=view==='saved'?state.bookmark:state.hidden,live=new Map((items||[]).map(x=>[key(x),x]));
 return Object.entries(bucket||{}).map(([k,v])=>live.get(k)||v.article||snapshot({source_url:k,title:'이전에 보관한 기사 · 원문에서 확인'})).filter(Boolean);
}
function select(items,state,{view='unread',category='ALL',actor='ALL',query='',classify=()=>({}),includeReview=false,newsScope=null,exclusiveOnly=false}={}){
 return mergePool(items,state,view).filter(x=>{
  const k=key(x);if(!k)return false;
  if(newsScope&&scope(x)!==newsScope)return false;
  if(exclusiveOnly&&!exclusive(x))return false;
  if(view!=='hidden'&&state.hidden?.[k])return false;
  if(view==='hidden'&&!state.hidden?.[k])return false;
  if(view==='saved'&&!state.bookmark?.[k])return false;
  const a=x.relevance||assess(x);
  if(['latest','unread','tracked'].includes(view)&&a.status!=='relevant'&&!includeReview)return false;
  if(view==='review'&&a.status==='relevant')return false;
  if(view==='unread'&&!unread(x,state))return false;
  if(view==='tracked'&&!matchingWatches(x,state).length)return false;
  const c=classify(x),override=state.override?.[k]?.category;
  const cats=override?[override]:[c.category_id,...(c.secondary_categories||[])];
  if(category!=='ALL'&&!cats.includes(category))return false;
  if(actor!=='ALL'&&!c.actor_ids?.includes(actor))return false;
  const hay=clean([x.title,x.title_ko,x.source_name,...(x.related_entities||[]).map(e=>e.canonical_name)].join(' ')).toLowerCase();
  return clean(query).toLowerCase().split(/\s+/).filter(Boolean).every(t=>hay.includes(t));
 }).sort((a,b)=>time(b.published_at)-time(a.published_at));
}
function legacy(value){const next=empty();for(const [k,at] of Object.entries(value?.saved||{})){if(url(k))next.bookmark[url(k)]={at:Number.isFinite(Number(at))&&Number(at)>0?new Date(Number(at)).toISOString():new Date().toISOString(),article:snapshot({source_url:k,title:'기존 보관 기사 · 원문에서 확인'})};}for(const [k,v] of Object.entries(value?.overrides||{})){if(url(k))next.override[url(k)]={category:clean(v).slice(0,50),at:new Date().toISOString()};}return next;}
return {KINDS,clean,time,url,key,scope,exclusive,revision,assess,snapshot,empty,validate,apply,unread,watchMatches,matchingWatches,focusReasons,focus,mergePool,select,legacy};
});
