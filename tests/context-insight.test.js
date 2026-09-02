const test = require("node:test");
const assert = require("node:assert/strict");
const { buildContextInsight, relevantEvidence } = require("../lib/context-insight");

test("공시 사건과 주제가 맞는 보도자료만 해석 근거로 쓴다", () => {
  const context = { eventLabel: "경영권·최대주주 변동", stage: "조건·내용 변경", reportName: "[기재정정]공개매수설명서" };
  const sources = {
    press_release: [
      { title: "가비아, 신제품 출시", snippet: "" },
      { title: "가비아 공개매수 조건 변경 관련 보도자료", snippet: "" },
    ],
    domestic: [],
    foreign: [],
  };
  const insight = buildContextInsight(context, sources);
  assert.equal(insight.basis, "press_release");
  assert.equal(insight.evidence_count, 1);
  assert.match(insight.text, /관련 보도자료와 공시/);
  assert.match(insight.text, /거래 종결 가능성/);
});

test("무관한 보도자료 대신 사건이 맞는 기사를 근거로 쓴다", () => {
  const context = { eventLabel: "대량보유·주주 변동", stage: "조건·내용 변경", reportName: "대량보유상황보고서" };
  const sources = {
    press_release: [{ title: "지에프아이 ESS 공급계약", snippet: "" }],
    domestic: [{ title: "지에프아이 최대주주 지분 변동", snippet: "" }],
    foreign: [],
  };
  const insight = buildContextInsight(context, sources);
  assert.equal(insight.basis, "news");
  assert.equal(insight.evidence_count, 1);
  assert.match(insight.text, /기존 대량보유 보고/);
});

test("관련 자료가 없으면 공시만 본 해석이라고 밝힌다", () => {
  const context = { eventLabel: "유상증자·자본 확충", stage: "의사결정", reportName: "유상증자결정" };
  const insight = buildContextInsight(context, { press_release: [], domestic: [], foreign: [] });
  assert.equal(insight.basis, "disclosure");
  assert.match(insight.text, /^공시만 놓고 보면/);
  assert.match(insight.text, /배정 대상/);
});

test("사건별 근거 선별은 회사 이름만 같은 자료를 제외한다", () => {
  const rows = relevantEvidence([
    { title: "홈플러스 신상품 출시" },
    { title: "홈플러스 회생절차 개시" },
  ], { eventLabel: "회생·법적 위험" });
  assert.deepEqual(rows.map((row) => row.title), ["홈플러스 회생절차 개시"]);
});
