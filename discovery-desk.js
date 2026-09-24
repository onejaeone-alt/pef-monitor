(function(){
'use strict';
const C=globalThis.IBDiscovery,$=s=>document.querySelector(s),root=$('#discoveryDesk');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REVIEW_KEY='ib_dart_reviews_v1',PROJECT_KEY='pef_my_reporting_projects_v1';
const endpoints={canonical:['출자공고·기존 분석','/api/signals?mode=clues&days=14'],news:['국내 뉴스','/api/news?feed=reader&days=7&limit=500'],foreign:['외신','/api/news?scope=foreign&days=7&limit=100'],dart:['DART 공시','/api/dart-feed?days=7&limit=800'],calendar:['취재일정','/api/news?feed=calendar']};
let state={},status={},reviews={},data=[],view='current',query='',expanded=false,run=0,controller,reading=false,failures=new Set();
const UPDATE_MS=5*60*1000;
const P=globalThis.DiscoveryPatterns,B=globalThis.MarketInStoryBrief,RESEARCH_KEY='ib_discovery_research_v1';
let researchCache=stored(RESEARCH_KEY,{}),researching=false,researchPending=new Set(),researchRequests=new Map();
let findingToday=false,todayMessage='',loadJob=null,reviewJob=null,researchJob=null,recommendationId=null,returnFocus=null;
let loading=false,lastStarted=0,lastChecked=0,updateTimer=null,pendingData=null,renderedCards='';
const away=()=>document.hidden||globalThis.navigator?.onLine===false;
const readingCard=()=>!!$('#recommendationDialog')?.open||document.querySelectorAll('[data-detail][open]').length>0||(globalThis.scrollY||0)>180;
function autoStatus(){
 const clock=lastChecked?new Date(lastChecked).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}):'';
 const text=away()?'화면으로 돌아오면 자동 확인':loading?'새 자료 자동 확인 중':'5분마다 자동 업데이트';
 $('#discoveryAutoStatus').textContent=text+(clock?' · 최근 확인 '+clock:'');
}
function scheduleUpdate(){
 clearTimeout(updateTimer);updateTimer=null;autoStatus();
 if(!away()&&!loading&&!reading&&!findingToday&&!researching)updateTimer=setTimeout(()=>load({automatic:true}),Math.max(1000,UPDATE_MS-(Date.now()-lastStarted)));
}
function stored(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'null')??fallback;}catch(_){return fallback;}}
function list(rows){const values=(rows||[]).filter(x=>typeof x==='string'&&x.trim());return values.length?'<ul>'+values.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'';}
function links(rows){return (rows||[]).filter(s=>C.safeUrl(s.url)).map(s=>`<a href="${esc(C.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label||'원문')} ↗</a>`).join('');}
function patternSummary(x){
 if(!P||x.lane!=='background'&&x.detector!=='pattern_followup')return '';
 const s=P.summary(x),ref=x.pattern_ref;
 const jump=ref?`<button data-discovery-jump="${esc(ref.clue_id)}">기존 특징과 근거 보기 →</button>`:x.linked_update?`<button data-discovery-jump="${esc(x.linked_update.clue_id)}">연결된 새 자료 ${x.linked_update.count}건 →</button>`:'';
 return `<dl class="discovery-pattern-summary"><dt>발견한 특징</dt><dd>${esc(s.feature)}</dd><dt>비교한 자료</dt><dd>${esc(s.comparison)}</dd><dt>새로 확인된 내용</dt><dd>${esc(s.update)}</dd></dl>${s.asOf?`<p class="discovery-baseline">기존 자료 기준 ${esc(s.asOf)} · 오늘 다시 검증한 결과는 아닙니다.</p>`:''}${jump?`<div class="discovery-pattern-link">${jump}</div>`:''}`;
}
function inbox(rows){
 if(!rows.length)return '';
 const open=document.querySelector('[data-discovery-inbox]')?.open;
 return `<details class="discovery-inbox" data-discovery-inbox ${open?'open':''}><summary>수집한 자료 ${rows.length}건</summary><p>기사 방향이 나온 추천과 별도로, 수집한 원문을 확인할 수 있습니다.</p>${rows.map(x=>`<div class="discovery-inbox-row"><strong>${esc(x.one_line_signal||x.headline)}</strong><span>${esc(x.research?.status==='ready'?'원문을 읽었지만 새 기사 방향을 찾지 못함':x.research?.error==='insufficient_sources'?'비교할 원문 부족':/model_/.test(x.research?.error||'')?'AI 분석 미완료':'원문 분석 대기')}</span>${links((x.sources||[]).slice(0,2))}${B?.requestFor(x)?`<button data-discovery-research="${esc(x.clue_id)}">원문 대조</button>`:''}</div>`).join('')}</details>`;
}
function card(x){
 const pitch=x.research?.status==='ready'&&x.article_brief?.angles?.[0];
 const research=pitch?'<dl class="discovery-pattern-summary"><dt>추천 이유</dt><dd>'+esc(pitch.reason)+'</dd><dt>후속 취재 질문</dt><dd>'+esc(pitch.question)+'</dd></dl>':'',researchDetails=(B?.renderDetails(x.research,x.clue_id)||'')+(!pitch?(B?.renderBriefHtml(x.research)||''):'');
 const heading=pitch?.headline||x.one_line_signal||x.headline;
 const evidence=(x.evidence||[]).map(f=>`${f.label}: ${f.before!==undefined?f.before+' → '+f.after:f.value+(f.unit?' '+f.unit:'')} · ${f.source?.location||'원문 위치 확인'}`);
 return `<article data-discovery-card="${esc(x.clue_id)}" tabindex="-1" class="discovery-card ${pitch?'discovery-proposal':'discovery-reference'}"><div class="discovery-meta"><span>${pitch?'추천 기사':'참고자료'}</span><span>${esc(pitch?x.headline:x.detector_label)}</span><time>${esc(x.event_date?'예정 '+x.event_date:'자료 '+C.date(x.sort_date))}</time></div><h3>${esc(heading)}</h3>${pitch?'<p class="discovery-fact">'+esc(x.one_line_signal||x.changed_fact)+'</p>':''}${research}${pitch?'':patternSummary(x)}<div class="discovery-actions">${pitch?`<button class="recommendation-open" data-recommendation-open="${esc(x.clue_id)}">추천기사 열기</button>`:''}${!pitch&&B?.requestFor(x)?`<button class="discovery-research-button" data-discovery-research="${esc(x.clue_id)}" ${researchPending.has(B.requestFor(x).key)?'disabled':''}>${researchPending.has(B.requestFor(x).key)?'원문 비교 중…':x.research?'원문 다시 비교':'원문 비교'}</button>`:''}${links((x.sources||[]).slice(0,2))}<button data-discovery-project="${esc(x.clue_id)}" ${pitch?'data-discovery-angle="0"':''}>취재에 담기 →</button></div><details data-detail="${esc(x.clue_id)}"><summary>근거 보기</summary><div class="discovery-detail">${researchDetails}${x.pattern_ref?'<h4>기존 분석의 비교 자료</h4>'+links(x.pattern_ref.sources):''}${x.extracted_facts?.length?'<h4>원문 자동 추출 · 검수 전</h4>'+list(x.extracted_facts):''}${x.confirmed_facts?.length?'<h4>기존 분석의 확인 내용 · 자료 기준일 확인</h4>'+list(x.confirmed_facts):''}${x.reported?.length?'<h4>보도된 내용</h4>'+list(x.reported):''}${x.original_title?'<p>'+esc(x.original_title)+'</p>':''}${evidence.length?'<h4>원문 위치</h4>'+list(evidence):''}${x.previous_state?'<h4>비교 기준</h4><p>'+esc(x.previous_state)+'</p>':''}${x.hypothesis?'<h4>아직 확인하지 않은 가설</h4><p>'+esc(x.hypothesis)+'</p><p>'+esc(x.falsification)+'</p>':''}${x.background_relationships?.length?'<h4>기존 투자·사업 관계 · 이번 거래 참여 여부 미확인</h4>'+list(x.background_relationships.map(r=>r.investor+' · '+r.as_of))+links(x.background_relationships.map(r=>({label:r.investor+' 관계 출처',url:r.url}))):''}${x.related_sources?.length?'<h4>같은 기업·기관의 다른 보도 · 동일 사건 여부 미확인</h4>'+links(x.related_sources.map(s=>({...s,label:s.title}))):''}<h4>모든 출처</h4>${links(x.sources)}</div></details></article>`;
}
function render({accept=false}={}){
 const open=new Set([...document.querySelectorAll('[data-detail][open]')].map(e=>e.dataset.detail));
 let next=C.build({...state,reviews}).map(x=>{const r=B?.requestFor(x),cached=r&&researchCache[r.key];return B&&r?B.attach(x,cached?.until>Date.now()?cached.value:researchPending.has(r.key)?{version:B.VERSION,status:'loading'}:null):x;}).filter(Boolean);
 if(P)next=P.connect(next,state);
 if(!accept&&!findingToday&&data.length&&readingCard()&&JSON.stringify(next)!==JSON.stringify(data))pendingData=next;
 else {data=next;pendingData=null;}
 $('#discoveryUpdates').hidden=!pendingData;
 const counts={current:data.filter(x=>x.lane==='current').length,background:data.filter(x=>x.lane==='background').length};
 let rows=data.filter(x=>x.lane===view&&(!query||[x.headline,x.article_pitch,x.one_line_signal,...(x.entities||[])].join(' ').toLowerCase().includes(query)));
 const raw=view==='current'?rows.filter(x=>!(x.research?.status==='ready'&&x.article_brief?.angles?.length)&&x.detector!=='pattern_followup'):[];
 if(view==='current')rows=rows.filter(x=>!raw.includes(x));
 const total=rows.length;if(view==='current'&&!expanded&&!query)rows=B?B.shortlist(rows):C.shortlist(rows);
 const proposals=rows.filter(x=>x.research?.status==='ready'&&x.article_brief?.angles?.length),references=rows.filter(x=>!proposals.includes(x));
 const group=(title,items)=>items.length?'<h3 class="discovery-section-title">'+title+' <span>'+items.length+'</span></h3>'+items.map(card).join(''):'';
 const html=(rows.length?group('추천 기사',proposals)+group(view==='background'?'누적자료에서 찾은 특징':'기존 특징에 연결된 새 자료',references):`<div class="discovery-empty">${Object.values(status).some(s=>s.state==='loading')?'자료를 읽고 있습니다. 기사 방향과 근거가 나온 결과부터 표시합니다.':'현재 자료에서 추천할 기사 방향을 찾지 못했습니다.'}</div>`)+inbox(raw);
 if(html!==renderedCards){$('#discoveryCards').innerHTML=html;renderedCards=html;for(const el of document.querySelectorAll('[data-detail]'))if(open.has(el.dataset.detail))el.open=true;}
 const ready=data.filter(x=>x.lane==='current'&&x.article_brief?.angles?.length).length;
 $('#discoveryViewNote').textContent=view==='background'?'여러 기록을 비교해 찾은 특징입니다. 기존 자료 기준일과 새 자료 연결 여부를 함께 확인하세요.':'원문과 기존 보도를 대조해 찾은 기사 방향과 추천 이유를 보여줍니다.';
 $('#discoveryCounts').textContent=view==='background'?`누적 특징 ${counts.background}건 · 새 자료 연결 ${data.filter(x=>x.lane==='background'&&x.linked_update).length}건`:`추천 기사 ${ready}건`;
 const blocked=data.some(x=>/model_/.test(x.research?.error||'')),sourceMissing=data.some(x=>x.research?.error==='insufficient_sources');
 $('#discoveryResearchStatus').textContent=researching?'새 자료의 원문과 마켓인 보도를 대조하고 있습니다.':blocked?'AI 분석을 완료하지 못했습니다. 확보한 원문은 수집한 자료에서 볼 수 있습니다.':sourceMissing?'비교할 원문이 부족해 일부 발제 추천을 보류했습니다.':!ready?'기사 방향과 근거를 갖춘 결과부터 추천합니다.':'';
 $('#discoveryMore').hidden=!(view==='current'&&!expanded&&!query&&total>rows.length);$('#discoveryMore').textContent=`나머지 ${total-rows.length}건 보기`;
 $('#discoverySources').innerHTML=Object.entries(endpoints).map(([key,[name]])=>{const s=status[key]||{state:'loading'};return `<span class="${s.state}">${esc(name)} · ${esc(s.state==='loading'?'수집 중':s.state==='failed'?'불러오기 실패':s.detail||'연결됨')}</span>`;}).join('');
 const candidates=C.dartCandidates(state.dart),valid=candidates.filter(x=>C.validReview(x,reviews[x.rcept_no])).length,pending=candidates.filter(x=>!C.validReview(x,reviews[x.rcept_no])&&!failures.has(x.rcept_no)).length;
 $('#discoveryReviewStatus').textContent=candidates.length?`공시 원문 ${valid}/${candidates.length}건 읽음${reading?' · 읽는 중':''}${failures.size?' · 실패 '+failures.size+'건':''}${pending?' · 대기 '+pending+'건':''} · 단순 공시 목록은 DART 탭에서 확인`:'';
 $('#discoveryReadMore').hidden=!pending||reading;$('#discoveryRetry').hidden=!Object.values(status).some(s=>s.state==='failed'||s.state==='partial')&&!failures.size;
 $('#status').textContent=Object.values(status).some(s=>s.state==='loading')?'수집 결과 연결 중…':reading?'공시 근거 확인 중…':`최근 취재거리 ${counts.current}건`;
 syncTodayStatus();autoStatus();
}
async function json(url,signal){
 const request=new AbortController(),abort=()=>request.abort();
 if(signal?.aborted)request.abort();else signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,65000);
 try{const r=await fetch(url,{signal:request.signal}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'조회 실패');return d;}
 finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
