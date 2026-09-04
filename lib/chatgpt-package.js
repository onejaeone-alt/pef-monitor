const FORMAT_LABELS = {
  auto: "자동 추천",
  straight: "스트레이트",
  interview: "인터뷰",
  deep: "심층취재",
  column: "칼럼",
  reportage: "르포",
};

function clean(value, max = 1200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sourceLine(item, index) {
  const date = item.published_at ? String(item.published_at).slice(0, 10) : "날짜 미상";
  const type = item.evidence_label || item.evidence_type || item.source_type || "자료";
  const title = clean(item.title, 350);
  const snippet = clean(item.snippet, 500);
  const url = item.source_url || "";
  const match = item.event_match ? "같은 사건" : "관련 참고";
  return [
    `${index + 1}. [${type}·${match}] ${date} | ${clean(item.source_name, 100)} | ${title}`,
    snippet ? `   핵심: ${snippet}` : "",
    url ? `   원문: ${url}` : "",
  ].filter(Boolean).join("\n");
}

function dossierLines(dossier) {
  if (!dossier) return ["- 최근 관계 자료 없음"];
  const rows = [];
  for (const item of (dossier.relations || []).slice(0, 8)) {
    rows.push(`- ${clean(item.relation_label || item.relation_type, 80)} → ${clean(item.counterpart_name, 120)}${item.basis ? ` | 확인된 사실: ${clean(item.basis, 220)}` : ""}${item.follow_up_question ? ` | 다음 확인: ${clean(item.follow_up_question, 220)}` : ""}`);
  }
  for (const item of (dossier.deals || []).slice(0, 5)) {
    rows.push(`- 관련 거래: ${clean(item.deal_name, 160)}${item.current_stage ? ` | 단계: ${clean(item.current_stage, 80)}` : ""}`);
  }
  return rows.length ? rows : ["- 최근 관계 자료 없음"];
}

function styleRules(format) {
  const common = [
    "원재연 기자의 한국어 기사 문체로 작성한다.",
    "기사와 책 문체를 섞지 않는다. 번역투와 지나친 대명사를 피한다.",
    "제목은 핵심 주체와 확인된 변화·갈등·수치를 잡고, 부제는 제목에 없는 수치·일정·영향을 보탠다.",
    "한 문단은 대체로 2~3문장. 각 문단마다 새 사실·수치·원인·비교·반론 중 하나를 더한다.",
    "'주목된다', '기대된다' 같은 근거 없는 문장을 쓰지 않는다.",
    "입력문은 제보일 뿐이다. 아래 근거와 충돌하면 근거 기준으로 바로잡는다.",
    "아래 자료에 없는 금액·날짜·인물·지분율·직접 인용은 만들지 않는다.",
  ];
  const byFormat = {
    straight: [
      "스트레이트 기사다. 첫 문단에서 주체·행동·시점·핵심 결과를 밝힌다.",
      "두 번째 문단부터 수치·조건·문서·일정을 놓고, 이후 배경·영향·반론 순으로 내려간다.",
      "독자가 첫 두 문단만 읽어도 무슨 일이 벌어졌는지 알 수 있어야 한다.",
      "수사적 반전이나 칼럼식 결말을 쓰지 않는다.",
    ],
    interview: [
      "인터뷰 기사다. 실제 취재 메모에 있는 발언만 인용한다.",
      "가장 기사 가치가 큰 발언을 앞세우고 문답 순서를 그대로 옮기지 않는다.",
    ],
    deep: [
      "심층취재 기사다. 가장 강한 사례 → 추가 사례 → 통계·문서 → 작동 원리 → 이해관계 → 반론·한계 순으로 전개한다.",
      "독자가 이미 아는 현상보다 새로 드러난 구조와 원인을 보여준다.",
    ],
    column: [
      "칼럼이다. 취재 메모에 적힌 논지를 중심으로 사실과 기자 판단을 분리한다.",
      "자료가 감당하는 만큼만 단정한다.",
    ],
    reportage: [
      "르포다. 취재 메모에 실제 현장 장면이 있을 때만 장면으로 시작한다.",
      "직접 보지 못한 표정·소리·대화·날씨를 만들지 않는다.",
    ],
  };
  return [...common, ...(byFormat[format] || byFormat.straight)];
}

function buildChatGptPackage({ brief, notes = "" }) {
  const selected = brief?.format?.selected || "straight";
  const formatLabel = FORMAT_LABELS[selected] || FORMAT_LABELS.straight;
  const evidence = (brief?.evidence || []).slice(0, 20);
  const questions = (brief?.reporting_questions || []).slice(0, 8);
  const warnings = [...new Set([...(brief?.format?.missing || []), brief?.claim?.reason].filter(Boolean))].slice(0, 8);
  const rules = styleRules(selected);

  const prompt = [
    "아래 취재 패키지를 바탕으로 기사를 작성해줘.",
    "",
    `[기사 형식] ${formatLabel}`,
    "",
    "[원재연 기사 작성 원칙]",
    ...rules.map((rule) => `- ${rule}`),
    "",
    `[취재 아이디어] ${clean(brief?.tip, 400)}`,
    `[취재 대상] ${clean(brief?.subject, 160)}`,
    `[사건 분류] ${clean(brief?.event_label, 120)}`,
    `[현재 확인 상태] ${clean(brief?.claim?.label, 220)}`,
    `[현재 해석] ${clean(brief?.meaning?.summary, 1200)}`,
    "",
    notes ? `[내 취재 메모]\n${String(notes).trim().slice(0, 5000)}` : "[내 취재 메모]\n없음",
    "",
    "[근거 자료]",
    ...(evidence.length ? evidence.map(sourceLine) : ["- 관련 근거 자료 없음"]),
    "",
    "[최근 관계·거래]",
    ...dossierLines(brief?.dossier),
    "",
    "[추가 확인 질문]",
    ...(questions.length ? questions.map((q, i) => `${i + 1}. ${clean(q, 350)}`) : ["- 없음"]),
    "",
    "[주의할 빈칸]",
    ...(warnings.length ? warnings.map((w) => `- ${clean(w, 500)}`) : ["- 별도 경고 없음"]),
    "",
    "[출력 요청]",
    "1. 제목",
    "2. 부제 2~3줄",
    "3. 기사 본문 완성본",
    "4. 기사 밖에 별도로 '마감 전 확인사항'이 있으면 짧게 정리",
    "기사 본문 안에는 '자료를 대조하면', '추가 취재에서는', '자동 초안' 같은 제작 메타 문장을 넣지 마.",
  ].join("\n");

  return {
    format: selected,
    format_label: formatLabel,
    prompt,
    stats: {
      evidence: evidence.length,
      matching_event: evidence.filter((item) => item.event_match).length,
      questions: questions.length,
      relations: Number(brief?.dossier?.stats?.relations || 0),
    },
    warnings,
  };
}

module.exports = { buildChatGptPackage };
