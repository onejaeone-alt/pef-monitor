'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../lib/discovery-research'),D=require('../daily-report-pitch');

const docs=[
 {source_id:'m1',url:'https://marketin.edaily.co.kr/News/Read?newsId=1',title:'홈플러스 재매각',text:'홈플러스가 티저레터를 배포하며 경영권 매각 절차를 재가동한다.',read_ok:true,published_at:'2026-09-16T06:00:00Z'},
 {source_id:'n1',url:'https://www.hankyung.com/article/1',title:'홈플러스 67개점 M&A',text:'홈플러스는 대형마트 67개점 M&A와 폐점 점포 19곳 매각에 착수했다.',read_ok:true,published_at:'2026-09-17T05:00:00Z'},
 {source_id:'n2',url:'https://www.yna.co.kr/view/1',title:'회생계획 인가',text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',read_ok:true,published_at:'2026-09-17T04:00:00Z'}
];
function output(){return {scope:'supported',summary:{text:'홈플러스가 회생계획 인가 뒤 67개점 M&A와 19개 폐점 점포 매각을 추진한다.',fact_ids:['f1','f2','f3']},why_now:{text:'회생계획 인가 뒤 67개점 M&A와 19개 폐점 점포 매각이 구체화됐다.',fact_ids:['f2','f3']},previous_state:{text:'기존에는 티저레터 배포와 경영권 매각 재가동이 공개됐다.',fact_ids:['f1']},changes:[],facts:[
 {id:'f1',text:'마켓인은 홈플러스가 티저레터를 배포하며 경영권 매각 절차를 재가동한다고 전했다.',date:'',source_id:'m1',quote:docs[0].text},
 {id:'f2',text:'홈플러스는 대형마트 67개점 M&A와 폐점 점포 19곳 매각에 착수했다.',date:'',source_id:'n1',quote:docs[1].text},
 {id:'f3',text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',date:'',source_id:'n2',quote:docs[2].text}],already_covered:[{text:'티저레터 배포와 경영권 매각 재가동',source_id:'m1'}],angles:[],daily_pitch:{headline:'홈플러스 67개점 M&A 재시동…19개 폐점 점포 매각과 회생안 이후 달라진 처분 구조',thesis:{text:'회생계획 인가 뒤 홈플러스 매각은 67개점 M&A와 19개 폐점 점포 처분을 함께 추진하는 구조로 구체화됐다.',fact_ids:['f2','f3']},bullets:[{text:'마켓인은 티저레터 배포와 경영권 매각 재가동을 전했다.',fact_ids:['f1']},{text:'홈플러스는 대형마트 67개점 M&A와 폐점 점포 19곳 매각에 착수했다.',fact_ids:['f2']},{text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',fact_ids:['f3']}],coverage_ids:['m1'],new_information:'기존 재매각 개시 보도에서 더 나아가 67개점 M&A와 19개 폐점 점포 처분을 나눠 회생계획 이후의 자산 처분 구조를 설명한다.',decisive_gap:'매각 주관사 투자안내서에서 67개점 M&A 범위와 19개 폐점 점포 처분 방식이 어떻게 구분되는지 확인한다.'},uncertainties:[]};}

test('daily report pitch requires concrete grounded copy from multiple sources',()=>{
 const v=R.validate(output(),docs);assert.ok(v.daily_pitch);assert.match(v.daily_pitch.headline,/67개점/);assert.equal(v.daily_pitch.bullets.length,3);
 const thin=output();thin.daily_pitch.bullets=thin.daily_pitch.bullets.slice(0,1);assert.equal(R.validate(thin,docs).daily_pitch,null);
 const vague=output();vague.daily_pitch.headline='홈플러스 향후 전망';assert.equal(R.validate(vague,docs).daily_pitch,null);
});

test('daily pitch renderer exposes why today, what is new, and one decisive gap',()=>{
 const result={status:'ready',analysis:{daily_pitch:R.validate(output(),docs).daily_pitch,why_now:{text:'오늘 매각 단위가 구체화됐다.'}}};
 const html=D.render(result);assert.match(html,/일보 후보/);assert.match(html,/67개점/);assert.match(html,/오늘 쓰는 이유/);assert.match(html,/기존 보도보다 추가할 것/);assert.match(html,/오늘 채울 한 칸/);
});

test('daily gate preserves the research shortlist and only filters the first-screen daily shortlist',()=>{
 const B={requestFor:x=>({key:x.clue_id,url:'/x'}),attach:(x,r)=>({...x,research:r}),renderBriefHtml:()=>'',shortlist:rows=>rows};
 const root={MarketInStoryBrief:B};assert.equal(D.install(root),true);const rows=[{clue_id:'a',sort_date:'2026-09-17'},{clue_id:'b',sort_date:'2026-09-16'}];assert.deepEqual(B.shortlist(rows),rows);assert.deepEqual(B.dailyShortlist(rows),[]);
 const ready=B.attach({clue_id:'a',sort_date:'2026-09-17'},{status:'ready',analysis:{daily_pitch:{headline:'일보 후보'}}});assert.deepEqual(B.dailyShortlist([rows[1],ready]).map(x=>x.clue_id),['a']);
});

test('AI discovery explicitly allows zero daily candidates and loads gate before the desk',()=>{
 const html=fs.readFileSync('leads.html','utf8'),daily=html.indexOf('/daily-report-pitch.js'),desk=html.indexOf('/discovery-desk.js');assert.ok(daily>0&&desk>daily);assert.match(html,/오늘 일보 후보/);assert.match(html,/후보가 없으면 0건/);assert.match(html,/daily-report-pitch.css/);
});

test('research cache version changes independently from response compatibility version',()=>{
 assert.equal(R.VERSION,'marketin-research-4');assert.equal(R.CACHE_VERSION,'daily-report-gate-1');assert.match(R.PROMPT,/오늘 아침 데스크 일보/);assert.ok(R.schema.properties.daily_pitch);
});
