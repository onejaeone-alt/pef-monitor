'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../discovery-patterns'),R=require('../discovery-recommendations');
const now=Date.parse('2026-09-28T03:00:00Z'),DAY=86400000;
const news=(title,id,date,extra={})=>({title,source_url:'https://example.com/'+id,source_name:'시험매체',published_at:date,target:{name:'시험파트너스',category:'gp'},...extra});
const old=news('시험파트너스, 가온식품 경영권 인수 계약 체결','old','2026-09-08T01:00:00Z');
const fresh=news('시험파트너스, 나래식품 경영권 매각 본계약 체결','fresh','2026-09-28T01:00:00Z');
const third=news('시험파트너스, 다온물류 경영권 인수 계약 체결','third','2026-09-28T02:00:00Z');
const run=(rows,previous={},time=now)=>P.accumulate({news:rows},{engine:R,previous,now:time});
test('archived and fresh source facts create a background feature before editorial ranking',()=>{
 assert.equal(run([fresh]).items.length,0);
 const result=run([old,fresh]),item=result.items[0];
 assert.equal(result.items.length,1);assert.equal(item.detector,'accumulated_pattern');assert.equal(item.lane,'background');assert.equal(item.sources.length,2);assert.equal(item.initial_analysis,true);assert.equal(item.new_sources.length,0);assert.equal(item.analysis_changed,false);
 assert.match(P.summary(item).feature,/2개 거래 대상/);assert.match(P.summary(item).comparison,/처음/);assert.match(P.summary(item).update,/초기 분석/);assert.match(P.summary(item).update,/제목/);assert.equal(item.sort_date,'2026-09-28');assert.equal(item.checked_at,new Date(now).toISOString());assert.equal(result.stats.source_count,2);assert.equal(result.stats.changed_count,0);
 assert.equal(run([old,{...fresh,published_at:'2026-09-09'}]).items.length,1,'patterns need not have a seven-day news trigger');
});
test('same-day additions preserve stable feature identity and compare previous versus new source facts',()=>{
 const first=run([old,fresh]),next=run([old,fresh,third],first.snapshot,now+300000),item=next.items[0];
 assert.equal(item.clue_id,first.items[0].clue_id);assert.equal(item.previous_sources.length,2);assert.equal(item.sources.length,3);assert.deepEqual(item.new_sources.map(s=>s.url),[third.source_url]);assert.equal(item.evidence_added,1);assert.equal(next.stats.changed_count,1);assert.notEqual(item.changed_at,first.items[0].changed_at);assert.match(P.summary(item).update,/새 근거 1건/);assert.match(item.one_line_signal,/3개 거래 대상/);
 const restored=JSON.parse(JSON.stringify(next.snapshot));assert.equal(restored.patterns[item.clue_id].sources.length,3);assert.equal(restored.patterns[item.clue_id].changed_at,item.changed_at);
});
test('a no-op poll advances checking time without manufacturing a material update',()=>{
 const first=run([old,fresh]),next=run([fresh,old],first.snapshot,now+DAY),item=next.items[0];
 assert.equal(item.changed_at,first.items[0].changed_at);assert.notEqual(item.checked_at,first.items[0].checked_at);assert.equal(item.new_sources.length,0);assert.equal(item.analysis_changed,false);assert.equal(next.stats.changed_count,0);assert.match(P.summary(item).update,/변경이 없습니다/);
});
test('reprints at new URLs and publisher tags do not create new evidence or changed timestamps',()=>{
 const first=run([old,fresh]),copy={...fresh,title:'[종합] '+fresh.title,source_url:'https://example.net/reprint',source_name:'재전송매체'};
 const together=run([old,fresh,copy],first.snapshot,now+300000),replacement=run([old,copy],first.snapshot,now+300000);
 for(const next of [together,replacement]){assert.equal(next.items[0].sources.length,2);assert.equal(next.items[0].evidence_added,0);assert.equal(next.items[0].evidence_revised,0);assert.equal(next.items[0].changed_at,first.items[0].changed_at);}
 assert.equal(run([fresh,copy]).items.length,0,'retransmissions alone cannot establish a pattern');
});
test('new verifiable content on the same URL is a revision rather than another independent source',()=>{
 const first=run([old,fresh]),richer={...fresh,summary:'시험파트너스가 나래식품 경영권 매각 본계약을 체결했다고 보도했다.'};
 const next=run([old,richer],first.snapshot,now+300000),item=next.items[0];assert.equal(item.sources.length,2);assert.equal(item.evidence_added,0);assert.equal(item.evidence_revised,1);assert.equal(item.revised_sources[0].url,fresh.source_url);assert.notEqual(item.changed_at,first.items[0].changed_at);assert.match(P.summary(item).update,/내용이 보강된 근거 1건/);assert.match(P.summary(item).comparison,/제목·요약/);assert.doesNotMatch(P.summary(item).comparison,/본문/);
});
test('expired material is removed from active comparisons and cannot survive only through the saved snapshot',()=>{
 const boundary={...old,published_at:'2026-06-30T01:00:00Z'},first=run([boundary,fresh,third]);assert.equal(first.items[0].sources.length,3);
 const next=run([boundary,fresh,third],first.snapshot,now+2*DAY),item=next.items[0];assert.equal(item.sources.length,2);assert.equal(item.evidence_removed,1);assert.equal(item.new_sources.length,0);assert.match(P.summary(item).update,/비교 범위에서 빠진 근거 1건/);
 const expired=run([old,fresh,third],next.snapshot,now+91*DAY);assert.deepEqual(expired.items,[]);assert.deepEqual(expired.snapshot.patterns,{});assert.equal(expired.stats.source_count,0);
});
test('future observations and similar corporation names cannot fabricate a same-GP pattern',()=>{
 assert.equal(run([old,{...fresh,published_at:'2026-09-28T04:00:00Z'}]).items.length,0);
 assert.equal(run([old,{...fresh,title:'시험파트너스증권, 나래식품 경영권 매각 본계약 체결'}]).items.length,0);
});
test('LP terms, different investors in a sector, and differing reported event stages have distinct evidence-based features',()=>{
 const lp=[news('국민연금, 사모펀드 위탁운용사 선정 3000억원 출자','lp1','2026-09-01',{target:{name:'국민연금',category:'lp'}}),news('국민연금, 사모펀드 위탁운용사 선정 4000억원 출자','lp2','2026-09-28',{target:{name:'국민연금',category:'lp'}})];
 const lpResult=run(lp);assert.ok(lpResult.items.some(x=>x.pattern_type==='lp_conditions'));assert.match(lpResult.items.find(x=>x.pattern_type==='lp_conditions').one_line_signal,/조건 변경으로 단정하지/);
 const sector=[old,news('다른파트너스, 나래식품 경영권 인수 계약 체결','sector','2026-09-28',{target:{name:'다른파트너스',category:'gp'}})];assert.ok(run(sector).items.some(x=>x.pattern_type==='sector_activity'));
 const events=[news('가온식품 공개매수 추진…매수가 2만원','event1','2026-09-01',{target:{name:'가온식품',category:'company'}}),news('가온식품 공개매수 무산…인수 계약 해제','event2','2026-09-28',{target:{name:'가온식품',category:'company'}})];const event=run(events).items.find(x=>x.pattern_type==='event_progress');assert.ok(event);assert.match(event.one_line_signal,/같은 거래의 진행 순서인지는/);
 const possible=[events[0],{...events[1],title:'가온식품 공개매수 무산 가능성 우려'}];assert.equal(run(possible).items.some(x=>x.pattern_type==='event_progress'),false);
});
test('missing normalization engine reports unavailable without deleting prior snapshots',()=>{
 const first=run([old,fresh]),result=P.accumulate({news:[fresh]},{previous:first.snapshot,now});assert.equal(result.stats.available,false);assert.equal(result.snapshot,first.snapshot);assert.deepEqual(result.items,[]);
});
test('a GP policy discussion without a concrete target cannot create a cumulative transaction pattern',()=>{
 const sale=news('MBK, 네파 손절…K2그룹에 매각','sale','2026-09-28');
 for(const title of ['(사모펀드 민낯)②MBK 사태에 LBO 200% 규제…“일률 제한보다 인수·사후관리”','MBK, 인수·사후관리 규제 논의']){
  const commentary=news(title,'policy','2026-09-27');
  assert.equal(run([sale,commentary]).items.some(x=>x.pattern_type==='gp_activity'),false);
 }
});

