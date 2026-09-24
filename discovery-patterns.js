(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DiscoveryPatterns=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
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
  const asOf=baseline(pattern),cutoff=Date.parse(asOf+'T23:59:59+09:00'),oldUrls=new Set((pattern.sources||[]).map(s=>s.url)),seen=new Set();
  if(!Number.isFinite(cutoff))continue;
  const candidates=material.filter(n=>{
   const time=Date.parse(n.published_at),url=safe(n.source_url),title=clean(n.title_ko||n.title);
   if(!url||oldUrls.has(url)||seen.has(url)||seen.has(title)||!Number.isFinite(time)||time<=cutoff||time>now||time<now-7*86400000||!relevant(pattern,n))return false;
   seen.add(url);seen.add(title);return true;
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
function summary(x){
 const accumulated=x.lane==='background',ref=x.pattern_ref;
 const changed=x.research?.status==='ready'&&x.article_brief?.changes?.length;
 return {
  feature:ref?.summary||x.one_line_signal||x.changed_fact||x.headline,
  comparison:ref?ref.date+' 기준 분석과 아래 새 자료 · 동일 펀드·사업 여부 대조 전':x.previous_state||'전후 조건을 비교할 자료는 아직 확보하지 못했습니다.',
  update:ref?'관련 새 자료 '+x.sources.length+'건을 찾았습니다. 기존 판단의 변화는 아직 확인하지 못했습니다.':accumulated?(x.linked_update?'관련 새 자료 '+x.linked_update.count+'건 · 아래에서 연결된 변화 확인':'이번 수집 범위에서 연결할 새 근거를 찾지 못했습니다.'):changed?x.article_brief.changes.map(c=>c.text).join(' · '):x.detector==='dart_deal'?(x.changed_fact||'')+' · 원문 자동 추출, 검수 전':x.detector==='reporting_opportunity'?'예정된 일정입니다. 발표 결과는 아직 확인되지 않았습니다.':'새 보도를 확보했습니다. 본문 대조로 확인된 변화는 아직 없습니다.',
  asOf:accumulated?baseline(x):''
 };
}
return {TYPES,baseline,relevant,connect,summary};
});
