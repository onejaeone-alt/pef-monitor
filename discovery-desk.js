(function(){
'use strict';
const C=globalThis.IBDiscovery,$=s=>document.querySelector(s),root=$('#discoveryDesk');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REVIEW_KEY='ib_dart_reviews_v1',PROJECT_KEY='pef_my_reporting_projects_v1';
const endpoints={canonical:['출자공고·기존 분석','/api/signals?mode=clues&days=14'],news:['국내 뉴스','/api/news?feed=reader&days=14&limit=500'],foreign:['외신','/api/news?scope=foreign&days=14&limit=100'],dart:['DART 공시','/api/dart-feed?days=7&limit=800'],calendar:['취재일정','/api/news?feed=calendar']};
let state={},status={},reviews={},data=[],view='current',query='',expanded=false,run=0,controller,reading=false,failures=new Set();
const UPDATE_MS=5*60*1000;
const P=globalThis.DiscoveryPatterns,B=globalThis.MarketInStoryBrief,RESEARCH_KEY='ib_discovery_research_v1';
const R=globalThis.DiscoveryRecommendations,ARCHIVE_KEY='ib_pitch_sources_v1',LAST_KEY='ib_pitch_last_v1',PATTERN_KEY='ib_accumulated_patterns_v1';
let archive=stored(ARCHIVE_KEY,{}),lastPitches=stored(LAST_KEY,null),category='all';
if(!archive||typeof archive!=='object'||Array.isArray(archive))archive={};
let patternSaved=stored(PATTERN_KEY,null),patternSnapshot=patternSaved?.snapshot||{},accumulatedResult=patternSaved&&Array.isArray(patternSaved.items)?patternSaved:null,archiveSaveFailed=false,patternSaveFailed=false;
const categories={all:'전체',lp:'LP 출자',pef:'PEF·GP',ma:'M&A',finance:'인수금융·조달',vc:'VC',policy:'정책·일정'};
const isPitch=x=>x.detector==='recommendation'||x.research?.status==='ready'&&x.article_brief?.angles?.length;
function mergeMaterial(oldRows,newRows){
 const merged=new Map();
 for(const row of [...(Array.isArray(oldRows)?oldRows:[]),...(Array.isArray(newRows)?newRows:[])]){
  if(!row||!C.safeUrl(row.source_url||row.url))continue;
  const key=C.safeUrl(row.source_url||row.url),old=merged.get(key)||{},next={...old,...row,source_url:key};
  for(const field of ['summary','snippet','description','body_text','content_text'])if(!next[field]&&old[field])next[field]=old[field];
  merged.set(key,next);
 }
 return [...merged.values()].filter(x=>Date.parse(x.published_at||x.date)>=Date.now()-90*86400000).sort((a,b)=>String(b.published_at||b.date).localeCompare(String(a.published_at||a.date))).slice(0,1200);
}
function rememberSources(key,rows){
 if(key==='canonical')archive.canonical=[...new Map([...(Array.isArray(archive.canonical)?archive.canonical:[]),...(Array.isArray(rows)?rows:[])].filter(x=>x?.clue_id&&x.sources?.some(s=>C.safeUrl(s.url))).map(x=>[x.clue_id,x])).values()].sort((a,b)=>String(b.sort_date).localeCompare(String(a.sort_date))).slice(0,200);
 else if(['news','foreign','official'].includes(key))archive[key]=mergeMaterial(archive[key],rows);
 else return;
 try{localStorage.setItem(ARCHIVE_KEY,JSON.stringify(archive));archiveSaveFailed=false;}catch{archiveSaveFailed=true;}
}
function recommendationInput(){return {...state,reviews,canonical:[...new Map([...(Array.isArray(archive.canonical)?archive.canonical:[]),...(state.canonical||[])].map(x=>[x.clue_id,x])).values()],...Object.fromEntries(['news','foreign','official'].map(k=>[k,mergeMaterial(archive[k],state[k])]))};}
function refreshAccumulated(){
 if(!P?.accumulate||!R)return;
 accumulatedResult=P.accumulate(recommendationInput(),{engine:R,previous:patternSnapshot,now:Date.now()});
 patternSnapshot=accumulatedResult.snapshot;
 try{localStorage.setItem(PATTERN_KEY,JSON.stringify(accumulatedResult));patternSaveFailed=false;}catch{patternSaveFailed=true;}
}
const formatTime=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
let researchCache=stored(RESEARCH_KEY,{}),researching=false,researchPending=new Set(),researchRequests=new Map();
let findingToday=false,todayMessage='',loadJob=null,reviewJob=null,researchJob=null,recommendationId=null,returnFocus=null;
let loading=false,lastStarted=0,lastChecked=0,updateTimer=null,pendingData=null,renderedCards='';
const away=()=>document.hidden||globalThis.navigator?.onLine===false;
const readingCard=()=>!!$('#recommendationDialog')?.open||document.querySelectorAll('[data-detail][open]').length>0||(globalThis.scrollY||0)>180;
function autoStatus(){
 const clock=lastChecked?new Date(lastChecked).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}):'';
 const text=away()?'화면으로 돌아오면 자동 확인':loading?'새 자료 자동 확인 중':'5분마다 새 자료 확인';
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
 if(x.detector==='accumulated_pattern')return `<dl class="discovery-pattern-summary"><dt>발견한 특징</dt><dd>${esc(s.feature)}</dd></dl><p class="discovery-baseline">최근 비교 ${esc(formatTime(x.checked_at))}</p>`;
 const jump=ref?`<button data-discovery-jump="${esc(ref.clue_id)}">기존 특징과 근거 보기 →</button>`:x.linked_update?`<button data-discovery-jump="${esc(x.linked_update.clue_id)}">연결된 새 자료 ${x.linked_update.count}건 →</button>`:'';
 return `<dl class="discovery-pattern-summary"><dt>발견한 특징</dt><dd>${esc(s.feature)}</dd></dl>${s.asOf?`<p class="discovery-baseline">기존 자료 기준 ${esc(s.asOf)}</p>`:''}${jump?`<div class="discovery-pattern-link">${jump}</div>`:''}`;
}
function pointText(x){
 const values=[x.changed_fact,x.one_line_signal,x.pitch_summary,x.why_now,x.reason]
  .filter(v=>typeof v==='string'&&v.trim()).map(v=>v.replace(/\s+/g,' ').trim());
 const picked=[];
 for(const value of values){
  const n=value.replace(/[^0-9A-Za-z가-힣]/g,'');
  if(!n||picked.some(old=>{const o=old.replace(/[^0-9A-Za-z가-힣]/g,'');return o===n||o.includes(n)||n.includes(o)}))continue;
  picked.push(value);
  if(picked.length===2)break;
 }
 return picked.join(' ');
}
function discoveryBrief(x){
 return '<dl class="discovery-pattern-summary discovery-reporting-brief"><dt>포인트</dt><dd>'+esc(pointText(x)||'근거 자료에서 실제 변화를 확인하세요.')+'</dd></dl>';
}
function inbox(rows){
 if(!rows.length)return '';
 const open=document.querySelector('[data-discovery-inbox]')?.open;
 return `<details class="discovery-inbox" data-discovery-inbox ${open?'open':''}><summary>수집한 자료 ${rows.length}건</summary><p>기사 방향이 나온 추천과 별도로, 수집한 원문을 확인할 수 있습니다.</p>${rows.map(x=>`<div class="discovery-inbox-row"><strong>${esc(x.one_line_signal||x.headline)}</strong><span>${esc(x.research?.status==='ready'?'원문을 읽었지만 새 기사 방향을 찾지 못함':x.research?.error==='insufficient_sources'?'비교할 원문 부족':/model_/.test(x.research?.error||'')?'AI 분석 미완료':'원문 분석 대기')}</span>${links((x.sources||[]).slice(0,2))}${B?.requestFor(x)?`<button data-discovery-research="${esc(x.clue_id)}">원문 대조</button>`:''}</div>`).join('')}</details>`;
}
function pitchEvidence(x,limit=4){
 return '<ul class="pitch-evidence">'+(x.evidence||[]).slice(0,limit).map(f=>'<li>'+esc(f.text)+links([{url:f.url,label:[f.label,f.date?C.date(f.date):'',f.read_level==='title'?'제목 확인':f.read_level==='summary'?'제목·요약 확인':'본문 확인'].filter(Boolean).join(' · ')}])+'</li>').join('')+'</ul>';
}
function scoreDetails(x){
 const names={specificity:'기사 구체성',importance:'IB 중요도',timeliness:'시의성',evidence:'자료 충실도',attention:'보도 관심도'};
 return '<p>추천 순위를 정하는 점수입니다. 사실의 확실성을 뜻하지 않습니다.</p><div class="pitch-score-grid">'+Object.entries(x.score_breakdown||{}).map(([key,value])=>'<span>'+esc(names[key]||key)+' <b>'+esc(typeof value==='object'?value.score:value)+'</b></span>').join('')+'</div>'+list(x.ranking_reasons);
}
function recommendationCard(x){
 return `<article data-discovery-card="${esc(x.clue_id)}" tabindex="-1" class="discovery-card discovery-proposal"><div class="discovery-meta"><span>${esc(x.type_label||'기사 추천')}</span><span>${esc(categories[x.category]||'IB')}</span><time>${esc(C.date(x.sort_date))}</time></div><h3>${esc(x.headline)}</h3>${discoveryBrief(x)}<div class="pitch-basis"><b>추천 근거</b>${pitchEvidence(x,3)}</div>${x.retained_at?'<p class="discovery-note">이전 추천 · '+esc(new Date(x.retained_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' 기준</p>':''}<div class="discovery-actions"><button class="recommendation-open" data-recommendation-open="${esc(x.clue_id)}">추천기사 열기</button></div><details data-detail="${esc(x.clue_id)}"><summary>추천 기준 · ${esc(x.score)}점</summary><div class="discovery-detail">${scoreDetails(x)}</div></details></article>`;
}
const NUMBER_KEY='ib_insight_numbers_v1';
let numberCache=stored(NUMBER_KEY,{}),numberPending=new Set(),numberErrors=new Map(),numberSaveFailed=false;
if(!numberCache||typeof numberCache!=='object'||Array.isArray(numberCache))numberCache={};
function numberInput(x){
 const seen=new Set();return [...(x.sources||[]),...(x.previous_sources||[])].filter(s=>{const u=C.safeUrl(s.url);if(!u||seen.has(u))return false;seen.add(u);return true;}).slice(0,60).map(s=>({url:s.url,title:String(s.title||s.label||'자료').slice(0,500),signature:s.signature||''}));
}
function numberSignature(x){return JSON.stringify(numberInput(x));}
function numberValue(v,unit){return Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+' '+unit;}
function numericalPanel(x){
 const pending=numberPending.has(x.clue_id),saved=numberCache[x.clue_id],value=saved?.value,stale=saved&&saved.signature!==numberSignature(x);
 const error=numberErrors.get(x.clue_id),label=pending?'원문에서 수치 추출 중…':stale?'새 자료로 수치 분석':value?'수치 다시 분석':'수치 추출·비교';
 const button=`<button data-insight-numbers="${esc(x.clue_id)}" ${pending?'disabled':''}>${label}</button>`;
 let body='';
 if(value){
  const coverage=value.coverage||{};
  body+=`<p class="discovery-note">분석 ${esc(formatTime(value.as_of))} · 연결 자료 ${coverage.total||0}건 중 ${coverage.selected||0}건 검토 · 본문 확보 ${coverage.read||0}건${coverage.total>coverage.selected?' · 최근 자료부터 최대 12건 분석':''}${stale?' · 새 자료가 추가돼 재분석 필요':''}</p>`;
  if(value.rows?.length){
   body+='<p class="discovery-note">원문 자동 추출 · 검수 전. 중복 보도는 한 항목으로 묶으며, 전체 시장의 통계가 아닙니다.</p>';
   if(value.comparisons?.length){body+='<h4>수치로 확인한 변화</h4><ul>'+value.comparisons.map(c=>'<li>'+esc(c.subject+' · '+c.scope+' · '+c.metric+' ('+c.state+')')+'<br>'+esc(c.before_period+'년 '+numberValue(c.before,c.unit)+' → '+c.after_period+'년 '+numberValue(c.after,c.unit))+'<br><strong>'+esc((c.delta>0?'+':'')+numberValue(c.delta,c.unit==='%'?'%p':c.unit)+(c.percent!==null?' / '+(c.percent>0?'+':'')+c.percent+'%':''))+'</strong></li>').join('')+'</ul>';}
   else body+='<p>추출한 수치는 아래에 정리했습니다. 같은 사업·기준의 전년도 수치가 없어 증감률은 계산하지 않았습니다.</p>';
   body+='<div class="insight-number-table"><table><caption>원문에서 추출한 수치</caption><thead><tr><th>기관·대상</th><th>항목·기준</th><th>연도·상태</th><th>수치</th><th>근거</th></tr></thead><tbody>'+value.rows.map(r=>'<tr><td>'+esc(r.subject)+'<br>'+esc(r.scope)+'</td><td>'+esc(r.metric)+'<br>'+esc(r.basis)+'</td><td>'+esc(r.period||'연도 미확인')+'<br>'+esc(r.state)+'</td><td>'+esc(r.value_text)+(r.conflict?'<br><b>수치 충돌 · 비교 제외</b>':'')+'</td><td><details><summary>원문 '+r.sources.length+'건</summary>'+r.sources.map(s=>'<p>'+esc(s.quote)+'</p><small>'+esc(s.location)+'</small>'+links([{url:s.url,label:s.title||'원문'}])).join('')+'</details></td></tr>').join('')+'</tbody></table></div>';
  }else body+='<p>'+esc(value.error==='model_key_unconfigured'?'AI 분석 연결이 설정되지 않았습니다.':value.error==='insufficient_sources'?'연결된 자료의 본문을 확보하지 못했습니다.':value.status==='unavailable'?'이번 수치 분석을 완료하지 못했습니다. 다시 시도해 주세요.':'확보한 본문에서 단위와 근거가 명확한 수치를 찾지 못했습니다.')+'</p>';
 }
 if(error)body+='<p role="status">'+esc(error)+'</p>';
 if(numberSaveFailed)body+='<p>저장공간이 부족해 분석 결과를 이 기기에 보관하지 못했습니다.</p>';
 return '<section class="insight-numbers" aria-label="수치 분석"><div class="discovery-actions">'+button+'</div>'+body+'</section>';
}
async function analyzeNumbers(x){
 if(!x||numberPending.has(x.clue_id))return;
 if(numberPending.size>=2){numberErrors.set(x.clue_id,'진행 중인 수치 분석이 끝난 뒤 다시 눌러주세요.');render({accept:true});return;}
 const signature=numberSignature(x);numberPending.add(x.clue_id);numberErrors.delete(x.clue_id);render({accept:true});
 try{
  const response=await fetch('/api/signals?mode=insight-numbers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sources:numberInput(x)}),signal:AbortSignal.timeout(65000)});
  if(!response.ok)throw Error('request_failed');const value=await response.json();if(!value.ok)throw Error('analysis_failed');
  if(value.status==='unavailable')throw Error(value.error||'analysis_failed');
  numberCache[x.clue_id]={signature,value};
  numberCache=Object.fromEntries(Object.entries(numberCache).sort((a,b)=>String(b[1]?.value?.as_of).localeCompare(String(a[1]?.value?.as_of))).slice(0,20));
  try{localStorage.setItem(NUMBER_KEY,JSON.stringify(numberCache));numberSaveFailed=false;}catch{numberSaveFailed=true;}
 }catch(e){numberErrors.set(x.clue_id,e.message==='model_key_unconfigured'?'AI 분석 연결이 설정되지 않았습니다.':e.message==='research_busy'?'다른 수치 분석이 진행 중입니다. 잠시 뒤 다시 눌러주세요.':'수치 분석을 완료하지 못했습니다. 다시 시도해 주세요.');}
 finally{numberPending.delete(x.clue_id);render({accept:true});}
}

function accumulatedCard(x){
 const sourceList=rows=>(rows||[]).length?'<ul class="pitch-evidence">'+rows.map(r=>'<li>'+esc(r.title||r.label||'관련 자료')+links([{url:r.url,label:[r.label,r.date?C.date(r.date):'',r.read_level==='title'?'제목 확인':r.read_level==='summary'?'제목·요약 확인':r.read_level==='body'?'본문 확인':'확인 범위 미표시'].filter(Boolean).join(' · ')}])+'</li>').join('')+'</ul>':'';
 const merged=[...(x.new_sources||[]),...(x.revised_sources||[]),...(x.sources||[]),...(x.previous_sources||[])];
 const seen=new Set(),related=merged.filter(r=>{const k=C.safeUrl(r?.url)||String(r?.title||'');if(!k||seen.has(k))return false;seen.add(k);return true;}).slice(0,12);
 return `<article data-discovery-card="${esc(x.clue_id)}" tabindex="-1" class="discovery-card discovery-reference"><div class="discovery-meta"><span>${esc(x.detector_label||'누적자료 비교')}</span><time>최근 자료 ${esc(C.date(x.sort_date))}</time></div><h3>${esc(x.headline)}</h3>${patternSummary(x)}${numericalPanel(x)}${x.article_pitch?'<p class="pitch-now"><b>취재할 기사</b> '+esc(x.article_pitch)+'</p>':''}${x.questions?.length?'<h4>취재 질문</h4>'+list(x.questions):''}<details data-detail="${esc(x.clue_id)}"><summary>연결된 자료 ${related.length}건</summary><div class="discovery-detail">${sourceList(related)}</div></details></article>`;
}
function card(x){
 if(x.detector==='recommendation')return recommendationCard(x);
 if(x.detector==='accumulated_pattern')return accumulatedCard(x);
 const pitch=x.research?.status==='ready'&&x.article_brief?.angles?.[0];
 const research=pitch?'<dl class="discovery-pattern-summary"><dt>추천 이유</dt><dd>'+esc(pitch.reason)+'</dd><dt>후속 취재 질문</dt><dd>'+esc(pitch.question)+'</dd></dl>':'',researchDetails=(B?.renderDetails(x.research,x.clue_id)||'')+(!pitch?(B?.renderBriefHtml(x.research)||''):'');
 const heading=pitch?.headline||x.one_line_signal||x.headline;
 const evidence=(x.evidence||[]).map(f=>`${f.label}: ${f.before!==undefined?f.before+' → '+f.after:f.value+(f.unit?' '+f.unit:'')} · ${f.source?.location||'원문 위치 확인'}`);
 return `<article data-discovery-card="${esc(x.clue_id)}" tabindex="-1" class="discovery-card ${pitch?'discovery-proposal':'discovery-reference'}"><div class="discovery-meta"><span>${pitch?'추천 기사':'참고자료'}</span><span>${esc(pitch?x.headline:x.detector_label)}</span><time>${esc(x.event_date?'예정 '+x.event_date:'자료 '+C.date(x.sort_date))}</time></div><h3>${esc(heading)}</h3>${pitch?'<p class="discovery-fact">'+esc(x.one_line_signal||x.changed_fact)+'</p>':''}${research}${pitch?'':patternSummary(x)}<div class="discovery-actions">${pitch?`<button class="recommendation-open" data-recommendation-open="${esc(x.clue_id)}">추천기사 열기</button>`:''}${!pitch&&B?.requestFor(x)?`<button class="discovery-research-button" data-discovery-research="${esc(x.clue_id)}" ${researchPending.has(B.requestFor(x).key)?'disabled':''}>${researchPending.has(B.requestFor(x).key)?'원문 비교 중…':x.research?'원문 다시 비교':'원문 비교'}</button>`:''}${links((x.sources||[]).slice(0,2))}</div><details data-detail="${esc(x.clue_id)}"><summary>근거 보기</summary><div class="discovery-detail">${researchDetails}${x.pattern_ref?'<h4>기존 분석의 비교 자료</h4>'+links(x.pattern_ref.sources):''}${x.extracted_facts?.length?'<h4>원문 자동 추출 · 검수 전</h4>'+list(x.extracted_facts):''}${x.confirmed_facts?.length?'<h4>기존 분석의 확인 내용 · 자료 기준일 확인</h4>'+list(x.confirmed_facts):''}${x.reported?.length?'<h4>보도된 내용</h4>'+list(x.reported):''}${x.original_title?'<p>'+esc(x.original_title)+'</p>':''}${evidence.length?'<h4>원문 위치</h4>'+list(evidence):''}${x.previous_state?'<h4>비교 기준</h4><p>'+esc(x.previous_state)+'</p>':''}${x.background_relationships?.length?'<h4>기존 투자·사업 관계 · 이번 거래 참여 여부 미확인</h4>'+list(x.background_relationships.map(r=>r.investor+' · '+r.as_of))+links(x.background_relationships.map(r=>({label:r.investor+' 관계 출처',url:r.url}))):''}${x.related_sources?.length?'<h4>같은 기업·기관의 다른 보도 · 동일 사건 여부 미확인</h4>'+links(x.related_sources.map(s=>({...s,label:s.title}))):''}<h4>모든 출처</h4>${links(x.sources)}</div></details></article>`;
}
function render({accept=false}={}){
 const open=new Set([...document.querySelectorAll('[data-detail][open]')].map(e=>e.dataset.detail));
 const accumulatedInput=recommendationInput();
 let next=C.build({...state,reviews,canonical:accumulatedInput.canonical}).map(x=>{const r=B?.requestFor(x),cached=r&&researchCache[r.key];return B&&r?B.attach(x,cached?.until>Date.now()?cached.value:researchPending.has(r.key)?{version:B.VERSION,status:'loading'}:null):x;}).filter(Boolean);
 if(P)next=P.connect(next,accumulatedInput);
 if(accumulatedResult?.items)next=[...accumulatedResult.items,...next];
 if(R){
  let pitches=R.build(accumulatedInput,{limit:12});
  const failed=Object.values(status).some(s=>s.state==='failed');
  if(!pitches.length&&failed&&Array.isArray(lastPitches?.items)&&Date.now()-lastPitches.at<7*86400000)pitches=lastPitches.items.map(x=>({...x,retained_at:lastPitches.at}));
  else if(failed&&lastPitches){pitches=pitches.map(x=>lastPitches.items?.some(old=>old.clue_id===x.clue_id&&JSON.stringify(old.sources)===JSON.stringify(x.sources))?{...x,retained_at:lastPitches.at}:x);}
  else if(pitches.length&&!Object.values(status).some(s=>s.state==='loading')){lastPitches={at:Date.now(),items:pitches};try{localStorage.setItem(LAST_KEY,JSON.stringify(lastPitches));}catch{}}
  const covered=new Set(pitches.flatMap(x=>x.sources.map(s=>s.url)));
  next=[...pitches.map(x=>{const r=B?.requestFor(x),cached=r&&researchCache[r.key];return B&&cached?.until>Date.now()?B.attach(x,cached.value):x;}),...next.filter(x=>!isPitch(x)||!x.sources?.some(s=>covered.has(s.url)))];
 }
 if(!accept&&!findingToday&&data.length&&readingCard()&&JSON.stringify(next)!==JSON.stringify(data))pendingData=next;
 else {data=next;pendingData=null;}
 $('#discoveryUpdates').hidden=!pendingData;
 const counts={current:data.filter(x=>x.lane==='current').length,background:data.filter(x=>x.lane==='background').length};
 let rows=data.filter(x=>x.lane===view&&(!query||[x.headline,x.article_pitch,x.one_line_signal,...(x.entities||[])].join(' ').toLowerCase().includes(query)));
 const raw=view==='current'?rows.filter(x=>!isPitch(x)&&x.detector!=='pattern_followup'):[];
 if(view==='current')rows=rows.filter(x=>!raw.includes(x));
 if(view==='current'&&category!=='all')rows=rows.filter(x=>x.category===category);
 const total=rows.length;if(view==='current'&&!expanded&&!query)rows=R?rows.slice(0,5):B?B.shortlist(rows):C.shortlist(rows);
 const accumulated=rows.filter(x=>x.detector==='accumulated_pattern'),proposals=rows.filter(isPitch),references=rows.filter(x=>!isPitch(x)&&x.detector!=='accumulated_pattern');
 const group=(title,items)=>items.length?'<h3 class="discovery-section-title">'+title+' <span>'+items.length+'</span></h3>'+items.map(card).join(''):'';
 const html=(rows.length?group('누적자료에서 다시 비교한 특징',accumulated)+group('추천 기사',proposals)+group(view==='background'?'기존 분석과 연결된 자료':'기존 특징에 연결된 새 자료',references):`<div class="discovery-empty">${Object.values(status).some(s=>s.state==='loading')?'자료를 읽고 있습니다. 기사 방향과 근거가 나온 결과부터 표시합니다.':view==='current'&&category!=='all'?'선택한 분야에서 추천할 기사 방향을 찾지 못했습니다. 전체 추천도 살펴보세요.':'현재 자료에서 추천할 기사 방향을 찾지 못했습니다.'}</div>`)+inbox(raw);
 if(html!==renderedCards){$('#discoveryCards').innerHTML=html;renderedCards=html;for(const el of document.querySelectorAll('[data-detail]'))if(open.has(el.dataset.detail))el.open=true;}
 const ready=data.filter(x=>x.lane==='current'&&isPitch(x)).length;
 if($('#recommendationFilters')){$('#recommendationFilters').hidden=view!=='current';$('#recommendationFilters').innerHTML=Object.entries(categories).map(([key,label])=>'<button data-pitch-category="'+key+'" aria-pressed="'+(key===category)+'" class="'+(key===category?'on':'')+'">'+label+' <span>'+data.filter(x=>x.lane==='current'&&isPitch(x)&&(key==='all'||x.category===key)).length+'</span></button>').join('');}
 $('#discoveryViewNote').textContent=view==='background'?'이 브라우저에 저장된 최대 90일 자료와 새 자료를 합쳐 다시 비교합니다. 뉴스·외신·공식자료는 종류별 최대 1200건을 보관합니다. 페이지를 닫으면 수집·비교가 멈추고, 다시 열 때 이어집니다.':'투자·회수·출자에서 공통점과 차이를 찾아 기사 방향을 추천합니다. 제목만 확보한 근거는 따로 표시합니다.';
 $('#discoveryCounts').textContent=view==='background'?`누적 특징 ${counts.background}건 · 비교 자료 ${accumulatedResult?.stats?.source_count||0}건 · 최근 비교 ${formatTime(accumulatedResult?.stats?.checked_at)} · 새 자료 연결 ${data.filter(x=>x.lane==='background'&&x.linked_update).length}건`+(archiveSaveFailed||patternSaveFailed?' · 저장공간 부족으로 이번 결과를 저장하지 못했습니다.':''):`추천 기사 ${ready}건`;
 const blocked=data.some(x=>/model_/.test(x.research?.error||'')),sourceMissing=data.some(x=>x.research?.error==='insufficient_sources');
 $('#discoveryResearchStatus').textContent=researching?'추천은 먼저 볼 수 있습니다. 관련 본문을 읽어 기사 방향을 보완하고 있습니다.':blocked?(ready?'추가 AI 분석에 연결하지 못했습니다. 수집한 뉴스에 근거한 추천은 유지합니다.':'AI 분석을 완료하지 못했습니다. 확보한 원문은 수집한 자료에서 볼 수 있습니다.'):sourceMissing?(ready?'일부 근거는 제목까지만 확보했습니다. 카드에서 확인 범위를 볼 수 있습니다.':'비교할 원문이 부족해 일부 발제 추천을 보류했습니다.'):!ready?'기사 방향과 근거를 갖춘 결과부터 추천합니다.':'';
 $('#discoveryMore').hidden=!(view==='current'&&!expanded&&!query&&total>rows.length);$('#discoveryMore').textContent=`나머지 ${total-rows.length}건 보기`;
 $('#discoverySources').innerHTML=Object.entries(endpoints).map(([key,[name]])=>{const s=status[key]||{state:'loading'};return `<span class="${s.state}">${esc(name)} · ${esc(s.state==='loading'?'수집 중':s.state==='failed'?'불러오기 실패':s.detail||'연결됨')}</span>`;}).join('');
 const candidates=C.dartCandidates(state.dart),valid=candidates.filter(x=>C.validReview(x,reviews[x.rcept_no])).length,pending=candidates.filter(x=>!C.validReview(x,reviews[x.rcept_no])&&!failures.has(x.rcept_no)).length;
 $('#discoveryReviewStatus').textContent=candidates.length?`공시 원문 ${valid}/${candidates.length}건 읽음${reading?' · 읽는 중':''}${failures.size?' · 실패 '+failures.size+'건':''}${pending?' · 대기 '+pending+'건':''} · 단순 공시 목록은 DART 탭에서 확인`:'';
 $('#discoveryReadMore').hidden=!pending||reading;$('#discoveryRetry').hidden=!Object.values(status).some(s=>s.state==='failed'||s.state==='partial')&&!failures.size;
 $('#status').textContent=Object.values(status).some(s=>s.state==='loading')?'수집 결과 연결 중…':`추천 기사 ${ready}건`;
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
 reading=false;
 if(token===run){render();if(!loading)scheduleUpdate();}else if(!away())readBatch(run);
}
function load(options={}){
 if(loading)return;
 if(findingToday&&!options.today)return;
 loadJob=performLoad(options);return loadJob;
}
async function performLoad({automatic=false,today=false}={}){
 if(loading){scheduleUpdate();return;}
 if(automatic&&away()){scheduleUpdate();return;}
 loading=true;lastStarted=Date.now();clearTimeout(updateTimer);
 const token=++run;controller?.abort();controller=new AbortController();status=Object.fromEntries(Object.keys(endpoints).map(k=>[k,{state:'loading'}]));failures=new Set();reviews={...stored(REVIEW_KEY,{}),...reviews};$('#discoveryMessage').textContent='';render();
 await Promise.allSettled(Object.entries(endpoints).map(async([key,[,url]])=>{
  try{const d=await json(url+(today&&key==='news'?'&refresh=1':''),controller.signal);if(token!==run)return;
   if(key==='canonical'){state.canonical=d.items||[];state.official=d.source_signals||[];rememberSources('official',state.official);}
   else state[key]=key==='calendar'?d.events||[]:d.items||[];
   rememberSources(key,state[key]||[]);
   if(key==='news')state.newsIssues=d.issues||[];
   const count=(state[key]||[]).length;const partial=d.coverage?.complete===false||d.collection_status?.partial||d.sources?.some(s=>!s.ok)||key==='canonical'&&Object.values(d.diagnostics?.providers?.official||{}).some(v=>!v);
   const capped=d.coverage?.display_limited||d.collection_status?.truncated,translationFailed=Number(d.translation?.failed)||0;
   status[key]={state:partial||translationFailed?'partial':'ready',detail:count+'건 확인'+(partial?' · 일부 수집 실패':'')+(capped?' · 조회 상한 적용':'')+(translationFailed?' · 번역 미확보 '+translationFailed+'건':'')};render();
   if(key==='dart')readBatch(token);
  }catch(e){if(token!==run)return;status[key]={state:'failed'};if(state[key]?.length)$('#discoveryMessage').textContent='일부 수집원에 연결하지 못해 해당 항목은 이전 자료를 유지했습니다. 다음 자동 갱신 때 다시 확인합니다.';render();}
 }));
 if(token===run&&!away())readBatch(token);
 if(token===run){loading=false;lastChecked=Date.now();refreshAccumulated();render({accept:!automatic});if(today&&!R){await readBatch(token);render({accept:true});await readResearch(token,null,6);}else{if(today)render({accept:true});scheduleUpdate();readResearch(token,null,today?5:3);}}
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
 label.textContent=findingToday?(loading?'뉴스·공시·출자 자료를 확인하고 있습니다.':'관련 소식을 묶고 추천 순위를 정하고 있습니다.'):(todayMessage||'최근 소식과 쌓인 자료를 비교해, 기사 방향이 구체적인 순서로 추천합니다.');
}
async function findToday(){
 if(findingToday)return;
 if(globalThis.navigator?.onLine===false){todayMessage='인터넷 연결을 확인한 뒤 다시 눌러 주세요.';syncTodayStatus();return;}
 findingToday=true;todayMessage='';clearTimeout(updateTimer);syncTodayStatus();
 try{
  // Finish work already in flight before starting another collection run.
  while(loading||(!R&&(reading||researching)))await Promise.allSettled((R?[loadJob]:[loadJob,reviewJob,researchJob]).filter(Boolean));
  view='current';query='';category='all';expanded=false;$('#discoverySearch').value='';
  for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b.dataset.discoveryView===view);b.setAttribute('aria-pressed',String(b.dataset.discoveryView===view));}
  await load({today:true});render({accept:true});
  const count=data.filter(x=>x.lane==='current'&&isPitch(x)).length;
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
 if(clue?.detector==='recommendation'){
  const dialog=$('#recommendationDialog');if(!dialog)return;
  recommendationId=clue.clue_id;returnFocus=trigger;
  $('#recommendationTitle').textContent=clue.headline;
  $('#recommendationBody').innerHTML='<section><h3>포인트</h3><p>'+esc(pointText(clue)||clue.pitch_summary||clue.headline)+'</p></section>'+'<section><h3>추천 근거</h3>'+pitchEvidence(clue,8)+'</section>'+'<details><summary>추천 순위의 근거 · '+esc(clue.score)+'점</summary>'+scoreDetails(clue)+'</details>'+(clue.research?.status==='ready'?'<details><summary>추가로 읽은 본문과 기사 방향</summary>'+B.renderDetails(clue.research)+'</details>':'')+'<p class="recommendation-asof">기존 기사와 같은 질문·사례를 다뤘는지는 발제 선택 때 원문과 함께 살펴보세요.</p>';
  if(!dialog.open)dialog.showModal();$('#recommendationTitle').focus();return;
 }
 const a=clue?.article_brief,p=a?.angles?.[0],dialog=$('#recommendationDialog');
 if(!p||clue.research?.status!=='ready'||!dialog)return;
 recommendationId=clue.clue_id;returnFocus=trigger;
 $('#recommendationTitle').textContent=p.headline;
 const facts=(a.facts||[]).filter(f=>p.basis_ids?.includes(f.id));
 const basis=facts.map(f=>{const source=clue.research.sources?.find(s=>s.source_id===f.source_id);return '<li>'+esc(f.text)+links(source?[{...source,label:source.publisher||source.title}]:[])+'</li>';}).join('');
 const point=[p.new_information,a.why_now?.text,p.reason].filter(Boolean).filter((v,i,all)=>all.findIndex(t=>String(t).trim()===String(v).trim())===i).slice(0,2).join(' ');
 $('#recommendationBody').innerHTML='<section><h3>포인트</h3><p>'+esc(point||p.reason)+'</p></section>'+'<section><h3>추천 근거</h3><ul>'+basis+'</ul></section>'+'<details><summary>모든 근거와 기존 보도 확인</summary>'+B.renderDetails(clue.research,clue.clue_id)+'</details>'+(clue.research.as_of?'<p class="recommendation-asof">분석 기준 '+esc(new Date(clue.research.as_of).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' · 한국시간</p>':'');
 if(!dialog.open)dialog.showModal();$('#recommendationTitle').focus();
}
$('#findToday').onclick=findToday;
$('#closeRecommendation').onclick=()=>$('#recommendationDialog').close();
$('#recommendationDialog').addEventListener('close',()=>{recommendationId=null;if(returnFocus?.isConnected)returnFocus.focus();else $('#findToday').focus();if(pendingData&&!readingCard())render({accept:true});});
$('#discoveryRetry').onclick=()=>load();$('#discoveryReadMore').onclick=()=>readBatch(run);
$('#discoveryUpdates').onclick=()=>render({accept:true});
$('#discoveryMore').onclick=()=>{expanded=true;render({accept:true});};$('#discoverySearch').oninput=e=>{query=e.target.value.trim().toLowerCase();render({accept:true});};
root.addEventListener('click',e=>{
 const numbers=e.target.closest('[data-insight-numbers]');if(numbers){analyzeNumbers(data.find(x=>x.clue_id===numbers.dataset.insightNumbers));return;}

 const filter=e.target.closest('[data-pitch-category]');if(filter){category=filter.dataset.pitchCategory;expanded=false;render({accept:true});return;}
 const recommendation=e.target.closest('[data-recommendation-open]');if(recommendation){openRecommendation(data.find(x=>x.clue_id===recommendation.dataset.recommendationOpen),recommendation);return;}
 const jump=e.target.closest('[data-discovery-jump]');if(jump){
  const target=data.find(x=>x.clue_id===jump.dataset.discoveryJump);if(!target)return;
  view=target.lane;query='';expanded=true;$('#discoverySearch').value='';
  for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b.dataset.discoveryView===view);b.setAttribute('aria-pressed',String(b.dataset.discoveryView===view));}
  render({accept:true});const card=[...document.querySelectorAll('[data-discovery-card]')].find(el=>el.dataset.discoveryCard===target.clue_id);card?.scrollIntoView({block:'center'});card?.focus({preventScroll:true});return;
 }
 const tab=e.target.closest('[data-discovery-view]');if(tab){view=tab.dataset.discoveryView;for(const b of document.querySelectorAll('[data-discovery-view]')){b.classList.toggle('on',b===tab);b.setAttribute('aria-pressed',String(b===tab));}render({accept:true});}
 const researchButton=e.target.closest('[data-discovery-research]');if(researchButton){const clue=data.find(x=>x.clue_id===researchButton.dataset.discoveryResearch);if(clue)readResearch(run,clue);return;}
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
