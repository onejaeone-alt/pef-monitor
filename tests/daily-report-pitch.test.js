'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../lib/discovery-research'),D=require('../daily-report-pitch');
const docs=[
 {source_id:'m1',url:'https://marketin.edaily.co.kr/News/Read?newsId=1',title:'홈플러스 재매각',text:'홈플러스가 티저레터를 배포하며 경영권 매각 절차를 재가동한다.',read_ok:true,read_scope:'index_excerpt',published_at:'2026-09-16T06:00:00Z'},
 {source_id:'n1',url:'https://www.hankyung.com/article/1',title:'홈플러스 67개점 통매각',text:'홈플러스, 대형마트 67개점 M&A 착수…폐점 점포 19곳도 매각',read_ok:true,read_scope:'headline',published_at:'2026-09-17T05:00:00Z'},
 {source_id:'n2',url:'https://www.yna.co.kr/view/1',title:'회생계획 인가',text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',read_ok:true,read_scope:'body',published_at:'2026-09-17T04:00:00Z'}
];
function output(){return {scope:'supported',summary:{text:'홈플러스가 회생계획 인가 뒤 67개점 M&A와 19개 자가점포 매각을 추진한다.',fact_ids:['f1','f2','f3']},why_now:{text:'회생계획 인가 뒤 67개점 M&A와 19개 자가점포 매각이 구체화됐다.',fact_ids:['f2','f3']},facts:[
 {id:'f1',text:'마켓인은 홈플러스가 티저레터를 배포하며 경영권 매각 절차를 재가동한다고 전했다.',date:'',source_id:'m1',quote:docs[0].text},
 {id:'f2',text:'홈플러스는 대형마트 67개점 M&A와 폐점 점포 19곳 매각에 착수했다.',date:'',source_id:'n1',quote:docs[1].text},
 {id:'f3',text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',date:'',source_id:'n2',quote:docs[2].text}],already_covered:[{text:'티저레터 배포와 경영권 매각 재가동',source_id:'m1'}],angles:[{headline:'홈플러스 재매각, 회생안 인가 뒤 매각 구조 달라졌다',reason:'티저레터 배포를 넘어 67개점과 19개 자가점포의 처분 구조가 구체화됐다.',new_information:'67개점 영업양수도와 19개 자가점포 처분을 분리해 회생계획상 현금 유입 구조를 설명한다.',basis_ids:['f1','f2','f3'],coverage_ids:['m1']}],daily_pitch:{headline:'홈플러스 67개점 통매각 재시동…19개 자가점포 처분과 회생안 이후 달라진 매각 구조',thesis:{text:'회생계획 인가 뒤 홈플러스 매각은 경영권 재매각과 자가점포 처분을 동시에 추진하는 구조로 구체화됐다.',fact_ids:['f2','f3']},bullets:[{text:'마켓인은 티저레터 배포와 경영권 매각 재가동을 전했다.',fact_ids:['f1']},{text:'새 공개 보도에는 대형마트 67개점 M&A와 폐점 점포 19곳 매각이 제시됐다.',fact_ids:['f2']},{text:'서울회생법원은 홈플러스 회생계획안을 인가했다.',fact_ids:['f3']}],coverage_ids:['m1'],new_information:'기존 재매각 개시 보도에서 더 나아가 67개 영업점과 19개 자가점포 처분을 나눠 회생계획상 현금 유입 구조를 설명한다.',decisive_gap:'삼일회계법인 투자안내서에서 67개점 영업양수도 범위와 19개 자가점포 처분대금의 채권 변제 반영 방식을 확인한다.'},uncertainties:[]};}

test('a daily pitch needs grounded facts from two sources plus a MarketIN comparison',()=>{
 const v=R.validate(output(),docs);assert.ok(v.daily_pitch);assert.match(v.daily_pitch.headline,/67개점/);assert.equal(v.daily_pitch.bullets.length,3);
 const noCoverage=output();noCoverage.daily_pitch.coverage_ids=[];assert.equal(R.validate(noCoverage,docs).daily_pitch,null);
 const oneSource=output();oneSource.daily_pitch.bullets=oneSource.daily_pitch.bullets.slice(0,1);assert.equal(R.validate(oneSource,docs).daily_pitch,null);
});

test('public index excerpts and specific headlines can be bounded evidence without pretending full body access',()=>{
 const marketin=R.fallbackEvidence({url:'https://marketin.edaily.co.kr/News/Read?newsId=1',title:'홈플러스 재매각',snippet:'홈플러스가 국내외 주요 기업에 티저레터를 배포하며 경영권 매각 절차를 재가동한다. 회생계획안 인가 이후 첫 재매각 시도다.',publisher:'마켓인',search_purpose:'marketin_coverage'},{read_ok:false,read_error:'BODY_UNREADABLE'});
 assert.equal(marketin.read_ok,true);assert.equal(marketin.read_scope,'index_excerpt');assert.match(marketin.text,/티저레터/);
 const headline=R.fallbackEvidence({url:'https://news.google.com/rss/articles/abc',title:'홈플러스, 대형마트 67개점 M&A 착수…폐점 점포 19곳도 매각',publisher:'매체'},{read_ok:false,read_error:'REDIRECT_NOT_PUBLIC'});
 assert.equal(headline.read_ok,true);assert.equal(headline.read_scope,'headline');assert.equal(headline.text,headline.title);
 const fluff=R.fallbackEvidence({url:'https://news.google.com/rss/articles/abc',title:'홈플러스 소식',publisher:'매체'},{read_ok:false});assert.equal(fluff.read_ok,false);
});

test('daily report renderer shows the actual pitch and one decisive reporting gap',()=>{
 const result={status:'ready',analysis:{daily_pitch:R.validate(output(),docs).daily_pitch,why_now:{text:'오늘 매각 구조가 구체화됐다.'}}};
 const html=D.render(result);assert.match(html,/일보 후보/);assert.match(html,/67개점/);assert.match(html,/오늘 쓰는 이유/);assert.match(html,/오늘 채울 한 칸/);
});

test('default shortlist keeps only daily-report candidates; exploration remains in the underlying data',()=>{
 const B={requestFor:x=>({key:x.clue_id,url:'/x'}),attach:(x,r)=>({...x,research:r}),renderBriefHtml:()=>'',shortlist:rows=>rows};
 const root={MarketInStoryBrief:B};assert.equal(D.install(root),true);
 const daily={clue_id:'d',sort_date:'2026-09-17',research:{status:'ready',analysis:{daily_pitch:{headline:'일보'}}}},explore={clue_id:'e',sort_date:'2026-09-17',research:{status:'ready',analysis:{daily_pitch:null}}};
 assert.deepEqual(B.shortlist([explore,daily]).map(x=>x.clue_id),['d']);
 assert.equal([explore,daily].length,2);
});

test('AI discovery loads daily-report pitch extension before card rendering',()=>{
 const html=fs.readFileSync('leads.html','utf8'),daily=html.indexOf('/daily-report-pitch.js'),desk=html.indexOf('/discovery-desk.js');assert.ok(daily>0&&desk>daily);assert.match(html,/오늘 일보 후보/);assert.match(html,/후보가 없으면 0건/);assert.match(html,/daily-report-pitch.css/);
});
