'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../marketin-story-brief');
const source={clue_id:'x',detector:'news_followup',headline:'홈플러스 재매각 착수',entities:['홈플러스'],lane:'current',sort_date:'2026-09-17',sources:[{url:'https://www.hankyung.com/article/1',title:'홈플러스 재매각 착수',label:'한국경제',date:'2026-09-17'}]};
test('announcement schedules and generic public relations are not article recommendations',()=>{
 for(const row of [{detector:'reporting_opportunity',headline:'금융위 부위원장 PF 사업장 방문'},{detector:'story_pitch',headline:'홈플러스 회생 다음은'},{detector:'official_followup',headline:'성장금융 출자사업 공고'},{detector:'news_followup',headline:'PEF 후원 축제 개최'}])assert.equal(B.eligible(row),false);
 assert.equal(B.eligible(source),true);
 assert.equal(B.eligible({detector:'news_followup',headline:'국민연금 자산배분 개편, 사모펀드 투자 확대'}),true);
});
test('same company is grouped without inventing a pitch or claiming the bodies have been read',()=>{
 const rows=B.select([source,{...source,clue_id:'y'}]);assert.equal(rows.length,1);assert.equal(rows[0].headline,'홈플러스');assert.equal(rows[0].article_pitch,undefined);assert.equal(rows[0].article_brief,null);assert.match(rows[0].reason,/본문 대조 전/);
 assert.ok(B.requestFor(rows[0]).url.includes('mode=research'));
});
test('model failure stays an honest sources-only result and never recreates template advice',()=>{
 const x=B.attach(source,{version:B.VERSION,status:'sources_only',error:'model_quota_exhausted'});
 assert.equal(x.article_pitch,undefined);const html=B.renderBriefHtml(x.research);assert.match(html,/AI 분석 연결/);assert.doesNotMatch(html,/기사 제안|반드시 확인|전화 순서|확인할 질문/);
 assert.equal(B.attach(source,{version:B.VERSION,status:'out_of_scope'}),null);
});
test('evidence brief shows citations, coverage differences, and uncertainty with safe links',()=>{
 const r={version:B.VERSION,status:'ready',sources:[{source_id:'s1',url:'https://marketin.edaily.co.kr/News/Read?id=1',publisher:'마켓인',title:'매각 기사',read_ok:true},{source_id:'s2',url:'javascript:alert(1)',publisher:'외부',title:'다른 기사',read_ok:true}],analysis:{summary:{text:'현재 상황'},why_now:{text:'새 변화'},facts:[{id:'f1',text:'<img src=x onerror=alert(1)>',source_id:'s1'},{id:'f2',text:'목표 대비 매출에 관한 보도',source_id:'s2'}],angles:[{headline:'가제',reason:'두 자료를 함께 볼 이유',new_information:'기보도와의 차이',basis_ids:['f1','f2']}],already_covered:[{text:'매각 착수',source_id:'s1'}],uncertainties:[{text:'계획은 미정',fact_ids:['f1']}]}};
 const html=B.renderBriefHtml(r)+B.renderDetails(r);assert.match(html,/기보도와의 차이/);assert.match(html,/계획은 미정/);assert.match(html,/marketin.edaily.co.kr/);assert.doesNotMatch(html,/<img|javascript:|확인할 질문|전화 순서/);assert.match(html,/&lt;img/);
 assert.equal(B.attach(source,r).article_pitch,'가제');
});
test('install replaces generic enrichment without mutating core source records',()=>{
 const C={build:()=>[source]},root={IBDiscovery:C};assert.equal(B.install(root),true);assert.equal(B.install(root),false);const out=C.build();assert.equal(out[0].article_brief,null);assert.equal(source.article_brief,undefined);
});

test('latest news research precedes unanalysed DART material, grounded pitches precede both',()=>{const news={detector:'news_followup',research_topic:'홈플러스',sort_date:'2026-09-17'},dart={detector:'dart_deal',research_topic:'공시기업',sort_date:'2026-09-17'},pitch={article_brief:{angles:[{headline:'검증된 근거의 가제'}]},sort_date:'2026-09-16'};assert.deepEqual(B.shortlist([dart,news,pitch]),[pitch,news,dart]);});
test('pitch-first card body omits duplicate headline and retains cited rationale',()=>{const r={status:'ready',headline_in_card:true,sources:[{source_id:'s1',url:'https://marketin.edaily.co.kr/News/Read?id=1',publisher:'마켓인'}],analysis:{facts:[{id:'f1',source_id:'s1'}],angles:[{headline:'이미 카드 제목에 있는 가제',reason:'발제 요지',new_information:'기보도에서 진전시킬 내용',basis_ids:['f1']}]}};const html=B.renderBriefHtml(r);assert.match(html,/발제 요지/);assert.match(html,/기보도에서 진전/);assert.match(html,/marketin.edaily.co.kr/);assert.doesNotMatch(html,/이미 카드 제목/);});

