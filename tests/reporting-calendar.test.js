const test=require('node:test');const assert=require('node:assert/strict');const C=require('../lib/reporting-calendar');
const reference='2026-09-11T00:00:00Z';
test('Korean date crosses UTC midnight correctly',()=>assert.equal(C.kstDay(Date.parse('2026-09-10T15:01:00Z')),'2026-09-11'));
test('invalid dates rejected instead of rolling over',()=>{assert.equal(C.validDate(2026,2,30),null);assert.equal(C.validDate(2026,9,18),'2026-09-18');});
test('publication and registration deadlines do not become an event date',()=>{assert.equal(C.eventDate('게시일 2026-09-11\n신청기간: 9월 14일까지\n벤처투자 포럼 안내',reference),null);assert.equal(C.eventDate('9월 10일에 따르면 포럼을 개최할 계획이다.',reference),null);});
test('explicit event date outranks registration deadline',()=>{const e=C.makeEvent({title:'벤처투자 포럼 안내',url:'https://www.kvca.or.kr/test',published_at:reference},'신청기간: 9월 14일까지\n일시: 2026년 9월 18일 09:30~12:00\n장소: 콘래드호텔\n주최: 자본시장연구원');assert.equal(e.date,'2026-09-18');assert.equal(e.time,'09:30–12:00');assert.equal(e.venue,'콘래드호텔');});
test('LP selections and training are excluded',()=>{for(const title of ['출자사업 선정결과','위탁운용사 접수 마감','벤처투자 양성과정 세미나'])assert.equal(C.makeEvent({title,url:'https://test/'},'일시:2026년9월18일'),null);});
test('FSC rows retain relevant briefing and exclude general meetings',()=>{const html='<table><tr><td>1</td><td>2026-09-18</td><td>10:00 ~</td><td>자본시장 제도개선 브리핑 (정부서울청사)</td></tr><tr><td>2</td><td>2026-09-18</td><td>09:00 ~</td><td>주간업무회의 (정부서울청사)</td></tr></table>';const out=C.parseFsc(html,{id:'fsc-chair',name:'금융위원장 일정',url:'https://www.fsc.go.kr/fsc020301'});assert.equal(out.length,1);assert.equal(out[0].kind,'announcement');assert.equal(out[0].venue,'정부서울청사');});
test('missing FSC table is failure, not a successful empty schedule',()=>assert.throws(()=>C.parseFsc('<html>접근 불가</html>',{}),/FORMAT/));
test('weekly policy announcement has schedule date, not article date',()=>{const out=C.parseWeekly('◇9월 14일(월)\n▲자본시장 공시제도 개선방안 발표(12:00)\n▲보험 소비자 민원 통계 발표\n◇9월 15일(화)\n▲벤처투자 간담회(10:00)',{url:'https://news.test/article',published_at:reference});assert.equal(out.length,2);assert.equal(out[0].date,'2026-09-14');assert.equal(out[1].kind,'event');});
test('failed source retains last known events; explicit changes have history',()=>{const now=Date.parse(reference),old={id:'a',title:'자본시장 포럼',date:'2026-09-18',time:'10:00',venue:'서울',status:'scheduled'};assert.equal(C.mergeEvents([old],[],now).length,1);const next=C.mergeEvents([old],[{...old,date:'2026-09-19',status:'postponed'}],now)[0];assert.equal(next.previous_date,'2026-09-18');assert.equal(next.changed_at,reference.replace('Z','.000Z'));});
test('past events are never moved into the upcoming date window',()=>{const now=Date.parse(reference),old={id:'a',title:'KB 코리아 컨퍼런스',date:'2026-09-10',time:'08:00'};assert.equal(C.mergeEvents([old],[],now)[0].date,'2026-09-10');});
test('official event title supplies date when the notice body is a poster',()=>{const e=C.makeEvent({title:'「아시아창업엑스포 FLY ASIA2026」 개최 안내(10/7~8, 부산)',url:'https://www.kvca.or.kr/event',source_id:'kvca',published_at:reference},'행사 포스터');assert.equal(e.date,'2026-10-07');assert.equal(e.evidence,'「아시아창업엑스포 FLY ASIA2026」 개최 안내(10/7~8, 부산)');});

