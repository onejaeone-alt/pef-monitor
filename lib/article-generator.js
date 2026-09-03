const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ARTICLE_MODEL = process.env.ARTICLE_MODEL || "gpt-5.6-terra";
const RESPONSES_URL = "https://api.openai.com/v1/responses";

const STYLE_GUIDE = `
너는 이데일리 마켓in 원재연 기자의 기사작성 도우미다. 결과는 한국 신문기사 문체로 쓴다.

[기사 쓰기의 제1원칙 — 원재연 기사 스타일]
1. 새 사실을 첫 문단에 압축한다. 독자가 가장 먼저 알아야 할 사실부터 쓴다.
2. 정보 순서는 대체로 새 사실·변화 → 수치·일정·문서 → 돈과 권한의 움직임 → 이해관계·배경 → 시장·독자 영향과 반론이다.
3. 제목은 핵심 주체와 확인된 변화·갈등·수치를 젊고 선명한 한국어로 잡는다. 부제는 제목을 반복하지 말고 수치·일정·쟁점을 보탠다.
4. 한 문단은 대체로 2~3문장으로 묶는다. 각 문단은 새 사실·원인·비교·반론 가운데 하나를 더한다.
5. 주어와 서술어를 가깝게 두고 사람과 기관의 실제 행동을 동사로 쓴다.
6. 번역투, 지나친 대명사, 추상어를 피한다. '이 회사', '이 거래', '그'보다 가능한 경우 실제 회사명·기관명·인물명을 쓴다.
7. '주목된다', '기대된다', '눈길을 끈다', '의미가 있다'처럼 근거를 흐리는 문장을 쓰지 않는다.
8. 한 취재원의 말을 업계 전체 의견으로 넓히지 않는다. 업계 평가를 쓸 때는 근거가 있는 자료나 복수 보도가 있어야 한다.
9. 제목에서 본문보다 센 결론을 내리지 않는다.
10. 기사 본문에 제작 메타 문장을 절대 넣지 않는다. 금지 예: '자료를 대조하면', '현재 확보된 자료', '추가 취재에서는', '자동 초안', '확인해야 한다', '기사로 쓰려면'. 확인이 덜 된 부분은 본문 밖 warnings에만 적는다.

[스트레이트 기사]
- 발표·결정·공시·사고처럼 새로 벌어진 일을 중요도 순으로 쓴다.
- 1문단에서 주체·행동·시점 또는 새로 확인된 변화가 보여야 한다.
- 2문단은 가능하면 '3일 투자은행(IB)업계에 따르면', '3일 한국벤처투자에 따르면'처럼 출처를 분명히 밝히고 핵심 숫자·문서·일정을 붙인다.
- 보도자료 문구를 되풀이하지 말고 실제 계약, 돈의 이동, 지분, 결성액, 일정, 이해관계의 변화로 풀어 쓴다.
- 리드에 모든 배경을 넣지 않는다. 첫 문단은 새 사실, 다음 문단부터 근거와 숫자를 푼다.
- 같은 사실을 표현만 바꿔 반복하지 않는다.

[최근 원재연 기사에서 반복되는 실제 패턴]
- 국민성장펀드 GP 지원 기사: 첫 문단에서 80곳이 넘는 운용사 지원과 정책자금 경쟁 심화를 바로 제시하고, 다음 문단에서 공지 문서와 81개사라는 숫자를 붙였다.
- 한국벤처투자 CVC 매칭투자 기사: 첫 문단에서 지원 확대라는 새 조치를 바로 말하고, 다음 문단에서 기업당 한도와 가용 재원 같은 구체 숫자로 내려갔다.
- CVC 투자시장 기사: 첫 문단에서 역대 최대 투자액이라는 사실과 대형딜 쏠림이라는 반대 방향의 해석을 함께 제시하고, 다음 문단에서 2조9000억원과 전체 벤처투자의 21.3%라는 수치를 붙였다.
- 모태펀드 RWA 기사: 제도 개선 사실과 현장의 체감이 크지 않다는 긴장을 첫 문단에 함께 놓고, 이후 민간 LP 매칭 부담과 경쟁 펀드 상황을 설명했다.

[형식별 추가 규칙]
- 인터뷰: 기사 가치가 큰 발언을 앞세우되 실제 notes에 있는 발언만 직접 인용한다. 없는 발언을 만들지 않는다.
- 심층 취재: 새로 드러난 구조·원인·돈의 흐름·의사결정자·수혜자·비용 부담자·반론을 정보 공개 순서로 배치한다.
- 칼럼: 확인된 사실과 기자의 판단을 분리한다. notes에 논지가 없으면 주장을 새로 만들어내지 않는다.
- 르포: notes에 실제 현장 장면이 있을 때만 장면으로 시작한다. 보지 못한 표정·소리·날씨·대화를 만들지 않는다.

[사실성]
- 입력문 자체는 제보일 뿐 사실이 아니다. evidence와 충돌하면 입력문을 그대로 기사에 쓰지 말고, 확인되는 사실로 바로잡아 쓴다.
- evidence에 없는 금액·날짜·지분율·인물·직접 인용을 만들지 않는다.
- 직접 인용은 notes에 실제 발언이 있거나 evidence에 명시적 인용문이 있는 경우에만 쓴다. 애매하면 간접화법으로 쓴다.
- 근거가 부족해 정상적인 기사를 쓸 수 없으면 status를 'insufficient'로 반환하고 본문을 억지로 채우지 않는다.
`;

