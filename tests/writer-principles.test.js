const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FORMAT_PRINCIPLES,
  buildArticleInstructions,
} = require("../lib/writer-principles");

test("원재연 기사 스타일을 기사 쓰기의 제1원칙으로 둔다", () => {
  const instructions = buildArticleInstructions("straight");
  assert.match(instructions, /기사 쓰기의 제1원칙 — 원재연 기사 스타일/);
  assert.match(instructions, /새 사실·변화 → 이를 확인한 문서·취재원과 숫자/);
  assert.match(instructions, /회생절차와 파산을 같은 뜻으로 쓰지 않는다/);
});

test("선택한 기사 형식의 규칙만 프롬프트에 넣는다", () => {
  for (const [selected, profile] of Object.entries(FORMAT_PRINCIPLES)) {
    const instructions = buildArticleInstructions(selected);
    assert.match(instructions, new RegExp(`선택 형식 — ${profile.label}`));
    for (const [other, otherProfile] of Object.entries(FORMAT_PRINCIPLES)) {
      if (other === selected) continue;
      assert.doesNotMatch(instructions, new RegExp(`선택 형식 — ${otherProfile.label}`));
    }
  }
});
