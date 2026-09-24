'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../lib/discovery-research');
const now=Date.parse('2026-09-17T06:00:00Z');
const docs=[{source_id:'s1',url:'https://marketin.edaily.co.kr/News/Read?id=1',title:'홈플러스 매각',text:'삼일은 홈플러스 매각 안내서를 배포할 예정이다.',read_ok:true,published_at:'2026-09-16T06:00:00Z'}, {source_id:'s2',url:'https://www.yna.co.kr/view/123',title:'홈플러스 영업 상황',text:'사측은 목표 대비 매출이 40% 수준이라고 밝힌 것으로 전해졌다.',read_ok:true,published_at:'2026-09-17T03:00:00Z'}];
function valid(){return {scope:'supported',summary:{text:'매각 안내서 배포를 준비하는 가운데 매출이 목표에 못 미친다는 보도가 나왔다.',fact_ids:['f1','f2']},why_now:{text:'최근 영업 상황이 보도됐다.',fact_ids:['f2']},facts:[{id:'f1',text:'삼일은 매각 안내서 배포를 계획하고 있다.',date:'',source_id:'s1',quote:docs[0].text},{id:'f2',text:'사측이 목표 대비 매출 40%를 밝혔다고 연합뉴스가 보도했다.',date:'',source_id:'s2',quote:docs[1].text}],already_covered:[{text:'매각 안내서 배포 계획',source_id:'s1'}],angles:[{headline:'홈플러스 영업 부진, 재매각 조건에 영향 줄까',reason:'매각 계획과 영업 상황을 함께 검토할 필요가 있다.',new_information:'기존 매각 개시 보도에서 영업 부진이 조건에 미칠 영향으로 확장하는 가설',question:'매출 부진이 매각 조건을 바꾸나?',missing:'영업 실적이 매각 조건에 반영되는 방식',first_action:'매각 주관사에 영업 실적을 반영한 조건 변경 여부 확인',falsification:'영업 실적과 무관하게 매각 조건이 유지됐다면 가설 재검토',direction_key:'영업 부진과 매각 조건',basis_ids:['f1','f2'],coverage_ids:['s1']}],uncertainties:[]};}
test('grounded article directions do not depend on obtaining a MarketIN baseline',()=>{
 assert.equal(R.validate(valid(),docs).angles.length,1);
 const noOwn=docs.map(d=>({...d,url:d.source_id==='s1'?'https://www.hankyung.com/article/1':d.url}));const result=R.validate(valid(),noOwn);assert.equal(result.angles.length,1);assert.deepEqual(result.already_covered,[]);assert.deepEqual(result.angles[0].coverage_ids,[]);
 assert.throws(()=>R.validate(valid(),docs.map(d=>({...d,read_ok:d.source_id==='s1'}))),/insufficient_evidence/);
});
test('invented citations, unattested quotations and fabricated amounts cannot qualify',()=>{
 for(const change of [o=>o.facts[1].source_id='invented',o=>o.facts[1].quote='원문에 없는 문장',o=>o.facts[1].text='매출은 9000억원이다.']){const o=valid();change(o);assert.throws(()=>R.validate(o,docs),/insufficient_evidence/);}
 const o=valid();o.angles[0].coverage_ids=['invented'];assert.deepEqual(R.validate(o,docs).angles[0].coverage_ids,[]);
 o.angles[0].basis_ids=['invented'];assert.equal(R.validate(o,docs).angles.length,0);
});
test('repeated source headlines and source-count explanations cannot qualify as article angles',()=>{
 for(const mutate of [a=>a.headline=docs[0].title,a=>a.reason=a.headline,a=>a.new_information='새 보도를 확보했습니다.']){
  const output=valid();mutate(output.angles[0]);assert.equal(R.validate(output,docs).angles.length,0);
 }
});
test('selection keeps own reporting and official sources ahead of repeated news; filters unrelated and future material',()=>{
 const rows=[{title:'홈플러스 최신',url:'https://www.hankyung.com/article/1',published_at:'2026-09-17T01:00:00Z'},{title:'홈플러스 기보도',url:'https://news.google.com/rss/articles/abc',search_purpose:'marketin_coverage',published_at:'2026-09-16T01:00:00Z'},{title:'홈플러스 미래',url:'https://www.hankyung.com/article/2',published_at:'2027-09-17'},{title:'다른 기업',url:'https://www.hankyung.com/article/3'}];
 const selected=R.chooseSources(rows,'홈플러스',now);assert.equal(selected[0].search_purpose,'marketin_coverage');assert.equal(selected.length,2);
});
test('research reads public bodies, performs own-coverage search and returns no body dump',async()=>{
 const queries=[];const result=await R.research({topic:'홈플러스'},{now,key:'test',index:async()=>[],search:async q=>{queries.push(q);return {records:docs,log:[{status:'ok'}]};},read:async d=>d,generate:async ds=>R.validate(valid(),ds)});
 assert.equal(result.status,'ready');assert.equal(result.coverage.read,2);assert.ok(queries.some(q=>q.includes('site:marketin.edaily.co.kr')));assert.ok(result.sources.every(s=>!('text' in s)));assert.equal(result.analysis.angles.length,1);
});
test('missing model key and unreadable sources do not generate a fictitious recommendation',async()=>{
 const search=async()=>({records:docs,log:[]});let generated=false;
 const deps={now,key:'',search,index:async()=>[],read:async d=>d,generate:async()=>{generated=true;}};
 const r=await R.research({topic:'홈플러스'},deps);assert.equal(r.status,'sources_only');assert.equal(r.error,'model_key_unconfigured');assert.equal(r.analysis,null);assert.equal(generated,false);
 const failed=await R.research({topic:'홈플러스'},{...deps,read:async d=>({...d,read_ok:false})});assert.equal(failed.error,'insufficient_sources');
});
test('unrelated topics and private source URLs are rejected',async()=>{
 await assert.rejects(()=>R.research({topic:'홈플러스 site:attacker.test'}),/invalid_topic/);
 assert.deepEqual(R.chooseSources([{url:'http://127.0.0.1/secret',title:'홈플러스'}],'홈플러스',now),[]);
});