test('same concrete company shareholder change and rights issue are linked without formal deal-phase words or entity metadata',()=>{
 const sale={title:'MBK, 네파 손절…K2그룹에 매각',source_url:'https://example.com/nepa-sale',source_name:'매체1',published_at:'2026-09-23'};
 const capital={title:'네파, K2코리아그룹 새 최대주주로…주주배정 유상증자 추진',source_url:'https://example.com/nepa-capital',source_name:'매체2',published_at:'2026-09-24'};
 const first=run([sale,capital]),item=first.items.find(x=>x.pattern_type==='event_financing');assert.ok(item);assert.equal(item.sources.length,2);assert.equal(item.headline,'네파의 새 주주와 자본 확충');assert.match(item.one_line_signal,/유상증자/);assert.match(item.one_line_signal,/인과관계는 확인하지/);assert.deepEqual(item.confirmed_facts,[]);
 const noop=run([sale,capital],first.snapshot,now+300000).items.find(x=>x.pattern_type==='event_financing');assert.equal(noop.clue_id,item.clue_id);assert.equal(noop.changed_at,item.changed_at);assert.equal(noop.evidence_added,0);
 const added={title:'네파 유상증자 계획, 새 최대주주 투자 규모 주목',source_url:'https://example.com/nepa-plan',source_name:'매체3',published_at:'2026-09-28'};
 const next=run([sale,capital,added],first.snapshot,now+600000).items.find(x=>x.pattern_type==='event_financing');assert.equal(next.clue_id,item.clue_id);assert.equal(next.evidence_added,1);assert.equal(next.sources.length,3);
 const unrelated={...capital,title:'다른식품, K2코리아그룹 새 최대주주로…주주배정 유상증자 추진'};assert.equal(run([sale,unrelated]).items.some(x=>x.pattern_type==='event_financing'),false);
 assert.equal(run([capital,{...capital,source_url:'https://example.net/nepa-reprint'}]).items.some(x=>x.pattern_type==='event_financing'),false);
});
