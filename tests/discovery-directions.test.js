'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../lib/discovery-research'),B=require('../marketin-story-brief'),C=require('../discovery-core'),P=require('../reporting-direction'),T=require('../story-timeline');
const docs=[{source_id:'old',url:'https://marketin.edaily.co.kr/News/Read?newsId=1',publisher:'마켓인',read_ok:true,text:'시험LP는 최소 운용자산 요건을 1000억원으로 공고했다.'},{source_id:'new',url:'https://example.com/notice',publisher:'시험LP',read_ok:true,text:'시험LP는 정정 공고에서 최소 운용자산 요건을 2000억원으로 변경했다.'}];
const angle={headline:'지원 자격 변화',reason:'최소 운용자산 요건이 변경돼 지원 자격을 비교할 필요가 있다.',new_information:'지원 가능한 GP가 줄었을 가능성은 가설이다.',question:'요건 변경으로 지원할 수 없게 된 GP는 어디인가?',missing:'예외 적용 대상과 기준일별 운용자산',first_action:'시험LP 출자 담당자에게 예외 적용 기준 확인',falsification:'예외 규정으로 기존 GP가 모두 지원할 수 있다면 가설 재검토',direction_key:'지원 가능 GP 변화',basis_ids:['f1','f2'],coverage_ids:['old']};
function output(){return {scope:'supported',summary:{text:'시험LP가 최소 운용자산 요건을 변경했다.',fact_ids:['f1','f2']},why_now:{text:'정정 공고가 나와 지원 자격 대조가 필요하다.',fact_ids:['f2']},previous_state:{text:'기존 요건은 1000억원이다.',fact_ids:['f1']},changes:[{text:'최소 운용자산 요건이 1000억원에서 2000억원으로 변경됐다.',before_ids:['f1'],after_ids:['f2']}],facts:docs.map((d,i)=>({id:'f'+(i+1),text:d.text,source_id:d.source_id,quote:d.text,date:''})),already_covered:[{text:'최초 공고 요건',source_id:'old'}],angles:[{...angle}],uncertainties:[]};}
function result(){return {version:B.VERSION,status:'ready',sources:docs.map(({text,...s})=>s),analysis:R.validate(output(),docs)};}
function clue(){return B.attach({clue_id:'issue-test',headline:'시험LP',sources:[]},result());}
test('before and after require distinct valid evidence, never substitute an unsupported prior state',()=>{
 const o=output();assert.equal(R.validate(o,docs).changes.length,1);
 o.previous_state.fact_ids=['missing'];o.changes[0].before_ids=['f2'];const a=R.validate(o,docs);assert.equal(a.previous_state,null);assert.equal(a.changes.length,0);
 o.changes=[{text:'요건 9000억원',before_ids:['f1'],after_ids:['f2']}];assert.equal(R.validate(o,docs).changes.length,0);
});
test('directions need a concrete question, gap, action and falsification; duplicate questions and invented numbers are excluded',()=>{
 for(const field of ['question','missing','first_action','falsification','direction_key']){const o=output();delete o.angles[0][field];assert.equal(R.validate(o,docs).angles.length,0);}
 const o=output();o.angles.push({...angle,headline:'다른 제목'});assert.equal(R.validate(o,docs).angles.length,1);
 o.angles=[{...angle,question:'9000억원 요건에 지원 가능한가?'}];assert.equal(R.validate(o,docs).angles.length,0);
});
test('selected direction reaches project with sources and leaves existing notes, judgment and source records intact',()=>{
 const parent=clue(),selected=B.selectAngle(parent,0),first=C.mergeProject([],selected,'first');
 first.rows[0].notes='직접 확인한 메모';first.rows[0].judgment={decision:'추가취재'};first.rows[0].judgment_history=[{decision:'보류'}];first.rows[0].title='기자가 바꾼 제목';
 const next=C.mergeProject(first.rows,B.selectAngle(parent,0),'next');assert.equal(next.rows.length,1);assert.equal(next.rows[0].notes,'직접 확인한 메모');assert.equal(next.rows[0].title,'기자가 바꾼 제목');assert.equal(next.rows[0].judgment.decision,'추가취재');assert.equal(next.rows[0].judgment_history.length,1);assert.equal(next.rows[0].clue.selected_evidence.length,2);assert.equal(parent.selected_angle,undefined);
 parent.article_brief.angles.push({...angle,question:'GP가 다른 LP 출자사업으로 옮기나?',direction_key:'GP 대응'});const other=B.selectAngle(parent,1);assert.notEqual(other.clue_id,selected.clue_id);assert.equal(C.mergeProject(next.rows,other).rows.length,2);
});
test('direction controls remain available through timeline wrapper and escape content',()=>{
 const root={IBDiscovery:{build:()=>[],calendarClues:()=>[]},MarketInStoryBrief:{...B}};T.install(root);
 const r={...result(),story_timeline:[{phase:'다음',trigger:'선정',pitch:'결과 확인'}]};
 const html=root.MarketInStoryBrief.renderBriefHtml(r,'issue-"<img>');assert.match(html,/data-discovery-angle="0"/);assert.match(html,/가장 큰 빈칸/);assert.match(html,/첫 취재/);assert.doesNotMatch(html,/<img>/);assert.match(html,/marketin-story-timeline/);
});
test('daily-report export is gated by judgment and retains unconfirmed status, notes and original URLs',()=>{
 const p=C.mergeProject([],B.selectAngle(clue(),0)).rows[0];assert.throws(()=>P.dailyReport(p),/기사화/);assert.doesNotMatch(P.render(p),/data-daily-report/);
 p.judgment={decision:'기사화',claim:'검증한 핵심 주장'};p.notes='당사자 확인 결과';const text=P.dailyReport(p);assert.equal(text.split('\n').filter(l=>l.startsWith('- ')).length,9);assert.match(text,/가설/);assert.match(text,/당사자 확인 결과/);assert.match(text,/https:\/\/marketin/);assert.match(P.render(p),/data-daily-report/);
 p.clue.selected_angle.question='<img src=x onerror=alert(1)>';assert.doesNotMatch(P.render(p),/<img/);
});
