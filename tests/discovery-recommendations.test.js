'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../discovery-recommendations');
const now=Date.parse('2026-09-24T04:00:00Z');
const news=(title,id,extra={})=>({title,source_url:'https://example.com/'+id,source_name:'보도사'+id,published_at:'2026-09-23T04:00:00Z',...extra});
const build=input=>R.build(input,{now,limit:20});
test('one useful LP notice produces a pitch with links without model or MarketIn access',()=>{
 const rows=build({official:[news('국민연금, 국내 사모펀드 8000억원 출자 위탁운용사 선정','lp',{source_type:'capital_call'})]});
 assert.equal(rows.length,1);assert.equal(rows[0].category,'lp');assert.match(rows[0].headline,/국민연금.*운용사/);assert.equal(rows[0].read_level,'title');assert.equal(rows[0].evidence[0].text,'국민연금, 국내 사모펀드 8000억원 출자 위탁운용사 선정');assert.equal(rows[0].source_count,1);
 assert.doesNotMatch(JSON.stringify(rows),/신고서|결과보고서|발제 확정 전/);assert.equal(Object.values(rows[0].score_breakdown).reduce((a,b)=>a+b,0),rows[0].score);
});
test('a buyout plus rights offering yields a specific article direction and one case',()=>{
 const p=build({news:[news('MBK, 네파 손절…K2그룹에 매각','a'),news('K2, 아웃도어 브랜드 네파 인수','b'),news('네파, K2그룹 새 최대주주로…주주배정 유상증자 추진','c')]}).find(x=>x.headline.includes('네파'));
 assert.ok(p);assert.match(p.headline,/유상증자/);assert.equal(p.category,'pef');assert.equal(p.case_count,1);assert.equal(p.evidence.length,3);assert.doesNotMatch(p.pitch_summary,/손실\s*\d|수익률\s*\d/);
});
test('syndicated and identical titles do not increase cases or attention',()=>{
 const row=news('맥쿼리, 가비아 인수 최종 무산…공개매수 실패','a');const base=build({news:[row]})[0],duplicates=build({news:[row,{...row,source_url:'https://wire.example/copy',source_name:'재전송사',title:'[속보] '+row.title+' (종합)'}]})[0];
 assert.ok(base);assert.equal(duplicates.case_count,1);assert.equal(duplicates.source_count,1);assert.equal(duplicates.score_breakdown.attention,base.score_breakdown.attention);
});
test('watchlist LP metadata does not turn an insurer acquisition into LP allocation',()=>{
 const p=build({news:[news('KDB생명, 83% 비율 무상감자 결정…한투지주 인수 부담 줄여','kdb',{target:{name:'한국산업은행',category:'lp'}})]});
 assert.equal(p.length,1);assert.equal(p[0].category,'ma');assert.doesNotMatch(p[0].headline,/한국산업은행/);
});
test('joint bank fund aliases remain one event and do not become cross-LP comparison',()=>{
 const p=build({news:[news('기업은행·산업은행, 1200억원 넥스트스테이지 펀드 결성','a'),news('산은·기은, 1천200억 펀드 결성…유망 혁신기업 지원','b'),news('기업은행·산업은행, 혁신기업에 1200억원 투자…IPO 지원','c')]});
 assert.equal(p.length,1);assert.equal(p[0].case_count,1);assert.equal(p[0].type,'lp_selection');assert.doesNotMatch(p[0].headline,/펀드 펀드/);
});
test('same GP separate acquisitions can be compared without inventing an exit',()=>{
 const p=build({news:[news('맥쿼리, 가비아 인수 최종 무산…공개매수 실패','a',{target:{name:'맥쿼리자산운용그룹 한국',category:'pef'}}),news('맥쿼리PE, 화성코스메틱·나우코스 인수 계약','b')]}).find(x=>x.type==='gp_sequence');
 assert.ok(p);assert.equal(p.case_count,2);assert.match(p.headline,/가비아.*화성코스메틱/);assert.doesNotMatch(p.headline,/자산운용그룹 한국/);assert.doesNotMatch(p.pitch_summary,/회수하려는|회수했|같은 거래/);
});
test('currency, generic capital, counterfactuals and unrelated property news never become companies',()=>{
 const p=build({news:[news('한화가 KAI를 인수한다면…K국방 득실은?','a'),news('금강수목원 매각 철회, 국가정원 추진','b'),news('농지 강제매각 추진','c'),news('사모펀드가 서브웨이 샌드위치 96억달러에 인수','d'),news('커지는 차환 리스크','e')]});
 assert.equal(p.length,0);
});
test('Latin entity matches have word boundaries so SK does not match risk in foreign titles',()=>{
 const rows=build({news:[news('SK, 회사채 1500억 발행…공모채 조달 반토막','sk')],foreign:[news('The real risk of private credit in the pension business','f')]});
 const p=rows.find(x=>x.research_topic==='SK');assert.ok(p);assert.equal(p.source_count,1);assert.doesNotMatch(JSON.stringify(p.evidence),/pension/);
});
test('carveout possibility remains a proposal and names the asset, not the GP as the sale',()=>{
 const p=build({news:[news("베인, 에코마케팅서 '알짜' 안다르 분리한다…독립매각 가능성",'a')]})[0];
 assert.match(p.headline,/^안다르 분리 매각 구상/);assert.match(p.pitch_summary,/확정 여부/);assert.doesNotMatch(p.headline,/매각 완료|베인 분리/);
});
test('sector grouping requires three distinct cases and never fabricates a growth baseline',()=>{
 const rows=[news('MBK파트너스, 식품기업 푸드원 인수 계약','a'),news('한앤컴퍼니, 식품기업 푸드투 인수 계약','b'),news('스틱인베스트먼트, 식품기업 푸드셋 인수 계약','c')];
 const p=build({news:rows}).find(x=>x.type==='sector_investment');assert.ok(p);assert.equal(p.case_count,3);assert.doesNotMatch(p.headline,/급증|급감|늘었다|몰린다/);assert.equal(build({news:rows.slice(0,2)}).some(x=>x.type==='sector_investment'),false);
});
test('old unverified canonical narratives cannot become current facts and empty/error inputs are safe',()=>{
 assert.deepEqual(build(null),[]);assert.deepEqual(build({news:{error:'offline'}}),[]);assert.deepEqual(build({canonical:[{headline:'세 GP 결성 지연',sort_date:'2026-09-24',hypothesis:'돈이 모자라다',sources:[{url:'https://example.com/old',date:'2026-09-24'}]}]}),[]);
 assert.deepEqual(R.build({news:[news('국민연금, 8000억원 사모펀드 출자','a')]},{now,limit:0}),[]);
});
test('scheduled event is labelled as future and the evidence stays linked',()=>{
 const p=build({calendar:[{title:'BDC 운용사 규제 개편 발표',date:'2026-09-26',status:'scheduled',evidence:'공식 일정',source_url:'https://example.com/calendar',source_name:'금융위'}]})[0];
 assert.ok(p);assert.equal(p.type,'scheduled');assert.match(p.why_now,/2일 뒤/);assert.equal(p.evidence[0].read_level,'title');
});
test('discount wording is not a company and merges into the named acquisition',()=>{
 const p=build({news:[news('웨스팅하우스 지분 5~10% 인수…의결권 가능','a'),news('[단독] 韓, 웨스팅하우스 지분 10% 할인해 인수','b'),news("韓, 웨스팅하우스 5~10% 지분 '10% 할인가' 인수 추진",'c')]});
 assert.equal(p.length,1);assert.match(p[0].headline,/웨스팅하우스/);assert.equal(p[0].case_count,1);assert.equal(p[0].source_count,3);
});
test('insurer recommitment is LP money management and sector window is 30 days',()=>{
 const p=build({news:[news('삼성생명, 사모펀드 3000억원 재약정 검토','a')]});assert.equal(p[0].category,'lp');assert.equal(p[0].type,'lp_strategy');
 const rows=[news('MBK파트너스, 식품기업 푸드원 인수 계약','a'),news('한앤컴퍼니, 식품기업 푸드투 인수 계약','b'),news('스틱인베스트먼트, 식품기업 푸드셋 인수 계약','c',{published_at:'2026-08-01'})];
 assert.equal(build({news:rows}).some(p=>p.type==='sector_investment'),false);
});
test('a shareholder participating in a tender does not turn a verb into the subject',()=>{
 const p=build({news:[news('가격 낮다 반대하더니…차파트너스, 리파인 공개매수 참여해 지분 매각','a')]})[0];assert.match(p.headline,/^리파인 공개매수/);
});
test('reviewed DART forms cannot originate a sale or acquisition pitch from issuer names',()=>{
 const dart=[{rcept_no:'20260923000001',rcept_dt:'20260923',corp_name:'금호개발상사',report_nm:'타법인주식및출자증권취득결정'},{rcept_no:'20260923000002',rcept_dt:'20260923',corp_name:'핑거',report_nm:'타법인주식및출자증권취득결정'}];
 const reviews=Object.fromEntries(dart.map((d,i)=>[d.rcept_no,{ok:true,rcept_no:d.rcept_no,current_fields:[{label:'취득금액',value:'100',unit:'억원',topic:'money',evidence_id:'money',source:{source_id:'dart:'+d.rcept_no}},{label:'대상회사',value:i?'회사명(국적)':'(주)STX',topic:'party',evidence_id:'party',source:{source_id:'dart:'+d.rcept_no}},{label:'취득목적',value:i?'신규 투자':'(주)STX 회생계획에 따른 당사 채권 출자전환',topic:'purpose',evidence_id:'purpose',source:{source_id:'dart:'+d.rcept_no}}]}]));
 assert.deepEqual(build({dart,reviews}),[]);
 const article=news('SK, 회사채 1500억원 발행…기존 차입금 차환','sk');
 assert.deepEqual(build({news:[article],dart,reviews}),build({news:[article]}));
});
test('a Latin company name does not swallow a different company with a Korean suffix',()=>{
 const rows=build({news:[news('SK, 회사채 1500억원 발행…기존 차입금 차환','sk'),news('SK리츠, 회사채 1000억원 발행…차입금 차환','skreit')]});
 assert.equal(rows.length,2);
 for(const topic of ['SK','SK리츠']){const p=rows.find(r=>r.research_topic===topic);assert.ok(p);assert.equal(p.source_count,1);assert.equal(p.evidence[0].text.startsWith(topic+','),true);}
});
