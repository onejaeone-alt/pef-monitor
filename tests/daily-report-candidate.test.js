'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../lib/discovery-research'),D=require('../daily-report-pitch');
const docs=[
 {source_id:'m1',url:'https://marketin.edaily.co.kr/News/Read?newsId=1',title:'홈플러스 재매각',text:'홈플러스가 티저레터를 배포하며 경영권 매각 절차를 재가동한다.',read_ok:true,read_scope:'index_excerpt',published_at:'2026-09-16T06:00:00Z'},
 {source_id:'n1',url:'https://www.hankyung.com/article/1',title:'홈플러스 67개점 통매각',text:'홈플러스, 대형마트 67개점 M&A 착수…폐점 점포 19곳도 매각',read_ok:true,read_scope:'headline',published_at:'2026-09-17T05:00:00Z'},
 {source_id:'n2',url:'https://www.yna.co.kr/view/1',title:'회생계획 인가',text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',read_ok:true,read_scope:'body',published_at:'2026-09-17T04:00:00Z'}
];
function output(){return {scope:'supported',summary:{text:'홈플러스가 회생계획 인가 뒤 67개점 M&A와 19개 폐점 점포 매각을 추진한다.',fact_ids:['f1','f2','f3']},why_now:{text:'회생계획 인가 뒤 67개점 M&A와 19개 폐점 점포 매각이 구체화됐다.',fact_ids:['f2','f3']},previous_state:{text:'기존에는 티저레터 배포와 경영권 매각 재가동이 공개됐다.',fact_ids:['f1']},changes:[],facts:[
 {id:'f1',text:'마켓인은 홈플러스가 티저레터를 배포하며 경영권 매각 절차를 재가동한다고 전했다.',date:'',source_id:'m1',quote:docs[0].text},
 {id:'f2',text:'홈플러스는 대형마트 67개점 M&A와 폐점 점포 19곳 매각에 착수했다.',date:'',source_id:'n1',quote:docs[1].text},
 {id:'f3',text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',date:'',source_id:'n2',quote:docs[2].text}],already_covered:[{text:'티저레터 배포와 경영권 매각 재가동',source_id:'m1'}],angles:[],daily_pitch:{headline:'홈플러스 67개점 M&A 재시동…19개 폐점 점포 매각과 회생안 이후 달라진 처분 구조',thesis:{text:'회생계획 인가 뒤 홈플러스 매각은 67개점 M&A와 19개 폐점 점포 처분을 함께 추진하는 구조로 구체화됐다.',fact_ids:['f2','f3']},bullets:[{text:'마켓인은 티저레터 배포와 경영권 매각 재가동을 전했다.',fact_ids:['f1']},{text:'새 공개 보도에는 대형마트 67개점 M&A와 폐점 점포 19곳 매각이 제시됐다.',fact_ids:['f2']},{text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',fact_ids:['f3']}],coverage_ids:['m1'],new_information:'기존 재매각 개시 보도에서 더 나아가 67개점 M&A와 19개 폐점 점포 처분을 나눠 회생계획 이후의 자산 처분 구조를 설명한다.',decisive_gap:'매각 주관사 투자안내서에서 67개점 M&A 범위와 19개 폐점 점포 처분 방식이 어떻게 구분되는지 확인한다.'},uncertainties:[]};}

test('daily pitch survives only when multiple sources support concrete newsroom copy',()=>{
 const v=R.validate(output(),docs);assert.ok(v.daily_pitch);assert.match(v.daily_pitch.headline,/67개점/);assert.equal(v.daily_pitch.bullets.length,3);
 const thin=output();thin.daily_pitch.bullets=thin.daily_pitch.bullets.slice(0,1);assert.equal(R.validate(thin,docs).daily_pitch,null);
 const vague=output();vague.daily_pitch.headline='홈플러스 향후 전망';assert.equal(R.validate(vague,docs).daily_pitch,null);
});

test('bounded public evidence never pretends a headline or MarketIN index excerpt is a full body',()=>{
 const snippet='홈플러스가 국내외 주요 기업에 티저레터를 배포하며 경영권 매각 절차를 재가동한다. 회생계획안 인가 이후 첫 재매각 시도인 만큼 실제 원매자 확보 여부가 관건이다.';
 const marketin=R.fallbackEvidence({url:'https://marketin.edaily.co.kr/News/Read?newsId=1',title:'홈플러스 재매각',snippet,publisher:'마켓인',search_purpose:'marketin_coverage'},{read_ok:false,read_error:'BODY_UNREADABLE'});
 assert.equal(marketin.read_ok,true);assert.equal(marketin.read_scope,'index_excerpt');assert.equal(marketin.text,snippet);
 const headline=R.fallbackEvidence({url:'https://news.google.com/rss/articles/abcdefghijklmnop',title:'홈플러스, 대형마트 67개점 M&A 착수…폐점 점포 19곳도 매각',publisher:'매체'},{read_ok:false,read_error:'REDIRECT_NOT_PUBLIC'});
 assert.equal(headline.read_ok,true);assert.equal(headline.read_scope,'headline');assert.equal(headline.text,headline.title);
});

test('daily-report renderer shows headline, concrete bullets and one decisive gap',()=>{
 const result={status:'ready',analysis:{daily_pitch:R.validate(output(),docs).daily_pitch,why_now:{text:'오늘 매각 단위가 구체화됐다.'}}};
 const html=D.render(result);assert.match(html,/일보 후보/);assert.match(html,/67개점/);assert.match(html,/오늘 쓰는 이유/);assert.match(html,/오늘 채울 한 칸/);
});

test('daily gate does not hijack the research shortlist before analysis',()=>{
 const originalRows=[{clue_id:'a',sort_date:'2026-09-17'},{clue_id:'b',sort_date:'2026-09-16'}];
 const B={requestFor:x=>({key:x.clue_id,url:'/x'}),attach:(x,r)=>({...x,research:r}),renderBriefHtml:(r,id)=>`<section class="marketin-story-brief" aria-label="원문 기반 이슈 브리핑">${id||''}</section>`,shortlist:rows=>rows};
 const root={MarketInStoryBrief:B};assert.equal(D.install(root),true);assert.deepEqual(B.shortlist(originalRows),originalRows);assert.deepEqual(B.dailyShortlist(originalRows),[]);
 const ready=B.attach({clue_id:'a',sort_date:'2026-09-17'},{status:'ready',analysis:{daily_pitch:{headline:'일보 후보'}}});assert.deepEqual(B.dailyShortlist([originalRows[1],ready]).map(x=>x.clue_id),['a']);
});

test('AI discovery loads daily gate before the desk and explicitly permits zero candidates',()=>{
 const html=fs.readFileSync('leads.html','utf8'),daily=html.indexOf('/daily-report-pitch.js'),desk=html.indexOf('/discovery-desk.js');assert.ok(daily>0&&desk>daily);assert.match(html,/오늘 일보 후보/);assert.match(html,/후보가 없으면 0건/);assert.match(html,/daily-report-pitch.css/);
});
