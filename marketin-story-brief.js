(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./discovery-followup'):root.DiscoveryFollowup);if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.MarketInStoryBrief=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(F){
'use strict';
const VERSION='marketin-research-6';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const generic=/^(PEF|VC|LP|GP|사모펀드|벤처캐피탈|금융위원회|금융위|금융감독원|금융권|IB|M&A)$/i;
const scope=/사모펀드|PEF|프라이빗|벤처(?:캐피탈|투자)|인수금융|경영권|공개매수|재매각|매각.{0,15}(?:본입찰|예비입찰|우협|주관사)|펀드레이징|세컨더리|컨티뉴에이션|출자사업|위탁운용|모태펀드|성장금융|자산배분|기관투자자|LP\b|GP\b|신용등급|회사채.{0,15}(?:수요예측|차환|미매각)|PF.{0,15}(?:대출|본PF|차환|부실)|재무약정|세일앤리스백|DIP|BDC|private equity|private credit|buyout|fundrais/i;
const noise=/수목원|국가정원|축제|기념식|업무협약|MOU|목표주가|투자의견|주가.{0,12}(?:상승|급등|하락)|프로모션|할인행사|봉사활동|채용공고|교육과정|실무교육|과정\s*개설|기관\s*이전|이전기관|유치전|민생법안|무더기\s*적발|미공개정보.{0,15}(?:고발|통보|조치)/i;
const meaningful=/경영권|공개매수|인수금융|재매각|회생|워크아웃|EOD|기한이익|약정|차환|신용등급|부실|매각|인수|투자|출자|결성|모집|개편|규제|시행|세컨더리|buyout|acquisition|fundrais/i;
function primaryEntity(x){
 const explicit=F?.subject(clean(x.headline));if(explicit)return explicit;
 const known=(x.entities||[]).map(clean).find(e=>e.length>=2&&!generic.test(e));if(known)return known;
 const title=clean(x.headline);
 if(/의무공개매수/.test(title))return '의무공개매수';
 if(/인수금융\s*차환/.test(title))return '인수금융 차환';
 const leading=title.match(/^([가-힣A-Za-z][가-힣A-Za-z0-9·]{1,24}),/)?.[1];
 return leading&&!/^(증선위|금융당국|금투협|여야|국회|정부|업계|전문가)$/.test(leading)?leading:'';
}
function eligible(x){
 if(x.detector==='recommendation')return true;
 if(['story_pitch','reporting_opportunity'].includes(x.detector))return false;
 if(x.detector==='dart_deal')return true;
 const text=clean(x.headline+' '+(x.one_line_signal||''));
 if(noise.test(text)||F?.roundup.test(text))return false;
 if(x.detector==='official_followup'&&/공고|선정결과/.test(text)&&!/변경|확대|축소|신설|폐지|경쟁률/.test(text))return false;
 return scope.test(text)&&meaningful.test(text);
}
function select(rows,input={}){
 const out=[],groups=new Map(),allNews=[...(input.news||[]),...(input.foreign||[])].filter(n=>n.source_type!=='press_release'&&Date.parse(n.published_at)<=Date.now()&&Date.parse(n.published_at)>Date.now()-7*86400000);
 const seenUrls=new Set(rows.filter(x=>x.detector==='news_followup').flatMap(x=>(x.sources||[]).map(s=>s.url)));
 const extra=allNews.filter(n=>!seenUrls.has(n.source_url)&&n.source_type!=='press_release'&&Date.parse(n.published_at)<=Date.now()&&Date.parse(n.published_at)>Date.now()-7*86400000).map(n=>({clue_id:'news-'+norm(n.title_ko||n.title),detector:'news_followup',headline:n.title_ko||n.title,entities:[n.target?.name,...(n.related_entities||[]).map(e=>e.canonical_name)].filter(Boolean),sort_date:n.published_at,lane:'current',fact_status:'보도',sources:[{url:n.source_url,label:n.source_name,title:n.title_ko||n.title,date:n.published_at}]}));
 const deduped=[],byTitle=new Map(),byUrl=new Map();
 for(const row of [...rows,...extra]){
  if(row.detector!=='news_followup'){deduped.push(row);continue;}
  const title=norm(row.headline),old=byTitle.get(title)||(row.sources||[]).map(s=>byUrl.get(s.url)).find(Boolean);
  if(old){old.sources=[...new Map([...(old.sources||[]),...(row.sources||[])].map(s=>[s.url,s])).values()];continue;}
  const copy={...row,sources:[...(row.sources||[])]};deduped.push(copy);byTitle.set(title,copy);for(const s of copy.sources)byUrl.set(s.url,copy);
 }
 for(const x of deduped.sort((a,b)=>(Date.parse(b.sort_date)||0)-(Date.parse(a.sort_date)||0))){
  if(x.detector==='recommendation'){out.push(x);continue;}
  if(x.lane==='background'){out.push({...x,article_brief:null});continue;}
  if(!eligible(x))continue;
  const entity=primaryEntity(x),topic=entity||'';
  if(x.detector!=='news_followup'){out.push({...x,article_pitch:undefined,article_brief:null,research_topic:topic});continue;}
  const key=entity?norm(entity)+'-'+(F?.family(x.headline)||'other'):x.clue_id;
  if(groups.has(key))continue;groups.set(key,true);
  const related=entity?allNews.filter(n=>norm(n.title_ko||n.title).includes(norm(entity))&&!noise.test(n.title_ko||n.title)&&(!F||F.related(x.headline,n.title_ko||n.title))):[];
  const sources=[...(x.sources||[]).map(s=>({...s,title:s.title||x.headline})),...related.sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||''))).map(n=>({label:n.source_name,title:n.title_ko||n.title,url:n.source_url,date:n.published_at}))];
  const unique=[...new Map(sources.map(s=>[s.url,s])).values()];
  out.push({...x,clue_id:entity?'issue-'+key:x.clue_id,headline:entity||x.headline,one_line_signal:x.headline,detector_label:'관련 보도',reason:'본문 대조 전 · 기사 제안은 원문을 읽은 뒤 표시합니다.',article_pitch:undefined,article_brief:null,research_topic:topic,sources:unique.slice(0,12),reported:unique.slice(0,6).map(s=>(s.label||'보도')+': '+(s.title||x.headline))});
 }
 return out;
}
function requestFor(x){
 const topic=clean(x.research_topic);if(!topic)return null;
 // A comparison across companies remains its own proposal; the engine opts in only a single-entity topic.
 const sources=(x.sources||[]).filter(s=>s.title&&href(s.url)&&
  (x.detector!=='recommendation'||norm(s.title).includes(norm(topic)))
 ).slice(0,5).map(s=>({url:s.url,title:s.title,published_at:s.date||s.published_at||'',publisher:s.label||s.publisher||''}));
 if(x.detector==='recommendation'&&!sources.length)return null;
 const key=JSON.stringify([VERSION,topic,sources]);
 return {key,url:'/api/signals?mode=research&topic='+encodeURIComponent(topic)+'&seeds='+encodeURIComponent(JSON.stringify(sources))};
}
function shortlist(rows,limit=6){
 const weight=x=>x.detector==='recommendation'?(x.research_topic?120+Math.max(0,Math.min(100,Number(x.score)||0))/100:0):x.article_brief?.angles?.length?100:x.article_brief?80:x.detector==='pattern_followup'?60:x.detector==='news_followup'&&x.research_topic?50:x.research_topic?30:x.detector==='dart_deal'?10:0;
 return [...rows].sort((a,b)=>weight(b)-weight(a)||String(b.sort_date||'').localeCompare(String(a.sort_date||''))).slice(0,limit);
}
function attach(x,result){
 if(!result||result.version!==VERSION)return x;
 // Reading more sources enriches a rule-generated article; it cannot replace its comparison or erase it.
 if(x.detector==='recommendation')return {...x,research:result};
 if(result.status==='out_of_scope')return null;
 const a=result.analysis;if(result.status!=='ready'||!a)return {...x,research:result};
 return {...x,research:result,detector_label:a.angles?.length?'추천 기사':'이슈 브리핑',fact_status:'보도',one_line_signal:a.summary?.text||x.one_line_signal,reason:a.why_now?.text||'',article_pitch:a.angles?.[0]?.headline,article_brief:a,changed_fact:(a.changes||[]).map(c=>c.text).join(' · '),previous_state:a.previous_state?.text||'',reported:(a.facts||[]).map(f=>f.text),questions:(a.angles||[]).map(p=>p.question).filter(Boolean),unknowns:[...(a.uncertainties||[]).map(u=>u.text),...(a.angles||[]).map(p=>p.missing).filter(Boolean)],sources:[...new Map([...(result.sources||[]).map(s=>({...s,label:s.publisher||s.title})),...(x.sources||[])].map(s=>[s.url,s])).values()]};
}
function href(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function citation(ids,result){const a=result.analysis;return [...new Set((ids||[]).map(id=>a?.facts?.find(f=>f.id===id)?.source_id).filter(Boolean))].map(id=>{const s=result.sources.find(s=>s.source_id===id),url=href(s?.url);return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.publisher||s.title||'원문')} ↗</a>`:'';}).join(' · ');}
function renderBriefHtml(result,clueId){
 if(!result)return '';
 if(result.status!=='ready'||!result.analysis){const error=result.error||'';const text=/model_/.test(error)?'AI 분석 연결을 사용할 수 없어 원문 목록만 표시합니다.':error==='insufficient_sources'?'본문을 확보하지 못했습니다.':error==='no_recent_source'?'최근 원문을 확인하지 못했습니다.':result.status==='loading'?'관련 원문을 읽는 중…':'원문 분석을 완료하지 못했습니다.';return `<p class="discovery-research-status">${esc(text)}</p>`;}
 const a=result.analysis;
 if(result.headline_in_card&&a.angles?.length){const p=a.angles[0];return `<section class="marketin-story-brief" aria-label="발제 요지"><p class="discovery-pitch-reason">${esc(p.reason)}</p><p class="discovery-pitch-difference">${esc(p.new_information)}</p><span>${citation(p.basis_ids,result)}</span></section>`;}
 const facts=(a.facts||[]).slice(0,3).map(f=>`<li>${esc(f.text)} <span>${citation([f.id],result)}</span></li>`).join('');
 const angles=(a.angles||[]).map((p,index)=>`<div class="marketin-story-pitch"><strong>${esc(p.headline)}</strong><p>${esc(p.reason)}</p><small>${esc(p.new_information)}</small><span>${citation(p.basis_ids,result)}</span>${clueId?`<button class="discovery-angle-select" data-discovery-project="${esc(clueId)}" data-discovery-angle="${index}">이 방향으로 취재에 담기</button>`:''}</div>`).join('');
 return `<section class="marketin-story-brief" aria-label="기사 방향과 근거">${angles}<b class="discovery-section-label">추천 근거</b><ul class="discovery-brief-facts">${facts}</ul></section>`;
}
// Stable direction identity keeps repeat saves on the same project without mixing different hypotheses.
function selectAngle(clue,index){
 const a=clue.article_brief,p=a?.angles?.[index];if(!p?.question||!p.direction_key)throw Error('선택한 취재 방향을 다시 확인해 주세요.');
 const key=norm(p.direction_key);if(!key)throw Error('취재 방향을 식별하지 못했습니다.');
 let id=2166136261;for(const c of key){id^=c.charCodeAt(0);id=Math.imul(id,16777619);}
 return {...clue,parent_clue_id:clue.clue_id,clue_id:clue.clue_id+'-angle-'+(id>>>0).toString(16),selected_angle:{...p},headline:p.headline||p.question,article_pitch:p.headline||p.question,reason:p.reason,questions:[p.question],unknowns:[p.missing,...(a.uncertainties||[]).map(u=>u.text)].filter(Boolean),next_action:p.first_action||'',hypothesis:p.new_information,falsification:p.falsification,selected_evidence:(a.facts||[]).filter(f=>p.basis_ids.includes(f.id)),stage:'취재 방향 선택'};
}

function renderDetails(result,clueId){
 if(!result?.sources)return '';
 const a=result.analysis;let html='';
 if(a){
  if(a.why_now?.text)html+='<h4>지금 살펴볼 이유</h4><p>'+esc(a.why_now.text)+'</p>';
  if(a.previous_state)html+='<h4>직전 상태</h4><p>'+esc(a.previous_state.text)+' '+citation(a.previous_state.fact_ids,result)+'</p>';
  if(a.changes?.length)html+='<h4>전후 비교</h4><ul>'+a.changes.map(c=>'<li>'+esc(c.text)+' '+citation([...(c.before_ids||[]),...(c.after_ids||[])],result)+'</li>').join('')+'</ul>';
  const additional=(a.angles||[]).filter(p=>p.missing);
  if(additional.length)html+='<h4>추가 취재</h4><ul>'+additional.map(p=>'<li>'+esc(p.missing)+'</li>').join('')+'</ul>';
  if(a.angles?.length>1)html+='<h4>다른 기사 방향</h4><ul>'+a.angles.slice(1).map((p,i)=>'<li>'+esc(p.headline)+' · '+esc(p.new_information)+(clueId?`<button class="discovery-angle-select" data-discovery-project="${esc(clueId)}" data-discovery-angle="${i+1}">이 방향으로 취재에 담기</button>`:'')+'</li>').join('')+'</ul>';
  html+='<h4>현재 읽은 마켓인 기사에서 다룬 내용</h4>'+((a.already_covered||[]).length?'<ul>'+a.already_covered.map(c=>{const s=result.sources.find(s=>s.source_id===c.source_id);return `<li>${esc(c.text)} ${href(s?.url)?`<a href="${esc(href(s.url))}" target="_blank" rel="noopener noreferrer">기존 기사 ↗</a>`:''}</li>`;}).join('')+'</ul>':'<p>'+(result.sources.some(s=>s.is_marketin&&s.read_ok)?'확보한 마켓인 원문에서 별도 비교 내용을 추리지 않았습니다.':'마켓인 기보도 확인 못함.')+'</p>');
  if(a.uncertainties?.length)html+='<h4>아직 정해지지 않았거나 보도가 다른 부분</h4><ul>'+a.uncertainties.map(u=>`<li>${esc(u.text)} ${citation(u.fact_ids,result)}</li>`).join('')+'</ul>';
  html+='<h4>사실과 출처</h4><ul>'+a.facts.map(f=>`<li>${f.date?esc(f.date)+' · ':''}${esc(f.text)} ${citation([f.id],result)}</li>`).join('')+'</ul>';
 }
 html+='<h4>본문 확인 범위</h4><ul>'+result.sources.map(s=>`<li>${esc(s.title)} · ${s.read_ok?'본문 읽음':'본문 미확보'}${s.published_at?' · '+esc(String(s.published_at).slice(0,10)):''}</li>`).join('')+'</ul>';
 if(result.as_of)html+='<p>분석 기준 '+esc(new Date(result.as_of).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' (한국시간)</p>';
 return html;
}
function install(root){const C=root?.IBDiscovery;if(!C||C.__marketinStoryBriefInstalled)return false;const original=C.build;C.build=function(input,...rest){return select(original.call(C,input,...rest),input);};C.__marketinStoryBriefInstalled=true;return true;}
return {VERSION,primaryEntity,eligible,select,requestFor,attach,renderBriefHtml,renderDetails,selectAngle,shortlist,install};
});
