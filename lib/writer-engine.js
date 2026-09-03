const { classifyEvent } = require("./reporting-signals");
const { WATCH_TARGETS, findWatchTarget } = require("./watch-config");

const EVENT_LABELS = {
  capital_call: "출자공고",
  selection_result: "운용사 선정",
  distress: "회생·재무위험",
  deal_process: "M&A 절차",
  fund_formation: "펀드 결성",
  exit: "회수",
  people_move: "핵심 인사",
  investment: "투자",
  financing: "자금조달",
  general: "새 사건",
};

const FORMAT_LABELS = {
  auto: "자동 추천",
  straight: "스트레이트",
  interview: "인터뷰",
  deep: "심층 취재",
  column: "칼럼",
  reportage: "르포",
};

function normalizeText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function unique(items, keyFor = (item) => item) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function subjectFromTip(tip) {
  const text = normalizeText(tip).replace(/^["'“‘「『\[]+|["'”’」』\]]+$/g, "");
  const watched = findWatchTarget(text, WATCH_TARGETS);
  if (watched) return watched.name;

  const particle = text.match(/^(.{2,60}?)(?:은|는|이|가|을|를|의|에서|에게)\s*(?=(?:파산|회생|워크아웃|매각|인수|투자|유치|합병|분할|상장|퇴사|영입|선임|사임|펀드|회사채|유상증자|전환사채|최대주주|공개매수))/);
  if (particle) return particle[1].trim();

  const eventStart = text.search(/\s+(?:파산|회생|워크아웃|매각|인수|투자|유치|합병|분할|상장|퇴사|영입|선임|사임|펀드|회사채|유상증자|전환사채|최대주주|공개매수)/);
  if (eventStart >= 2) return text.slice(0, eventStart).replace(/(?:은|는|이|가|을|를|의|에서|에게)$/g, "").trim();

  return text.split(/[,.!?·:]/)[0].split(/\s+/).slice(0, 3).join(" ").replace(/(?:은|는|이|가|을|를)$/g, "").trim();
}

function classifyTip(tip) {
  const text = normalizeText(tip);
  if (/(회사채|전환사채|교환사채|신주인수권부사채|차입|대출|리파이낸싱|차환|증자|자금조달)/.test(text)) return "financing";
  return classifyEvent(text);
}

function sourceEvent(item) {
  if (item.event_type && item.event_type !== "general") return item.event_type;
  return classifyTip(`${item.title || ""} ${item.snippet || ""} ${item.event_type || ""}`);
}

function sourceClass(item) {
  const type = String(item.source_type || item.category || "");
  if (type === "disclosure") return { key: "disclosure", label: "DART 원문", strength: 4 };
  if (["capital_call", "selection_result", "official_notice"].includes(type)) return { key: "official", label: "공식 공고", strength: 4 };
  if (type === "press_release") return { key: "press_release", label: "당사자 발표", strength: 3 };
  if (type === "foreign" || type === "foreign_news") return { key: "foreign_news", label: "외신 보도", strength: 2 };
  return { key: "domestic_news", label: "국내 보도", strength: 2 };
}

function targetTerms(subject, target) {
  return unique([subject, target?.name, ...(target?.aliases || [])]
    .map(matchText)
    .filter((term) => term.length >= 2));
}

function materialText(item) {
  return matchText(`${item.title || ""} ${item.snippet || ""} ${item.corp_name || ""} ${item.filer_name || ""} ${item.subject_name || ""} ${item.target?.name || ""}`);
}

function filterRelevantMaterials(items, subject, target = null) {
  const terms = targetTerms(subject, target);
  if (!terms.length) return [];
  return unique((items || []).filter((item) => {
    const haystack = materialText(item);
    return terms.some((term) => haystack.includes(term));
  }), (item) => String(item.source_url || item.rcept_no || item.title || "").replace(/[?#].*$/, ""));
}

function normalizeDisclosure(row) {
  const title = [row.corp_name, row.report_nm].filter(Boolean).join(", ");
  return {
    source_type: "disclosure",
    category: "disclosure",
    source_name: "DART",
    title,
    source_url: row.dart_url || (row.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${row.rcept_no}` : ""),
    published_at: row.receipt_date || null,
    snippet: normalizeText(row.raw_data?.analysis?.new_fact || row.raw_data?.analysis?.why || ""),
    event_type: row.event_type && row.event_type !== "PEF·VC 관련 공시" ? classifyTip(`${row.report_nm || ""} ${row.event_type}`) : classifyTip(row.report_nm),
    rcept_no: row.rcept_no || null,
    corp_name: row.corp_name || "",
    filer_name: row.filer_name || "",
  };
}

function normalizeLead(item) {
  return {
    source_type: item.source_type || item.category || "domestic_news",
    category: item.category || item.source_type || "domestic",
    source_name: item.source_name || "출처 미상",
    title: normalizeText(item.title),
    source_url: item.source_url || "",
    published_at: item.published_at || item.occurred_at || null,
    snippet: normalizeText(item.snippet || item.interpretation || ""),
    event_type: item.event_type || classifyTip(item.title),
    subject_name: item.subject_name || "",
    target: item.target || null,
  };
}

function eventMatches(tipEvent, item) {
  const materialEvent = sourceEvent(item);
  if (tipEvent === "general") return true;
  if (materialEvent === tipEvent) return true;
  if (tipEvent === "financing" && ["investment", "deal_process"].includes(materialEvent)) return /회사채|사채|차입|대출|증자|조달|차환/.test(`${item.title} ${item.snippet || ""}`);
  return false;
}

function evidenceCard(item, tipEvent) {
  const kind = sourceClass(item);
  return {
    ...item,
    evidence_type: kind.key,
    evidence_label: kind.label,
    evidence_strength: kind.strength,
    event_match: eventMatches(tipEvent, item),
  };
}

function verificationSummary(tip, tipEvent, evidence) {
  const eventEvidence = evidence.filter((item) => item.event_match);
  const originals = eventEvidence.filter((item) => item.evidence_strength >= 4);
  const partyStatements = eventEvidence.filter((item) => item.evidence_type === "press_release");
  const reports = eventEvidence.filter((item) => item.evidence_strength === 2);

  if (originals.length) return {
    level: "official_related",
    label: "관련 원문 있음·문장 자체는 미확인",
    reason: `같은 ${EVENT_LABELS[tipEvent]} 사건을 다룬 원문 ${originals.length}건을 찾았습니다. 다만 ‘${tip}’의 표현과 범위가 원문과 정확히 같은지는 직접 대조해야 합니다.`,
  };
  if (partyStatements.length) return {
    level: "party_statement",
    label: "당사자 발표 있음·교차 확인 필요",
    reason: `같은 사건을 다룬 당사자 발표 ${partyStatements.length}건을 찾았습니다. 상대방·감독기관·공시 원문으로 한 번 더 확인해야 합니다.`,
  };
  if (reports.length) return {
    level: "reported_only",
    label: "관련 보도 있음·당사자 확인 필요",
    reason: `같은 사건으로 분류되는 보도 ${reports.length}건을 찾았지만 이를 확정하는 원문은 아직 묶이지 않았습니다.`,
  };
  return {
    level: "unverified",
    label: "미확인",
    reason: "입력한 문장을 뒷받침하는 같은 사건의 원문이나 보도를 아직 찾지 못했습니다.",
  };
}

function questionsFor(eventType, subject) {
  const map = {
    distress: [
      "파산 선고인가, 회생절차 신청·개시인가, 워크아웃인가",
      "법원 사건번호와 신청·개시·결정 시점은 언제인가",
      "담보권자·주요 채권자와 채무액은 얼마인가",
      "대주주가 추가 자금 지원 또는 채무 인수를 약속했는가",
      "영업·고용·납품대금과 진행 중인 매각 절차에는 어떤 영향이 생겼는가",
    ],
    deal_process: [
      "현재 단계는 검토·티저·예비입찰·본입찰·우협·SPA 가운데 어디인가",
      "매도자와 원매자, 매각주관사는 누구인가",
      "대상 지분과 희망가격, 실제 제시가격은 얼마인가",
      "인수금융 확약과 기업결합 심사 등 선행조건을 충족했는가",
      "기존 보도나 공시보다 상대방·금액·일정이 무엇이 달라졌는가",
    ],
    capital_call: [
      "총 출자액과 전략별 배정액은 얼마인가",
      "선정할 GP 수와 GP당 최소·최대 출자액은 얼마인가",
      "접수·숏리스트·최종 선정 일정은 언제인가",
      "최소 결성액과 결성 시한, 재출자 제한은 무엇인가",
      "직전 출자사업과 달라진 조건은 무엇인가",
    ],
    selection_result: [
      "선정 GP와 탈락 GP는 각각 어디인가",
      "GP별 실제 배정액은 얼마인가",
      "최종 결성 시한과 최소 결성 조건은 무엇인가",
      "다른 LP의 출자 확약과 민간 매칭액은 얼마인가",
      "이번 선정으로 새로 투자할 수 있는 드라이파우더는 얼마인가",
    ],
    fund_formation: [
      "목표액이 아니라 현재 확보한 실제 약정액은 얼마인가",
      "앵커 LP와 주요 출자자는 누구인가",
      "1차·최종 클로징 시점은 언제인가",
      "투자기간·존속기간과 주력 투자 분야는 무엇인가",
      "선행 투자와 남은 드라이파우더는 얼마인가",
    ],
    investment: [
      "투자금액과 투자 전·후 기업가치는 얼마인가",
      "신주와 구주 비중, 취득 지분율은 얼마인가",
      "리드·공동투자자와 기존 주주 가운데 누가 참여했는가",
      "자금 사용처와 다음 자금조달 시점은 언제인가",
      "우선주 조건과 투자자 보호조항은 무엇인가",
    ],
    exit: [
      "실제 회수액과 투자원가는 얼마인가",
      "매각 뒤 남는 지분과 보호예수 조건은 무엇인가",
      "MOIC와 IRR은 얼마인가",
      "매수자와 자금조달 구조는 어떻게 되는가",
      "해당 펀드의 만기와 LP 분배 일정은 언제인가",
    ],
    people_move: [
      "당사자의 새 직책과 합류·퇴사 시점은 언제인가",
      "기존에 맡았던 펀드와 진행 중인 거래는 무엇인가",
      "함께 이동하는 인력과 새 조직의 역할은 무엇인가",
      "키맨 조항이나 펀드 운용에는 어떤 영향이 있는가",
      "독립계 운용사 설립이나 신규 펀드 결성 계획이 있는가",
    ],
    financing: [
      "조달금액과 금리·만기·상환 조건은 무엇인가",
      "조달 목적과 실제 자금 사용처는 무엇인가",
      "담보·보증·재무약정과 조기상환 조건은 무엇인가",
      "기존 차입금보다 비용과 만기가 어떻게 달라졌는가",
      "차환 실패나 유동성 위험이 현실화할 시점은 언제인가",
    ],
    general: [
      "누가 언제 무엇을 결정했는가",
      "이를 확인하는 원문·계약·공고는 무엇인가",
      "금액·지분·일정 가운데 새로 확인된 숫자는 무엇인가",
      "이해관계자들의 설명이 엇갈리는 지점은 무엇인가",
      "기존 기사와 비교해 실제로 새로 생긴 사실은 무엇인가",
    ],
  };
  return (map[eventType] || map.general).map((question, index) => index === 0 && subject ? `${subject}: ${question}` : question);
}

function noteSignals(notes) {
  const text = normalizeText(notes);
  return {
    transcript: text.length >= 80 && /(문답|질문|답변|Q\s*[:.]|A\s*[:.]|인터뷰|말했다|밝혔다)/i.test(text),
    field: text.length >= 100 && /(현장|오전|오후|찾아가|방문|목격|주변|소리|표정|모습|취재원)/.test(text),
    thesis: text.length >= 50 && /(주장|논지|핵심은|문제는|봐야 한다|필요하다|때문이다|라고 본다)/.test(text),
  };
}

function recommendFormat(evidence, dossier) {
  const matching = evidence.filter((item) => item.event_match);
  const originals = matching.filter((item) => item.evidence_strength >= 4).length;
  const streams = new Set(matching.map((item) => item.evidence_type)).size;
  if (originals > 0) return "straight";
  if (matching.length >= 3 && (streams >= 2 || Number(dossier?.stats?.relations || 0) > 0)) return "deep";
  return "straight";
}

function formatReadiness(format, evidence, notes, dossier) {
  const matching = evidence.filter((item) => item.event_match);
  const originals = matching.filter((item) => item.evidence_strength >= 4);
  const streams = new Set(matching.map((item) => item.evidence_type));
  const signals = noteSignals(notes);
  const relationCount = Number(dossier?.stats?.relations || 0);
  const missing = [];

  if (format === "straight" && !originals.length) missing.push("사건을 확인하는 DART·법원·공식 공고 원문");
  if (format === "interview" && !signals.transcript) missing.push("실제 질문과 답변이 담긴 인터뷰 녹취");
  if (format === "deep" && matching.length < 3) missing.push("서로 대조할 관련 자료 3건 이상");
  if (format === "deep" && streams.size < 2 && relationCount === 0) missing.push("공시 외 독립된 취재원·자료 또는 기존 거래 관계");
  if (format === "column" && !signals.thesis) missing.push("사실과 구분되는 명확한 주장·논지 메모");
  if (format === "reportage" && !signals.field) missing.push("직접 본 장면·시간·장소·취재원이 담긴 현장 메모");

  return {
    ready: missing.length === 0,
    missing,
    message: missing.length ? `초안을 쓰기 전에 ${missing.join(", ")}이 필요합니다.` : `${FORMAT_LABELS[format]} 구조를 잡을 자료가 모였습니다.`,
  };
}

function outlineFor(format, subject, eventType, verification, evidence) {
  const label = EVENT_LABELS[eventType] || EVENT_LABELS.general;
  const best = evidence.find((item) => item.event_match && item.evidence_strength >= 4) || evidence.find((item) => item.event_match);
  const sourceLine = best ? `${best.source_name}의 ‘${best.title}’에서 확인할 사실` : "확보할 원문에서 확인할 사실";
  const common = {
    straight: [
      `리드: ${subject}의 ${label}에서 새로 확인된 사실·숫자·시점`,
      `근거: ${sourceLine}`,
      "2문단: 직전 상태와 비교해 달라진 점",
      "3문단: 거래 상대방·채권자·주주 등 이해관계자의 설명",
      "마지막: 남은 절차와 다음 확인 시점",
    ],
    interview: [
      "도입: 인터뷰 대상과 지금 이 사람에게 물어야 하는 이유",
      "핵심 문답 1: 새 사실을 확인하는 답변과 그대로 인용할 문장",
      "핵심 문답 2: 금액·일정·책임 소재를 묻는 후속 질문",
      `검증 문단: 답변을 ${sourceLine}과 대조`,
      "마지막: 독자가 기억할 답변과 아직 답하지 않은 쟁점",
    ],
    deep: [
      `문제 제기: ${subject}의 ${label}가 시장에 던지는 질문`,
      `확인된 사실: ${sourceLine}`,
      "타임라인: 최초 신호부터 현재까지 바뀐 상대방·금액·일정",
      "구조: 주주·채권자·GP·LP·자문사 사이의 이해관계",
      "반론·빈칸: 확인되지 않은 주장과 당사자별 설명",
      "결론: 다음 분기점과 그때 확인할 지표",
    ],
    column: [
      `논지: ${subject} 사례를 통해 주장할 한 문장`,
      "사실 1: 논지를 받치는 원문과 숫자",
      "사실 2: 반대 사례 또는 반론",
      "판단: 사실과 기자의 해석을 분리해 전개",
      "결론: 시장·정책·투자자에게 요구되는 변화",
    ],
    reportage: [
      "첫 장면: 직접 본 시간·장소·인물·행동",
      "확인: 장면에서 제기된 주장을 문서와 취재원으로 검증",
      "두 번째 장면: 이해관계가 다른 사람의 구체적 경험",
      `배경: ${sourceLine}`,
      "마지막 장면: 달라진 상황을 보여주는 관찰 가능한 사실",
    ],
  };
  return {
    format,
    format_label: FORMAT_LABELS[format],
    verification_note: verification.reason,
    sections: common[format] || common.straight,
  };
}

function titleIdeas(subject, eventType, verification) {
  const label = EVENT_LABELS[eventType] || EVENT_LABELS.general;
  if (verification.level === "official_related") return [
    `${subject} ${label} 원문 확인…달라진 숫자·일정은`,
    `${subject} 관련 원문 나왔다…거래 당사자와 남은 절차`,
    `${subject} ${label}, 공시와 기존 보도 대조해보니`,
  ];
  if (["party_statement", "reported_only"].includes(verification.level)) return [
    `‘${subject} ${label}’ 보도 잇따라…원문·당사자 확인은 아직`,
    `${subject}에 무슨 일이…관련 보도에서 확인된 것과 빈칸`,
    `${subject} ${label}설, 사실일까…먼저 확인할 세 가지`,
  ];
  return [
    `‘${subject} ${label}’ 사실일까…원문부터 확인`,
    `${subject} 관련 제보, 무엇을 확인해야 기사로 쓸 수 있나`,
    `${subject} ${label}설…공시·당사자 확인 전 단정은 금물`,
  ];
}

function meaningFromEvidence(subject, tip, eventType, verification, evidence) {
  const matching = evidence.filter((item) => item.event_match);
  const originals = matching.filter((item) => item.evidence_strength >= 4);
  const ordered = [...originals, ...matching.filter((item) => item.evidence_strength < 4)];
  const titles = unique(ordered.map((item) => item.title)).slice(0, 3);
  const titleText = titles.join(" ");

  if (!matching.length) return {
    summary: `${subject}에 관한 입력문을 확인할 같은 사건의 자료가 아직 없습니다. 지금 단계에서는 기사 문장이 아니라 확인할 제보로만 다뤄야 합니다.`,
    basis_titles: [],
  };
  if (eventType === "distress" && /파산/.test(tip) && /회생/.test(titleText) && !/파산/.test(titleText)) return {
    summary: `찾은 자료가 가리키는 것은 ‘파산 선고’가 아니라 ‘회생절차’입니다. 법원이 청산을 결정한 것인지, 채무를 조정해 영업을 계속하는 절차인지부터 구분해야 하므로 입력문의 ‘파산했다’는 표현은 그대로 기사에 쓸 수 없습니다.`,
    basis_titles: titles,
  };
  if (eventType === "distress") return {
    summary: `${subject}의 법원·채권단 절차 또는 유동성 위험을 다룬 자료가 잡혔습니다. 제목에 쓰인 ‘회생·워크아웃·파산’은 법적 상태가 서로 다르므로 사건번호와 결정문을 확인한 뒤 영업 지속 여부, 채권자 통제권, 매각 일정의 변화를 기사 핵심으로 잡아야 합니다.`,
    basis_titles: titles,
  };
  if (eventType === "deal_process" && /(기재정정|정정|변경)/.test(titleText)) return {
    summary: `새 경영권 거래를 처음 결정한 자료라기보다 기존 공개매수·주식양수도·매각 조건을 고친 후속 자료일 가능성이 큽니다. 정정 전후 가격·수량·기간·선행조건 가운데 실제로 바뀐 항목이 거래 종결 가능성을 높였는지가 기사거리입니다.`,
    basis_titles: titles,
  };
  if (eventType === "selection_result") return {
    summary: `출자사업이 모집 단계에서 실제 GP 선정 단계로 넘어간 자료입니다. 선정 명단만 옮기기보다 GP별 배정액, 탈락한 하우스, 결성 시한을 접수 현황과 대조해야 펀드레이징 승패와 새 투자 여력을 기사로 만들 수 있습니다.`,
    basis_titles: titles,
  };
  if (eventType === "capital_call") return {
    summary: `기관투자가의 돈이 어느 전략과 운용사군으로 움직일지 보여주는 출자 절차입니다. 총액뿐 아니라 GP 수, 최소 결성액, 재출자 제한, 마감일을 직전 공고와 비교해야 실제 수혜 후보를 가릴 수 있습니다.`,
    basis_titles: titles,
  };
  if (eventType === "fund_formation") return {
    summary: `${subject}의 새 투자 재원이 만들어지는 신호입니다. 기사에서는 홍보성 목표액과 실제 약정액을 구분하고, 앵커 LP와 1차 클로징 여부를 확인해야 실제 집행 가능한 자금 규모를 말할 수 있습니다.`,
    basis_titles: titles,
  };
  if (eventType === "investment") return {
    summary: `${subject} 관련 투자 자료가 여러 출처에서 확인됩니다. 발표된 투자금액만 옮기지 말고 신주·구주 비중, 투자 전후 기업가치, 공동투자자를 확인해야 누가 얼마를 넣고 기존 주주가 얼마나 회수했는지 설명할 수 있습니다.`,
    basis_titles: titles,
  };
  if (eventType === "exit") return {
    summary: `${subject}의 지분 처분·상장·회수 신호입니다. 거래금액이 곧 수익은 아니므로 투자원가, 잔여 지분, 펀드별 귀속액을 확인해야 실제 MOIC와 LP 분배 영향을 계산할 수 있습니다.`,
    basis_titles: titles,
  };
  if (eventType === "people_move") return {
    summary: `${subject} 관련 핵심 인력 변동이 포착됐습니다. 단순 인사기사보다 이 인물이 맡았던 펀드·LP·거래와 함께 이동한 팀을 확인해야 기존 조직의 공백과 새 하우스 설립 가능성을 기사로 만들 수 있습니다.`,
    basis_titles: titles,
  };
  if (eventType === "financing") return {
    summary: `${subject}의 자금조달 조건이 바뀌거나 새 차입이 생긴 신호입니다. 금액보다 기존 부채의 금리·만기와 비교해 조달비용이 높아졌는지, 차환이 유동성 시간을 얼마나 벌어줬는지가 핵심입니다.`,
    basis_titles: titles,
  };
  return {
    summary: `${verification.label} 상태입니다. 가장 가까운 자료인 ‘${titles[0]}’에서 입력문과 일치하는 주체·행위·시점·숫자를 먼저 표시한 뒤, 다른 출처와 충돌하는 대목을 확인해야 합니다.`,
    basis_titles: titles,
  };
}

function buildWriterBrief({ tip, format = "auto", notes = "", subject, target = null, materials = [], dossier = null }) {
  const cleanTip = normalizeText(tip);
  const cleanSubject = normalizeText(subject || subjectFromTip(cleanTip));
  const tipEvent = classifyTip(cleanTip);
  const evidence = filterRelevantMaterials(materials, cleanSubject, target)
    .map((item) => evidenceCard(item, tipEvent))
    .sort((a, b) => Number(b.event_match) - Number(a.event_match) || b.evidence_strength - a.evidence_strength || String(b.published_at || "").localeCompare(String(a.published_at || "")));
  const verification = verificationSummary(cleanTip, tipEvent, evidence);
  const recommended = recommendFormat(evidence, dossier);
  const selected = format === "auto" || !FORMAT_LABELS[format] ? recommended : format;
  const readiness = formatReadiness(selected, evidence, notes, dossier);
  const meaning = meaningFromEvidence(cleanSubject, cleanTip, tipEvent, verification, evidence);
  const counts = evidence.reduce((result, item) => {
    result[item.evidence_type] = (result[item.evidence_type] || 0) + 1;
    return result;
  }, { disclosure: 0, official: 0, press_release: 0, domestic_news: 0, foreign_news: 0 });

  return {
    tip: cleanTip,
    subject: cleanSubject,
    target,
    event_type: tipEvent,
    event_label: EVENT_LABELS[tipEvent] || EVENT_LABELS.general,
    claim: {
      text: cleanTip,
      status: "입력·미확인",
      ...verification,
    },
    counts: { ...counts, total: evidence.length, matching_event: evidence.filter((item) => item.event_match).length },
    meaning,
    evidence: evidence.slice(0, 30),
    timeline: evidence.slice(0, 20).sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || ""))),
    reporting_questions: unique([...(dossier?.questions || []), ...questionsFor(tipEvent, cleanSubject)]).slice(0, 8),
    dossier,
    format: {
      requested: format,
      selected,
      selected_label: FORMAT_LABELS[selected],
      recommended,
      recommended_label: FORMAT_LABELS[recommended],
      ...readiness,
    },
    outline: outlineFor(selected, cleanSubject, tipEvent, verification, evidence),
    title_ideas: titleIdeas(cleanSubject, tipEvent, verification),
  };
}

module.exports = {
  EVENT_LABELS,
  FORMAT_LABELS,
  buildWriterBrief,
  classifyTip,
  filterRelevantMaterials,
  formatReadiness,
  normalizeDisclosure,
  normalizeLead,
  normalizeText,
  subjectFromTip,
};
