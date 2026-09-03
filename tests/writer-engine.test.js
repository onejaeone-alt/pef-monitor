const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildWriterBrief,
  classifyTip,
  filterRelevantMaterials,
  normalizeDisclosure,
  subjectFromTip,
} = require("../lib/writer-engine");

test("한 줄 제보에서 감시 대상과 사건을 찾는다", () => {
  assert.equal(subjectFromTip("홈플러스가 파산했다"), "홈플러스");
  assert.equal(classifyTip("홈플러스가 파산했다"), "distress");
  assert.equal(classifyTip("A사가 회사채 500억원을 차환한다"), "financing");
});

test("취재 대상과 무관한 자료는 근거 묶음에서 뺀다", () => {
  const materials = [
    { source_url: "https://example.com/a", title: "홈플러스 회생절차 개시", source_name: "법원" },
    { source_url: "https://example.com/b", title: "롯데쇼핑 실적 발표", source_name: "언론사" },
  ];
  const result = filterRelevantMaterials(materials, "홈플러스");
  assert.equal(result.length, 1);
  assert.match(result[0].title, /홈플러스/);
});

test("뉴스만으로는 입력문을 사실로 승격하지 않는다", () => {
  const brief = buildWriterBrief({
    tip: "홈플러스가 파산했다",
    subject: "홈플러스",
    materials: [{
      source_type: "domestic_news",
      source_name: "경제신문",
      title: "홈플러스 회생절차 돌입",
      source_url: "https://example.com/news",
      published_at: "2026-09-03",
      event_type: "distress",
    }],
  });
  assert.equal(brief.claim.status, "입력·미확인");
  assert.equal(brief.claim.level, "reported_only");
  assert.equal(brief.format.ready, false);
  assert.match(brief.title_ideas[0], /보도|사실|확인/);
});

test("관련 DART가 있어도 제보 문장 자체는 미확인으로 남긴다", () => {
  const disclosure = normalizeDisclosure({
    rcept_no: "20260903000001",
    corp_name: "홈플러스",
    report_nm: "회생절차개시결정",
    receipt_date: "2026-09-03",
    dart_url: "https://dart.fss.or.kr/example",
  });
  const brief = buildWriterBrief({
    tip: "홈플러스가 파산했다",
    subject: "홈플러스",
    materials: [disclosure],
  });
  assert.equal(brief.claim.status, "입력·미확인");
  assert.equal(brief.claim.level, "official_related");
  assert.equal(brief.counts.disclosure, 1);
  assert.match(brief.meaning.summary, /파산 선고.*아니라.*회생절차/);
});

test("인터뷰와 르포는 녹취·현장 메모 없이 준비 완료가 되지 않는다", () => {
  const material = {
    source_type: "disclosure",
    source_name: "DART",
    title: "홈플러스 회생절차개시결정",
    source_url: "https://dart.fss.or.kr/example",
    event_type: "distress",
  };
  const interview = buildWriterBrief({ tip: "홈플러스가 회생절차에 들어갔다", subject: "홈플러스", format: "interview", materials: [material] });
  const reportage = buildWriterBrief({ tip: "홈플러스가 회생절차에 들어갔다", subject: "홈플러스", format: "reportage", materials: [material] });
  assert.equal(interview.format.ready, false);
  assert.match(interview.format.missing.join(" "), /녹취/);
  assert.equal(reportage.format.ready, false);
  assert.match(reportage.format.missing.join(" "), /현장 메모/);
});

test("충분한 인터뷰 녹취가 있으면 인터뷰 구조를 열어준다", () => {
  const notes = "인터뷰 문답 Q: 회생절차를 왜 신청했습니까? A: 단기 유동성보다 채무구조 조정이 필요했습니다. 질문: 영업을 계속합니까? 답변: 법원 허가 아래 점포 운영은 계속합니다. 관계자는 이렇게 말했다고 확인했다.";
  const brief = buildWriterBrief({
    tip: "홈플러스가 회생절차를 신청했다",
    subject: "홈플러스",
    format: "interview",
    notes,
    materials: [],
  });
  assert.equal(brief.format.ready, true);
  assert.equal(brief.outline.format, "interview");
});
