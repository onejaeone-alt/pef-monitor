'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../lib/discovery-research');
const now=Date.parse('2026-09-17T06:00:00Z');
const docs=[{source_id:'s1',url:'https://marketin.edaily.co.kr/News/Read?id=1',title:'홈플러스 매각',text:'삼일은 홈플러스 매각 안내서를 배포할 예정이다.',read_ok:true,published_at:'2026-09-16T06:00:00Z'}, {source_id:'s2',url:'https://www.yna.co.kr/view/123',title:'홈플러스 영업 상황',text:'사측은 목표 대비 매출이 40% 수준이라고 밝힌 것으로 전해졌다.',read_ok:true,published_at:'2026-09-17T03:00:00Z'}];
function valid(){return {scope:'supported',summary:{text:'매각 안내서 배포를 준비하는 가운데 매출이 목표에 못 미친다는 보도가 나왔다.',fact_ids:['f1','f2']},why_now:{text:'최근 영업 상황이 보도됐다.',fact_ids:['f2']},facts:[{id:'f1',text:'삼일은 매각 안내서 배포를 계획하고 있다.',date:'',source_id:'s1',quote:docs[0].text},{id:'f2',text:'사측이 목표 대비 매출 40%를 밝혔다고 연합뉴스가 보도했다.',date:'',source_id:'s2',quote:docs[1].text}],already_covered:[{text:'매각 안내서 배포 계획',source_id:'s1'}],angles:[{headline:'홈플러스 영업 부진, 재매각 조건에 영향 줄까',reason:'매각 계획과 영업 상황을 함께 검토할 필요가 있다.',new_information:'기존 매각 개시 보도에서 영업 부진이 조건에 미칠 영향으로 확장하는 가설',basis_ids:['f1','f2'],coverage_ids:['s1']}],uncertainties:[]};}
test('brief requires two read sources and a read MarketIN baseline before proposing a follow-up',()=>{
 assert.equal(R.validate(valid(),docs).angles.length,1);
 const noOwn=docs.map(d=>({...d,url:d.source_id==='s1'?'https://www.hankyung.com/article/1':d.url}));assert.equal(R.validate(valid(),noOwn).angles.length,0);
 assert.throws(()=>R.validate(valid(),docs.map(d=>({...d,read_ok:d.source_id==='s1'}))),/insufficient_evidence/);
});
test('invented citations, unattested quotations and fabricated amounts cannot qualify',()=>{
 for(const change of [o=>o.facts[1].source_id='invented',o=>o.facts[1].quote='원문에 없는 문장',o=>o.facts[1].text='매출은 9000억원이다.']){const o=valid();change(o);assert.throws(()=>R.validate(o,docs),/insufficient_evidence/);}
 const o=valid();o.angles[0].coverage_ids=['invented'];assert.equal(R.validate(o,docs).angles.length,0);
});
test('selection keeps own reporting and official sources ahead of repeated news; filters unrelated and future material',()=>{
 const rows=[{title:'홈플러스 최신',url:'https://www.hankyung.com/article/1',published_at:'2026-09-17T01:00:00Z'},{title:'홈플러스 기보도',url:'https://news.google.com/rss/articles/abc',search_purpose:'marketin_coverage',published_at:'2026-09-16T01:00:00Z'},{title:'홈플러스 미래',url:'https://www.hankyung.com/article/2',published_at:'2027-09-17'},{title:'다른 기업',url:'https://www.hankyung.com/article/3'}];
 const selected=R.chooseSources(rows,'홈플러스',now);assert.equal(selected[0].search_purpose,'marketin_coverage');assert.equal(selected.length,2);
});
test('research reads public bodies, performs own-coverage search and returns no body dump',async()=>{
 const queries=[];const result=await R.research({topic:'홈플러스'},{now,key:'test',search:async q=>{queries.push(q);return {records:docs,log:[{status:'ok'}]};},read:async d=>d,generate:async ds=>R.validate(valid(),ds)});
 assert.equal(result.status,'ready');assert.equal(result.coverage.read,2);assert.ok(queries.some(q=>q.includes('site:marketin.edaily.co.kr')));assert.ok(result.sources.every(s=>!('text' in s)));assert.equal(result.analysis.angles.length,1);
});
test('missing model key and unreadable sources do not generate a fictitious recommendation',async()=>{
 const search=async()=>({records:docs,log:[]});let generated=false;
 const deps={now,key:'',search,read:async d=>d,generate:async()=>{generated=true;}};
 const r=await R.research({topic:'홈플러스'},deps);assert.equal(r.status,'sources_only');assert.equal(r.error,'model_key_unconfigured');assert.equal(r.analysis,null);assert.equal(generated,false);
 const failed=await R.research({topic:'홈플러스'},{...deps,read:async d=>({...d,read_ok:false})});assert.equal(failed.error,'insufficient_sources');
});
test('unrelated topics and private source URLs are rejected',async()=>{
 await assert.rejects(()=>R.research({topic:'홈플러스 site:attacker.test'}),/invalid_topic/);
 assert.deepEqual(R.chooseSources([{url:'http://127.0.0.1/secret',title:'홈플러스'}],'홈플러스',now),[]);
});
