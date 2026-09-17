'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');

test('AI 발견 explains story proposals as reporting hypotheses, not article judgments',()=>{
 const h=fs.readFileSync('leads.html','utf8');
 assert.match(h,/오늘 무엇을 취재해 기사로 발전시킬지/);assert.match(h,/사전 랩업/);assert.match(h,/다음 단계와 시나리오/);assert.match(h,/기사 제안.*가제·가설/);
 assert.doesNotMatch(h,/기사점수|기사 등급|A등급 기사|B등급 기사/);
});

test('story pitch is visible before detail while sources and reporting requirements remain available',()=>{
 const s=fs.readFileSync('discovery-desk.js','utf8');
 for(const term of ['article_pitch','story_mode','why_today','story_requirements','comparison_targets','기사에 필요한 확인','비교할 사례·자료','출발 신호'])assert.match(s,new RegExp(term));
 assert.match(s,/취재에 담기/);assert.match(s,/모든 출처/);
});
