'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../lib/dart-review'),UI=require('../dart-desk');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const fixture=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/dart-forms',n+'.json'),'utf8')).map(t=>'<TABLE>'+t.map(r=>'<TR>'+r.map(c=>`<TD ROWSPAN="${c.rowspan}" COLSPAN="${c.span}">${esc(c.value)}</TD>`).join('')+'</TR>').join('')+'</TABLE>').join('');
const read=n=>R.analyzeMarkup(fixture(n),{rcept_no:n,entry:n+'.xml'});
const field=(r,label)=>r.current_fields.find(f=>f.label===label);
const table=rows=>'<TABLE>'+rows.map(r=>'<TR>'+r.map(v=>'<TD>'+v+'</TD>').join('')+'</TR>').join('')+'</TABLE>';
const run=s=>R.analyzeMarkup(s,{rcept_no:'20260923900518'});
test('KRX contract reads consideration, shares, price, parties and future ownership separately',()=>{
 const r=read('20260923900518');assert.equal(field(r,'양수도 대금').value,'21,000,000,000');assert.equal(field(r,'양수도 대금').unit,'원');assert.equal(field(r,'예정 소유비율').value,'27.83');assert.equal(field(r,'양수도 주식수').unit,'주');assert.equal(field(r,'양수인').value,'(주)제이스커머스 외 1인');assert.equal(field(r,'지분율'),undefined);assert.match(UI.rowDelta({rcept_no:r.rcept_no},r).text,/210억원/);
});
test('cancelled contract keeps cancellation visible beside historical consideration',()=>{
 const r=read('20260923900724');assert.equal(field(r,'양수도 대금').value,'156,971,904,000');assert.equal(field(r,'계약 해소일').value,'2026-09-23');assert.match(UI.rowDelta({rcept_no:r.rcept_no},r).text,/해제.*1,569/);assert.equal(r.changes.length,0);
});
test('company split preserves ratio and company scope without swallowing other financial values',()=>{
 const r=read('20260923000636');assert.equal(field(r,'분할기일').value,'2026년 11월 01일');assert.match(field(r,'분할 신설회사').value,/안다르홀딩스/);assert.equal(UI.summaryValue(field(r,'분할비율')),'존속 0.3613426 / 신설 0.6386574');assert.equal(field(r,'취득금액'),undefined);
});
test('rehabilitation and litigation return event facts without inventing money',()=>{
 const r=read('20260923000634'),s=read('20260923900726');assert.equal(field(r,'관할법원').value,'서울회생법원');assert.equal(field(s,'사건번호').value,'2026비합10051');assert.equal(field(s,'사건명').value,'검사인 선임');assert.equal(r.current_fields.filter(f=>f.topic==='money').length,0);assert.doesNotMatch(UI.rowDelta({rcept_no:r.rcept_no},r).text,/거래 수치/);
});
test('explicit funding clauses do not turn planned subscription into share-sale proceeds',()=>{
 const r=read('20260922900618');assert.equal(field(r,'납입 예정총액').value,'12,000,000,000');assert.equal(field(r,'납입 예정총액').source.table,1);assert.equal(field(r,'양수도 대금'),undefined);assert.equal(field(r,'납입 예정일').value,'2026년 10월 29일');
});
test('large holdings distinguishes previous report, current zero and separate contract section',()=>{
 const r=read('20260923000618');assert.equal(field(r,'직전 보고 보유비율').value,'24.37');assert.equal(field(r,'이번 보고 보유비율').value,'0.00');assert.equal(field(r,'이번 보고 보유주식수').value,'0');assert.equal(field(r,'이번 보고 보유비율').source.row,6);assert.match(field(r,'보고사유').value,/계약 해제/);assert.equal(r.changes.length,0);
});
test('maximum shareholder phases never substitute the acquirer company shareholder',()=>{
 const r=read('20260922900647');assert.equal(field(r,'변경 후 최대주주').value,'케이비엔홀딩스 주식회사');assert.equal(field(r,'변경 후 지분율').value,'21.90');assert.equal(field(r,'변경 전 지분율').value,'64.22');assert.equal(field(r,'최대주주'),undefined);assert.equal(field(r,'인수자금 중 차입금').value,'6,850,000,000');
});
test('tender horizontal headings retain planned, tendered and purchased quantities',()=>{
 const r=read('20260922000404');assert.equal(field(r,'공개매수 예정수량').value,'16,076,041주');assert.equal(field(r,'공개매수 매수수량').value,'6,984,290주');assert.equal(field(r,'공개매수 가격').value,'주당 900원');assert.equal(field(r,'공개매수 매수수량').source.table,2);assert.equal(field(r,'공개매수 매수수량').source.row,2);
});
test('headings, absent units, conflicting totals and correction subtrees remain guarded',()=>{
 assert.equal(run(table([['지분율(%)','주식수(주)'],['취득금액(원)','자기자본']])).current_fields.length,0);
 assert.equal(field(run(table([['양수도 대금','100']])),'양수도 대금').unit,null);
 assert.equal(field(run(table([['양수도 대금(원)','100'],['양수도 대금(원)','200']])),'양수도 대금'),undefined);
 assert.equal(run(table([['항목','정정전','정정후'],['거래',table([['양수도 대금(원)','100']]),table([['양수도 대금(원)','200']])]])).current_fields.length,0);
});
test('new version invalidates old empty reviews and displays available facts on correction filings',()=>{
 assert.equal(UI.isCurrentReview({ok:true,version:'dart-review-1.7'}),false);
 const r=read('20260923900518');assert.match(UI.rowDelta({rcept_no:r.rcept_no,report_nm:'[기재정정]계약체결'},r).text,/현재 기재값.*210억원/);
 for(const f of r.current_fields)assert.equal(f.source.source_id,'dart:'+r.rcept_no);
});
