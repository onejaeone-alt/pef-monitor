'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../daily-report-gate');
const now=Date.parse('2026-09-17T07:00:00Z');
function result(angleOverrides={},analysisOverrides={}){
 const facts=[
  {id:'f1',text:'홈플러스는 본사와 대형마트 67개점 매각 절차에 착수했다.',date:'2026-09-17',source_id:'s1'},
  {id:'f2',text:'폐점 예정 19개점의 부동산은 개별 매각을 병행한다.',date:'2026-09-17',source_id:'s2'},
  {id:'f3',text:'마켓인은 전날 홈플러스 재매각 절차 재개를 보도했다.',date:'2026-09-16',source_id:'m1'}
 ];
 return {status:'ready',analysis:{facts,why_now:{text:'17일 본사·대형마트 67개점 매각 착수와 폐점 19개점 부동산 별도 매각이 구체화됐다.',fact_ids:['f1','f2']},already_covered:[{text:'재매각 절차 재개',source_id:'m1'}],changes:[],angles:[{headline:'홈플러스 67개점 통매각 착수…19개 폐점 부동산은 따로 판다',reason:'회생인가 이후 매각 범위가 구체화됐다.',new_information:'기보도된 재매각 재개에서 더 나아가 67개점 통매각과 폐점 19개점 부동산 별도매각 구조를 확인한다.',question:'67개점 통매각과 19개 부동산 별도매각이 회생계획의 변제재원에 각각 얼마나 반영돼 있나?',missing:'회생계획상 두 매각 경로별 예상 변제재원',first_action:'홈플러스와 매각주관사에 67개점 패키지와 19개 부동산의 예상 매각대금 구분 자료를 확인',falsification:'두 매각 경로가 회생계획상 별도 변제재원으로 구분되지 않는다고 확인되면 이 방향을 폐기',direction_key:'sale-package-vs-property',basis_ids:['f1','f2'],coverage_ids:['m1'],...angleOverrides}],uncertainties:[],...analysisOverrides}};
}
test('daily gate requires a fresh hard nugget, MarketIN comparison and an actionable missing fact',()=>{
 const d=G.evaluate({headline:'홈플러스',research_topic:'홈플러스'},result(),now);assert.ok(d);assert.match(d.headline,/67개점/);assert.match(d.hard_nugget,/67개점|19개점/);assert.equal(d.timing,'fresh_fact');
});
test('generic scenario language does not become a daily item even when sources are grounded',()=>{
 const r=result({headline:'홈플러스 회생 이후 다음은',new_information:'향후 채권 회수와 시장 반응을 살펴본다.'});assert.equal(G.evaluate({headline:'홈플러스'},r,now),null);
});
test('old hard facts do not become a daily item without an imminent sourced event',()=>{
 const r=result({}, {facts:[{id:'f1',text:'67개점 매각 검토',date:'2026-09-10',source_id:'s1'},{id:'f2',text:'19개점 부동산 매각 검토',date:'2026-09-10',source_id:'s2'}]});assert.equal(G.evaluate({headline:'홈플러스'},r,now),null);
});
test('imminent policy event can pass without a new transaction today when the angle is specific and grounded',()=>{
 const r=result({headline:'BDC 세부안 19일 발표…대출비중·투자대상·상장요건 기존안과 비교',new_information:'19일 세부안에서 BDC 대출비중·투자대상·상장요건의 기존안 대비 변경 여부를 확인한다.',question:'19일 발표안에서 BDC 대출비중과 투자대상 요건이 기존안에서 바뀌나?',missing:'19일 최종 세부안의 대출비중·투자대상 조문',first_action:'금융위원회 담당부서에 19일 공개 시각과 최종 세부안 배포 여부를 확인'}, {facts:[{id:'f1',text:'금융위원회는 19일 BDC 세부안을 발표할 예정이다.',date:'2026-09-15',source_id:'s1'},{id:'f2',text:'기존 BDC 논의에는 대출비중과 투자대상 요건이 포함됐다.',date:'2026-09-10',source_id:'s2'}],why_now:{text:'BDC 세부안 발표가 19일로 예정돼 있다.',fact_ids:['f1']}});
 const d=G.evaluate({headline:'BDC',research_topic:'BDC',event_date:'2026-09-19'},r,now);assert.ok(d);assert.equal(d.timing,'imminent_event');
});
test('single-source or no MarketIN comparison never reaches the daily shelf',()=>{
 const one=result({}, {facts:[{id:'f1',text:'67개점 매각 착수',date:'2026-09-17',source_id:'s1'},{id:'f2',text:'19개점 별도 매각',date:'2026-09-17',source_id:'s1'}]});assert.equal(G.evaluate({headline:'홈플러스'},one,now),null);
 const noCoverage=result({}, {already_covered:[]});assert.equal(G.evaluate({headline:'홈플러스'},noCoverage,now),null);
});
test('clone keeps non-daily directions as watch angles while removing them from the proposal shelf',()=>{
 const r=result();const empty=G.cloneResult(r,null);assert.equal(empty.analysis.angles.length,0);assert.equal(empty.watch_angles.length,1);
 const d=G.evaluate({headline:'홈플러스'},r,now),picked=G.cloneResult(r,d);assert.equal(picked.analysis.angles.length,1);assert.equal(picked.daily_pitch.headline,d.headline);
});
test('rendered daily report proposal is concise and escapes unsafe strings',()=>{
 const html=G.renderDaily({headline:'<img src=x> 67개점',today_reason:'오늘',hard_nugget:'67개점',new_information:'차이',missing:'빈칸',first_action:'회사에 확인'});assert.match(html,/일보 후보/);assert.match(html,/제목에 박을 근거/);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('AI discovery loads the daily gate after source research and timelines but before card rendering',()=>{
 const html=fs.readFileSync('leads.html','utf8'),brief=html.indexOf('/marketin-story-brief.js'),timeline=html.indexOf('/story-timeline.js'),gate=html.indexOf('/daily-report-gate.js'),desk=html.indexOf('/discovery-desk.js');assert.ok(brief>=0&&timeline>brief&&gate>timeline&&desk>gate);assert.match(html,/일보에 올릴 만큼 구체적인 취재거리/);assert.match(html,/일보 후보는 오늘의 명확한 계기/);
});
