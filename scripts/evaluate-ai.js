'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const Rules=require('../discovery-recommendations'),Research=require('../lib/discovery-research');
const suite=require('../evals/editorial-cases.json');
const results=[];
function check(id,purpose,fn){try{fn();results.push({id,purpose,passed:true});}catch(e){results.push({id,purpose,passed:false,reason:e.message});}}
for(const c of suite.cases)check(c.id,c.purpose,()=>{
 const input={news:c.titles.map((title,i)=>({title,source_url:`https://example.com/${c.id}/${i}`,source_name:`예시매체${i}`,published_at:c.date||'2026-09-23T04:00:00Z'}))};
 const rows=Rules.build(input,{now:Date.parse(suite.as_of),limit:20}),e=c.expected;
 if(e.count!==undefined)assert.equal(rows.length,e.count);
 if(e.headline)assert.ok(rows.some(r=>r.headline.includes(e.headline)));
 if(e.topics)assert.deepEqual(rows.map(r=>r.research_topic).sort(),[...e.topics].sort());
 for(const row of rows){
  for(const k of ['case_count','source_count','read_level'])if(e[k]!==undefined)assert.equal(row[k],e[k]);
  if(e.forbidden)assert.ok(!JSON.stringify(row).includes(e.forbidden));
  if(e.forbidden_type)assert.notEqual(row.type,e.forbidden_type);
 }
});
const now=Date.parse(suite.as_of);
check('retrieval-earlier-context','최근 반복 보도 속에서도 이전 조건 자료 확보',()=>{
 const rows=Array.from({length:10},(_,i)=>({title:'홈플러스 매각 착수',url:`https://www.hankyung.com/article/${i}`,published_at:'2026-09-24T03:00:00Z'}));
 const old={title:'홈플러스 매출 부진과 체불 임금',url:'https://www.yna.co.kr/view/earlier',published_at:'2026-09-22T03:00:00Z'};
 assert.ok(Research.chooseSources([...rows,old],'홈플러스',now).some(r=>r.url===old.url));
});
check('retrieval-topic','다른 회사 원문을 근거 후보로 섞지 않음',()=>{
 assert.equal(Research.chooseSources([{title:'SK리츠 회사채 발행',url:'https://www.yna.co.kr/view/other'}],'홈플러스',now).length,0);
});
const doc={source_id:'s1',url:'https://www.yna.co.kr/view/sample',title:'예시기업 인수 계약',text:'예시기업은 지분 30%를 인수하는 계약을 체결했다.',read_ok:true};
const output=()=>({scope:'supported',summary:{text:'예시기업이 지분 인수 계약을 체결했다.',fact_ids:['f1']},why_now:{text:'인수 계약이 공개됐다.',fact_ids:['f1']},facts:[{id:'f1',text:doc.text,quote:doc.text,source_id:'s1',date:''}],angles:[],already_covered:[],uncertainties:[]});
check('grounding-supported','확보한 원문에 있는 사실은 유지',()=>assert.equal(Research.validate(output(),[doc]).facts.length,1));
check('grounding-fabricated-number','근거에 없는 수치를 포함한 분석 차단',()=>{const x=output();x.facts[0].text='예시기업은 지분 70%를 인수했다.';assert.throws(()=>Research.validate(x,[doc]),/insufficient_evidence/);});
check('grounding-fabricated-quote','원문에 없는 인용 구절 차단',()=>{const x=output();x.facts[0].quote='계약이 해제됐다.';assert.throws(()=>Research.validate(x,[doc]),/insufficient_evidence/);});
check('grounding-unread-document','읽지 못한 문서는 확인된 사실 근거로 사용하지 않음',()=>assert.throws(()=>Research.validate(output(),[{...doc,read_ok:false}]),/insufficient_evidence/));
const files=['discovery-recommendations.js','lib/discovery-research.js','evals/editorial-cases.json'];
const hashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')]));
const passed=results.filter(r=>r.passed).length;
const report={suite:suite.version,generated_at:new Date().toISOString(),as_of:suite.as_of,mode:'offline-regression',limitations:['실제 LLM을 호출하지 않음','기사 품질·정확도·채택률을 나타내지 않음','평가 사례는 기자가 검토하고 보강해야 함'],release:Research.OPS_IDENTITY,hashes,gate:passed===results.length?'pass':'fail',passed,total:results.length,results};
if(require.main===module){
 const destination=path.join(__dirname,'..','.ai-ops');fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'evaluation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`AI 운영 회귀 평가: ${passed}/${results.length} 통과 (${report.gate}). 실제 LLM 품질 평가는 별도입니다.`);
 for(const r of results.filter(r=>!r.passed))console.error(r.id+': '+r.reason);
 if(report.gate==='fail')process.exitCode=1;
}
module.exports=report;