test('MarketIN public index supplies direct originals when search returns redirect links',()=>{
 const html='<a href="/News/Read?newsId=123"><h2>홈플러스 재매각</h2></a><a href="https://evil.test/News/Read?newsId=1">홈플러스</a>';
 const rows=R.marketinLinks(html,'홈플러스');assert.equal(rows.length,1);assert.equal(rows[0].url,'https://marketin.edaily.co.kr/News/Read?newsId=123');
});
test('prior operating context is retained when many publishers repeat todays sale announcement',()=>{
 const latest=Array.from({length:10},(_,i)=>({title:'홈플러스 매각 착수',url:'https://www.newspim.com/news/view/'+i,publisher:'매체'+i,published_at:'2026-09-17T05:00:00Z'}));
 const earlier={title:'홈플러스 매출 부진과 체불 임금',url:'https://www.yna.co.kr/view/prior',published_at:'2026-09-16T06:00:00Z'};
 assert.ok(R.chooseSources([...latest,earlier],'홈플러스',now).some(x=>x.url===earlier.url));
});

test('known publisher originals are read before Google navigation links in the remaining source budget',()=>{
 const rows=[{url:'https://news.google.com/rss/articles/a',title:'시험사 매각 착수',published_at:'2026-09-17T05:00:00Z'}, {url:'https://www.hankyung.com/article/1',title:'시험사 매각 착수',published_at:'2026-09-17T01:00:00Z'}];
 assert.equal(R.chooseSources(rows,'시험사',now)[0].url,'https://www.hankyung.com/article/1');
});

const lpDoc={source_id:'lp',url:'https://www.nps.or.kr/notice/1',title:'시험LP 사모펀드 위탁운용사 선정',text:'시험LP는 사모펀드 위탁운용사 선정에 3000억원을 배정했다. 운용사별 제안 규모와 투자 분야를 심사한다.',read_ok:true,published_at:'2026-09-17T03:00:00Z'};
function lpOutput(){return {scope:'supported',summary:{text:'시험LP가 사모펀드 위탁운용사 선정 계획을 공개했다.',fact_ids:['lp1']},why_now:{text:'운용사 선정 계획이 나와 지원 분야를 살펴볼 때다.',fact_ids:['lp1']},facts:[{id:'lp1',text:lpDoc.text,quote:lpDoc.text,source_id:'lp',date:''}],already_covered:[],angles:[{headline:'시험LP 출자사업, 제안 규모와 투자 분야를 함께 본다',reason:'사모펀드 운용사 선정에서 제안 규모와 투자 분야가 어떻게 심사되는지 정리한다.',new_information:'발표된 심사 항목을 기준으로 GP가 준비할 투자 계획을 설명하는 기사다.',question:'운용사 제안에서 투자 분야와 규모는 어떻게 연결되는가?',basis_ids:['lp1'],direction_key:'lp-investment-criteria'}],uncertainties:[]};}
test('one read official announcement supports an LP explainer without compulsory reporting checklists',async()=>{
 const analysis=R.validate(lpOutput(),[lpDoc]);assert.equal(analysis.angles.length,1);assert.equal(analysis.angles[0].first_action,'');assert.deepEqual(analysis.angles[0].coverage_ids,[]);
 const result=await R.research({topic:'시험LP'},{now,key:'test',index:async()=>[],search:async()=>({records:[lpDoc],log:[]}),read:async d=>d,generate:async ds=>R.validate(lpOutput(),ds)});
 assert.equal(result.status,'ready');assert.equal(result.coverage.read,1);assert.equal(result.coverage.marketin_read,0);assert.equal(result.analysis.angles.length,1);
 const unread=R.validate({...lpOutput(),scope:'rejected'},[{...lpDoc,read_ok:false}]);assert.equal(unread.facts.length,0);assert.equal(unread.angles.length,0);
});
test('older context can support current recommendations but cannot become a fresh trigger',async()=>{
 const earlier={...lpDoc,published_at:'2026-07-01T03:00:00Z'};assert.equal(R.chooseSources([earlier],'시험LP',now).length,1);
 let generated=false;const result=await R.research({topic:'시험LP'},{now,key:'test',index:async()=>[],search:async()=>({records:[earlier],log:[]}),read:async d=>d,generate:async()=>{generated=true;}});
 assert.equal(result.error,'no_recent_source');assert.equal(generated,false);
});
