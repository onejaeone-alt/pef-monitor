'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../lib/dart-review');
const run=rows=>R.analyzeMarkup('<TABLE><TR><TD>항목</TD><TD>정정전</TD><TD>정정후</TD></TR>'+rows.map(r=>'<TR>'+r.map(v=>'<TD>'+v+'</TD>').join('')+'</TR>').join('')+'</TABLE>',{rcept_no:'20260907000332'});
test('note reference labels alone are not counted as extracted changed values',()=>{const r=run([['기타','주1-1)','주1-2)'],['기타2','(주1) 정정 전','(주1) 정정 후']]);assert.equal(r.changes.length,0);assert.equal(r.state,'comparison_incomplete');assert.match(r.warnings.join(' '),/주석 위치/);});
test('same-purpose amount change does not presuppose a changed use of proceeds',()=>{const r=run([['자금조달의 목적','운영자금(원)6999996780','운영자금(원)6999997062']]);assert.match(r.questions[0].question,/같은 사용처의 금액만/);assert.doesNotMatch(r.questions[0].question,/사용처를 바꾼 이유/);});
test('spacing and native labels route to appropriate questions',()=>{const r=run([['1. 신주의 종류와 수','1851851','2219403'],['7. 기준주가','4199','3503'],['제3자배정 대상자','가온','나래']]);assert.deepEqual(r.changes.map(c=>c.topic),['ownership','money','party']);});
