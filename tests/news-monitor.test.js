const test = require('node:test');
const assert = require('node:assert/strict');
const { clusterIssues, shouldKeep, theme } = require('../lib/news-monitor');
const { isJakMemberSource, parseJakMemberPage } = require('../lib/jak-members');

test('filters PE polymer and LP vinyl noise', () => {
  assert.equal(shouldKeep({ source_name:'매일경제', title:'PE·PP 가격 인하…석유화학 지원', snippet:'폴리에틸렌(PE) 공급가격' }, null), false);
  assert.equal(shouldKeep({ source_name:'한국경제', title:'LP판 열풍에 바이닐 매장 확대', snippet:'턴테이블과 음반' }, null), false);
});

test('keeps concrete IB stories only from JAK member sources', () => {
  assert.equal(shouldKeep({ source_name:'서울경제', title:'MBK, A사 매각 본입찰 돌입', snippet:'사모펀드 운용사와 원매자가 참여했다' }, { id:'A-013' }), true);
  assert.equal(shouldKeep({ source_name:'가입안한가상매체', title:'MBK, A사 매각 본입찰 돌입', snippet:'사모펀드 운용사와 원매자가 참여했다' }, { id:'A-013' }), false);
  assert.deepEqual(theme('한국성장금융 출자사업 위탁운용사 선정'), ['lp','LP·정책자금']);
});

test('parses and matches JAK member names', () => {
  const html = '<table><tr><th>지회</th></tr><tr><td>서울경제신문</td><td>03142</td></tr><tr><td>이데일리</td><td>04517</td></tr></table>';
  const names = parseJakMemberPage(html);
  assert.deepEqual(names, ['서울경제신문','이데일리']);
  assert.equal(isJakMemberSource('서울경제', names), true);
  assert.equal(isJakMemberSource('이데일리', names), true);
  assert.equal(isJakMemberSource('가상경제', names), false);
});

test('clusters repeated coverage of the same deal', () => {
  const base = {
    theme_id:'ma_pef', theme_label:'M&A·PEF', event_label:'M&A 진행',
    target:{ id:'A-013', name:'MBK파트너스', category:'pef' }, snippet:''
  };
  const issues = clusterIssues([
    { ...base, title:'MBK, 홈플러스 매각 본입찰 돌입', source_name:'서울경제', source_url:'https://a.test/1', published_at:'2026-09-03T01:00:00Z' },
    { ...base, title:'홈플러스 매각 본입찰…MBK 새 주인 찾기 속도', source_name:'이데일리', source_url:'https://b.test/2', published_at:'2026-09-02T02:00:00Z' },
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].article_count, 2);
  assert.equal(issues[0].source_count, 2);
  assert.equal(issues[0].ongoing, true);
});
