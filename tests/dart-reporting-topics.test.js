'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Keep old classifier regressions: the module is preserved, but no longer loaded by DART.
const T=require('../dart-reporting-topics'),U=require('../dart-desk'),{inject}=require('../scripts/inject-dart-desk');
const n='20260908000001',item=report_nm=>({rcept_no:n,report_nm,corp_name:'가온',flr_nm:'공시 제출자'});
const e=(label,before,after,extra={})=>({evidence_id:'e'+label,label,before,after,source:{source_id:'dart:'+n,location:'원문 표 5 행 3'},...extra});
const review=changes=>({ok:true,version:U.REVIEW_VERSION,rcept_no:n,changes,current_fields:[],questions:[],warnings:[]});
const ids=(title,r)=>T.classify(item(title),r).map(x=>x.id);
const sourcePath=file=>path.join(__dirname,'..',file);
test('raw view remains and the retired analysis view is absent',()=>{assert.equal(U.DEFAULT_VIEW,'raw');const h=fs.readFileSync(sourcePath('dart.html'),'utf8');assert.match(h,/<section id="rawView"/);assert.doesNotMatch(h,/id="deskView"|data-view=|reportingTopics/);});
test('opening the page never launches correction reads',()=>{const s=fs.readFileSync(sourcePath('dart-desk.js'),'utf8');assert.doesNotMatch(s,/load\(\)\.then|batch\(/);assert.match(s,/\n  load\(\);/);});
for(const [title,expected] of [
 ['주요사항보고서(유상증자결정)',['funding']],['전환사채권발행결정',['funding']],['신주인수권부사채권발행결정',['funding']],['만기전사채취득',['debt']],
 ['주식등의대량보유상황보고서(일반)',['control']],['임원ㆍ주요주주특정증권등소유상황보고서',['control']],['최대주주변경',['control']],
 ['타법인주식및출자증권취득결정',['deal']],['주요사항보고서(타법인주식및출자증권양수결정)',['deal']],['회사합병결정',['deal']],
 ['합병등종료보고서',['deal','execution']],['증권발행실적보고서',['funding','execution']],['금전대여결정',['debt']],['타인에대한채무보증결정',['debt']],
 ['자기주식취득신탁계약해지결정',['capital']],['무상감자결정',['capital']],['현금배당결정',['capital']],['조합결성',['fund']],
 ['[기재정정]사업보고서',['reference']],['[기재정정]주요사항보고서(유상증자결정)',['funding']],
])test('conservative title lens: '+title,()=>assert.deepEqual(ids(title),expected));
test('company name and old article score never influence classification',()=>{assert.deepEqual(T.classify({...item('수시공시'),'corp_name':'부도경영권펀드',story_score:99}).map(x=>x.id),['reference']);});
test('unknown words or API group IDs do not invent an article lead',()=>{assert.deepEqual(T.classify({...item('일반 안내'),group_id:'risk'}).map(x=>x.id),['reference']);});
test('fund-classified record stays a topic, not a completed fund',()=>{const ts=T.classify({...item('변경보고'),group_id:'fund'});assert.deepEqual(ts.map(t=>t.id),['fund']);assert.ok(ts.every(t=>!('fact_status' in t)));});
test('same-financing share count is dilution, not automatic control takeover',()=>{const r=review([e('1. 신주의 종류와 수','100','120')]);assert.deepEqual(ids('유상증자결정',r),['funding']);});
test('date change adds execution lens only after same-receipt evidence',()=>{const x=item('[기재정정]유상증자결정'),r=review([e('9. 납입일','2026-10-08','2026-09-22',{day_delta:-16})]);assert.deepEqual(T.classify(x).map(t=>t.id),['funding']);assert.deepEqual(T.classify(x,r).map(t=>t.id),['funding','execution']);});
test('forward schedule is not described as delay',()=>{const x=item('[기재정정]유상증자결정'),r=review([e('납입일','2026-10-08','2026-09-22',{day_delta:-16})]),a=T.storyContext(x,r,'execution');assert.match(a.why,/16일 앞으로/);assert.doesNotMatch(a.why,/지연|연기|자금난/);assert.equal(a.resolved,false);});
test('no date direction is invented for an unparsed date',()=>{const a=T.storyContext(item('납입일변경'),review([e('납입일','미정','2026-09-22',{day_delta:null})]),'execution');assert.doesNotMatch(a.why,/\d+일|앞으로|뒤로/);});
test('current schedule is not automatically a schedule change',()=>{const r=review([]);r.current_fields=[{evidence_id:'current',label:'납입일',value:'2026-09-22',source:{source_id:'dart:'+n}}];assert.deepEqual(ids('유상증자결정',r),['funding']);});
test('unrelated receipt evidence and stale review cannot add a category',()=>{const r=review([e('납입일','a','b')]);for(const bad of [{...r,rcept_no:'20260908000099'},{...r,version:'dart-review-1.4'},{...r,ok:false}])assert.deepEqual(ids('유상증자결정',bad),['funding']);r.changes[0].source.source_id='dart:20260908000099';assert.deepEqual(ids('유상증자결정',r),['funding']);});
test('price/share questions use related original IDs and do not invent a money delta',()=>{const r=review([e('신주의 종류와 수','100','120'),e('신주 발행가액','1000','900')]),a=T.storyContext(item('유상증자결정'),r,'funding');assert.match(a.why,/함께 바뀐/);assert.match(a.question,/조달총액/);assert.deepEqual(a.evidence_ids,r.changes.map(x=>x.evidence_id));assert.doesNotMatch(a.why,/감소|증가|손실/);});
test('multi-label counts do not duplicate an article or mutate records',()=>{const x=item('주식양수도계약해제'),r=review([e('납입일','a','b')]),before=JSON.stringify([x,r]);const counts=T.countTopics([x],{[n]:r});assert.equal(counts.control,1);assert.equal(counts.deal,1);assert.equal(counts.execution,1);assert.equal(JSON.stringify([x,r]),before);});
test('reference material is not labeled an article candidate',()=>{const a=T.storyContext(item('사업보고서'));assert.equal(a.topic.id,'reference');assert.match(a.why,/자동으로 기사 후보로 취급하지 않습니다/);assert.equal(a.resolved,false);});
test('title-only classification is disclosed, body extraction stays review pending',()=>{const a=T.classify(item('유상증자결정')),b=T.classify(item('유상증자결정'),review([e('발행가액','100','90')]));assert.match(a[0].basis_label,/공시명/);assert.match(b[0].basis_label,/검수 전/);});
test('evidence escapes untrusted strings without rendering a story template',()=>{const r=review([e('신주 발행가액','<img src=x>','<script>bad()</script>')]);const h=U.evidenceHtml(r);assert.doesNotMatch(h,/<img|<script|dd-story/);assert.ok(h.includes('&lt;img'));});
test('copy contains original evidence, not a reporting lens or private notes',()=>{const x={...item('유상증자결정'),notes:'PRIVATE_NOTE_TEST'},r=review([e('발행가액','100','90')]);const text=U.brief(x,r);assert.match(text,/원문 표 5 행 3/);assert.doesNotMatch(text,/취재 쟁점|대조할 자료|PRIVATE_NOTE_TEST/);});
test('asset integration stops loading the retired topics UI and stays idempotent',()=>{const h='<head><link rel="stylesheet" href="/dart-desk.css?v=1"></head><body><script src="/news-reader-account-client.js"></script><script src="/dart-reporting-topics.js?v=1"></script><script src="/dart-desk.js?v=1" defer></script></body>',a=inject(h);assert.equal(inject(a),a);assert.equal((a.match(/dart-desk\.js/g)||[]).length,1);assert.equal((a.match(/dart-reporting-topics\.js/g)||[]).length,0);assert.match(a,/news-reader-account-client.js/);});
