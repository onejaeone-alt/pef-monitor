'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('../story-timeline');

test('only material IB policy announcements become timing research candidates',()=>{
  const bdc={clue_id:'schedule-bdc',detector:'reporting_opportunity',headline:'금융위원회 기업성장집합투자기구(BDC) 세부안 발표',event_date:'2026-09-19',story_mode:'사전 랩업',article_pitch:'old synthetic pitch',sources:[{url:'https://www.fsc.go.kr/a',label:'금융위',date:'2026-09-19'}]};
  const generic={...bdc,clue_id:'schedule-event',headline:'금융권 기념행사 개최',article_pitch:'old',sources:[{url:'https://example.com/e',label:'행사'}]};
  const C={calendarClues:()=>[bdc,generic]};
  const rows=T.timingCandidates([],{},C,Date.parse('2026-09-17T00:00:00Z'));
  assert.equal(rows.length,1);assert.equal(rows[0].research_topic,'BDC');assert.equal(rows[0].article_pitch,undefined);assert.equal(rows[0].sources[0].title,bdc.headline);assert.match(rows[0].reason,/원문과 기존 마켓인 보도/);
});

test('timing candidate merges into an existing researched issue instead of duplicating it',()=>{
  const issue={clue_id:'issue-bdc',research_topic:'BDC',sources:[{url:'https://example.com/news',title:'BDC 기사'}]};
  const event={clue_id:'schedule-bdc',headline:'BDC 세부안 발표',event_date:'2026-09-19',story_mode:'사전 랩업',article_pitch:'old',sources:[{url:'https://www.fsc.go.kr/a',label:'금융위'}]};
  const rows=T.timingCandidates([issue],{}, {calendarClues:()=>[event]});
  assert.equal(rows.length,1);assert.equal(rows[0].event_date,'2026-09-19');assert.equal(rows[0].sources.length,2);
});

test('timeline is withheld until source research returns a grounded article angle',()=>{
  const clue={research_topic:'홈플러스',headline:'홈플러스'};
  assert.deepEqual(T.timelineFor(clue,{status:'sources_only',analysis:null}),[]);
  assert.deepEqual(T.timelineFor(clue,{status:'ready',analysis:{angles:[]}}),[]);
});

test('BDC D-2 research continues into announcement-day comparison and first-product followup',()=>{
  const clue={research_topic:'BDC',headline:'BDC',event_date:'2026-09-19',story_mode:'사전 랩업'};
  const result={status:'ready',analysis:{summary:{text:'BDC 세부안 발표 예정'},why_now:{text:'발표 임박'},facts:[{text:'기업성장집합투자기구 BDC 제도'}],angles:[{headline:'오늘 쓸 BDC 랩업',reason:'이유',new_information:'차이'}]}};
  const rows=T.timelineFor(clue,result);assert.equal(rows.length,2);assert.equal(rows[0].phase,'09/19 발표 당일');assert.match(rows[0].pitch,/기존안서 뭐가 바뀌었나/);assert.match(rows[1].pitch,/1호 BDC/);
});

test('Homeplus restructuring research advances to the next court-sale signal and recovery result',()=>{
  const clue={research_topic:'홈플러스',headline:'홈플러스'};
  const result={status:'ready',analysis:{summary:{text:'홈플러스 회생 절차와 재매각이 진행 중'},why_now:{text:'재매각 절차 재개'},facts:[{text:'회생 인가 후 재매각 절차가 재개됐다'},{text:'채권 회수와 자산 매각이 쟁점이다'}],angles:[{headline:'홈플러스 회생 이후 시나리오',reason:'이유',new_information:'후속'}]}};
  const rows=T.timelineFor(clue,result);assert.equal(rows[0].phase,'다음 신호');assert.match(rows[0].trigger,/법원 결정|매각 공고/);assert.match(rows[0].pitch,/채권 회수/);assert.equal(rows[1].phase,'결과 기사');assert.match(rows[1].pitch,/누가 얼마 회수했나/);
});

test('M&A and LP issue research get stage-specific future article paths rather than generic checklists',()=>{
  const deal=T.timelineFor({research_topic:'A사',headline:'A사'}, {status:'ready',analysis:{summary:{text:'A사 매각 우선협상'},why_now:{text:'실사 착수'},facts:[{text:'인수금융 협의'}],angles:[{headline:'A사 거래 후속',reason:'r',new_information:'n'}]}});
  assert.match(deal[0].pitch,/본계약까지 남은 건/);assert.equal(deal[1].phase,'종결 후');
  const lp=T.timelineFor({research_topic:'모태펀드',headline:'모태펀드'}, {status:'ready',analysis:{summary:{text:'모태펀드 GP 선정'},why_now:{text:'출자사업'},facts:[{text:'최종 GP 선정 뒤 결성 예정'}],angles:[{headline:'선정 이후',reason:'r',new_information:'n'}]}});
  assert.match(lp[0].pitch,/민간 LP 확약/);assert.equal(lp[1].phase,'결성 후');
});

test('rendered timeline escapes untrusted strings',()=>{
  const html=T.renderTimelineHtml([{phase:'다음 <신호>',trigger:'<script>x</script>',pitch:'<img src=x onerror=alert(1)>'}]);
  assert.doesNotMatch(html,/<script|<img/);assert.match(html,/다음 기사 흐름 · 조건부/);assert.match(html,/&lt;script/);
});

test('install adds timing candidates and appends timelines only after the research brief is ready',()=>{
  const C={build:()=>[],calendarClues:()=>[]};
  const B={attach:(x,r)=>({...x,research:r,article_brief:r.analysis}),renderBriefHtml:r=>r.status==='ready'?'<section class="marketin-story-brief">brief</section>':'',shortlist:(rows,limit)=>rows.slice(0,limit)};
  const root={IBDiscovery:C,MarketInStoryBrief:B};assert.equal(T.install(root),true);assert.equal(T.install(root),false);
  const result={status:'ready',analysis:{summary:{text:'회생'},why_now:{text:'재매각'},facts:[{text:'회생 재매각'}],angles:[{headline:'기사',reason:'r',new_information:'n'}]}};
  const attached=B.attach({clue_id:'h',research_topic:'홈플러스',headline:'홈플러스'},result);assert.equal(attached.article_timeline.length,2);assert.ok(attached.research.story_timeline);
  assert.match(B.renderBriefHtml(attached.research),/marketin-story-timeline/);
});

test('AI discovery loads timeline extension after source-grounded MarketIN research and before the desk',()=>{
  const html=fs.readFileSync('leads.html','utf8');const brief=html.indexOf('/marketin-story-brief.js'),timeline=html.indexOf('/story-timeline.js'),desk=html.indexOf('/discovery-desk.js');
  assert.ok(brief>=0&&timeline>brief&&desk>timeline);assert.match(html,/story-timeline.css/);
});
