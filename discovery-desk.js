(function(){
'use strict';
const C=globalThis.IBDiscovery,$=s=>document.querySelector(s),root=$('#discoveryDesk');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REVIEW_KEY='ib_dart_reviews_v1',PROJECT_KEY='pef_my_reporting_projects_v1';
const endpoints={canonical:['출자공고·기존 분석','/api/signals?mode=clues&days=14'],news:['국내 뉴스','/api/news?feed=reader&days=7&limit=500'],foreign:['외신','/api/news?scope=foreign&days=7&limit=100'],dart:['DART 공시','/api/dart-feed?days=7&limit=800'],calendar:['취재일정','/api/news?feed=calendar']};
let state={},status={},reviews={},data=[],view='current',query='',expanded=false,run=0,controller,reading=false,failures=new Set();
const UPDATE_MS=5*60*1000;
const B=globalThis.MarketInStoryBrief,RESEARCH_KEY='ib_discovery_research_v1';
let researchCache=stored(RESEARCH_KEY,{}),researching=false,researchPending=new Set();
let loading=false,lastStarted=0,lastChecked=0,updateTimer=null,pendingData=null,renderedCards='';
const away=()=>document.hidden||globalThis.navigator?.onLine===false;
const readingCard=()=>document.querySelectorAll('[data-detail][open]').length>0||(globalThis.scrollY||0)>180;
function autoStatus(){
 const clock=lastChecked?new Date(lastChecked).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}):'';
 const text=away()?'화면으로 돌아오면 자동 확인':loading?'새 자료 자동 확인 중':'5분마다 자동 업데이트';
 $('#discoveryAutoStatus').textContent=text+(clock?' · 최근 확인 '+clock:'');
}
function scheduleUpdate(){
 clearTimeout(updateTimer);updateTimer=null;autoStatus();
 if(!away()&&!loading&&!reading)updateTimer=setTimeout(()=>load({automatic:true}),Math.max(1000,UPDATE_MS-(Date.now()-lastStarted)));
}
function stored(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'null')??fallback;}catch(_){return fallback;}}
function list(rows){return rows?.length?'<ul>'+rows.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>현재 확보한 내용이 없습니다.</p>';}
function links(rows){return (rows||[]).filter(s=>C.safeUrl(s.url)).map(s=>`<a href="${esc(C.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label||'원문')} ↗</a>`).join('');}
function card(x){
 const pitch=x.research?.status==='ready'&&x.article_brief?.angles?.[0];
 const research=pitch?(B?.renderBriefHtml({...x.research,headline_in_card:true})||''):'',researchDetails=(B?.renderDetails(x.research,x.clue_id)||'')+(!pitch?(B?.renderBriefHtml(x.research)||''):'');
 const heading=pitch?.headline||x.one_line_signal||x.headline;
 const evidence=(x.evidence||[]).map(f=>`${f.label}: ${f.before!==undefined?f.before+' → '+f.after:f.value+(f.unit?' '+f.unit:'')} · ${f.source?.location||'원문 위치 확인'}`);
 return `<article class="discovery-card ${pitch?'discovery-proposal':'discovery-reference'}"><div class="discovery-meta"><span>${pitch?'발제 후보':'참고자료'}</span><span>${esc(pitch?x.headline:x.detector_label)}</span><time>${esc(x.event_date?'예정 '+x.event_date:'자료 '+C.date(x.sort_date))}</time></div><h3>${esc(heading)}</h3>${pitch?'<p class="discovery-fact">'+esc(x.one_line_signal||x.changed_fact)+'</p>':''}${research}<div class="discovery-actions">${links((x.sources||[]).slice(0,2))}<button data-discovery-project="${esc(x.clue_id)}" ${pitch?'data-discovery-angle="0"':''}>취재에 담기 →</button></div><details data-detail="${esc(x.clue_id)}"><summary>근거 보기</summary><div class="discovery-detail">${researchDetails}${x.extracted_facts?.length?'<h4>원문 자동 추출 · 검수 전</h4>'+list(x.extracted_facts):''}${x.confirmed_facts?.length?'<h4>기존 분석의 확인 내용 · 자료 기준일 확인</h4>'+list(x.confirmed_facts):''}${x.reported?.length?'<h4>보도된 내용</h4>'+list(x.reported):''}${x.original_title?'<p>'+esc(x.original_title)+'</p>':''}${evidence.length?'<h4>원문 위치</h4>'+list(evidence):''}${x.previous_state?'<h4>비교 기준</h4><p>'+esc(x.previous_state)+'</p>':''}${x.hypothesis?'<h4>아직 확인하지 않은 가설</h4><p>'+esc(x.hypothesis)+'</p><p>'+esc(x.falsification)+'</p>':''}${x.background_relationships?.length?'<h4>기존 투자·사업 관계 · 이번 거래 참여 여부 미확인</h4>'+list(x.background_relationships.map(r=>r.investor+' · '+r.as_of))+links(x.background_relationships.map(r=>({label:r.investor+' 관계 출처',url:r.url}))):''}${x.related_sources?.length?'<h4>같은 기업·기관의 다른 보도 · 동일 사건 여부 미확인</h4>'+links(x.related_sources.map(s=>({...s,label:s.title}))):''}<h4>모든 출처</h4>${links(x.sources)}</div></details></article>`;
}
function render({accept=false}={}){
 const open=new Set([...document.querySelectorAll('[data-detail][open]')].map(e=>e.dataset.detail));
 const next=C.build({...state,reviews}).map(x=>{const r=B?.requestFor(x),cached=r&&researchCache[r.key];return B&&r?B.attach(x,cached?.until>Date.now()?cached.value:researchPending.has(r.key)?{version:B.VERSION,status:'loading'}:null):x;}).filter(Boolean);
 if(!accept&&data.length&&readingCard()&&JSON.stringify(next)!==JSON.stringify(data))pendingData=next;
 else {data=next;pendingData=null;}
 $('#discoveryUpdates').hidden=!pendingData;
 const counts={current:data.filter(x=>x.lane==='current').length,background:data.filter(x=>x.lane==='background').length};
 let rows=data.filter(x=>x.lane===view&&(!query||[x.headline,x.article_pitch,x.one_line_signal,...(x.entities||[])].join(' ').toLowerCase().includes(query)));
 const total=rows.length;if(view==='current'&&!expanded&&!query)rows=B?B.shortlist(rows):C.shortlist(rows);
 const proposals=rows.filter(x=>x.research?.status==='ready'&&x.article_brief?.angles?.length),references=rows.filter(x=>!proposals.includes(x));
 const group=(title,items)=>items.length?'<h3 class="discovery-section-title">'+title+' <span>'+items.length+'</span></h3>'+items.map(card).join(''):'';
 const html=rows.length?group('발제 후보',proposals)+group(view==='background'?'보관된 분석':'살펴볼 자료',references):`<div class="discovery-empty">${Object.values(status).some(s=>s.state==='loading')?'자료를 읽는 중입니다. 도착한 자료부터 표시합니다.':'현재 조건에서 추린 취재거리가 없습니다. 아래 수집 상태를 확인해 주세요.'}</div>`;
 if(html!==renderedCards){$('#discoveryCards').innerHTML=html;renderedCards=html;for(const el of document.querySelectorAll('[data-detail]'))if(open.has(el.dataset.detail))el.open=true;}
 const ready=data.filter(x=>x.lane==='current'&&x.article_brief?.angles?.length).length;
 $('#discoveryCounts').textContent=`발제 후보 ${ready}건 · 최근 참고자료 ${counts.current-ready}건`;
 const blocked=data.some(x=>/model_/.test(x.research?.error||''));
 $('#discoveryResearchStatus').textContent=researching?'최신 이슈의 원문과 마켓인 보도를 대조하고 있습니다.':blocked?'AI 분석 연결이 지연되고 있습니다. 확보한 원문은 아래에서 볼 수 있습니다.':!ready?'새 기사로 발전시킬 근거를 확보한 이슈부터 발제 후보에 올립니다.':'';
 $('#discoveryMore').hidden=!(view==='current'&&!expanded&&!query&&total>rows.length);$('#discoveryMore').textContent=`나머지 ${total-rows.length}건 보기`;
 $('#discoverySources').innerHTML=Object.entries(endpoints).map(([key,[name]])=>{const s=status[key]||{state:'loading'};return `<span class="${s.state}">${esc(name)} · ${esc(s.state==='loading'?'수집 중':s.state==='failed'?'불러오기 실패':s.detail||'연결됨')}</span>`;}).join('');
 const candidates=C.dartCandidates(state.dart),valid=candidates.filter(x=>C.validReview(x,reviews[x.rcept_no])).length,pending=candidates.filter(x=>!C.validReview(x,reviews[x.rcept_no])&&!failures.has(x.rcept_no)).length;
 $('#discoveryReviewStatus').textContent=candidates.length?`공시 원문 ${valid}/${candidates.length}건 읽음${reading?' · 읽는 중':''}${failures.size?' · 실패 '+failures.size+'건':''}${pending?' · 대기 '+pending+'건':''} · 단순 공시 목록은 DART 탭에서 확인`:'';
 $('#discoveryReadMore').hidden=!pending||reading;$('#discoveryRetry').hidden=!Object.values(status).some(s=>s.state==='failed'||s.state==='partial')&&!failures.size;
 $('#status').textContent=Object.values(status).some(s=>s.state==='loading')?'수집 결과 연결 중…':reading?'공시 근거 확인 중…':`최근 취재거리 ${counts.current}건`;
 autoStatus();
}
async function json(url,signal){
 const request=new AbortController(),abort=()=>request.abort();
 if(signal?.aborted)request.abort();else signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,65000);
 try{const r=await fetch(url,{signal:request.signal}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'조회 실패');return d;}
 finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
function saveReview(n,r){reviews[n]=r;try{const saved=stored(REVIEW_KEY,{});localStorage.setItem(REVIEW_KEY,JSON.stringify({...saved,[n]:r}));}catch(_){$('#discoveryMessage').textContent='원문 결과를 이 기기에 저장하지 못했습니다. 현재 화면에서는 확인할 수 있습니다.';}}
async function readBatch(token){
 if(reading||away())return;reading=true;render();
 const queue=C.dartCandidates(state.dart).filter(x=>!C.validReview(x,reviews[x.rcept_no])&&!failures.has(x.rcept_no));
 const signal=controller.signal;
 await Promise.all([0,1].map(async()=>{while(queue.length&&token===run&&!away()){const x=queue.shift();try{const r=await json('/api/dart-feed?action=review&rcept_no='+x.rcept_no,signal);if(token!==run)return;if(!C.validReview(x,r))throw Error('원문 불일치');saveReview(x.rcept_no,r);}catch(e){if(token!==run)return;failures.add(x.rcept_no);}render();}}));
 if(token===run){reading=false;render();if(!loading)scheduleUpdate();}
}
async function load({automatic=false}={}){
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
 if(token===run){loading=false;lastChecked=Date.now();$('#refresh').disabled=false;render();scheduleUpdate();readResearch(token);}
}
async function readResearch(token){
 if(!B||researching||away())return;
 researching=true;
 const queue=B.shortlist(data.filter(x=>x.lane==='current'),data.length).map(x=>B.requestFor(x)).filter(r=>r&&!(researchCache[r.key]?.until>Date.now())).filter((r,i,all)=>all.findIndex(t=>t.key===r.key)===i).slice(0,3);
 try{for(const request of queue){
  if(token!==run||away())break;
  researchPending.add(request.key);render();
  let value;
  try{value=await json(request.url,controller.signal);}catch{value={version:B.VERSION,status:'sources_only',error:'research_unavailable',sources:[]};}
  researchPending.delete(request.key);if(token!==run)break;
  researchCache[request.key]={until:Date.now()+30*60000,value};
  const keep=Object.entries(researchCache).filter(([,v])=>v.until>Date.now()).sort((a,b)=>b[1].until-a[1].until).slice(0,15);researchCache=Object.fromEntries(keep);
  try{localStorage.setItem(RESEARCH_KEY,JSON.stringify(researchCache));}catch{}
  render();
 }}finally{researching=false;researchPending.clear();if(token===run)render();}
}
$('#refresh').onclick=()=>load();$('#discoveryRetry').onclick=()=>load();$('#discoveryReadMore').onclick=()=>readBatch(run);
$('#discoveryUpdates').onclick=()=>render({accept:true});
$('#discoveryMore').onclick=()=>{expanded=true;render({accept:true});};$('#discoverySearch').oninput=e=>{query=e.target.value.trim().toLowerCase();render({accept:true});};
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-discovery-view]');if(tab){view=tab.dataset.discoveryView;for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b===tab);b.setAttribute('aria-pressed',String(b===tab));}render({accept:true});}
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
