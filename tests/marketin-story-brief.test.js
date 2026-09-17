'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const B=require('../marketin-story-brief');

test('M&A clue becomes a concrete reporting brief without pretending the angle is confirmed',()=>{
  const clue={clue_id:'d1',detector:'dart_deal',headline:'SGC에너지 · 타법인주식및출자증권취득결정',entities:['SGC에너지'],one_line_signal:'취득금액 3000억원 · 대상회사 A'};
  const brief=B.storyBrief(clue);
  assert.equal(brief.kind,'M&A·거래');
  assert.match(brief.angle,/누가 얼마를 어떤 돈으로/);
  assert.ok(brief.must_get.some(x=>/자금원/.test(x)));
  assert.ok(brief.compare.some(x=>/유사 거래/.test(x)));
  assert.match(brief.ready_when,/원문과 당사자 취재/);
  assert.doesNotMatch(brief.angle,/확정|기사화$/);
});

test('LP and GP brief separates policy amount, planned size, commitment and paid-in money',()=>{
  const brief=B.storyBrief({detector:'official_followup',headline:'국민성장펀드 GP 선정 기준 변경',entities:['국민성장펀드'],questions:['GP 선정 기준이 어떻게 바뀌나?']});
  assert.equal(brief.kind,'LP·GP');
  const text=brief.must_get.join(' ');
  for(const term of ['정책 출자액','출자 요청액','결성예정액','실제 약정액'])assert.match(text,new RegExp(term));
  assert.match(brief.compare.join(' '),/최근 2개년/);
});

test('credit brief asks who bears risk and requires terms, collateral and refinancing source',()=>{
  const brief=B.storyBrief({detector:'news_followup',headline:'현대건설 5000억원 CB 투자자 손실 우려',entities:['현대건설']});
  assert.equal(brief.kind,'크레딧');
  assert.match(brief.angle,/위험과 손실/);
  assert.match(brief.must_get.join(' '),/금리|수익률/);
  assert.match(brief.must_get.join(' '),/담보|보증/);
  assert.match(brief.must_get.join(' '),/상환재원|차환/);
});

test('market-pattern brief requires independent cases and a counterexample before calling it a trend',()=>{
  const brief=B.storyBrief({detector:'market_pattern',headline:'PEF 식음료 애드온 투자 증가',one_line_signal:'유사 거래 반복'});
  assert.equal(brief.kind,'시장흐름');
  assert.match(brief.must_get.join(' '),/반대 사례/);
  assert.match(brief.ready_when,/3개 이상 사례/);
  assert.match(brief.ready_when,/한 건이면 단건 기사/);
});

test('rendered brief escapes untrusted source strings',()=>{
  const html=B.renderBriefHtml({kind:'M&A·거래',angle:'<img src=x onerror=alert(1)>',must_get:['<script>x</script>'],compare:[],calls:[],ready_when:'확인'});
  assert.doesNotMatch(html,/<img|<script>/);
  assert.match(html,/&lt;img/);
  assert.match(html,/마켓인형 취재안/);
});

test('AI discovery loads the story brief between clue building and card rendering',()=>{
  const html=fs.readFileSync('leads.html','utf8');
  const core=html.indexOf('/discovery-core.js'),brief=html.indexOf('/marketin-story-brief.js'),desk=html.indexOf('/discovery-desk.js');
  assert.ok(core>=0&&brief>core&&desk>brief);
  assert.match(html,/필요한 숫자·비교사례·취재원/);
  assert.match(fs.readFileSync('ai-discovery.css','utf8'),/marketin-story-brief/);
});

test('install enriches the existing discovery build without changing source clues in place',()=>{
  const source={clue_id:'x',detector:'news_followup',headline:'PEF 인수 검토',entities:['A PEF']};
  const C={build:()=>[source]};
  const root={IBDiscovery:C};
  assert.equal(B.install(root),true);
  const out=C.build();
  assert.ok(out[0].article_brief);
  assert.equal(source.article_brief,undefined);
  assert.equal(B.install(root),false);
});
