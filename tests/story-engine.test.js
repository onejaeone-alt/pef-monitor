const test = require("node:test");
const assert = require("node:assert/strict");
const {
  analyzeDisclosure,
  attachPreviousEvents,
  shouldInclude,
  toMonitoredItem,
} = require("../lib/story-engine");

function raw(overrides = {}) {
  return {
    rcept_no: "20260902000001",
    rcept_dt: "20260902",
    corp_code: "00123456",
    corp_name: "테스트회사",
    report_nm: "타법인주식및출자증권취득결정",
    flr_nm: "테스트회사",
    ...overrides,
  };
}

test("파트너스라는 이름만 들어간 감사보고서는 제외한다", () => {
  const item = toMonitoredItem(raw({ corp_name: "피아이와이아트파트너스", report_nm: "감사보고서" }));
  assert.equal(item.analysis.event_id, "periodic");
  assert.equal(shouldInclude(item, item.analysis), false);
});

test("PEF가 관련된 경영권 공시는 오늘 기사 후보로 올린다", () => {
  const item = toMonitoredItem(raw({ corp_name: "대상회사", report_nm: "최대주주 변경을 수반하는 주식양수도 계약 체결", flr_nm: "MBK파트너스" }));
  assert.equal(item.category, "PEF");
  assert.equal(item.analysis.bucket, "story");
  assert.ok(item.analysis.score >= 75);
});

test("PEF 명칭이 없어도 주요 인수 결정은 취재 필요 목록에 남긴다", () => {
  const item = toMonitoredItem(raw());
  assert.equal(shouldInclude(item, item.analysis), true);
  assert.ok(["story", "verify"].includes(item.analysis.bucket));
});

test("정정 공시는 변경 전후 비교를 우선하도록 표시한다", () => {
  const analysis = analyzeDisclosure(raw({ report_nm: "[기재정정]타법인주식및출자증권처분결정" }));
  assert.equal(analysis.stage, "조건·내용 변경");
  assert.match(analysis.change_summary, /변경 전후/);
});

test("같은 회사·사건의 과거 공시를 연결한다", () => {
  const previous = toMonitoredItem(raw({ rcept_no: "20260801000001", rcept_dt: "20260801" }));
  const current = toMonitoredItem(raw());
  const [linked] = attachPreviousEvents([current], [previous]);
  assert.equal(linked.analysis.previous_event.rcept_no, previous.rcept_no);
  assert.match(linked.analysis.change_summary, /같은 유형/);
});

test("PEF 관련성이 없는 일반 회생 공시는 제외한다", () => {
  const item = toMonitoredItem(raw({ report_nm: "회생절차개시결정" }));
  assert.equal(shouldInclude(item, item.analysis), false);
});

test("감시목록 회사의 자금조달 공시는 관련 명칭이 없어도 남긴다", () => {
  const item = toMonitoredItem(raw({ corp_name: "포트폴리오회사", report_nm: "전환사채권발행결정" }));
  assert.equal(shouldInclude(item, item.analysis, ["포트폴리오회사"]), true);
});

test("일반 공모펀드 투자설명서는 운용사 이름이 잡혀도 제외한다", () => {
  const item = toMonitoredItem(raw({ corp_name: "현대인베스트먼트자산운용", report_nm: "[기재정정]투자설명서(집합투자증권)" }));
  assert.equal(shouldInclude(item, item.analysis), false);
});
