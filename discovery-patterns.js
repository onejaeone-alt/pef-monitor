(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DiscoveryPatterns=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='accumulated-patterns-1',DAY=86400000;
const TYPES=new Set(['gp_repeat','gp_lp_shift','lp_rule_change','kvic_plan_change','formation_gap','formation_pattern','market_pattern','cross_source']);
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const day=v=>/^\d{8}$/.test(String(v))?String(v).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):String(v||'').slice(0,10);
const safe=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)&&!x.username&&!x.password?x.href:'';}catch{return '';}};
function baseline(x){return [x.sort_date,...(x.sources||[]).map(s=>s.date)].map(day).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1)||'';}
function mentions(text,name){
 const n=clean(name);if(n.length<3||/^(?:PEF|VC|GP|LP|사모펀드|운용사|벤처캐피탈)$/i.test(n))return false;
 const escaped=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp('(^|[^가-힣a-zA-Z0-9])'+escaped+'(?=$|[^가-힣a-zA-Z0-9]|은|는|이|가|의|와|과|에서)').test(text);
}
function relevant(pattern,row){
 const text=clean(row.title_ko||row.title),names=(pattern.entities||[]).filter(Boolean);
 const rule=/rule_change|plan_change/.test(pattern.detector);
 const subjects=rule?names:names.filter(n=>!/^(?:국민연금공단(?: 기금운용본부)?|한국성장금융(?:투자운용)?|한국벤처투자|한국산업은행|.*공제회)$/.test(n));
 if(!subjects.some(n=>mentions(text,n)))return false;
 if(/행사|설명회|세미나|채용|업무협약|목표주가/.test(text))return false;
 return rule?/출자|위탁운용|선정/.test(text)&&/기준|요건|조건|변경|완화|강화|확대|축소|정정/.test(text):/펀드|조합|출자|위탁운용/.test(text)&&/결성|선정|약정|모집|연장|철회|등록|취소|목표액/.test(text);
}
function connect(rows,input={},now=Date.now()){
 const result=rows.map(x=>({...x})),updates=[];
 const material=[...(input.news||[]),...(input.foreign||[]),...(input.official||[])];
 // Reviewed DART facts can supply a dated source; never infer facts from a company match.
 for(const x of rows.filter(x=>x.detector==='dart_deal'))for(const s of x.sources||[])material.push({title:x.headline+' '+(x.changed_fact||''),source_url:s.url,source_name:s.label,published_at:s.date||x.sort_date});
 for(const pattern of result.filter(x=>x.lane==='background'&&TYPES.has(x.detector))){
  const asOf=baseline(pattern),cutoff=Date.parse(asOf+'T00:00:00+09:00'),oldUrls=new Set((pattern.sources||[]).map(s=>safe(s.url))),oldTitles=new Set((pattern.sources||[]).map(s=>titleKey(s.title)).filter(Boolean)),seen=new Set();
  delete pattern.linked_update;
  if(!Number.isFinite(cutoff))continue;
  const candidates=material.filter(n=>{
   const time=Date.parse(n.published_at),url=safe(n.source_url),title=clean(n.title_ko||n.title);
   if(!url||oldUrls.has(url)||oldTitles.has(titleKey(title))||seen.has(url)||seen.has(titleKey(title))||!Number.isFinite(time)||time<cutoff||time>now||time<now-90*DAY||!relevant(pattern,n))return false;
   seen.add(url);seen.add(titleKey(title));return true;
  }).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,3);
  if(!candidates.length)continue;
  const refs=candidates.map(n=>({label:n.source_name||'새 자료',title:n.title_ko||n.title,url:n.source_url,date:n.published_at}));
  const clue_id='pattern-update-'+pattern.clue_id;
  pattern.linked_update={clue_id,count:refs.length,date:day(refs[0].date)};
  updates.push({clue_id,detector:'pattern_followup',detector_label:'기존 특징에 새 자료 연결',lane:'current',fact_status:'단서',headline:refs[0].title,one_line_signal:refs[0].title,sort_date:refs[0].date,
   entities:pattern.entities||[],sources:refs,reported:refs.map(s=>s.label+' · '+s.title),confirmed_facts:[],unknowns:['동일 펀드·출자사업인지, 기존 판단이 달라지는지 원문 대조 필요'],
   reason:'기존 분석 이후 같은 주체와 관련 주제의 자료를 찾았습니다. 동일 사건 여부와 조건 변화는 아직 확인하지 않았습니다.',
   pattern_ref:{clue_id:pattern.clue_id,headline:pattern.headline,summary:pattern.one_line_signal||pattern.changed_fact||pattern.headline,date:asOf,sources:pattern.sources},
   next_action:'기존 자료와 새 원문에서 펀드명·사업연도·선정일·금액·기한을 대조',stage:'후속 자료 발견'});
 }
 return [...updates,...result];
}
const list=v=>Array.isArray(v)?v:[];
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const titleKey=v=>norm(clean(v).replace(/\[[^\]]*\]/g,'').replace(/[‘’“”"'「」『』]/g,'').replace(/\((?:종합|종합\d보|속보)\)/g,''));
const uniq=values=>[...new Set(values.filter(Boolean))];
function hash(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
function by(rows,key){const groups=new Map();for(const row of rows)for(const value of uniq(list(key(row)))){const set=groups.get(value)||[];set.push(row);groups.set(value,set);}return groups;}
function phase(row){if(/무산.{0,6}(?:가능성|우려|위기)|실패.{0,6}(?:가능성|우려)|(?:무산|실패|철회|해제)(?:될|할)\s*(?:경우|가능성|수)/.test(row.text))return '';return /무산|실패|철회|해제/.test(row.text)?'중단':/거래\s*종결|인수\s*완료|매각\s*완료/.test(row.text)?'완료':/본계약|계약\s*체결/.test(row.text)?'계약':/우선협상|우협/.test(row.text)?'우선협상':/본입찰|예비입찰|매각\s*추진|인수\s*추진|공개매수/.test(row.text)?'추진':'';}
function family(row){return /공개매수/.test(row.text)?'공개매수':/인수금융|차환|회사채/.test(row.text)?'자금 조달':/인수|매각|경영권/.test(row.text)?'지분 거래':'';}
function groupDefinitions(rows){
 const groups=[];
 for(const [key,set]of by(rows.filter(r=>r.subject&&list(r.assets).some(a=>norm(a)===norm(r.subject))),r=>list(r.gps).filter(gp=>norm(gp)!==norm(r.subject)&&mentions(r.text,gp)).map(norm))){
  const cases=uniq(set.map(r=>r.case_key)),actions=uniq(set.flatMap(r=>r.actions));
  if(cases.length<2||!actions.some(a=>['투자','회수','거래 중단','펀드 조성'].includes(a)))continue;
  const name=set.flatMap(r=>r.gps).find(n=>norm(n)===key),subjects=uniq(set.map(r=>r.subject).filter(n=>norm(n)!==key));
  groups.push({key:'gp-'+key,type:'gp_activity',rows:set,headline:name+'의 복수 거래',feature:name+' 관련 자료에서 '+cases.length+'개 거래 대상과 '+actions.join('·')+' 활동을 찾았습니다.',axis:'거래 대상과 진행 상황',entities:[name,...subjects]});
 }
 for(const [sector,set]of by(rows.filter(r=>r.sector&&r.category!=='lp'&&list(r.actions).includes('투자')),r=>[r.sector])){
  const cases=uniq(set.map(r=>r.case_key)),gps=uniq(set.flatMap(r=>r.gps).map(norm));if(cases.length<2||gps.length<2)continue;
  groups.push({key:'sector-'+sector,type:'sector_activity',rows:set,headline:sector+' 기업에 투자한 운용사들',feature:sector+'에서 서로 다른 '+cases.length+'개 투자 대상과 '+gps.length+'개 운용사의 자료를 찾았습니다. 시장 전체의 증가세를 뜻하지는 않습니다.',axis:'기업별 투자 대상과 운용사',entities:uniq(set.flatMap(r=>r.entities))});
 }
 for(const [key,set]of by(rows.filter(r=>r.category==='lp'&&r.lp&&/출자|위탁운용|선정|자산배분|약정/.test(r.text)),r=>[norm(r.lp)+'-'+(r.lp_track||'일반')])){
  if(set.length<2)continue;const name=set[0].lp,fields=uniq(set.flatMap(r=>[...r.text.matchAll(/\d[\d,.]*(?:\s*(?:조|천|억|만))+(?:\s*원|\s*달러)?|\d[\d,.]*\s*%|세컨더리|크레딧|벤처|블라인드|선정|위탁운용|자산배분|약정/g)].map(m=>m[0])));
  if(fields.length<2)continue;
  groups.push({key:'lp-'+key,type:'lp_conditions',rows:set,headline:name+' 출자 분야와 조건',feature:name+'의 출자 관련 자료 '+set.length+'건에서 '+fields.slice(0,5).join('·')+' 항목을 비교할 수 있습니다. 별도 사업의 차이를 조건 변경으로 단정하지 않습니다.',axis:'사업별 투자 분야·규모·선정 조건',entities:[name]});
 }
 for(const [key,set]of by(rows.filter(r=>r.category!=='lp'&&r.subject&&family(r)&&phase(r)),r=>[r.case_key+'-'+family(r)])){
  const stages=uniq(set.map(phase));if(stages.length<2||set.length<2)continue;
  const name=set[0].subject;
  groups.push({key:'event-'+key,type:'event_progress',rows:set,headline:name+' '+family(set[0])+' 관련 보도 흐름',feature:name+' 관련 자료에서 '+stages.join('·')+' 단계의 보도가 함께 확인됩니다. 같은 거래의 진행 순서인지는 각 원문으로 확인해야 합니다.',axis:'보도된 거래 단계와 시점',entities:uniq(set.flatMap(r=>r.entities))});
 }
 // A change of shareholder and capital raising can be a useful connection
 // even when neither title names a formal transaction stage. Keep the same
 // concrete target and two distinct documents; do not infer the funding use.
 for(const [key,set]of by(rows.filter(r=>r.category!=='lp'&&r.subject&&list(r.assets).some(a=>norm(a)===norm(r.subject))),r=>[r.case_key])){
  const ownership=r=>/인수(?!금융)|매각|경영권|(?:새|신규)\s*최대주주|최대주주\s*변경/.test(r.text),capital=r=>/유상증자|자본\s*확충|신주\s*발행/.test(r.text);
  const owners=set.filter(ownership),funding=set.filter(capital);
  if(!owners.some(a=>funding.some(b=>a.url!==b.url)))continue;
  const related=set.filter(r=>ownership(r)||capital(r)),name=related[0].subject,joined=related.map(r=>r.text).join(' '),ownerLabel=/(?:새|신규)\s*최대주주|최대주주\s*변경/.test(joined)?'새 주주':'지분 거래',capitalLabel=/유상증자/.test(joined)?'유상증자':'자본 확충';
  groups.push({key:'financing-'+key,type:'event_financing',rows:related,headline:name+'의 '+ownerLabel+'와 자본 확충',feature:name+'에 관한 서로 다른 자료에서 '+ownerLabel+'와 '+capitalLabel+' 관련 내용을 함께 찾았습니다. 자금 용도나 두 활동의 인과관계는 확인하지 않았습니다.',axis:'지분 거래·주주 변경 보도와 자본 확충 계획',entities:uniq(related.flatMap(r=>r.entities))});
 }
 return groups;
}
function sourceRef(row,oldSources){
 const key=titleKey(row.title),old=oldSources.find(s=>safe(s.url)===row.url)||oldSources.find(s=>s.title_key===key||titleKey(s.title)===key);
 return {evidence_id:old?.evidence_id||'evidence-'+hash(key),title_key:key,signature:hash(titleKey(row.title)+'|'+clean(row.summary)+'|'+clean(row.body)),url:row.url,title:row.title,label:row.publisher,date:row.date,read_level:row.read_level,text:row.summary?row.title+' — '+row.summary.slice(0,350):row.title};
}
function accumulate(input={},options={}){
 const engine=options.engine,parsed=options.now===undefined?Date.now():typeof options.now==='number'?options.now:Date.parse(options.now),now=Number.isFinite(parsed)?parsed:Date.now(),checkedAt=new Date(now).toISOString();
 const previous=options.previous&&typeof options.previous==='object'?options.previous:{},oldPatterns=previous.patterns&&typeof previous.patterns==='object'?previous.patterns:{};
 const emptyStats={source_count:0,pattern_count:0,changed_count:0,new_pattern_count:0,latest_source_date:'',checked_at:checkedAt};
 if(!engine?.evidenceRows)return {items:[],snapshot:previous,stats:{...emptyStats,available:false}};
 // Reuse the recommendation engine's normalization and title/URL deduplication,
 // before recency ranking. Scheduled events are not observed historical activity.
 const rows=engine.evidenceRows(input,{now}).filter(r=>r.kind!=='calendar'&&!r.scheduled&&(!/T/.test(r.raw?.published_at||r.raw?.date||'')||Date.parse(r.raw.published_at||r.raw.date)<=now));
 const items=[],patterns={};
 for(const definition of groupDefinitions(rows).sort((a,b)=>b.rows[0].date.localeCompare(a.rows[0].date)||a.key.localeCompare(b.key)).slice(0,200)){
  const clueId='accumulated-'+hash(definition.key),old=oldPatterns[clueId],oldSources=list(old?.sources),seen=new Set();
  const sources=definition.rows.filter(r=>{const key=titleKey(r.title);if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>b.date.localeCompare(a.date)||a.url.localeCompare(b.url)).slice(0,60).map(r=>sourceRef(r,oldSources));
  if(sources.length<2)continue;
  const fingerprint=sources.map(s=>s.evidence_id+':'+s.signature).sort().join('|'),initial=!old;
  const priorIds=new Set(oldSources.map(s=>s.evidence_id)),currentIds=new Set(sources.map(s=>s.evidence_id));
  const added=initial?[]:sources.filter(s=>!priorIds.has(s.evidence_id)),revised=initial?[]:sources.filter(s=>{const prior=oldSources.find(p=>p.evidence_id===s.evidence_id);return prior&&prior.signature!==s.signature;}),removed=initial?[]:oldSources.filter(s=>!currentIds.has(s.evidence_id));
  const changed=!initial&&fingerprint!==old.fingerprint,changedAt=initial||changed?checkedAt:old.changed_at||checkedAt;
  const material='수집한 '+['제목',sources.some(s=>s.read_level==='summary')?'요약':'',sources.some(s=>s.read_level==='body')?'본문':''].filter(Boolean).join('·'),comparison=initial?'최근 90일 동안 '+material+' '+sources.length+'건을 처음 묶었습니다. 이전 분석과의 변화는 아직 비교하지 않았습니다.':'이전 분석의 근거 '+oldSources.length+'건과 최근 90일 동안 '+material+' '+sources.length+'건을 '+definition.axis+' 기준으로 비교했습니다.';
  const delta=[added.length?'새 근거 '+added.length+'건':'',revised.length?'내용이 보강된 근거 '+revised.length+'건':'',removed.length?'현재 비교 범위에서 빠진 근거 '+removed.length+'건':''].filter(Boolean).join(' · ');
  const update=initial?'초기 분석입니다. '+material+'에 나온 사실과 활동을 묶었습니다.':changed?delta+'. 근거 구성의 변화이며, 미확인 원인이나 거래 결과를 확정한 것은 아닙니다.':'이전 분석 이후 반영할 새 근거나 내용 변경이 없습니다.';
  const item={clue_id:clueId,detector:'accumulated_pattern',detector_label:'누적자료 비교',lane:'background',pattern_type:definition.type,headline:definition.headline,one_line_signal:definition.feature,entities:definition.entities,sources,previous_sources:oldSources,new_sources:added,revised_sources:revised,removed_sources:removed,sort_date:sources[0].date,detected_at:sources[0].date,checked_at:checkedAt,changed_at:changedAt,initial_analysis:initial,evidence_added:added.length,evidence_revised:revised.length,evidence_removed:removed.length,analysis_changed:changed,accumulated_analysis:{feature:definition.feature,comparison,update},read_level:sources.every(s=>s.read_level==='title')?'title':'mixed',confirmed_facts:[],reported:sources.map(s=>s.label+' · '+s.text),stage:'누적자료 비교',fact_status:'자료에서 찾은 특징',rules_version:VERSION};
  items.push(item);patterns[clueId]={sources,fingerprint,checked_at:checkedAt,changed_at:changedAt,sort_date:item.sort_date,headline:item.headline};
 }
 items.sort((a,b)=>Number(b.analysis_changed)-Number(a.analysis_changed)||b.sort_date.localeCompare(a.sort_date)||a.clue_id.localeCompare(b.clue_id));
 return {items,snapshot:{version:VERSION,checked_at:checkedAt,patterns},stats:{...emptyStats,source_count:rows.length,pattern_count:items.length,changed_count:items.filter(x=>x.analysis_changed).length,new_pattern_count:items.filter(x=>x.initial_analysis).length,latest_source_date:rows.map(r=>r.date).sort().at(-1)||'',available:true}};
}
function summary(x){
 if(x.detector==='accumulated_pattern')return {...x.accumulated_analysis,asOf:x.sort_date};
 const accumulated=x.lane==='background',ref=x.pattern_ref;
 const changed=x.research?.status==='ready'&&x.article_brief?.changes?.length;
 return {
  feature:ref?.summary||x.one_line_signal||x.changed_fact||x.headline,
  comparison:ref?ref.date+' 기준 분석과 아래 새 자료 · 동일 펀드·사업 여부 대조 전':x.previous_state||'전후 조건을 비교할 자료는 아직 확보하지 못했습니다.',
  update:ref?'관련 새 자료 '+x.sources.length+'건을 찾았습니다. 기존 판단의 변화는 아직 확인하지 못했습니다.':accumulated?(x.linked_update?'관련 새 자료 '+x.linked_update.count+'건 · 아래에서 연결된 변화 확인':'이번 수집 범위에서 연결할 새 근거를 찾지 못했습니다.'):changed?x.article_brief.changes.map(c=>c.text).join(' · '):x.detector==='dart_deal'?(x.changed_fact||'')+' · 원문 자동 추출, 검수 전':x.detector==='reporting_opportunity'?'예정된 일정입니다. 발표 결과는 아직 확인되지 않았습니다.':'새 보도를 확보했습니다. 본문 대조로 확인된 변화는 아직 없습니다.',
  asOf:accumulated?baseline(x):''
 };
}
return {VERSION,TYPES,baseline,relevant,connect,accumulate,summary};
});