test('rule-generated articles retain their direction and evidence when optional reading fails or suggests another angle',()=>{
 const proposal={detector:'recommendation',clue_id:'rule-lp',headline:'시험LP 출자사업의 투자 분야',article_pitch:'시험LP 출자사업의 투자 분야',pitch_summary:'규모와 분야 비교',comparison_axis:'투자 분야',score:82,evidence:[{text:'원문에 나온 출자 분야'}],sources:[{title:'시험LP 위탁운용사 선정',url:'https://www.nps.or.kr/notice/1',label:'시험LP',date:'2026-09-17'}],research_topic:'시험LP'};
 for(const status of ['ready','sources_only','out_of_scope']){
  const attached=B.attach(proposal,{version:B.VERSION,status,analysis:{angles:[{headline:'다른 방향'}]}});
  assert.equal(attached.headline,proposal.headline);assert.equal(attached.article_pitch,proposal.article_pitch);assert.equal(attached.pitch_summary,proposal.pitch_summary);assert.equal(attached.comparison_axis,proposal.comparison_axis);assert.equal(attached.score,82);assert.deepEqual(attached.evidence,proposal.evidence);assert.equal(attached.article_brief,undefined);
 }
 assert.equal(B.select([proposal])[0],proposal);assert.ok(B.requestFor(proposal).url.includes('mode=research'));
 assert.equal(B.requestFor({...proposal,research_topic:undefined}),null);
 assert.equal(B.requestFor({...proposal,research_topic:'다른기업'}),null);
 assert.equal(B.requestFor({...proposal,sources:[{...proposal.sources[0],url:'https://user:secret@example.com'}]}),null);
});
test('missing MarketIN coverage is disclosed without suppressing the recommendation or adding checklist sections',()=>{
 const r={status:'ready',sources:[{source_id:'s1',url:'https://www.nps.or.kr/notice/1',title:'시험LP 출자사업',read_ok:true}],analysis:{facts:[{id:'f1',text:'출자 분야 공개',source_id:'s1'}],angles:[{headline:'출자 분야별 선정 기준',reason:'투자 분야와 심사 항목을 정리한다.',new_information:'운용사의 지원 선택을 설명한다.',question:'어떤 투자 분야를 선정하는가?',basis_ids:['f1'],first_action:'공개매수 결과보고서 대조',falsification:'가설 반증'}],already_covered:[]}};
 const html=B.renderBriefHtml(r)+B.renderDetails(r);assert.match(html,/출자 분야별 선정 기준/);assert.match(html,/마켓인 기보도 확인 못함/);assert.doesNotMatch(html,/제안은 보류|검증 전|첫 취재|반증 조건|공개매수 결과보고서/);
});

test('optional research enriches selected rule articles before legacy groups and skips comparisons without a single topic',()=>{
 const proposal={detector:'recommendation',clue_id:'rule-lp',score:80,research_topic:'시험LP',sources:[{title:'시험LP 위탁운용사 선정',url:'https://www.nps.or.kr/notice/1',date:'2026-09-17'}]};
 const higher={...proposal,clue_id:'rule-gp',score:85,research_topic:'시험GP',sources:[{title:'시험GP 펀드 결성',url:'https://www.hankyung.com/article/1',date:'2026-09-17'}]};
 const comparison={...proposal,clue_id:'comparison',score:99,research_topic:undefined};
 const raw={detector:'news_followup',research_topic:'다른기업',sort_date:'2026-09-18'};
 const legacy={article_brief:{angles:[{headline:'기존 발제'}]},sort_date:'2026-09-18'};
 const ordered=B.shortlist([raw,legacy,comparison,proposal,higher]);assert.deepEqual(ordered,[higher,proposal,legacy,raw,comparison]);
 const requests=ordered.map(B.requestFor).filter(Boolean);assert.equal(requests.length,3);assert.equal(requests[0].key,B.requestFor(higher).key);assert.equal(requests[1].key,B.requestFor(proposal).key);assert.equal(B.requestFor(comparison),null);
});