test('official seminar programme accepts its theme as title',()=>{const e=C.makeEvent({title:'혁신과 성장을 견인하는 자본시장 – 생산적 금융 전환 과제',url:'https://www.kcmi.re.kr/seminar/seminar_program?eno=317',source_id:'kcmi'},'일시 :2026년 09월 18일 (금), 09:30~12:00\n주최 :자본시장연구원');assert.equal(e.date,'2026-09-18');});

test('multi-day conferences retain their final day',()=>{assert.equal(C.endDate('10/7~8, 부산','2026-10-07'),'2026-10-08');assert.equal(C.endDate('9월 29일(화) ~ 30일(수)','2026-09-29'),'2026-09-30');});

test('seminar date metadata outside the programme body is retained',()=>{const html='<main><h2>혁신과 성장을 견인하는 자본시장</h2><ul><li>일시 :2026년 09월 18일 (금), 09:30~12:00</li></ul><div class="view_content">주제발표와 토론 프로그램</div></main>';const e=C.makeEvent({title:'혁신과 성장을 견인하는 자본시장',url:'https://www.kcmi.re.kr/seminar/seminar_program?eno=317',source_id:'kcmi'},C.pageText(html));assert.equal(e.date,'2026-09-18');});


test('an LP mandate explanation session is an event, not an application deadline',()=>{
 const e=C.makeEvent({title:'한국벤처투자 지역모펀드 출자사업 설명회',url:'https://www.kvic.or.kr/test'},'신청기간:2026년9월14일\n일시:2026년9월18일 오후 3시');
 assert.equal(e.date,'2026-09-18');assert.equal(e.time,'15:00');
});
test('Growth defence IR uses the session date, not the application or selection date',()=>{
 const e=C.makeEvent({title:'2026년 2차 방위산업 혁신기업 투자설명회(IR) 참여기업 모집 공고',url:'https://www.kgrowth.or.kr/notice_view.asp?idx=1115&str_type=2',published_at:'2026-09-02'},'□ IR Day 개요\nㅇ 일    시 : 2026년 10월 29일(목), 13:00 ~ 17:00\nㅇ 장    소 : 서울 내 외부 장소 대관(추후 개별 안내)\n신청기한 : 2026.9.30(수) 16:00\n선정 결과 : 2026.10.8');
 assert.equal(e.date,'2026-10-29');assert.equal(e.time,'13:00–17:00');assert.match(e.venue,/서울/);
});
test('Growth fintech meetup parses future prose and registration is not the date',()=>{
 const e=C.makeEvent({title:'한국성장금융 코리아핀테크위크2026 투자밋업 모집공고',url:'https://www.kgrowth.or.kr/notice_view.asp?idx=816&str_type=3',published_at:'2026-08-27'},"한국성장금융투자운용(주)은 오는 11월 26일(목), 서울 양재동 aT센터 제2 전시장에서 핀테크 스타트업을 위한 '핀테크 스타트업 1:1 투자밋업'을 개최하고자 한다.");
 assert.equal(e.date,'2026-11-26');assert.match(e.venue,/aT센터/);
});
test('abbreviated year and from-through range preserve all three fintech-week days',()=>{
 const e=C.makeEvent({title:'코리아 핀테크 위크 2026 개최 안내',url:'https://www.kgrowth.or.kr/notice_view.asp?idx=815&str_type=3',published_at:'2026-07-30'},'’26.11.25일(수)부터 11.27일(금)까지 3일간 「코리아 핀테크 위크 2026」가 서울 aT센터(양재)에서 개최된다.');
 assert.equal(e.date,'2026-11-25');assert.equal(e.end_date,'2026-11-27');
});
test('a contradictory year is not silently corrected',()=>{
 assert.equal(C.makeEvent({title:'2026년도 환급사업장 매각설명회 개최 안내',url:'https://www.kofia.or.kr/test',published_at:'2026-08-13'},'□ 일시 : 2025.8.21.(금)13:30~16:00'),null);
});
test('a month/day without a reliable reference year stays unconfirmed',()=>{
 assert.equal(C.makeEvent({title:'벤처투자 설명회 안내',url:'https://www.kvic.or.kr/test'},'일시:9월18일'),null);
});

