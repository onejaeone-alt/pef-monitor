const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../news-taxonomy');
const cases = [
 ['PEF A파트너스 3호 블라인드펀드 5000억원 결성','fund_formation'],
 ['VC A인베스트먼트 신규 펀드 최종 클로징','fund_formation'],
 ['모태펀드 출자사업 최종 GP 선정','lp_selection'],
 ['국민연금 운용사 선정 공고…신규 펀드 조성','lp_selection'],
 ['한국벤처투자 출자 기준 변경','policy'],
 ['벤처투자 시행령 개정안 발표','policy'],
 ['산업은행 인수금융 리파이낸싱','credit'],
 ['PEF 투자기업 회사채 차환 추진','credit'],
 ['VC A캐피탈 신임 대표 영입','people'],
 ['운용역 독립…신생 운용사 출범','people'],
 ['PEF A파트너스 포트폴리오 기업 매각','deal'],
 ['A기업 인수 우선협상대상자 선정','deal'],
 ['VC 포트폴리오 IPO 추진','investment_exit'],
 ['스타트업 시리즈 A 투자유치','investment_exit'],
 ['세컨더리 펀드 1000억원 결성','fund_formation'],
 ['국민연금의 올해 시장 전망','review'],
 ['신임 대표 취임…모태펀드 협력 강화','people'],
 ['AC 창업기획자 후속 투자 결정','investment_exit'],
 ['인수인계 문서와 업무 절차','review'],
 ['투자기업 회생 신청','credit'],
 ['삼성생명 예상인수결과 시스템 특허…보험가입 확인','review'],
 ['로빈후드 오우라 IPO 인수단 합류','investment_exit'],
 ['이랜드월드 미매각…공모채 발행 감소 [DCM]','credit'],
 ['국민연금 고려아연 주총 모든 안건 찬성','deal'],
 ['국민연금 환헤지 중단','credit'],
 ['국민연금 가점 받자…전주 운용사 사무실 증가','policy'],
 ['사모펀드 데이터센터 매물 인기','deal'],
 ['국민연금 사모투자 늘었다','investment_exit'],
];
for (const [title,expected] of cases) test(title,()=>assert.equal(T.classify({title}).category_id,expected));
test('headline event wins over snippet background',()=>{
 assert.equal(T.classify({title:'VC 신임 대표 영입',snippet:'작년 인수 계약, 모태펀드 출자사업과 회사채 리파이낸싱'}).category_id,'people');
});
test('actor facets do not control event category',()=>{
 const c=T.classify({title:'PEF 신규 펀드 결성',snippet:'국민연금 LP 출자'});
 assert.equal(c.category_id,'fund_formation');assert.deepEqual(c.actor_ids,['PEF','LP']);
});
const now=Date.parse('2026-09-08T03:00:00Z');
const item=(title,id,h=0)=>({title,source_url:'https://example.com/'+id,published_at:new Date(now-h*3600000).toISOString(),source_name:'테스트 매체'});
test('split category conflicts without losing or duplicating articles',()=>{
 const a=item('PEF 펀드 결성',1),b=item('PEF 기업 매각',2);
 const rows=T.buildRows([a,b,a],[{items:[a,b]}],{now});
 assert.equal(rows.length,2);assert.equal(rows.flatMap(x=>x.items).length,2);
});
test('single display group for matching category with related coverage',()=>{
 const a=item('PEF 3호 펀드 결성',1),b=item('PEF 3호 펀드 결성 마무리',2,2);
 const rows=T.buildRows([a,b],[{items:[a,b]}],{now});
 assert.equal(rows.length,1);assert.equal(rows[0].items.length,2);assert.equal(rows[0].lead.source_url,a.source_url);
});
test('article view unfolds all articles',()=>{
 const a=item('PEF 펀드 결성',1),b=item('PEF 펀드 결성',2);
 assert.equal(T.buildRows([a,b],[{items:[a,b]}],{now,mode:'articles'}).length,2);
});
test('newest reporting first, not article counts',()=>{
 const a=item('PEF 기업 매각',1),b=item('PEF 펀드 결성',2,5),c=item('PEF 펀드 결성',3,6);
 assert.equal(T.buildRows([a,b,c],[{items:[b,c]}],{now})[0].lead.source_url,a.source_url);
});
test('local classification overrides do not mutate raw sources',()=>{
 const a=item('PEF 기업 매각',1);const old=JSON.stringify(a);
 const rows=T.buildRows([a],[],{now,overrides:{[T.key(a)]:'investment_exit'}});
 assert.equal(rows[0].category_id,'investment_exit');assert.equal(rows[0].manual,true);assert.equal(JSON.stringify(a),old);
});
test('source URL preferences survive temporary group ID changes',()=>{
 const a=item('PEF 기업 매각',1),b=item('PEF 펀드 결성',2);
 const one=T.buildRows([a],[{items:[a]}],{now})[0];
 const two=T.buildRows([a],[{items:[b]},{items:[a]}],{now})[0];
 assert.deepEqual(one.keys,two.keys);
});
test('range excludes old and future articles; unknown dates stay explicitly unknown',()=>{
 const a=item('투자 유치',1,200),b=item('투자 유치',2,-24),c={...item('투자 유치',3),published_at:null};
 const rows=T.buildRows([a,b,c],[],{now,days:7});assert.equal(rows.length,1);assert.equal(rows[0].latest,null);
});
test('category counts sum to the full display list',()=>{
 const items=cases.map(([title],i)=>item(title,i));const rows=T.buildRows(items,[],{now});
 assert.equal(T.categories.reduce((n,c)=>n+rows.filter(x=>x.category_id===c.id).length,0),rows.length);
});
test('existing actor metadata is usable without inventing names',()=>{
 const c=T.classify({title:'신규 펀드 결성',related_entities:[{type_label:'벤처캐피탈'}]});assert.deepEqual(c.actor_ids,['VC']);
});

test('do not merge unrelated reporting solely because the LP matches',()=>{
 const a={...item('국민연금 고려아연 주총 찬성',1),target:{name:'국민연금'}},b={...item('국민연금 삼성전자 지분 매각',2),target:{name:'국민연금'}};
 assert.equal(T.buildRows([a,b],[{items:[a,b]}],{now}).length,2);
});
test('unclassified reports are individually reviewable',()=>{
 const a=item('국민연금 치매 재산관리 신청',1),b=item('국민연금 부산 수해복구 지원',2);
 assert.equal(T.buildRows([a,b],[{items:[a,b]}],{now}).length,2);
});
test('different numbered funds are not merged',()=>{
 const a=item('A캐피탈 3호 펀드 결성',1),b=item('A캐피탈 4호 펀드 결성',2);
 assert.equal(T.buildRows([a,b],[{items:[a,b]}],{now}).length,2);
});
test('identical category override remains resettable',()=>{
 const a=item('신규 펀드 결성',1);
 assert.equal(T.buildRows([a],[],{now,overrides:{[T.key(a)]:'fund_formation'}})[0].manual,true);
});
