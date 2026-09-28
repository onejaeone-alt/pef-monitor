'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const N=require('../lib/insight-numbers');
const f=(year,value,extra={})=>({source_id:'s'+year,subject:'한국성장금융',scope:'성장펀드',basis:'연간 총출자액',metric:'출자액',state:'계획',period:String(year),value_text:value,quote:`한국성장금융은 ${year}년 성장펀드에 ${value}을 출자할 계획이다.`,...extra});
const doc=f=>({source_id:f.source_id,url:'https://www.kgrowth.or.kr/'+f.source_id,title:'출자계획',read_ok:true,text:'서문 '+f.quote+' 끝'});
test('Korean units, percentages and counts use deterministic arithmetic',()=>{
 assert.deepEqual(N.parseNumber('1조 2,000억원'),{value:1200000000000,unit:'원'});
 assert.deepEqual(N.parseNumber('3.5억달러'),{value:350000000,unit:'달러'});
 assert.deepEqual(N.parseNumber('5.2%'),{value:5.2,unit:'%'});
 assert.deepEqual(N.parseNumber('6곳'),{value:6,unit:'개사'});
 for(const s of ['약 500억원','500~600억원','500억원 이상','-500억원','1억2조원',''])assert.equal(N.parseNumber(s),null);
});
test('year comparison, duplicate reporting, and source positions',()=>{
 const a=f(2025,'100억원'),b=f(2026,'150억원'),duplicate={...b,source_id:'copy'};
 const r=N.validate({facts:[a,b,duplicate]},[a,b,duplicate].map(doc));
 assert.equal(r.rows.length,2);assert.equal(r.rows[1].sources.length,2);
 assert.equal(r.comparisons[0].percent,50);assert.equal(r.comparisons[0].delta,5e9);
 assert.match(r.rows[0].location,/본문 4번째/);
});
test('conflicting reports, different scopes/statuses/currencies never compare',()=>{
 const a=f(2025,'100억원'),b=f(2026,'150억원'),conflict={...b,value_text:'160억원',quote:b.quote.replace('150','160'),source_id:'conflict'};
 let r=N.validate({facts:[a,b,conflict]},[a,b,conflict].map(doc));assert.equal(r.comparisons.length,0);assert.equal(r.rows.filter(x=>x.conflict).length,2);
 for(const extra of [{scope:'다른펀드'},{state:'실행'},{basis:'누적 총액'},{value_text:'150억달러',quote:b.quote.replace('150억원','150억달러')}]){
  const c={...b,...extra};r=N.validate({facts:[a,c]},[a,c].map(doc));assert.equal(r.comparisons.length,0);
 }
});
test('fabricated quotes, absent periods and approximation stripped by model rejected',()=>{
 const a=f(2025,'100억원');assert.equal(N.validate({facts:[a]},[{...doc(a),text:'다른 문서'}]).rows.length,0);
 const unknown={...a,period:'2024'};assert.equal(N.validate({facts:[unknown]},[doc(a)]).rows[0].period,'');
 const approx={...a,quote:a.quote.replace('100억원','약 100억원')};assert.equal(N.validate({facts:[approx]},[doc(approx)]).rows.length,0);
});
test('percent rates use percentage points and zero baseline has no rate',()=>{
 const a=f(2025,'0억원'),b=f(2026,'150억원');let r=N.validate({facts:[a,b]},[a,b].map(doc));assert.equal(r.comparisons[0].percent,null);
 const c=f(2025,'5%',{metric:'금리'}),d=f(2026,'6%',{metric:'금리'});r=N.validate({facts:[c,d]},[c,d].map(doc));assert.equal(r.comparisons[0].delta,1);assert.equal(r.comparisons[0].percent,null);
});
test('analyze retrieves public bodies and reports unread sources without using titles as evidence',async()=>{
 const a=f(2025,'100억원');const r=await N.analyze({sources:[{url:'https://www.kgrowth.or.kr/a',title:'A'},{url:'https://www.kgrowth.or.kr/b',title:'B'}]},
 {key:'test',read:async s=>s.title==='A'?doc(a):{...s,read_ok:false},generate:async()=>({facts:[a]})});
 assert.equal(r.status,'ready');assert.equal(r.coverage.read,1);assert.equal(r.coverage.total,2);
});
