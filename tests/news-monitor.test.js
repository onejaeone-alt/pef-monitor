const test = require('node:test');
const assert = require('node:assert/strict');
const { clusterIssues, eventLabel, queries, shouldKeep, theme } = require('../lib/news-monitor');
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

test('LP retrieval separately covers allocation, private-market strategies and distributions', () => {
  const focused = queries(7).filter(q => q.includes('연기금 OR 공제회 OR 보험사'));
  assert.equal(focused.length, 3);
  assert.ok(focused.every(q => q.endsWith('when:7d')));
  assert.match(focused[0], /자산배분.*위탁운용.*운용사 선정/);
  assert.match(focused[1], /크레딧.*세컨더리.*공동투자/);
  assert.match(focused[2], /재출자.*재약정.*분배금.*출자 축소/);
});

test('explicit LP decisions take priority over the investment strategy vocabulary', () => {
  for (const title of [
    '국민연금, 국내 사모펀드 출자 GP 선정',
    '교직원공제회, 벤처투자 위탁운용사 선정 착수',
    '보험사, PE 세컨더리 펀드 약정액 확대',
    '사학연금, 자산배분 비중 조정',
    'LP 재약정 축소…사모펀드 분배금 감소',
    '공무원연금, 크레딧 투자 확대',
    '삼성화재, 세컨더리 펀드 출자 결정',
    '우정사업본부, 공동투자 배정 확대'
  ]) {
    assert.deepEqual(theme(title), ['lp','LP·정책자금'], title);
    assert.equal(eventLabel(title), 'LP·출자', title);
  }
});

test('institution names alone do not make unrelated news an LP event', () => {
  for (const title of [
    '국민연금, 노후 생활 상담 서비스 개편',
    '공제회, 창립 기념 문화행사 개최',
    '한국벤처투자, 사옥 환경 개선',
    '삼성화재, 자동차 보험료 인하'
  ]) {
    assert.equal(theme(title)[0], 'other', title);
    assert.equal(shouldKeep({source_name:'이데일리',title}), false, title);
  }
  assert.equal(theme('산업은행, KDB생명 매각 추진')[0], 'ma_pef');
  assert.equal(theme('A사, 회사채 차환 추진')[0], 'ib');
});

test('production scope keeps LP allocation and distribution news without reopening noise', () => {
  const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
  const { patch } = require('../scripts/extend-news-marketin-coverage');
  const source = fs.readFileSync(path.join(__dirname,'../lib/news-monitor.js'),'utf8');
  const patched = patch(source);
  assert.equal(patch(patched), patched, 'build patch remains idempotent');
  const m = new Module(path.join(__dirname,'../lib/__lp-monitor-test.js'),module);
  m.filename = path.join(__dirname,'../lib/__lp-monitor-test.js'); m.paths = module.paths;
  m._compile(patched,m.filename);
  const keep = (title, source_name='이데일리') => m.exports.shouldKeep({title,source_name});
  for (const title of [
    '사학연금, 자산배분 비중 조정',
    'LP 재약정 축소…사모펀드 분배금 감소',
    '보험사, 크레딧 투자 비중 확대'
  ]) assert.equal(keep(title), true, title);
  assert.equal(keep('LP판 판매 확대…턴테이블 인기'), false);
  assert.equal(keep('국민연금, 노후 생활 상담 서비스 개편'), false);
  assert.equal(keep('공제회, 사모펀드 출자 운용사 채용'), false);
  assert.equal(keep('공제회 출자 수혜주 급등'), false);
  assert.equal(keep('사학연금, 자산배분 비중 조정','가입안한가상매체'), false);
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
    { ...base, title:'MBK, 홈플러스 매각 본입찰 돌입', source_name:'서울경제', source_url:'https://a.test/1', published_at:'2026-09-03T01:00:00Z', related_entities:[
      { entity_key:'pef:mbk', canonical_name:'MBK파트너스' },
      { entity_key:'company:homeplus', canonical_name:'홈플러스' },
    ] },
    { ...base, title:'홈플러스 매각 본입찰…MBK 새 주인 찾기 속도', source_name:'이데일리', source_url:'https://b.test/2', published_at:'2026-09-02T02:00:00Z', related_entities:[
      { entity_key:'company:homeplus', canonical_name:'홈플러스' },
    ] },
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].article_count, 2);
  assert.equal(issues[0].source_count, 2);
  assert.equal(issues[0].ongoing, true);
  assert.deepEqual(issues[0].related_entities.map((item)=>item.canonical_name), ['MBK파트너스','홈플러스']);
});