function saveReview(n,r){reviews[n]=r;try{const saved=stored(REVIEW_KEY,{});localStorage.setItem(REVIEW_KEY,JSON.stringify({...saved,[n]:r}));}catch(_){$('#discoveryMessage').textContent='원문 결과를 이 기기에 저장하지 못했습니다. 현재 화면에서는 확인할 수 있습니다.';}}
function readBatch(token){
 if(reading)return reviewJob;
 reviewJob=performReadBatch(token);return reviewJob;
}
async function performReadBatch(token){
 if(reading||away())return;reading=true;render();
 const queue=C.dartCandidates(state.dart).filter(x=>!C.validReview(x,reviews[x.rcept_no])&&!failures.has(x.rcept_no));
 const signal=controller.signal;
 await Promise.all([0,1].map(async()=>{while(queue.length&&token===run&&!away()){const x=queue.shift();try{const r=await json('/api/dart-feed?action=review&rcept_no='+x.rcept_no,signal);if(token!==run)return;if(!C.validReview(x,r))throw Error('원문 불일치');saveReview(x.rcept_no,r);}catch(e){if(token!==run)return;failures.add(x.rcept_no);}render();}}));
 if(token===run){reading=false;render();if(!loading)scheduleUpdate();}
}
function load(options={}){
 if(loading||reading)return;
 if(findingToday&&!options.today)return;
 loadJob=performLoad(options);return loadJob;
}
async function performLoad({automatic=false,today=false}={}){
 if(loading||reading){scheduleUpdate();return;}
 if(automatic&&away()){scheduleUpdate();return;}
 loading=true;lastStarted=Date.now();clearTimeout(updateTimer);$('#refresh').disabled=true;
 const token=++run;controller?.abort();controller=new AbortController();status=Object.fromEntries(Object.keys(endpoints).map(k=>[k,{state:'loading'}]));failures=new Set();reviews={...stored(REVIEW_KEY,{}),...reviews};$('#discoveryMessage').textContent='';render();
 await Promise.allSettled(Object.entries(endpoints).map(async([key,[,url]])=>{
  try{const d=await json(url,controller.signal);if(token!==run)return;
   if(key==='canonical'){state.canonical=d.items||[];state.official=d.source_signals||[];}
   else state[key]=key==='calendar'?d.events||[]:d.items||[];
   if(key==='news')state.newsIssues=d.issues||[];
   const count=(state[key]||[]).length;const partial=d.coverage?.complete===false||d.collection_status?.partial||d.sources?.some(s=>!s.ok)||key==='canonical'&&Object.values(d.diagnostics?.providers?.official||{}).some(v=>!v);
   const capped=d.coverage?.display_limited||d.collection_status?.truncated,translationFailed=Number(d.translation?.failed)||0;
   status[key]={state:partial||translationFailed?'partial':'ready',detail:count+'건 확인'+(partial?' · 일부 수집 실패':'')+(capped?' · 조회 상한 적용':'')+(translationFailed?' · 번역 미확보 '+translationFailed+'건':'')};render();
   if(key==='dart')readBatch(token);
  }catch(e){if(token!==run)return;status[key]={state:'failed'};if(state[key]?.length)$('#discoveryMessage').textContent='일부 수집원에 연결하지 못해 해당 항목은 이전 자료를 유지했습니다. 다음 자동 갱신 때 다시 확인합니다.';render();}
 }));
 if(token===run&&!away())readBatch(token);
 if(token===run){loading=false;lastChecked=Date.now();$('#refresh').disabled=false;render();if(today){await readBatch(token);render({accept:true});await readResearch(token,null,6);}else{scheduleUpdate();readResearch(token);}}
}
function readResearch(token,requested,limit=3){
 if(researching){if(requested){const r=B?.requestFor(requested);if(r){researchRequests.set(r.key,r);researchPending.add(r.key);render();}}return researchJob;}
 researchJob=performReadResearch(token,requested,limit);return researchJob;
}
async function performReadResearch(token,requested,limit=3){
 if(!B||away())return;
 if(requested){const r=B.requestFor(requested);if(r){researchRequests.set(r.key,r);researchPending.add(r.key);render();}}
 if(researching)return;
 researching=true;
 const queue=B.shortlist(data.filter(x=>x.lane==='current'),data.length).map(x=>B.requestFor(x)).filter(r=>r&&!(researchCache[r.key]?.until>Date.now())).filter((r,i,all)=>all.findIndex(t=>t.key===r.key)===i).slice(0,limit);
 const completed=new Set();
 try{while(queue.length||researchRequests.size){
  const request=researchRequests.size?researchRequests.values().next().value:queue.shift();researchRequests.delete(request.key);if(completed.has(request.key))continue;completed.add(request.key);
  if(token!==run||away())break;
  researchPending.add(request.key);render();
  let value;
  try{value=await json(request.url,controller.signal);}catch{value={version:B.VERSION,status:'sources_only',error:'research_unavailable',sources:[]};}
  researchPending.delete(request.key);if(token!==run)break;
  researchCache[request.key]={until:Date.now()+30*60000,value};
  const keep=Object.entries(researchCache).filter(([,v])=>v.until>Date.now()).sort((a,b)=>b[1].until-a[1].until).slice(0,15);researchCache=Object.fromEntries(keep);
  try{localStorage.setItem(RESEARCH_KEY,JSON.stringify(researchCache));}catch{}
  render();
 }}finally{researching=false;researchPending.clear();if(token===run){render();if(!findingToday)scheduleUpdate();}}
}
function syncTodayStatus(){
 const button=$('#findToday'),label=$('#todayPitchStatus');if(!button||!label)return;
 button.disabled=findingToday||globalThis.navigator?.onLine===false;
 button.textContent=findingToday?'발제 찾는 중…':'오늘 발제 찾기';
 root.setAttribute('aria-busy',String(findingToday));
 label.textContent=findingToday?(loading?'뉴스·공시·출자 자료를 확인하고 있습니다.':reading?'공시 본문에서 거래 조건을 확인하고 있습니다.':researching?'관련 원문과 기존 보도를 대조하고 있습니다.':'발제 후보를 정리하고 있습니다.'):(todayMessage||'최근 자료와 기존 보도를 대조해 발제 후보를 찾습니다.');
}
async function findToday(){
 if(findingToday)return;
 if(globalThis.navigator?.onLine===false){todayMessage='인터넷 연결을 확인한 뒤 다시 눌러 주세요.';syncTodayStatus();return;}
 findingToday=true;todayMessage='';clearTimeout(updateTimer);syncTodayStatus();
 try{
  // Finish work already in flight before starting another collection run.
  while(loading||reading||researching)await Promise.allSettled([loadJob,reviewJob,researchJob].filter(Boolean));
  view='current';query='';expanded=true;$('#discoverySearch').value='';
  for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b.dataset.discoveryView===view);b.setAttribute('aria-pressed',String(b.dataset.discoveryView===view));}
  await load({today:true});render({accept:true});
  const count=data.filter(x=>x.lane==='current'&&x.research?.status==='ready'&&x.article_brief?.angles?.length).length;
  const incomplete=Object.values(status).some(s=>s.state==='failed'||s.state==='partial');
  const unavailable=data.some(x=>/model_|research_unavailable/.test(x.research?.error||''));
  const sourceMissing=data.some(x=>x.research?.status==='sources_only');
  const clock=new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});
  todayMessage=count?`${clock} 확인 · 추천 기사 ${count}건. 추천기사 열기에서 방향과 근거를 볼 수 있습니다.`:unavailable?'AI 분석을 완료하지 못했습니다. 확보한 자료와 수집 상태를 확인해 주세요.':sourceMissing?'비교할 원문을 충분히 확보하지 못했습니다. 확보하지 못한 자료를 분석한 것처럼 추천하지 않았습니다.':'이번에 확인한 자료에서는 추천할 기사 방향을 찾지 못했습니다. 확보한 원문은 수집한 자료에서 볼 수 있습니다.';
  if(incomplete)todayMessage+=' 일부 수집원은 확인하지 못했습니다.';
 }catch{todayMessage='발제 찾기를 완료하지 못했습니다. 현재 결과를 유지했습니다. 다시 눌러 주세요.';}
 finally{findingToday=false;syncTodayStatus();scheduleUpdate();}
}
function openRecommendation(clue,trigger){
 const a=clue?.article_brief,p=a?.angles?.[0],dialog=$('#recommendationDialog');
 if(!p||clue.research?.status!=='ready'||!dialog)return;
 recommendationId=clue.clue_id;returnFocus=trigger;
 $('#recommendationTitle').textContent=p.headline;
 const facts=(a.facts||[]).filter(f=>p.basis_ids?.includes(f.id));
 const basis=facts.map(f=>{const source=clue.research.sources?.find(s=>s.source_id===f.source_id);return '<li>'+esc(f.text)+links(source?[{...source,label:source.publisher||source.title}]:[])+'</li>';}).join('');
 $('#recommendationBody').innerHTML='<section><h3>기사 방향</h3><p>'+esc(p.reason)+'</p></section><section><h3>기존 보도에서 더 나아갈 부분</h3><p>'+esc(p.new_information)+'</p></section>'+(a.why_now?.text?'<section><h3>지금 볼 이유</h3><p>'+esc(a.why_now.text)+'</p></section>':'')+(p.question?'<section><h3>후속 취재 질문</h3><p>'+esc(p.question)+'</p></section>':'')+(p.first_action?'<section><h3>먼저 확인할 자료</h3><p>'+esc(p.first_action)+'</p></section>':'')+'<section><h3>근거로 삼은 사실</h3><ul>'+basis+'</ul></section>'+(p.missing?'<section class="recommendation-missing"><h3>아직 확인할 내용</h3><p>'+esc(p.missing)+'</p></section>':'')+'<details><summary>모든 근거와 기존 보도 확인</summary>'+B.renderDetails(clue.research,clue.clue_id)+'</details>'+(clue.research.as_of?'<p class="recommendation-asof">분석 기준 '+esc(new Date(clue.research.as_of).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' · 한국시간</p>':'');
 $('#saveRecommendation').dataset.discoveryProject=clue.clue_id;$('#saveRecommendation').dataset.discoveryAngle='0';
 if(!dialog.open)dialog.showModal();$('#recommendationTitle').focus();
}
$('#findToday').onclick=findToday;
$('#closeRecommendation').onclick=()=>$('#recommendationDialog').close();
$('#recommendationDialog').addEventListener('close',()=>{recommendationId=null;if(returnFocus?.isConnected)returnFocus.focus();else $('#findToday').focus();if(pendingData&&!readingCard())render({accept:true});});
$('#refresh').onclick=()=>load();$('#discoveryRetry').onclick=()=>load();$('#discoveryReadMore').onclick=()=>readBatch(run);
$('#discoveryUpdates').onclick=()=>render({accept:true});
$('#discoveryMore').onclick=()=>{expanded=true;render({accept:true});};$('#discoverySearch').oninput=e=>{query=e.target.value.trim().toLowerCase();render({accept:true});};
root.addEventListener('click',e=>{
 const recommendation=e.target.closest('[data-recommendation-open]');if(recommendation){openRecommendation(data.find(x=>x.clue_id===recommendation.dataset.recommendationOpen),recommendation);return;}
 const jump=e.target.closest('[data-discovery-jump]');if(jump){
  const target=data.find(x=>x.clue_id===jump.dataset.discoveryJump);if(!target)return;
  view=target.lane;query='';expanded=true;$('#discoverySearch').value='';
  for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b.dataset.discoveryView===view);b.setAttribute('aria-pressed',String(b.dataset.discoveryView===view));}
  render({accept:true});const card=[...document.querySelectorAll('[data-discovery-card]')].find(el=>el.dataset.discoveryCard===target.clue_id);card?.scrollIntoView({block:'center'});card?.focus({preventScroll:true});return;
 }
 const tab=e.target.closest('[data-discovery-view]');if(tab){view=tab.dataset.discoveryView;for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b===tab);b.setAttribute('aria-pressed',String(b===tab));}render({accept:true});}
 const researchButton=e.target.closest('[data-discovery-research]');if(researchButton){const clue=data.find(x=>x.clue_id===researchButton.dataset.discoveryResearch);if(clue)readResearch(run,clue);return;}
 const button=e.target.closest('[data-discovery-project]');if(!button)return;
 let clue=data.find(x=>x.clue_id===button.dataset.discoveryProject);if(!clue)return;
 if(button.hasAttribute('data-discovery-angle')){try{clue=B.selectAngle(clue,Number(button.dataset.discoveryAngle));}catch(e){$('#discoveryMessage').textContent=e.message;return;}}
 try{const raw=localStorage.getItem(PROJECT_KEY),old=raw?JSON.parse(raw):[],merged=C.mergeProject(old,clue);localStorage.setItem(PROJECT_KEY,JSON.stringify(merged.rows));localStorage.setItem('pef_selected_project_v1',merged.id);location.href='/projects.html?project='+encodeURIComponent(merged.id);}catch(_){$('#discoveryMessage').textContent='취재 목록에 저장하지 못했습니다. 기존 목록과 저장공간을 확인해 주세요.';}
});
async function wake(){
 if(away()){scheduleUpdate();return;}
 if(!lastChecked||Date.now()-lastStarted>=UPDATE_MS)await load({automatic:true});
 else if(!loading){await readBatch(run);render();scheduleUpdate();}
}
document.addEventListener('visibilitychange',wake);
globalThis.addEventListener('online',()=>load({automatic:true}));
globalThis.addEventListener('offline',scheduleUpdate);
globalThis.addEventListener('pageshow',wake);
globalThis.addEventListener('scroll',()=>{if(pendingData&&!readingCard())render({accept:true});},{passive:true});
root.addEventListener('toggle',()=>{if(pendingData&&!readingCard())render({accept:true});},true);
load();
})();