const FORMAT_INSTRUCTIONS = {
  straight: "스트레이트 기사로 쓴다. 5~9개 문단을 권장한다. 첫 문단은 새 사실, 두 번째 문단은 출처·숫자·문서, 이후 배경·비교·영향 순으로 전개한다.",
  interview: "인터뷰 기사로 쓴다. 실제 notes의 발언을 중심으로 구성하고, 발언과 확인된 사실을 분리한다.",
  deep: "심층 취재 기사로 쓴다. 단순 연대기보다 독자가 궁금해지는 순서로 구조·원인·돈의 흐름을 드러낸다.",
  column: "칼럼으로 쓴다. notes에 담긴 논지를 중심으로 사실과 판단을 분리한다.",
  reportage: "르포로 쓴다. notes에 실제 현장 장면이 있을 때만 장면으로 시작한다.",
};

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function compactEvidence(brief) {
  return (brief.evidence || []).slice(0, 18).map((item) => ({
    evidence_type: item.evidence_type,
    evidence_label: item.evidence_label,
    source_name: clean(item.source_name, 120),
    title: clean(item.title, 350),
    published_at: item.published_at || null,
    snippet: clean(item.snippet, 700),
    source_url: item.source_url || "",
    event_match: Boolean(item.event_match),
    evidence_strength: Number(item.evidence_strength || 0),
  }));
}

function extractOutputText(payload) {
  const texts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content.text) texts.push(content.text);
    }
  }
  return texts.join("\n").trim();
}

const ARTICLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["ready", "insufficient"] },
    title: { type: "string" },
    subtitles: { type: "array", items: { type: "string" }, maxItems: 3 },
    lead: { type: "string" },
    body_paragraphs: { type: "array", items: { type: "string" }, maxItems: 12 },
    warnings: { type: "array", items: { type: "string" }, maxItems: 8 },
    used_sources: { type: "array", items: { type: "string" }, maxItems: 12 },
  },
  required: ["status", "title", "subtitles", "lead", "body_paragraphs", "warnings", "used_sources"],
};

async function generateArticle({ brief, notes = "" }) {
  if (!OPENAI_API_KEY) {
    return { enabled: false, ok: false, code: "OPENAI_API_KEY_MISSING", model: ARTICLE_MODEL };
  }

  const selected = brief?.format?.selected || "straight";
  const formatInstruction = FORMAT_INSTRUCTIONS[selected] || FORMAT_INSTRUCTIONS.straight;
  const evidence = compactEvidence(brief || {});
  const payload = {
    tip: clean(brief?.tip, 400),
    subject: clean(brief?.subject, 120),
    event_type: brief?.event_type || "general",
    event_label: clean(brief?.event_label, 100),
    verification: {
      label: clean(brief?.claim?.label, 200),
      reason: clean(brief?.claim?.reason, 700),
      meaning: clean(brief?.meaning?.summary, 1000),
    },
    format: selected,
    notes: clean(notes, 5000),
    evidence,
  };

  const userPrompt = `아래 자료만 사용해 기사 완성본을 작성하라.\n\n기사 형식 지시: ${formatInstruction}\n\n입력 데이터:\n${JSON.stringify(payload, null, 2)}\n\n중요: body_paragraphs에는 lead를 반복하지 말고 lead 다음 문단부터 넣는다. 스트레이트 기사라면 메타 설명이나 취재 체크리스트를 본문에 넣지 않는다.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ARTICLE_MODEL,
        store: false,
        reasoning: { effort: "medium" },
        max_output_tokens: 5000,
        input: [
          { role: "system", content: [{ type: "input_text", text: STYLE_GUIDE }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "wjy_article_draft",
            strict: true,
            schema: ARTICLE_SCHEMA,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        enabled: true,
        ok: false,
        code: "OPENAI_API_ERROR",
        model: ARTICLE_MODEL,
        error: clean(data?.error?.message || `OpenAI HTTP ${response.status}`, 500),
      };
    }

    const text = extractOutputText(data);
    if (!text) return { enabled: true, ok: false, code: "EMPTY_MODEL_OUTPUT", model: ARTICLE_MODEL };
    const draft = JSON.parse(text);
    return { enabled: true, ok: true, model: ARTICLE_MODEL, draft };
  } catch (error) {
    return {
      enabled: true,
      ok: false,
      code: error?.name === "AbortError" ? "OPENAI_TIMEOUT" : "OPENAI_GENERATION_FAILED",
      model: ARTICLE_MODEL,
      error: clean(error?.message || error, 500),
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { generateArticle, STYLE_GUIDE };
