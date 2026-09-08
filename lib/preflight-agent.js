'use strict';
const C=require('./preflight-core'),S=require('./preflight-sources');
async function mapLimit(values,n,fn){const out=new Array(values.length);let index=0;await Promise.all(Array.from({length:Math.min(n,values.length)},async()=>{while(index<values.length){const i=index++;out[i]=await fn(values[i],i);}}));return out;}
function dedupeSources(rows){const m=new Map();for(const r of rows){const url=C.sourceKey(r.url||r.source_url);if(!url)continue;if(!m.has(url)||r.read_ok)m.set(url,{...r,url});}return [...m.values()];}
function candidateMatches(r,seeds){const title=C.norm(`${r.title||''} ${r.snippet||''}`);return seeds.some(s=>title.includes(C.norm(s.gp||s.lp))&&(s.playbook==='lp_rules'?/벤처/.test(r.title||''):(/펀드|조합|결성|클로징|출자|선정|운용인력/.test(r.title||'')||s.tokens.filter(t=>!/^(소형|국내|스케일업)$/i.test(t)).some(t=>title.includes(C.norm(t))))));}
function readPlan(refs,history,searches,seeds){
  // A per-case/per-search-purpose budget, not an article-value score. One GP cannot consume the whole budget.
  const plan=[...refs.slice(0,3),...history.filter(r=>S.publicKind(r.url)==='official').slice(0,2)];
  for(const seed of seeds){
    const groups=searches.filter(s=>s.case_id===seed.case_id);
    for(const group of groups){const rows=group.records.filter(r=>candidateMatches(r,[seed])&&S.publicKind(r.url)!=='blocked');
      const purpose=group.log.find(l=>l.purpose)?.purpose;
      const chronological=rows.filter(r=>{const y=String(r.published_at||'').slice(0,4);return /^20\d{2}$/.test(y)&&y===(purpose==='previous_rule'?String(Number(seed.year)-1):seed.year);});
      plan.push(...(chronological.length?chronological:rows).slice(0,1));
    }
  }
  return dedupeSources(plan).slice(0,10);
}
async function runResearch(parent,options={}){
  const started=new Date().toISOString(),deadline=Date.now()+(options.budgetMs||47000),seeds=parent.cases.slice(0,3),logs=[],steps=[],limitations=[];
  if(parent.cases.length>seeds.length)limitations.push(`이번 실행은 ${parent.cases.length}개 대상 중 ${seeds.length}개를 조사했습니다.`);
  const search=options.search||S.search,readDocument=options.readDocument||S.readDocument;
  const loadHistory=options.loadHistory||(()=>require('./clue-data').loadReportingLeadHistory(730,900)),loadFunds=options.loadFunds||(()=>require('./clue-data').fetchKvicFunds());
  const searchOne=async q=>{try{const r=await search(q.query,q.purpose,deadline);return {...r,case_id:q.case_id};}catch(_){return {records:[],case_id:q.case_id,log:[{query:q.query,purpose:q.purpose,status:'failed',count:0}]};}};
  const queries=seeds.flatMap(s=>C.makeQueries(s).map(q=>({...q,query:q.purpose==='previous_rule'?`${q.query} after:${Number(s.year)-1}-01-01 before:${s.year}-01-01`:q.query,case_id:s.case_id})));
  steps.push({step:'scope',status:'done',detail:`${seeds.length}개 조사대상으로 분리. 정본 기록은 출발 단서로만 사용.`});
  const [historical,funds,first]=await Promise.all([loadHistory().then(rows=>({ok:true,rows})).catch(()=>({ok:false,rows:[]})),loadFunds().catch(()=>({ready:false,items:[]})),mapLimit(queries,3,searchOne)]);
  for(const g of first)logs.push(...g.log.map(l=>({...l,case_id:g.case_id})));
  steps.push({step:'search',status:logs.some(l=>l.status==='ok')?'done':'partial',detail:'완료·연장·철회 또는 직전 연도 조건을 각각 검색'});
  if(!historical.ok)limitations.push('기존 공개 원문 색인을 읽지 못했습니다. 관련 기록 부재를 뜻하지 않습니다.');
  if(!funds.ready)limitations.push('공개 펀드목록 조회에 실패했습니다. 미등재·미결성 여부는 판단하지 않습니다.');
  const refs=seeds.flatMap(s=>s.references).filter(r=>S.publicKind(r.url)==='official').map(r=>({...r,title:r.label,found_by:'canonical_reference'})),history=S.historyRecords(historical.rows,seeds),searched=first.flatMap(g=>g.records).filter(r=>candidateMatches(r,seeds));
  const plan=readPlan(refs,history,first,seeds),all=dedupeSources([...refs,...searched,...history]);
  const readSafe=async r=>{if(Date.now()>deadline-500)return {...S.metaSource(r),access:'link_only',read_error:'RESEARCH_TIME_LIMIT'};try{return await readDocument(r,deadline);}catch(_){return {...S.metaSource(r),access:'unread',read_error:'READER_FAILED'};}};
  let sources=await mapLimit(plan,3,readSafe);
  const readKeys=new Set(plan.map(r=>C.sourceKey(r.url)));
  sources.push(...all.filter(r=>!readKeys.has(C.sourceKey(r.url))).slice(0,24).map(r=>({...S.metaSource(r),access:S.publicKind(r.url)==='search'?'headline_only':'link_only',read_error:'READ_BUDGET_NOT_SELECTED'})));
  const attachments=dedupeSources(sources.filter(s=>s.kind==='official'&&s.read_ok).flatMap(s=>(s.links||[]).map(l=>({...l,title:`${s.title} / ${l.title}`,found_by:'official_attachment',published_at:s.published_at||null}))))
    .filter(r=>/fileDown|download|attach|\.pdf|\.hwpx?/i.test(r.url+' '+r.title)).sort((a,b)=>Number(/선정\s*결과/.test(b.title))-Number(/선정\s*결과/.test(a.title))).slice(0,3);
  if(Date.now()<deadline-1000)sources.push(...await mapLimit(attachments,2,readSafe));
  steps.push({step:'read',status:sources.some(s=>s.read_ok)?'done':'partial',detail:`본문 ${sources.filter(s=>s.read_ok).length}건 열람. 첨부파일과 뉴스 원문 연결 결과를 별도 기록.`});
  const preliminary=seeds.map(s=>C.buildCaseResult(s,sources)),followups=seeds.flatMap((s,i)=>C.followupQueries(s,preliminary[i].evidence).map(q=>({...q,case_id:s.case_id})));
  let followed=[];
  if(Date.now()<deadline-2500){followed=await mapLimit(followups,2,searchOne);for(const g of followed)logs.push(...g.log.map(l=>({...l,case_id:g.case_id})));
    const existing=new Set(sources.flatMap(s=>[C.sourceKey(s.url),C.sourceKey(s.discovery_url)]));
    const more=dedupeSources(followed.flatMap(g=>g.records).filter(r=>candidateMatches(r,seeds))).filter(r=>!existing.has(C.sourceKey(r.url)));
    const nextPlan=readPlan([],[],followed,seeds).filter(r=>!existing.has(C.sourceKey(r.url))).slice(0,2);
    if(Date.now()<deadline-1000)sources.push(...await mapLimit(nextPlan,2,readSafe));
    const used=new Set(nextPlan.map(r=>C.sourceKey(r.url)));sources.push(...more.filter(r=>!used.has(C.sourceKey(r.url))).slice(0,6).map(r=>({...S.metaSource(r),access:S.publicKind(r.url)==='search'?'headline_only':'link_only',read_error:'READ_BUDGET_NOT_SELECTED'})));
  }else limitations.push('실행시간 한도 때문에 후속 검색을 마치지 못했습니다.');
  steps.push({step:'followup',status:followed.some(g=>g.log.some(l=>l.status==='ok'))?'done':'partial',detail:'완료 언급 여부에 따라 후속 질문과 검색을 변경'});
  sources=dedupeSources(sources);
  const cases=seeds.map(s=>C.buildCaseResult(s,sources,{fund_candidates:S.fundCandidates(funds.items||[],s)}));
  const relevantIds=new Set(cases.flatMap(c=>c.coverage_source_ids)),evidenceCount=cases.reduce((n,c)=>n+c.evidence.length,0),bodyRead=sources.filter(s=>s.read_ok),relevantRead=bodyRead.filter(s=>relevantIds.has(s.source_id));
  const searchFailed=!logs.some(l=>l.status==='ok'),partial=searchFailed||!historical.ok||!followed.length||cases.some(c=>!c.evidence.length)||sources.some(s=>s.access==='unread')||Date.now()>=deadline;
  if(searchFailed)limitations.push('실시간 검색에 실패했습니다. 기존 색인과 직접 연결 원문만 조사했습니다.');
  if(logs.some(l=>l.status==='not_configured'))limitations.push('네이버 검색은 미연결입니다. Google News는 뉴스 색인 범위이며 웹 전체를 빠짐없이 검색하지 않습니다.');
  limitations.push('본문 미열람·접근 제한·시간 한도는 자료가 없다는 뜻이 아닙니다. 유료·로그인·CAPTCHA는 우회하지 않습니다.');
  limitations.push('공식 첨부파일의 텍스트층과 HWPX를 읽습니다. 스캔 PDF와 구형 HWP는 미열람으로 남깁니다.');
  limitations.push('본문 발췌는 자동 추출 후보입니다. 동일 펀드·회차·계정과 문맥은 기자가 검수해야 하며 [확인]으로 자동 승격하지 않습니다.');
  limitations.push('관련 보도가 검색되지 않아도 미보도·단독으로 판정하지 않습니다. 목록 부재는 미결성·미등록의 증거가 아닙니다.');
  limitations.push('정책 출자액·목표액·약정액·납입액은 각각 확인합니다. 표의 헤더·단위가 불명확하면 숫자를 항목에 임의 배분하지 않습니다.');
  const years=[...new Set((funds.items||[]).map(f=>String(f.year||'').match(/20\d{2}/)?.[0]).filter(Boolean))].sort();
  return {ok:true,version:'preflight-1.1',run_id:C.hash(parent.clue_id,started),clue_id:parent.clue_id,title:parent.title,started_at:started,finished_at:new Date().toISOString(),canonical_as_of:seeds[0]?.canonical_as_of||null,state:partial?'partial':'completed',cases,
    sources:sources.map(({text,blocks,links,snippet,...meta})=>meta),coverage:{canonical_source:'기존 정본의 읽기전용 스냅샷',index_rows:historical.rows.length,index_ready:historical.ok,fund_catalog_ready:Boolean(funds.ready),fund_rows:(funds.items||[]).length,fund_catalog_years:years,searches:logs,body_read:bodyRead.length,relevant_body_read:relevantRead.length,official_attachments_read:bodyRead.filter(s=>s.found_by==='official_attachment').length,media_body_read:bodyRead.filter(s=>s.kind==='media').length,resolved_news_urls:sources.filter(s=>s.discovery_url).length,title_or_link_only:sources.filter(s=>!s.read_ok).length,evidence_count:evidenceCount,complete_market_coverage:false},steps,limitations,
    policy:{public_only:true,notes_uploaded:false,canonical_write:false,article_judgment:false,article_score:false,paid_model_calls:0,mode:'bounded_public_source_playbook'}};
}
module.exports={runResearch,mapLimit,dedupeSources,readPlan};
