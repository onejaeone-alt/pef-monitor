const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildArticlePayload,
  buildArticleSchema,
  buildOpenAIRequest,
  normalizeDraft,
} = require("../lib/article-generator");
const {
  FORMAT_PRINCIPLES,
  PRINCIPLES_VERSION,
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

test("취재 자료에는 추적 가능한 S번호와 원칙 버전을 붙인다", () => {
  const payload = buildArticlePayload({
    brief: {
      tip: "홈플러스가 회생절차에 들어갔다",
      subject: "홈플러스",
      event_type: "distress",
      event_label: "회생·재무위험",
      claim: { label: "관련 원문 있음", reason: "법원 결정문 대조 필요" },
      meaning: { summary: "회생절차와 파산은 다르다" },
      format: { selected: "straight", ready: true, missing: [] },
      evidence: [{ source_name: "법원", title: "회생절차 개시 결정", source_url: "https://example.com/1", event_match: true, evidence_strength: 4 }],
      reporting_questions: ["법원 결정 시점은 언제인가"],
    },
    notes: "법원 결정문을 확인했다.",
  });
  assert.equal(payload.principles_version, PRINCIPLES_VERSION);
  assert.equal(payload.evidence[0].source_id, "S1");
  assert.equal(payload.format, "straight");
});

test("출력 형식과 선택한 기사 모드를 구조적으로 고정한다", () => {
  const schema = buildArticleSchema("reportage");
  assert.deepEqual(schema.properties.format.enum, ["reportage"]);
  assert.ok(schema.required.includes("source_map"));
  assert.ok(schema.required.includes("missing_reporting"));
});

test("취재 메모를 저장하지 않는 Responses 요청을 만든다", () => {
  const request = buildOpenAIRequest({ selected: "column", instructions: "원칙", userPrompt: "자료" });
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.deepEqual(request.text.format.schema.properties.format.enum, ["column"]);
});

test("실제로 수집하지 않은 출처 번호는 모델 결과에서 제거한다", () => {
  const draft = normalizeDraft({
    status: "ready",
    format: "straight",
    title: "제목",
    subtitles: [],
    lead: "확인된 사실을 담은 리드입니다.",
    body_paragraphs: ["확인된 사실을 담은 본문입니다."],
    warnings: [],
    missing_reporting: [],
    used_source_ids: ["S1", "S99"],
    source_map: [{ sentence: "확인된 문장", source_ids: ["S1", "S99"], basis: "법원 결정문" }],
  }, {
    format: "straight",
    notes: "",
    evidence: [{ source_id: "S1" }],
  });
  assert.deepEqual(draft.used_source_ids, ["S1"]);
  assert.deepEqual(draft.source_map[0].source_ids, ["S1"]);
  assert.match(draft.warnings.join(" "), /없는 출처 번호/);
});

test("기사 재료가 없으면 완성본을 내보내지 않는다", () => {
  const draft = normalizeDraft({
    status: "ready",
    format: "straight",
    title: "제목",
    subtitles: [],
    lead: "리드 문장입니다.",
    body_paragraphs: ["본문 문장입니다."],
    warnings: [],
    missing_reporting: [],
    used_source_ids: [],
    source_map: [],
  }, { format: "straight", notes: "", evidence: [] });
  assert.equal(draft.status, "insufficient");
  assert.equal(draft.title, "");
});
