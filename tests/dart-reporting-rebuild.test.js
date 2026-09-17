'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../lib/story-engine'),M=require('../lib/dart-monitor'),R=require('../lib/dart-review'),U=require('../dart-desk'),C=require('../lib/dart-reporting-context'),{safeRecord}=require('../api/dart-feed');
const n='20260915000001';
const raw=(title,more={})=>({corp_name:'신규회사',flr_nm:'신규회사',corp_cls:'Y',report_nm:title,rcept_no:n,...more});
const row=c=>'<TR>'+c.map(x=>'<TD>'+x+'</TD>').join('')+'</TR>';
const table=rows=>'<TABLE>'+rows.map(row).join('')+'</TABLE>';
const analyze=xml=>R.analyzeMarkup(xml,{rcept_no:n,entry:n+'.xml'});
test('actual HLB repricing title cannot become an acquisition or enter discovery',()=>{
 const x=E.toMonitoredItem(raw('전환가액ㆍ신주인수권행사가액ㆍ교환가액의조정(안내공시)',{corp_name:'HLB글로벌'}));
 assert.notEqual(x.analysis.event_id,'equity_acquisition');assert.equal(M.shouldKeep(x),false);
});
test('dissolution and treasury stock cannot masquerade as new M&A',()=>{
 for(const t of ['해산사유발생(자회사의 주요경영사항)','자기주식취득결정','전환청구권행사'])assert.equal(M.shouldKeep(E.toMonitoredItem(raw(t))),false,t);
});
test('unlisted and KOSDAQ genuine transaction decisions remain discoverable',()=>{
 for(const cls of ['E','K','Y'])assert.equal(M.shouldKeep(E.toMonitoredItem(raw('타법인주식및출자증권처분결정',{corp_cls:cls}))),true);
});
test('portfolio asset sale and periodic financial statements remain collected',()=>{
 for(const t of ['주요사항보고서(유형자산양도결정)','감사보고서','분기보고서'])assert.equal(M.shouldKeep(E.toMonitoredItem(raw(t,{corp_name:'오스템임플란트',flr_nm:'오스템임플란트',corp_cls:'E'}))),true,t);
});
test('price adjustments remain excluded even for a watched company',()=>assert.equal(M.shouldKeep(E.toMonitoredItem(raw('전환가액의조정',{corp_name:'오스템임플란트'}))),false));
test('public relationship context preserves source and does not imply transaction participation',()=>{
 const x=safeRecord(M.enrich(E.toMonitoredItem(raw('공개매수에관한의견표명서',{corp_name:'가비아'}))));
 assert.equal(x.reporting_context.relation_scope,'background_only');assert.match(x.reporting_context.relationships[0].url,/macquarie/);
 assert.match(U.investorHtml(x),/이번 거래 참여 여부는 별도 확인/);assert.equal(x.reporting_context.parties,undefined);
});
test('an unrelated name containing a target name does not inherit its ownership',()=>assert.equal(C.contextFor({corp_name:'오스템임플란트와무관한회사'}).relationships.length,0));
test('money and party fields are read with original labels, units and exact provenance',()=>{
 const r=analyze(table([['2. 처분내역','처분금액(원)','1,000,000,000'],['거래상대방','MBK파트너스'],['처분목적','차입금 상환']]));
 assert.equal(r.current_fields[0].value,'1,000,000,000');assert.equal(r.current_fields[0].unit,'원');assert.equal(r.current_fields[0].source.row,1);
 assert.equal(r.parties[0].name,'MBK파트너스');assert.equal(r.parties[0].source.source_id,'dart:'+n);
 const item={...raw('타법인주식및출자증권처분결정'),scope_kind:'market'};
 assert.equal(U.priorityReason(item,r),'원문에 펀드·투자자 확인');assert.match(U.rowDelta(item,r).text,/10억원/);
});
test('number without explicit unit stays without invented currency',()=>assert.equal(analyze(table([['처분금액','300']])).current_fields[0].unit,null));
test('target issuer name beside a merged section heading remains a target, not buyer',()=>{
 const r=analyze('<TABLE><TR><TD ROWSPAN="3">1. 발행회사</TD><TD>회사명</TD><TD>대상기업</TD></TR></TABLE>');
 assert.equal(r.current_fields[0].label,'대상회사');assert.equal(r.current_fields[0].value,'대상기업');
});
test('allottee headers are not themselves read as investor values',()=>{
 const r=analyze(table([['제3자배정 대상자','선정경위','배정주식수'],['새봄벤처투자조합','협의','1000']]));
 assert.equal(r.current_fields.filter(f=>f.topic==='party').length,1);assert.equal(r.parties[0].name,'새봄벤처투자조합');
});
test('conflicting amounts are omitted instead of selecting a convenient number',()=>{
 const r=analyze(table([['처분금액(원)','100'],['처분금액(원)','200']]));assert.equal(r.current_fields.length,0);assert.ok(r.warnings.length);
});
test('old correction cells cannot be presented as current investors or amounts',()=>{
 const r=analyze(table([['항목','정정전','정정후'],['금액',table([['처분금액(원)','100']]),table([['처분금액(원)','200']])]]));assert.equal(r.current_fields.length,0);
});
test('priority uses reporting relationships rather than core labels; wrong receipts cannot promote',()=>{
 const item={...raw('타법인주식및출자증권처분결정'),scope_kind:'market',tier:'core'};
 assert.equal(U.priorityReason(item),null);assert.equal(U.filteredItems([item],{feed:'market'}).length,1);
 const r=analyze(table([['거래상대방','MBK파트너스']]));
 assert.equal(U.filteredItems([item],{feed:'priority',reviews:{[n]:r}}).length,1);
 assert.equal(U.priorityReason(item,{...r,rcept_no:'20260915000999'}),null);
 assert.equal(U.rowDelta(item,{...r,rcept_no:'20260915000999'}).state,'pending');
});
test('investor search uses background relationships and source fields',()=>{
 const item={...raw('주요사항보고서'),reporting_context:{relationships:[{investor:'UCK파트너스'}]}};
 assert.equal(U.filteredItems([item],{query:'UCK'}).length,1);
});

test('Jeju private real-estate fund redemption connects from source role without inventing its manager',()=>{
 const r=analyze(table([['1. 발행회사','회사명','퍼시픽제3호일반사모부동산투자(유)'],['처분금액(원)','52,793,715,894'],['처분 목적','출자금 회수']]));
 assert.equal(r.parties[0].name,'퍼시픽제3호일반사모부동산투자(유)');assert.equal(r.parties[0].role,'대상회사');
 const item={...raw('타법인주식및출자증권처분결정'),scope_kind:'market'};
 assert.match(U.rowDelta(item,r).text,/약 527.9억원/);assert.match(U.brief(item,r),/52,793,715,894 원/);
 assert.match(U.priorityReason(item,r),/펀드/);
});
