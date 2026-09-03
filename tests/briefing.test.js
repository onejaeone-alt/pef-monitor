const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBriefing, weeklyStart } = require("../lib/briefing");

function lead(id, score, grade, eventType = "investment") {
  return {
    signal_id: id,
    story_score: score,
    alert_grade: grade,
    event_type: eventType,
    source_type: "domestic_news",
    published_at: "2026-09-02T00:00:00Z",
    interpretation: `${id} 해석`,
  };
}

test("일간 브리핑은 P1·P2를 먼저 놓고 P3로 채운다", () => {
  const briefing = buildBriefing([
    lead("p3", 65, "P3"),
    lead("p2", 80, "P2", "deal_process"),
    lead("p1", 95, "P1", "distress"),
  ], "daily", new Date("2026-09-02T23:00:00Z"));
  assert.equal(briefing.period_start, "2026-09-03");
  assert.deepEqual(briefing.items.map((item) => item.signal_id), ["p1", "p2", "p3"]);
  assert.equal(briefing.stats.urgent, 2);
  assert.match(briefing.summary, /즉시·당일 확인 대상은 2건/);
});

test("주간 브리핑 기간은 한국시간 월요일부터 잡는다", () => {
  assert.equal(weeklyStart(new Date("2026-09-03T00:00:00Z")), "2026-08-31");
  const briefing = buildBriefing([lead("weekly", 70, "P2")], "weekly", new Date("2026-09-03T00:00:00Z"));
  assert.equal(briefing.period_start, "2026-08-31");
  assert.equal(briefing.period_end, "2026-09-03");
  assert.match(briefing.title, /주간 기사 후보/);
});