const S=require('../lib/reporting-calendar-sources');
const D=require('../lib/public-document-reader');
const H={...C,clean:s=>D.decode(String(s).replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim(),key:s=>s,links:(html,base)=>[...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].flatMap(m=>{try{const a=D.attrs(m[0]),u=new URL(a.href,base);return /^https?:$/.test(u.protocol)?[{url:u.href,title:D.decode(m[0].replace(/<[^>]*>/g,'')).trim()}]:[];}catch(_){return [];}})};
test('Growth scans all three boards and canonicalizes page variants without excluding explanations',()=>{
 const source=S.SOURCES.find(s=>s.id==='kgrowth-notice');
 const html='<table><tr><td>123</td><td><a href="notice_view.asp?idx=100&amp;page=2&amp;str_type=1">출자사업 설명회</a></td><td>2026-09-02</td></tr><tr><td><a href="notice_view.asp?idx=101&amp;str_type=1">출자사업 선정결과</a></td><td>2026-09-02</td></tr></table>';
 const out=S.boardCandidates(html,source,H);assert.equal(out.length,1);assert.equal(out[0].published_at,'2026-09-02');assert.equal(out[0].url,'https://www.kgrowth.or.kr/notice_view.asp?idx=100&str_type=1');assert.equal(S.SOURCES.filter(s=>s.type==='growth').length,3);
});
test('KVIC javascript detail links retain the IR notice and board path',()=>{
 const source=S.SOURCES.find(s=>s.id==='kvic-other');const html='<tr><td>123</td><td><a href="javascript:goView(5123)">벤처투자 IR Day 개최 안내</a></td><td>2026-09-02</td></tr>';
 const out=S.boardCandidates(html,source,H);assert.equal(out.length,1);assert.equal(out[0].url,source.url+'?id=5123');
});
test('Assembly lists use explicitly paired date and venue and retain only beat-relevant sessions',()=>{
 const html='<li><p>[세미나] 자본시장과 기업지배구조</p><p>2026.09.18 | 장소 : 국회도서관 소강당 | 조회수 : 3</p></li><li><p>[세미나] 선거제도 개선</p><p>2026.09.19 | 장소 : 대회의실 | 조회수 : 2</p></li>';
 const out=S.parseNars(html,S.SOURCES.find(s=>s.id==='nars-seminar'),H);assert.equal(out.length,1);assert.equal(out[0].date,'2026-09-18');assert.equal(out[0].venue,'국회도서관 소강당');
});
test('neighbour notice dates are not attributed to an undated article',()=>{
 const html='<body><p>벤처투자 설명회 안내. 행사 날짜는 추후 안내합니다. 자세한 사항은 첨부파일을 참고해 주시기 바랍니다.</p><p>다음글</p><p>다른 세미나 일시:2026년9월18일</p></body>';
 assert.equal(C.eventDate(S.articleText(html,{type:'growth'},H),reference),null);
});
test('undated attachments stay visible and receive an explicit failure reason',async()=>{
 const source=S.SOURCES.find(s=>s.id==='kgrowth-other');
 const list='<table><tr><td><a href="notice_view.asp?idx=123&amp;str_type=2">2026 벤처투자 설명회</a></td><td>2026-09-02</td></tr></table>';
 const body='<body><p>벤처투자 설명회를 안내합니다. 일정과 장소 및 참석 안내는 아래 첨부파일에서 확인해 주시기 바랍니다.</p><a href="down_file.asp?idx=123">행사안내.pdf</a></body>';
 const reader={boundedFetch:async url=>({buffer:Buffer.from(url.includes('notice_view')?body:list),contentType:'text/html'}),read:async()=>({read_ok:false,read_error:'SCANNED_OR_EMPTY_DOCUMENT'})};
 const out=await S.collect(source,reader,Date.now()+10000,null,H);assert.equal(out.events.length,0);assert.equal(out.pending.length,1);assert.equal(out.pending[0].reason,'SCANNED_OR_EMPTY_DOCUMENT');
});

test('MUST Round accepts a two-digit year without an apostrophe',()=>{
 const e=C.makeEvent({title:'제27회 MUST Round 참가 투자자 모집',url:'https://www.kvca.or.kr/7349',published_at:'2026-08-28'},'[행사개요] □ 일시 : 26.9.16(수), 15:00~17:00\n□ 장소 : 부산 센텀기술창업타운 1층 창업카페');
 assert.equal(e.date,'2026-09-16');assert.equal(e.time,'15:00–17:00');assert.match(e.venue,/부산/);
});
test('parenthesized compact LP-GP and scaleup IR labels retain date and venue',()=>{
 const e=C.makeEvent({title:'2026 벤처캐피탈 LP-GP 교류회 개최',url:'https://www.kvca.or.kr/7335',published_at:'2026-08-07'},'[행사 개요]- (주 최) 한국벤처캐피탈협회- (일 시) 2026. 9. 8.(화), 09:30 ~ 13:00 (오찬 포함)- (장 소) 양재 엘타워 5층 오르체홀');
 assert.equal(e.date,'2026-09-08');assert.match(e.venue,/양재/);assert.equal(e.time,'09:30–13:00');
 const ir=C.makeEvent({title:'서울시-금융투자협회 공동 스케일업 IR',url:'https://www.kvca.or.kr/7346',published_at:'2026-08-26'},'ㅇ (일시) ‘26.9.9일(수), 10:00~12:10\nㅇ (장소) 동대문디자인플라자 컨퍼런스홀');
 assert.equal(ir.date,'2026-09-09');assert.match(ir.venue,/동대문/);
});
test('an overseas region label is retained as venue for domestic filtering',()=>{
 const e=C.makeEvent({title:'Super Return Asia 참가 안내',url:'https://www.kvca.or.kr/7316',published_at:'2026-07-14'},'일시:2026년9월28일~10월1일\nㅇ 지역 : 싱가포르 마리나베이샌즈 컨벤션 센터');assert.match(e.venue,/싱가포르/);
});
test('the same named event in an official notice and a news story appears once',()=>{
 const a={id:'official',date:'2026-11-26',title:'성장금융 핀테크 투자밋업 안내',evidence:"'핀테크 스타트업 1:1 투자밋업'을 개최한다.",time:''};
 const b={...a,id:'news',title:'성장금융, 투자밋업 11월 개최'};
 assert.equal(C.mergeEvents([],[a,b],Date.parse(reference)).length,1);
});
test('weekly policy collection still excludes plain LP deadlines',()=>{
 const out=C.parseWeekly('◇9월 14일(월)\n▲벤처펀드 위탁운용사 선정결과 발표\n▲벤처펀드 출자사업 설명회(14:00)',{url:'https://news.test/weekly',published_at:reference});assert.equal(out.length,1);assert.match(out[0].title,/설명회/);
});
test('an IR recruitment deadline in the title never supplies the event date',()=>{
 for(const title of ['벤처투자 IR 참가기업 모집(~9/14)','벤처투자 설명회 개최 참가기업 모집(9/14)'])assert.equal(C.makeEvent({title,source_id:'kvca',url:'https://www.kvca.or.kr/test',published_at:reference},'행사 안내 포스터'),null);
});
