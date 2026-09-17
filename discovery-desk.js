(function(){
'use strict';
const C=globalThis.IBDiscovery,$=s=>document.querySelector(s),root=$('#discoveryDesk');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REVIEW_KEY='ib_dart_reviews_v1',PROJECT_KEY='pef_my_reporting_projects_v1';
const endpoints={canonical:['출자공고·기존 분석','/api/signals?mode=clues&days=14'],news:['국내 뉴스','/api/news?feed=reader&days=7&limit=500'],foreign:['외신','/api/news?scope=foreign&days=7&limit=100'],dart:['DART 공시','/api/dart-feed?days=7&limit=800'],calendar:['취재일정','/api/news?feed=calendar']};
let state={},status={},reviews={},data=[],view='current',query='',expanded=false,run=0,controller,reading=false,failures=new Set();
function stored(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'null')??fallback;}catch(_){return fallback;}}
function list(rows){return rows?.length?'<ul>'+rows.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>현재 확보한 내용이 없습니다.</p>';}
function links(rows){return (rows||[]).filter(s=>C.safeUrl(s.url)).map(s=>`<a href="${esc(C.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label||'원문')} ↗</a>`).join('');}
function card(x){
 const evidence=(x.evidence||[]).map(f=>`${f.label}: ${f.before!==undefined?f.before+' → '+f.after:f.value+(f.unit?' '+f.unit:'')} · ${f.source?.location||'원문 위치 확인'}`);
 return `<article class="discovery-card"><div class="discovery-meta"><span>${esc(x.detector_label)}</span><span>${esc(x.fact_status==='보도'?'보도 기반 · 당사자 확인 필요':x.evidence?'원문 추출 · 검수 전':x.fact_status||'단서')}</span><time>${esc(x.event_date?'예정 '+x.event_date:'자료 '+C.date(x.sort_date))}</time></div><h3>${esc(x.headline)}</h3><p class="discovery-fact">${esc(x.one_line_signal||x.changed_fact)}</p><p class="discovery-reason">${esc(x.reason)}</p><div class="discovery-question"><b>확인할 질문</b><p>${esc(x.questions?.[0]||x.next_action)}</p><span>${esc((x.contacts||[]).slice(0,3).join(' · '))}</span></div><div class="discovery-actions">${links((x.sources||[]).slice(0,2))}<button data-discovery-project="${esc(x.clue_id)}">취재에 담기 →</button></div><details data-detail="${esc(x.clue_id)}"><summary>근거·추가 질문</summary><div class="discovery-detail">${x.extracted_facts?.length?'<h4>원문 자동 추출 · 검수 전</h4>'+list(x.extracted_facts):''}${x.confirmed_facts?.length?'<h4>기존 분석의 확인 내용 · 자료 기준일 확인</h4>'+list(x.confirmed_facts):''}${x.reported?.length?'<h4>보도된 내용</h4>'+list(x.reported):''}${x.original_title?'<p>'+esc(x.original_title)+'</p>':''}${evidence.length?'<h4>원문 위치</h4>'+list(evidence):''}<h4>추가 확인</h4>${list(x.questions)}${x.previous_state?'<h4>비교 기준</h4><p>'+esc(x.previous_state)+'</p>':''}${x.hypothesis?'<h4>아직 확인하지 않은 가설</h4><p>'+esc(x.hypothesis)+'</p><p>'+esc(x.falsification)+'</p>':''}${x.background_relationships?.length?'<h4>기존 투자·사업 관계 · 이번 거래 참여 여부 미확인</h4>'+list(x.background_relationships.map(r=>r.investor+' · '+r.as_of))+links(x.background_relationships.map(r=>({label:r.investor+' 관계 출처',url:r.url}))):''}${x.related_sources?.length?'<h4>같은 기업·기관의 다른 보도 · 동일 사건 여부 미확인</h4>'+links(x.related_sources.map(s=>({...s,label:s.title}))):''}<h4>모든 출처</h4>${links(x.sources)}</div></details></article>`;
}
function render(){
 const open=new Set([...document.querySelectorAll('[data-detail][open]')].map(e=>e.dataset.detail));
 data=C.build({...state,reviews});
 const counts={current:data.filter(x=>x.lane==='current').length,background:data.filter(x=>x.lane==='background').length};
 let rows=data.filter(x=>x.lane===view&&(!query||[x.headline,x.one_line_signal,...(x.entities||[])].join(' ').toLowerCase().includes(query)));
 const total=rows.length;if(view==='current'&&!expanded&&!query)rows=C.shortlist(rows);
 $('#discoveryCards').innerHTML=rows.length?rows.map(card).join(''):`<div class="discovery-empty">${Object.values(status).some(s=>s.state==='loading')?'자료를 읽는 중입니다. 도착한 자료부터 표시합니다.':'현재 조건에서 추린 취재거리가 없습니다. 아래 수집 상태를 확인해 주세요.'}</div>`;
 for(const el of document.querySelectorAll('[data-detail]'))if(open.has(el.dataset.detail))el.open=true;
 $('#discoveryCounts').textContent=`최근 자료 ${counts.current}건 · 기존 분석 ${counts.background}건`;
 $('#discoveryMore').hidden=!(view==='current'&&!expanded&&!query&&total>rows.length);$('#discoveryMore').textContent=`나머지 ${total-rows.length}건 보기`;
 $('#discoverySources').innerHTML=Object.entries(endpoints).map(([key,[name]])=>{const s=status[key]||{state:'loading'};return `<span class="${s.state}">${esc(name)} · ${esc(s.state==='loading'?'수집 중':s.state==='failed'?'불러오기 실패':s.detail||'연결됨')}</span>`;}).join('');
 const candidates=C.dartCandidates(state.dart),valid=candidates.filter(x=>C.validReview(x,reviews[x.rcept_no])).length,pending=candidates.filter(x=>!C.validReview(x,reviews[x.rcept_no])&&!failures.has(x.rcept_no)).length;
 $('#discoveryReviewStatus').textContent=candidates.length?`공시 원문 ${valid}/${candidates.length}건 읽음${reading?' · 읽는 중':''}${failures.size?' · 실패 '+failures.size+'건':''}${pending?' · 대기 '+pending+'건':''} · 단순 공시 목록은 DART 탭에서 확인`:'';
 $('#discoveryReadMore').hidden=!pending||reading;$('#discoveryRetry').hidden=!Object.values(status).some(s=>s.state==='failed'||s.state==='partial')&&!failures.size;
 $('#status').textContent=Object.values(status).some(s=>s.state==='loading')?'수집 결과 연결 중…':reading?'공시 근거 확인 중…':`최근 취재거리 ${counts.current}건`;
}
async function json(url,signal){const r=await fetch(url,{signal}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'조회 실패');return d;}
function saveReview(n,r){reviews[n]=r;try{const saved=stored(REVIEW_KEY,{});localStorage.setItem(REVIEW_KEY,JSON.stringify({...saved,[n]:r}));}catch(_){$('#discoveryMessage').textContent='원문 결과를 이 기기에 저장하지 못했습니다. 현재 화면에서는 확인할 수 있습니다.';}}
async function readBatch(token){
 if(reading)return;reading=true;render();
 const queue=C.dartCandidates(state.dart).filter(x=>!C.validReview(x,reviews[x.rcept_no])&&!failures.has(x.rcept_no)).slice(0,20);
 const signal=controller.signal;
 await Promise.all([0,1].map(async()=>{while(queue.length&&token===run){const x=queue.shift();try{const r=await json('/api/dart-feed?action=review&rcept_no='+x.rcept_no,signal);if(token!==run)return;if(!C.validReview(x,r))throw Error('원문 불일치');saveReview(x.rcept_no,r);}catch(e){if(token!==run)return;failures.add(x.rcept_no);}render();}}));
 if(token===run){reading=false;render();}
}
async function load(){
 const token=++run;controller?.abort();controller=new AbortController();state={};status=Object.fromEntries(Object.keys(endpoints).map(k=>[k,{state:'loading'}]));reading=false;failures=new Set();reviews=stored(REVIEW_KEY,{});expanded=false;$('#discoveryMessage').textContent='';render();
 await Promise.allSettled(Object.entries(endpoints).map(async([key,[,url]])=>{
  try{const d=await json(url,controller.signal);if(token!==run)return;
   if(key==='canonical'){state.canonical=d.items||[];state.official=d.source_signals||[];}
   else state[key]=key==='calendar'?d.events||[]:d.items||[];
   if(key==='news')state.newsIssues=d.issues||[];
   const count=(state[key]||[]).length;const partial=d.coverage?.complete===false||d.collection_status?.partial||d.sources?.some(s=>!s.ok)||key==='canonical'&&Object.values(d.diagnostics?.providers?.official||{}).some(v=>!v);
   const capped=d.coverage?.display_limited||d.collection_status?.truncated,translationFailed=Number(d.translation?.failed)||0;
   status[key]={state:partial||translationFailed?'partial':'ready',detail:count+'건 확인'+(partial?' · 일부 수집 실패':'')+(capped?' · 조회 상한 적용':'')+(translationFailed?' · 번역 미확보 '+translationFailed+'건':'')};render();
   if(key==='dart')await readBatch(token);
  }catch(e){if(token!==run)return;status[key]={state:'failed'};render();}
 }));
}
$('#refresh').onclick=load;$('#discoveryRetry').onclick=load;$('#discoveryReadMore').onclick=()=>readBatch(run);
$('#discoveryMore').onclick=()=>{expanded=true;render();};$('#discoverySearch').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-discovery-view]');if(tab){view=tab.dataset.discoveryView;for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b===tab);b.setAttribute('aria-pressed',String(b===tab));}render();}
 const button=e.target.closest('[data-discovery-project]');if(!button)return;
 const clue=data.find(x=>x.clue_id===button.dataset.discoveryProject);if(!clue)return;
 try{const raw=localStorage.getItem(PROJECT_KEY),old=raw?JSON.parse(raw):[],merged=C.mergeProject(old,clue);localStorage.setItem(PROJECT_KEY,JSON.stringify(merged.rows));localStorage.setItem('pef_selected_project_v1',merged.id);location.href='/projects.html?project='+encodeURIComponent(merged.id);}catch(_){$('#discoveryMessage').textContent='취재 목록에 저장하지 못했습니다. 기존 목록과 저장공간을 확인해 주세요.';}
});
load();
})();
