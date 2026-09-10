'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const U=require('../dart-desk'),{safeRecord}=require('../api/dart-feed');
const n='20260910000001';
const item=(over={})=>({rcept_no:n,rcept_dt:'20260910',corp_name:'가온',corp_code:'001',report_nm:'전환사채권발행결정',flr_nm:'가온',group_id:'finance',group_label:'자금조달',tier:'core',tier_label:'핵심 변동',event_id:'mezzanine',event_label:'메자닌 발행',monitor_reason:'CB 인수자와 전환조건·자금 사용처 확인',next_check:'발행액 · 인수자 · 전환가 · 만기 · 옵션',...over});
const review=()=>({ok:true,version:U.REVIEW_VERSION,rcept_no:n,changes:[{label:'납입일',before:'2026-09-10',after:'2026-10-01'}],current_fields:[{label:'발행금액',value:'300억원'}]});

test('먼저 확인은 기사점수가 아니라 기존 핵심·조건변경 유형만 고른다',()=>{
 const rows=[item(),item({rcept_no:'20260910000002',tier:'change',report_nm:'[기재정정]유상증자결정'}),item({rcept_no:'20260910000003',tier:'followup',group_id:'equity'}),item({rcept_no:'20260910000004',tier:'reference',group_id:'reference'})];
 assert.equal(U.filteredItems(rows,{feed:'priority'}).length,2);
 assert.equal(U.filteredItems(rows,{feed:'all'}).length,4);
 assert.equal(U.filteredItems(rows,{feed:'corrections'}).length,1);
});
test('원문을 읽기 전에는 달라진 값을 만들지 않는다',()=>{
 assert.deepEqual(U.rowDelta(item()),{label:'이번 공시',state:'pending',text:'원문 비교 전 · 내용 확인 필요'});
 assert.equal(U.rowDelta(item({report_nm:'[기재정정]전환사채권발행결정',is_correction:true})).text,'정정공시 · 변경값 확인 전');
});
test('같은 접수번호의 현재 추출값만 목록 변화로 표시한다',()=>{
 const d=U.rowDelta(item(),review());assert.equal(d.state,'confirmed');assert.match(d.text,/2026-09-10 → 2026-10-01/);
 assert.equal(U.rowDelta(item(),{...review(),version:'old'}).state,'pending');
});
test('돈·거래·지배력·위험·일정·희석은 설명 대신 짧은 축 태그로 쓴다',()=>{
 assert.deepEqual(U.axisTags(item(),review()),['돈','일정','희석']);
 const control=item({group_id:'deal',event_id:'control_change',report_nm:'최대주주 변경을 수반하는 주식양수도계약'});
 assert.deepEqual(U.axisTags(control,null).slice(0,2),['거래','지배력']);
});
test('이어볼 항목과 일보 확인 문장은 기존 DART 모니터 표현을 우선한다',()=>{
 const x=item();assert.equal(U.nextCheckText(x),x.next_check);assert.equal(U.reportingCheck(x),x.monitor_reason);
});
test('반복 공시는 건수와 정정 횟수만 세며 동일 거래라고 단정하지 않는다',()=>{
 const rows=[item({family_id:'f1'}),item({rcept_no:'20260910000002',family_id:'f1',is_correction:true,report_nm:'[기재정정]전환사채권발행결정'})];
 assert.deepEqual(U.familyStats(rows).get('f1'),{count:2,corrections:1});
});
test('API는 기존 모니터의 검토 단서만 공개하고 내부 analysis 객체는 내보내지 않는다',()=>{
 const raw=item({family_id:'f1',base_report_nm:'전환사채권발행결정',analysis:{event_id:'mezzanine',event_label:'메자닌 발행',secret:'x'},private_note:'NO'}),out=safeRecord(raw);
 for(const k of ['family_id','tier','tier_label','monitor_reason','next_check','event_id','event_label'])assert.ok(Object.hasOwn(out,k));
 assert.equal(out.analysis,undefined);assert.equal(out.private_note,undefined);assert.equal(JSON.stringify(out).includes('NO'),false);
});
test('화면은 회사·공시·달라진 것·이어볼 것 네 칸과 세 모아보기만 둔다',()=>{
 const h=fs.readFileSync('dart.html','utf8');for(const t of ['회사·일자','공시','달라진 것','이어볼 것','먼저 확인','정정 변화','전체 공시'])assert.match(h,new RegExp(t));
 assert.equal((h.match(/data-feed=/g)||[]).length,3);assert.doesNotMatch(h,/기사감|기사점수|article score|가설|반증 조건/);
});
test('내용 확인 한 건만 원문을 읽고 첫 화면에서 일괄 분석하지 않는다',()=>{
 const s=fs.readFileSync('dart-desk.js','utf8');assert.equal((s.match(/action=review/g)||[]).length,1);assert.match(s,/data-toggle/);assert.match(s,/await readReceipt\(n\)/);assert.doesNotMatch(s,/Promise\.all\([^)]*readReceipt|forEach\([^)]*readReceipt/);
});
