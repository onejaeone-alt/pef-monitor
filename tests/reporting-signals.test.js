const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyEvent,
  collapseStoryClusters,
  enrichSignal,
  parseOfficialPage,
  scoreSignal,
  withinDays,
} = require("../lib/reporting-signals");

test("공식 출자 페이지에서 제목·링크·날짜를 뽑는다", () => {
  const source = {
    id: "fixture",
    name: "한국성장금융",
    category: "capital_call",
    url: "https://example.com/notices",
    include: /(출자|선정|위탁운용사)/,
  };
  const html = `
    <tr><td>2026-09-02</td><td><a href="/notices/17">[과학기술인공제회] 2026년 위탁운용사 선정결과</a></td></tr>
    <tr><td><a href="/notice">출자사업공지</a></td></tr>
    <tr><td><a href="/alert">출자사업 알림서비스</a></td></tr>
    <tr><td>2026-08-30</td><td><a href="/about">기관 소개</a></td></tr>`;
  const rows = parseOfficialPage(html, source);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "[과학기술인공제회] 2026년 위탁운용사 선정결과");
  assert.equal(rows[0].subject_name, "과학기술인공제회");
  assert.equal(rows[0].source_url, "https://example.com/notices/17");
  assert.equal(rows[0].source_type, "selection_result");
  assert.equal(rows[0].published_at, "2026-09-01T15:00:00.000Z");
});

test("출자 선정과 펀드 결성 신호를 구분한다", () => {
  assert.equal(classifyEvent("국내 PE·VC 위탁운용사 최종 선정결과"), "selection_result");
  assert.equal(classifyEvent("3000억원 규모 딥테크 펀드 최종 결성"), "fund_formation");
  assert.equal(classifyEvent("김근호 한국투자파트너스 상무, 행사 참석"), "general");
  assert.equal(classifyEvent("한국투자파트너스 신임 대표 선임"), "people_move");
});

test("A등급 공식 선정결과는 P1으로 올린다", () => {
  const scored = scoreSignal({
    event_type: "selection_result",
    source_type: "selection_result",
    target: { priority: "A" },
    facts: { amounts: ["2000억원"], dates: [] },
  });
  assert.equal(scored.score, 100);
  assert.equal(scored.grade, "P1");
});

test("VC 뉴스는 대상·확인항목·구체 해석을 붙인다", () => {
  const signal = enrichSignal({
    source_type: "domestic_news",
    source_name: "테스트뉴스",
    title: "한국투자파트너스, 3000억원 신규 펀드 결성",
    source_url: "https://example.com/article/1",
    published_at: "2026-09-02T01:00:00Z",
    snippet: "",
    provider: "fixture",
  });
  assert.equal(signal.target.name, "한국투자파트너스");
  assert.equal(signal.event_type, "fund_formation");
  assert.ok(signal.story_score >= 70);
  assert.match(signal.interpretation, /앵커 LP/);
  assert.deepEqual(signal.checkpoints, ["실제 약정액", "앵커 LP", "1차·최종 클로징 시점"]);
});

test("같은 대상의 같은 투자 기사는 한 사건으로 묶는다", () => {
  const first = enrichSignal({
    source_type: "domestic_news", source_name: "A뉴스",
    title: "블루포인트, 스페이스랩 시드 투자 유치",
    source_url: "https://example.com/a", published_at: "2026-09-02T01:00:00Z",
  });
  const second = enrichSignal({
    source_type: "domestic_news", source_name: "B뉴스",
    title: "스페이스랩, 블루포인트서 시드 투자 유치…위성 추진체 개발",
    source_url: "https://example.com/b", published_at: "2026-09-02T02:00:00Z",
  });
  const rows = collapseStoryClusters([first, second]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].related_count, 2);
  assert.equal(rows[0].related_sources.length, 2);
});

test("요청 기간보다 오래된 출자공고는 새 단서에서 제외한다", () => {
  const now = new Date("2026-09-03T00:00:00Z").getTime();
  assert.equal(withinDays({ published_at: "2026-09-01T00:00:00Z" }, 3, now), true);
  assert.equal(withinDays({ published_at: "2026-08-14T00:00:00Z" }, 3, now), false);
  assert.equal(withinDays({ published_at: null }, 3, now), false);
});
