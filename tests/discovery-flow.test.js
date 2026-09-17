'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../discovery-core');
const now=Date.parse('2026-09-17T01:00:00Z'),n='20260915800786';
const item={rcept_no:n,rcept_dt:'20260915',corp_name:'제주항공',report_nm:'타법인주식및출자증권처분결정',event_id:'equity_disposal',scope_kind:'market'};
const field=(label,value,topic)=>({label,value,topic,evidence_id:label,source:{source_id:'dart:'+n,location:'표 1 · 행 6'}});
const review={ok:true,rcept_no:n,version:C.VERSION,current_fields:[{...field('처분금액','52,793,715,894','money'),unit:'원'},field('대상회사','퍼시픽제3호일반사모부동산투자(유)','party')],changes:[]};
test('fresh non-correction sale is discovered using same-receipt amount and target; stale or mismatched evidence is rejected',()=>{
 assert.equal(C.build({dart:[item],reviews:{[n]:review}},now).length,1);
 const clue=C.dartClue(item,review);assert.match(clue.one_line_signal,/52,793,715,894 원/);assert.match(clue.questions[0],/투자원가/);assert.equal(clue.confirmed_facts.length,0);
 assert.equal(C.dartClue(item,{...review,rcept_no:'20260917000001'}),null);
 assert.equal(C.dartClue(item,{...review,version:'old'}),null);
 assert.equal(C.dartClue(item,{...review,current_fields:[]}),null);
 assert.equal(C.dartClue(item,{...review,current_fields:review.current_fields.map(f=>({...f,source:{source_id:'dart:wrong'}}))}),null);
});
test('routine securities and old filing titles cannot displace real transactions',()=>{
 assert.equal(C.dartCandidates([{...item,event_id:'routine_security'},{...item,rcept_dt:'20260901'}],now).length,0);
 assert.equal(C.dartClue(item,{...review,current_fields:[review.current_fields[0],field('대상회사','일반 제조 자회사','party')]}),null);
});
test('central-bank bonds and public parks are excluded, similar reporting is collected into one card without claiming identical terms',()=>{
 const rows=['수목원 매각 철회','BOE 국채 매각 중단','[단독] 웨스팅하우스 지분 인수 추진','[단독] 웨스팅하우스 지분 인수 타진'].map((title,i)=>({title,source_type:'domestic_news',published_at:'2026-09-17',source_url:'https://example.com/'+i}));
 const clues=C.newsClues(rows,now,[{issue_id:'west',items:rows.slice(2)}]);assert.equal(clues.length,1);assert.equal(clues[0].related_sources.length,1);assert.match(clues[0].related_sources[0].label,/원문 대조/);
});
test('press notices and ordinary selections are excluded; explicit changed conditions generate an attributed followup',()=>{
 const rows=[{title:'IBK기업은행 2026년 출자사업 공고',source_type:'domestic_news'},{title:'국민연금 운용사 선정 결과 발표',source_type:'domestic_news'},{title:'국민연금 출자 운용사 선정 기준 완화',source_type:'domestic_news'},{title:'[단독] 사모펀드 인수 추진',source_type:'press_release'}].map((r,i)=>({...r,source_url:'https://example.com/'+i,source_name:'매체',published_at:'2026-09-17T00:00:00Z'}));
 const clues=C.newsClues(rows,now);assert.equal(clues.length,1);assert.equal(clues[0].fact_status,'보도');assert.equal(clues[0].confirmed_facts.length,0);assert.match(clues[0].questions[0],/GP/);
});
test('KST dates, translated foreign titles and original attribution survive',()=>{
 assert.equal(C.date('2026-09-16T23:00:00Z'),'2026-09-17');
 const clues=C.newsClues([{title:'Exclusive: Private equity fund cuts its target',title_ko:'사모펀드 목표액 축소',source_type:'foreign_news',source_url:'https://example.com/a',source_name:'Reuters',published_at:'2026-09-17T00:00:00Z'}],now);
 assert.equal(clues[0].headline,'사모펀드 목표액 축소');assert.match(clues[0].original_title,/Exclusive/);
});
test('only upcoming sourced events or announcements; cancellations, old events, far-future events and deadlines excluded',()=>{
 const e={id:'a',title:'벤처투자 설명회',date:'2026-09-18',status:'scheduled',evidence:'9월 18일 개최',source_url:'https://example.com/event',source_name:'성장금융',kind:'event'};
 const rows=[e,{...e,status:'cancelled'},{...e,date:'2026-09-16'},{...e,date:'2026-10-01'},{...e,title:'출자 접수 마감'},{...e,evidence:''}];
 assert.equal(C.calendarClues(rows,now).length,1);assert.match(C.calendarClues(rows,now)[0].next_action,/취재 등록/);
});
test('a sourced BDC announcement in two days becomes a pre-announcement wrapup pitch, not a prediction',()=>{
 const e={id:'bdc',title:'금융위원회 기업성장집합투자기구(BDC) 규제 세부안 발표',date:'2026-09-19',status:'scheduled',evidence:'9월 19일 BDC 세부안 발표 예정',source_url:'https://example.com/bdc',source_name:'금융위원회',kind:'announcement',organizer:'금융위원회'};
 const clue=C.calendarClues([e],now)[0];
 assert.equal(C.daysUntil(e.date,now),2);assert.equal(clue.story_mode,'사전 랩업');assert.match(clue.article_pitch,/BDC 규제 발표 D-2/);assert.match(clue.why_today,/2일 뒤/);assert.ok(clue.story_requirements.length>=4);assert.ok(clue.comparison_targets.some(x=>/미국 BDC/.test(x)));assert.equal(clue.fact_status,'단서');
});
test('repeated Homeplus restructuring coverage becomes a next-scenario story pitch with concrete reporting requirements',()=>{
 const rows=[
  ['홈플러스 회생 인가…매각 절차 재개','2026-09-15','한국경제'],
  ['홈플러스 재매각 시동…핵심 점포 새 주인 찾기','2026-09-16','매일경제'],
  ['홈플러스 회생 이후 자산 매각 본격화…채권단 촉각','2026-09-17','전자신문'],
 ].map(([title,published_at,source_name],i)=>({title,published_at,source_name,source_type:'domestic_news',source_url:'https://example.com/homeplus-'+i,target:{name:'홈플러스'},related_entities:[]}));
 const clues=C.storyPitchClues(rows,now);assert.equal(clues.length,1);const clue=clues[0];assert.equal(clue.detector,'story_pitch');assert.equal(clue.story_mode,'시나리오');assert.match(clue.article_pitch,/홈플러스/);assert.match(clue.article_pitch,/시나리오/);assert.match(clue.why_today,/3건/);assert.ok(clue.story_requirements.some(x=>/채권자별/.test(x)));assert.equal(clue.fact_status,'추론');
});
test('article count alone never creates a pitch when there is no next-stage or scenario cue',()=>{
 const rows=Array.from({length:6},(_,i)=>({title:'A사 신제품 출시 관련 보도 '+i,published_at:i<3?'2026-09-16':'2026-09-17',source_name:i%2?'매체B':'매체A',source_type:'domestic_news',source_url:'https://example.com/noise-'+i,target:{name:'A사'},related_entities:[]}));
 assert.equal(C.storyPitchClues(rows,now).length,0);
});
test('multi-day M&A reporting needs an explicit next-stage cue before it becomes a deal followup pitch',()=>{
 const rows=[
  ['B사 매각 추진','2026-09-15','매체A'],['C사 B사 인수 검토','2026-09-16','매체B'],['B사 매각 본계약 앞두고 인수금융 협의','2026-09-17','매체C'],
 ].map(([title,published_at,source_name],i)=>({title,published_at,source_name,source_type:'domestic_news',source_url:'https://example.com/deal-'+i,target:{name:'B사'},related_entities:[]}));
 const clue=C.storyPitchClues(rows,now)[0];assert.equal(clue.story_mode,'거래 후속');assert.match(clue.article_pitch,/인수금융/);assert.ok(clue.story_requirements.some(x=>/종결/.test(x)));
});
test('old canonical analyses remain available without posing as fresh discoveries; source URLs prevent duplicate cards',()=>{
 const old={clue_id:'old',sort_date:'2026-09-07',sources:[{url:'https://example.com/old'}]};
 const same={...old,clue_id:'same',sources:[{url:'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+n}]};
 const rows=C.build({dart:[item],reviews:{[n]:review},canonical:[old,same]},now);assert.equal(rows.length,2);assert.equal(rows[1].lane,'background');
});
test('shortlist reserves first-screen space for story pitches without hiding other candidates in data',()=>{
 const rows=Array.from({length:20},(_,i)=>({clue_id:'n'+i,detector:'news_followup',sort_date:'2026-09-17',lane:'current'}));
 rows.push({clue_id:'d',detector:'dart_deal',lane:'current'},{clue_id:'c',detector:'reporting_opportunity',lane:'current',event_date:'2026-09-18'},{clue_id:'s',detector:'story_pitch',lane:'current',sort_date:'2026-09-17',article_pitch:'[가제] 기사'});
 const shown=C.shortlist(rows);assert.equal(shown.length,12);assert.ok(shown.some(x=>x.clue_id==='d'));assert.ok(shown.some(x=>x.clue_id==='c'));assert.ok(shown.some(x=>x.clue_id==='s'));assert.equal(rows.length,23);
});
test('story-pitch project handoff uses the pitch as project title while preserving reporter notes and judgments',()=>{
 const clue={clue_id:'story-homeplus',headline:'홈플러스 관련 보도 흐름',article_pitch:'[가제] 홈플러스 다음 시나리오',sources:[{url:'https://example.com/h'}],questions:['q']};
 const result=C.mergeProject([],clue,'2026-09-17T01:00:00Z');assert.equal(result.rows[0].title,clue.article_pitch);
 const old={...result.rows[0],notes:'기자 메모',judgment:'보류',judgment_history:[{x:1}],title:'내가 고친 제목'};const next=C.mergeProject([old],clue,'2026-09-17T02:00:00Z');assert.equal(next.rows[0].notes,'기자 메모');assert.equal(next.rows[0].judgment,'보류');assert.equal(next.rows[0].title,'내가 고친 제목');
});
test('same-receipt project handoff preserves reporter notes and judgments and carries source evidence and questions',()=>{
 const clue=C.dartClue(item,review),old={project_id:'project-dart-'+n,notes:'기자 메모',judgment:'보류',judgment_history:[{x:1}],title:'기존 제목',created_at:'2026-09-16'};
 const result=C.mergeProject([old],clue);assert.equal(result.rows.length,1);assert.equal(result.rows[0].notes,old.notes);assert.equal(result.rows[0].judgment,'보류');assert.equal(result.rows[0].title,'기존 제목');assert.equal(result.rows[0].clue.evidence.length,2);assert.deepEqual(result.rows[0].dart_review_receipts,[n]);
});
