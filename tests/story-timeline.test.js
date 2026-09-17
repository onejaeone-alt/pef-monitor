'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('../story-timeline');

test('BDC pre-wrap continues into announcement-day comparison and first-product followup',()=>{
  const clue={clue_id:'bdc',story_mode:'사전 랩업',article_pitch:'[가제] BDC 규제 발표 D-2…시행 전 쟁점 총정리',event_date:'2026-09-19',headline:'금융위원회 기업성장집합투자기구(BDC) 규제 세부안 발표',entities:['금융위원회']};
  const rows=T.timelineFor(clue);
  assert.equal(rows.length,2);
  assert.equal(rows[0].phase,'09/19 발표 당일');
  assert.match(rows[0].pitch,/기존안서 뭐가 바뀌었나/);
  assert.match(rows[1].pitch,/1호 BDC/);
  assert.match(rows[1].trigger,/상품 출시/);
});

test('distress scenario continues at the next court or sale signal and then to a recovery result article',()=>{
  const clue={story_mode:'시나리오',article_pitch:'[가제] 홈플러스 회생 이후 다음은…재매각·자산처분·채권 회수 시나리오',headline:'홈플러스 관련 보도 흐름',entities:['홈플러스'],reported:['회생 인가','재매각 시동']};
  const rows=T.timelineFor(clue);
  assert.equal(rows.length,2);
  assert.equal(rows[0].phase,'다음 신호');
  assert.match(rows[0].trigger,/법원 결정|매각 공고/);
  assert.match(rows[0].pitch,/채권 회수표/);
  assert.equal(rows[1].phase,'결과 기사');
  assert.match(rows[1].pitch,/누가 얼마 회수했나/);
});

test('deal followup advances from current deal check to signing and closing analysis',()=>{
  const clue={story_mode:'거래 후속',article_pitch:'[가제] B회사 거래, 이제 남은 건…가격·인수금융·본계약·종결 조건 점검',headline:'B회사 관련 보도 흐름',entities:['B회사']};
  const rows=T.timelineFor(clue);
  assert.equal(rows.length,2);
  assert.match(rows[0].trigger,/SPA|인수금융/);
  assert.match(rows[0].pitch,/본계약까지 남은 건/);
  assert.equal(rows[1].phase,'종결 후');
  assert.match(rows[1].pitch,/새 지배구조/);
});

test('ordinary discovery clues do not get a fabricated article timeline',()=>{
  assert.deepEqual(T.timelineFor({headline:'단순 공시',detector:'dart_deal'}),[]);
});

test('timeline rendering escapes untrusted strings and stays compact',()=>{
  const html=T.renderTimelineHtml([{phase:'다음 <신호>',trigger:'<script>x</script>',pitch:'<img src=x onerror=alert(1)>'}]);
  assert.doesNotMatch(html,/<script|<img/);
  assert.match(html,/다음 기사 흐름/);
  assert.match(html,/&lt;script/);
});

test('install enriches built clues without mutating the original row',()=>{
  const source={clue_id:'x',story_mode:'거래 후속',article_pitch:'[가제] X 거래 후속',headline:'X 거래',entities:['X회사']};
  const C={build:()=>[source]};const root={IBDiscovery:C};
  assert.equal(T.install(root),true);
  const out=C.build();assert.ok(out[0].article_timeline);assert.equal(source.article_timeline,undefined);assert.equal(T.install(root),false);
});

test('AI discovery loads story timeline after MarketIN brief and before card rendering',()=>{
  const html=fs.readFileSync('leads.html','utf8');
  const brief=html.indexOf('/marketin-story-brief.js'),timeline=html.indexOf('/story-timeline.js'),desk=html.indexOf('/discovery-desk.js');
  assert.ok(brief>=0&&timeline>brief&&desk>timeline);
  assert.match(html,/발표 당일·다음 신호·결과 기사/);
  const css=fs.readFileSync('ai-discovery.css','utf8');assert.match(css,/marketin-story-timeline/);assert.match(css,/story-timeline-row/);
});
