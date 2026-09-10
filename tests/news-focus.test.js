const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../news-reader-core'),T=require('../news-taxonomy');
const now=Date.parse('2026-09-10T08:00:00Z');
const item=(title,id,extra={})=>({title,source_url:'https://example.com/'+id,published_at:new Date(now-3600000).toISOString(),...extra});
const rows=items=>T.buildRows(items,[],{mode:'articles',days:14,now});
const pick=(items,state=C.empty(),options={})=>C.focus(rows(items),state,{now,...options});
test('shortlist finds explicit follow-up events and returns the matching headline evidence',()=>{
 for(const [title,id] of [
  ['[단독] MBK, A기업 인수','exclusive'],['시공테크, 아이스크림에듀 지분 공개매수','bid'],
  ['하나벤처스 400억 출자사업 개시','lp'],['A기업 매각 본입찰 무산','risk'],
  ['A기업 회생 신청','risk'],['A기업 인수 완료','closing'],
  ['A캐피탈 3호 펀드 결성기한 연장','fund'],['고려아연 경영권 수성','dispute']
 ]){
  const result=pick([item(title,id)]);assert.equal(result.length,1,title);
  const reason=result[0].reasons.find(r=>r.id===id);assert.ok(reason,title);assert.ok(title.includes(reason.evidence));
 }
});
test('do not fill the shortlist with ordinary news, commentary or speculation',()=>{
 const titles=['세금 체납 내연녀, 아파트 경매로 매각','국민연금 퇴직자 노인일자리 만든다',
  '한성자동차, 95% 보장 매각 프로그램 출시','[기고] 공개매수 제도의 과제',
  'A기업 인수 완료 가능성','A기업 인수 무산설 부인','A사 회사채 발행',
  '벤처 펀드 결성액 증가','A기업 유상증자 결정','A사 단독 입찰',
  '매각 신호탄 되나?','국민연금 행사 소식'];
 assert.deepEqual(pick(titles.map((t,i)=>item(t,i))),[]);
});
test('foreign review works without translation and does not use translated claims as evidence',()=>{
 const foreign=title=>item(title,'foreign',{news_scope:'foreign'});
 assert.equal(pick([foreign('Blackstone completes acquisition of Acme')])[0].reasons[0].id,'closing');
 assert.equal(pick([foreign('Exclusive: KKR explores sale of Acme')])[0].reasons[0].id,'exclusive');
 assert.equal(pick([foreign('Acme files for bankruptcy')])[0].reasons[0].id,'risk');
 assert.equal(pick([foreign('KKR announces final close of fund')])[0].reasons[0].id,'fund');
 assert.deepEqual(pick([foreign('Acme could acquire Beta')]),[]);
 assert.deepEqual(pick([{...foreign('Market update'),title_ko:'A사 공개매수'}]),[]);
});
test('watched event gets priority but watch alone never creates an event or leaks across accounts',()=>{
 const a=item('A캐피탈 펀드 결성 완료',1),b=item('[단독] B기업 매각',2),noise=item('A캐피탈 업계 동향',3);
 const state=C.apply(C.empty(),[{kind:'watch',key:'A',value:{query:'A캐피탈',label:'A캐피탈'}}]);
 const before=JSON.stringify(state);
 assert.equal(pick([a,b,noise],state)[0].item.title,a.title);
 assert.equal(pick([a,b,noise])[0].item.title,b.title);
 assert.equal(pick([noise],state).length,0);assert.equal(JSON.stringify(state),before);
 assert.equal(pick([a])[0].reasons.some(r=>r.id==='watch'),false);
});
test('existing read flags do not suppress candidates; hidden articles stay hidden',()=>{
 const a=item('[단독] A기업 인수',1);
 const read=C.apply(C.empty(),[{kind:'read',key:C.key(a),value:{revision:C.revision(a)}}]);
 assert.equal(pick([a],read).length,1);
 const hidden=C.apply(read,[{kind:'hidden',key:C.key(a),value:{article:a}}]);
 assert.equal(pick([a],hidden).length,0);
});
test('strict dates prevent missing, future and old saved articles from entering the shortlist',()=>{
 const a=item('[단독] A기업 인수',1);
 for(const date of [null,'invalid',new Date(now+3600000).toISOString(),new Date(now-8*86400000).toISOString()]){
  const x={...a,published_at:date};assert.deepEqual(C.focus([{id:'test',lead:x,items:[x]}],C.empty(),{now}),[]);
 }
});
test('stale relative schedules are not presented as a reason to follow up today',()=>{
 const old=item('고려아연 주총 D-1',1,{published_at:new Date(now-2*86400000).toISOString()});
 assert.equal(pick([old]).length,0);
 const fresh={...old,published_at:new Date(now-3600000).toISOString()};
 assert.equal(pick([fresh])[0].reasons[0].id,'schedule');
});
test('shortlist stays within current search, topic and scope, including articles beyond the first page',()=>{
 const all=[item('[단독] A기업 인수',1),item('A기업 펀드 결성 완료',2),item('A기업 completes acquisition',3,{news_scope:'foreign'})];
 const filtered=C.select(all,C.empty(),{view:'latest',query:'A기업',category:'deal',newsScope:'domestic',classify:T.classify});
 assert.deepEqual(pick(filtered).map(x=>C.key(x.item)),[C.key(all[0])]);
 const ordinary=Array.from({length:35},(_,i)=>item('Z기업 회사채 발행',i+10));
 const result=pick([...ordinary,item('[단독] A기업 인수',99,{published_at:new Date(now-2*3600000).toISOString()})]);
 assert.equal(result.length,1);assert.ok(rows([...ordinary,result[0].item]).some(r=>r.id===result[0].rowId));
});
test('linked repeats occupy one place, without dropping either article from the full list',()=>{
 const a=item('A기업, 베타 공개매수',1),b=item('A기업 베타 지분 공개매수 개시',2),c=item('C기업 인수 완료',3);
 const related=new Map([[C.key(a),[a,b]],[C.key(b),[a,b]]]);
 const input=rows([a,b,c]),before=JSON.stringify(input),result=C.focus(input,C.empty(),{now,related});
 assert.equal(result.length,2);assert.equal(JSON.stringify(input),before);assert.equal(input.length,3);
});
test('same headline at different URLs is shown once, and a run of closings leaves room for other topics',()=>{
 const all=Array.from({length:6},(_,i)=>item('거래'+i+' 인수 완료',i));
 all.push(item('A캐피탈 펀드 결성 완료',10),item('A캐피탈 펀드 결성 완료',11));
 const result=pick(all);assert.equal(result.length,5);
 assert.equal(result.filter(x=>x.reasons.some(r=>r.id==='fund')).length,1);
 assert.equal(pick(all,C.empty(),{limit:0}).length,0);
});
