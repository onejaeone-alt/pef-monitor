const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../lib/reporting-calendar-institutions'),H=require('../lib/reporting-calendar');
const fsc=I.INSTITUTIONS.find(s=>s.id==='fsc-releases'),apfs=I.INSTITUTIONS.find(s=>s.id==='lp-apfs');
test('institution classification includes agricultural investment roadshows and separates mandate deadlines',()=>{
 assert.equal(I.candidate('2026 농식품 금융투자로드쇼 개최',apfs,H),true);
 assert.equal(I.candidate('2026 농식품모태펀드 출자사업 설명회',apfs,H),true);
 assert.equal(I.candidate('농식품모태펀드 위탁운용사 선정 결과',apfs,H),false);
 assert.equal(I.candidate('손해평가사 재해보험 교육',apfs,H),false);
});
test('FSC capital-market policy release is shown as published, never as a future sale date',()=>{
 const e=I.announcement({url:'https://www.fsc.go.kr/no010101/1',title:'제2차 국민참여성장펀드 9.30일부터 판매됩니다',published_at:'2026-09-08'},'오는 9월30일부터 펀드를 판매합니다.',fsc,H);
 assert.equal(e.date,'2026-09-08');assert.equal(e.status,'published');assert.equal(e.date_basis,'publication');
});
test('FSC formal publication schedule uses the announced date',()=>{
 const e=I.announcement({url:'https://www.fsc.go.kr/no010101/2',title:'벤처투자 제도개선 발표',published_at:'2026-09-11'},'보도시점:2026년9월18일 14:00',fsc,H);assert.equal(e.date,'2026-09-18');assert.equal(e.status,'scheduled');
});
test('board rows do not turn attached PDFs into separate notices',()=>{
 const html='<li><a href="/no010101/100">삼성증권 단기금융업 인가</a><a href="/comm/getFile?fileNo=123">삼성증권 단기금융업 인가.pdf</a><p>2026-09-09</p></li>';
 const items=I.items(html,fsc.url,fsc,H);assert.equal(items.length,1);assert.equal(items[0].published_at,'2026-09-09');
});
test('discovery follows same-host literal public paths, not arbitrary script execution',()=>{
 const html='<a href="javascript:void(0)" onclick="move(\'/front/board/list.do?boardId=1\')">보도자료</a><a href="https://example.com/list.do">공지사항</a>';
 const links=I.boardLinks(html,apfs.url);assert.equal(links.length,1);assert.equal(links[0].url,'https://www.apfs.kr/front/board/list.do?boardId=1');
});
