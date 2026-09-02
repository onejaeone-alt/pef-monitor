const KNOWN_PEF_HOUSES = [
  "MBK", "엠비케이", "한앤컴퍼니", "한앤코", "IMM", "아이엠엠", "VIG", "브이아이쥐",
  "스틱인베스트먼트", "UCK", "유니슨캐피탈", "어피니티", "베인캐피탈", "칼라일", "KKR",
  "블랙스톤", "맥쿼리", "JKL", "제이케이엘", "글랜우드", "스카이레이크", "케이스톤",
  "큐캐피탈", "노앤파트너스", "센트로이드", "웰투시", "프랙시스", "파라투스", "도미누스",
  "H&Q", "에이치앤큐", "SG PE", "에스지프라이빗에쿼티", "얼라인파트너스", "다올PE",
];

const STRONG_PEF_TERMS = [
  "기관전용 사모집합투자기구", "기관전용사모집합투자기구", "사모투자합자회사",
  "프라이빗에쿼티", "프라이빗 에쿼티", "피이에프", "경영참여형", "바이아웃",
  "에쿼티파트너스", "투자목적회사", ...KNOWN_PEF_HOUSES,
];

const STRONG_VC_TERMS = [
  "벤처캐피탈", "벤처투자회사", "벤처투자조합", "창업투자회사", "창업투자",
  "신기술사업금융", "신기술금융", "신기술투자조합", "액셀러레이터", "엑셀러레이터",
  "인베스트먼트", "기술투자", "벤처스", "CVC", "씨브이씨",
];

const WEAK_ENTITY_TERMS = ["파트너스", "인베스트", "투자조합", "에쿼티", "사모", "PE", "VC", "IB"];

const NOISE_REPORT_PATTERNS = [
  /투자설명서\(집합투자증권\)/,
  /증권신고서\(집합투자증권\)/,
  /일괄신고서.*집합투자증권/,
  /효력발생안내.*집합투자증권/,
];

const GENERIC_IB_EVENTS = new Set([
  "control_change",
  "equity_acquisition",
  "equity_disposal",
  "merger_restructuring",
]);

const EVENT_RULES = [
  {
    id: "related_party_funding", label: "계열 내 자금 이동", materiality: 18, actionability: 14,
    patterns: [/특수관계인.*자금차입/, /특수관계인.*자금대여/, /특수관계인.*채권매수/, /특수관계인.*채권매도/],
    why: "계열 내부의 자금 지원 방향과 재무 부담이 달라질 수 있습니다.", signals: ["내부거래", "자금지원"],
  },
  {
    id: "related_party_equity", label: "계열사 지분 거래", materiality: 20, actionability: 15,
    patterns: [/특수관계인.*주식.*취득/, /특수관계인.*주식.*매도/, /특수관계인.*주식.*처분/],
    why: "계열사 사이의 지분 이동으로 거래 뒤 지배구조와 대주주 수혜 여부를 확인해야 합니다.", signals: ["내부거래", "지분이동"],
  },
  {
    id: "control_change", label: "경영권·최대주주 변동", materiality: 20, actionability: 15,
    patterns: [/최대주주.*변경/, /경영권/, /주식양수도/, /공개매수/, /최대주주등소유주식변동/],
    why: "실제 경영권 이전이나 매각 종결로 이어질 수 있는 신호입니다.", signals: ["M&A", "지배구조"],
  },
  {
    id: "equity_acquisition", label: "지분 취득·인수", materiality: 20, actionability: 15,
    patterns: [/타법인.*주식.*취득/, /출자증권.*취득/, /주식.*취득결정/, /투자판단.*취득/, /신주인수/],
    why: "신규 투자와 경영권 인수를 구분하려면 취득 목적, 상대방, 거래 뒤 지분율을 확인해야 합니다.", signals: ["투자", "인수"],
  },
  {
    id: "equity_disposal", label: "지분 매각·회수", materiality: 20, actionability: 15,
    patterns: [/타법인.*주식.*처분/, /출자증권.*처분/, /주식.*처분결정/, /투자판단.*처분/],
    why: "부분 회수인지 완전한 엑시트인지, 취득원가 대비 성과가 얼마인지 확인할 수 있습니다.", signals: ["매각", "엑시트"],
  },
  {
    id: "merger_restructuring", label: "합병·분할·사업재편", materiality: 20, actionability: 15,
    patterns: [/합병/, /분할/, /영업양수/, /영업양도/, /주식교환/, /주식이전/, /해산/],
    why: "기업 구조와 자산 소유관계가 바뀌는 만큼 거래 구조와 존속법인을 함께 봐야 합니다.", signals: ["구조개편", "M&A"],
  },
  {
    id: "distress_legal", label: "회생·법적 위험", materiality: 20, actionability: 14, friction: 15,
    patterns: [/회생절차/, /워크아웃/, /부도/, /대출원리금.*연체/, /횡령/, /배임/, /소송.*제기/, /가압류/, /강제집행/],
    why: "기업가치와 채권 회수, 거래 종결 가능성에 직접 영향을 줄 수 있는 위험 신호입니다.", signals: ["재무위험", "법적위험"],
  },
  {
    id: "capital_reduction", label: "감자·자본구조 변경", materiality: 17, actionability: 13,
    patterns: [/감자결정/, /자본감소/, /무상감자/, /유상감자/],
    why: "유상감자는 투자금 회수, 무상감자는 결손 정리와 연결될 수 있습니다.", signals: ["자본구조", "회수가능성"],
  },
  {
    id: "capital_raise", label: "유상증자·자본 확충", materiality: 16, actionability: 13,
    patterns: [/유상증자/, /제3자배정/, /신주발행/, /증자결정/],
    why: "자금 유입과 주주 구성 변화가 동시에 나타날 수 있어 배정 대상과 사용처가 중요합니다.", signals: ["자금조달", "지분희석"],
  },
  {
    id: "mezzanine", label: "메자닌·사채 조달", materiality: 15, actionability: 12,
    patterns: [/전환사채/, /신주인수권부사채/, /교환사채/, /사모사채/, /사채권.*발행/],
    why: "투자자와 전환 조건, 담보·풋옵션, 자금 사용처에 따라 지배구조와 회수 조건이 달라집니다.", signals: ["자금조달", "메자닌"],
  },
  {
    id: "bond_retirement", label: "메자닌 상환·소각", materiality: 15, actionability: 12,
    patterns: [/전환사채.*소각/, /신주인수권부사채.*소각/, /교환사채.*소각/, /자기사채.*소각/, /사채.*상환/],
    why: "투자자 회수와 차환, 잠재 주식 물량 변화가 함께 나타날 수 있습니다.", signals: ["메자닌", "상환·소각"],
  },
  {
    id: "financing_support", label: "담보·보증·차입", materiality: 15, actionability: 12,
    patterns: [/담보제공/, /채무보증/, /금전대여/, /차입결정/, /대출원리금/, /채무인수/, /리파이낸싱/],
    why: "인수금융과 계열사 지원, 만기 대응 여부를 가늠할 수 있는 신호입니다.", signals: ["인수금융", "재무부담"],
  },
  {
    id: "ownership_report", label: "대량보유·주주 변동", materiality: 12, actionability: 9,
    patterns: [/대량보유/, /주식등의대량/, /임원.*주요주주/, /특정증권등소유/, /소유상황보고/],
    why: "직전 보고보다 지분이 얼마나 달라졌고 보유 목적이 바뀌었는지가 핵심입니다.", signals: ["지분변동", "주주동향"],
  },
  {
    id: "fund_change", label: "펀드·조합 변동", materiality: 13, actionability: 10,
    patterns: [/사모집합투자기구/, /투자합자회사/, /투자조합/, /벤처투자조합/, /집합투자/, /펀드/],
    why: "운용사와 출자자, 존속기간, 투자 대상을 보면 결성·변경·청산 여부를 가를 수 있습니다.", signals: ["펀드", "GP·LP"],
  },
  {
    id: "performance_risk", label: "실적·재무 위험", materiality: 14, actionability: 9,
    patterns: [/손상차손/, /매출액.*손익.*변동/, /자본잠식/, /감사의견.*(한정|거절|부적정)/, /계속기업.*불확실/],
    why: "밸류에이션과 투자 회수 가능성에 영향을 주는 실적·감사 신호입니다.", signals: ["재무위험", "밸류에이션"],
  },
  {
    id: "periodic", label: "정기·기초 공시", materiality: 3, actionability: 2,
    patterns: [/사업보고서/, /반기보고서/, /분기보고서/, /감사보고서/, /연결감사보고서/],
    why: "기사 단독 소재보다는 차입금과 투자자산, 계속기업 문구의 누적 변화를 확인하는 기초자료입니다.", signals: ["기초자료"],
  },
  {
    id: "group_disclosure", label: "계열사·내부거래 현황", materiality: 7, actionability: 5,
    patterns: [/대규모기업집단현황공시/, /기업집단현황공시/],
    why: "신규 계열사와 출자·대여·보증이 직전 분기보다 달라졌는지 비교할 때 유용합니다.", signals: ["계열관계", "내부거래"],
  },
];

const QUESTION_SETS = {
  control_change: ["거래 대상 지분과 예상 거래금액은 얼마인가", "현재 협상·승인·종결 가운데 어느 단계인가", "매수자와 매도자의 자금조달 구조는 어떻게 짰나", "거래 종결의 선행조건과 해제 조건은 무엇인가", "기존 경영진과 임직원 고용은 어떻게 달라지나"],
  equity_acquisition: ["취득 목적은 경영권 인수인가 단순 투자인가", "취득 전후 지분율과 의결권은 얼마인가", "거래 상대방과 취득가격 산정 근거는 무엇인가", "자기자본과 인수금융은 각각 얼마나 투입하나", "추가 지분 매입이나 합병 계획이 있는가"],
  equity_disposal: ["매각 지분과 잔여 지분은 얼마인가", "취득원가와 회수금액, 예상 MOIC·IRR은 얼마인가", "원매자와 협상 단계는 어디까지 왔나", "매각대금 사용처는 무엇인가", "완전 회수인지 단계적 엑시트인지"],
  financing_support: ["차입·보증·담보의 실제 수혜자는 누구인가", "금액과 금리, 만기, 담보비율은 얼마인가", "기존 인수금융의 차환인가 신규 조달인가", "재무약정과 조기상환 조건은 무엇인가", "배당·리캡 또는 매각 일정과 연결되는가"],
  mezzanine: ["인수자와 발행금액은 얼마인가", "전환·교환가격과 리픽싱 조건은 무엇인가", "풋옵션·콜옵션·담보 조건은 어떻게 되나", "자금 사용처는 운영자금인가 인수자금인가", "기존 주주의 지분 희석 폭은 얼마인가"],
  ownership_report: ["직전 보고보다 지분율이 얼마나 달라졌나", "보유 목적이 단순투자에서 경영참여로 바뀌었나", "장내매수·블록딜·전환 가운데 어떤 방식인가", "추가 매수나 공개매수 계획이 있나", "특별관계자별 실제 보유 주체는 누구인가"],
  fund_change: ["목표 결성액과 현재 모집액은 얼마인가", "주요 LP와 출자금액은 어떻게 되나", "블라인드펀드인지 프로젝트펀드인지", "존속기간과 투자기간은 얼마인가", "첫 투자·후속 투자 파이프라인은 무엇인가"],
  performance_risk: ["직전 기간보다 실적과 현금흐름이 얼마나 달라졌나", "차입금 만기와 이자 부담은 감당 가능한가", "감사인이 지적한 핵심 위험은 무엇인가", "대주주나 운용사의 추가 자금 지원 계획이 있나", "매각·차환 일정에 미치는 영향은 무엇인가"],
  distress_legal: ["회생·소송의 정확한 청구금액과 일정은 무엇인가", "담보권자와 주요 채권자는 누구인가", "영업과 거래 종결에 즉시 미치는 영향은 무엇인가", "대주주와 대주단이 추가 지원에 합의했나", "매각 또는 구조조정 절차가 병행되는가"],
};

function normalizeName(name) {
  return String(name || "")
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|투자목적회사|\(주\)|㈜|\s+/g, "")
    .toLowerCase();
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function safeIncludes(text, term) {
  if (/^[A-Z& ]{2,}$/.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, "i").test(text);
  }
  return text.toLowerCase().includes(term.toLowerCase());
}

function findTerms(text, terms) {
  return terms.filter((term) => safeIncludes(text, term));
}

function entityContext(item) {
  const corp = String(item.corp_name || "");
  const filer = String(item.flr_nm || "");
  const report = String(item.report_nm || "");
  const all = `${corp} ${filer} ${report}`;
  const pef = findTerms(all, STRONG_PEF_TERMS);
  const vc = findTerms(all, STRONG_VC_TERMS);
  const weak = findTerms(all, WEAK_ENTITY_TERMS);
  const strength = pef.length || vc.length ? 2 : weak.length ? 1 : 0;
  const category = pef.length ? "PEF" : vc.length ? "VC" : "IB";
  const corpStrong = findTerms(corp, [...STRONG_PEF_TERMS, ...STRONG_VC_TERMS]);
  return {
    category,
    strength,
    hits: unique([...pef, ...vc, ...weak]),
    strong_hits: unique([...pef, ...vc]),
    weak_hits: weak,
    is_house: corpStrong.length > 0,
  };
}

function eventRuleFor(title) {
  return EVENT_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(title))) || {
    id: "general", label: "IB 관련 단서", materiality: 2, actionability: 2,
    why: "명칭만으로는 거래 관련성을 판단하기 어렵습니다. 원문과 제출자를 함께 확인해야 합니다.", signals: ["원문확인"],
  };
}

function stageFor(title) {
  if (/철회|해제|중단|불발/.test(title)) return { label: "철회·중단", novelty: 25, action: 15, friction: 15 };
  if (/정정|기재정정|첨부정정/.test(title)) return { label: "조건·내용 변경", novelty: 25, action: 15, friction: 10 };
  if (/완료|결과|종료|종결|상환/.test(title)) return { label: "완료·결과", novelty: 25, action: 15, friction: 0 };
  if (/계약|약정|체결/.test(title)) return { label: "계약·약정", novelty: 23, action: 15, friction: 0 };
  if (/결정|승인|선정/.test(title)) return { label: "의사결정", novelty: 22, action: 15, friction: 0 };
  if (/신고서|신청|예고|보고서/.test(title)) return { label: "신고·검토", novelty: 14, action: 9, friction: 0 };
  return { label: "신규 공시", novelty: 12, action: 8, friction: 0 };
}

function extractKeyNumbers(text) {
  const source = String(text || "").replace(/\s+/g, " ");
  const matches = source.match(/\d[\d,]*(?:\.\d+)?\s*(?:조\s*원|억원|백만원|만원|원|%|배|주|개월|년)/g) || [];
  return unique(matches.map((value) => value.replace(/\s+/g, " "))).slice(0, 12);
}

function baseQuestions(eventId) {
  return QUESTION_SETS[eventId] || [
    "이번 공시에서 직전 공시보다 달라진 조건은 무엇인가",
    "거래 상대방과 실제 이해관계자는 누구인가",
    "금액·지분율·금리·만기 등 핵심 숫자는 얼마인가",
    "현재 절차는 어느 단계이며 다음 일정은 언제인가",
    "공시 밖에서 추가로 확인해야 할 변수는 무엇인가",
  ];
}

function callTargets(eventId, item) {
  const common = [`${item.corp_name} IR·재무 담당자`];
  if (["control_change", "equity_acquisition", "equity_disposal", "merger_restructuring"].includes(eventId)) {
    return unique([...common, "매도자·매수자 측 관계자", "매각·인수 자문사", "인수금융 주선사"]);
  }
  if (["financing_support", "mezzanine", "bond_retirement", "capital_raise", "capital_reduction"].includes(eventId)) {
    return unique([...common, "최대주주·운용사", "대주단·주선사", "메자닌 인수자"]);
  }
  if (["fund_change"].includes(eventId)) return unique(["운용사 펀딩 담당자", "주요 LP 출자 담당자", "앵커 LP·정책금융기관"]);
  if (["distress_legal", "performance_risk"].includes(eventId)) return unique([...common, "감사인·법률대리인", "최대주주·운용사", "주요 채권자·대주단"]);
  if (eventId === "ownership_report") return unique([...common, `${item.flr_nm || "공시 제출자"} 측`, "최대주주·운용사"]);
  return unique([...common, `${item.flr_nm || "공시 제출자"} 측`]);
}

function makeHeadline(item, rule, stage) {
  if (stage.label === "조건·내용 변경") return `${item.corp_name}, ${rule.label} 조건 다시 변경`;
  if (stage.label === "철회·중단") return `${item.corp_name}, ${rule.label} 절차 철회·중단`;
  if (stage.label === "완료·결과") return `${item.corp_name}, ${rule.label} 결과 공시`;
  if (stage.label === "계약·약정") return `${item.corp_name}, ${rule.label} 계약 체결`;
  if (stage.label === "의사결정") return `${item.corp_name}, ${rule.label} 결정`;
  return `${item.corp_name}, ${rule.label} 신호 포착`;
}

function bucketFor(score) {
  if (score >= 75) return "story";
  if (score >= 55) return "verify";
  return "archive";
}

function matchesWatchlist(item, watchTerms = []) {
  const hay = `${item.corp_name || ""} ${item.flr_nm || ""} ${item.report_nm || ""}`.toLowerCase();
  return (watchTerms || []).find((term) => {
    const value = String(term || "").trim().toLowerCase();
    return value.length >= 2 && hay.includes(value);
  }) || null;
}

function analyzeDisclosure(item) {
  const title = String(item.report_nm || "").trim();
  const context = entityContext(item);
  const rule = eventRuleFor(title);
  const stage = stageFor(title);
  const periodicPenalty = rule.id === "periodic" ? 9 : 0;
  const friction = Math.min(15, Number(rule.friction || 0) + stage.friction);
  const breakdown = {
    novelty: Math.max(0, stage.novelty - periodicPenalty),
    materiality: rule.materiality,
    stage: Math.min(rule.actionability, stage.action),
    beat: context.strength === 2 ? 15 : context.strength === 1 ? 5 : 0,
    friction,
    evidence: 10,
  };
  const rawScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  // PEF·VC나 감시목록 관련성이 확인되지 않은 일반 공시는 상위 기사 후보를 차지하지 않게 한다.
  const score = context.strength === 0 ? Math.min(69, rawScore) : rawScore;
  const correction = stage.label === "조건·내용 변경";
  const numbers = extractKeyNumbers(`${title} ${item.rm || ""}`);
  return {
    event_id: rule.id,
    event_label: rule.label,
    stage: stage.label,
    is_correction: correction,
    importance: score >= 75 ? "핵심" : score >= 55 ? "주시" : "참고",
    score,
    bucket: bucketFor(score),
    score_breakdown: breakdown,
    entity_strength: context.strength,
    entity_hits: context.hits,
    signals: unique([...(rule.signals || []), ...(correction ? ["정정공시"] : []), context.category]),
    new_fact: makeHeadline(item, rule, stage),
    change_summary: correction
      ? "정정 공시입니다. 변경 전후의 금액·지분율·상대방·일정을 먼저 대조해야 합니다."
      : "현재 조회 범위에서 같은 유형의 선행 공시가 아직 연결되지 않았습니다.",
    why: rule.why,
    key_numbers: numbers,
    next_check: correction ? "정정 전 원문과 표를 나란히 놓고 바뀐 셀부터 확인" : "원문에서 거래금액·지분율·상대방·다음 일정을 확인",
    call_targets: callTargets(rule.id, item),
    questions: baseQuestions(rule.id),
    angles: [
      "스트레이트: 새로 확인된 결정과 핵심 숫자",
      "후속: 거래 구조·자금조달·남은 변수",
      "기획: 같은 유형의 최근 거래와 운용사 행보 비교",
    ],
    confidence: "DART 공시 확인",
  };
}

function shouldInclude(item, analysis = analyzeDisclosure(item), watchTerms = []) {
  const title = String(item.report_nm || "");
  if (NOISE_REPORT_PATTERNS.some((pattern) => pattern.test(title))) return false;
  if (matchesWatchlist(item, watchTerms)) return true;
  if (analysis.event_id === "periodic" || analysis.event_id === "general") {
    return analysis.entity_strength >= 2;
  }
  if (analysis.entity_strength >= 1) return true;
  return GENERIC_IB_EVENTS.has(analysis.event_id) && analysis.score >= 50;
}

function toMonitoredItem(item) {
  const context = entityContext(item);
  const analysis = analyzeDisclosure(item);
  return {
    rcept_no: item.rcept_no,
    rcept_dt: item.rcept_dt,
    corp_code: item.corp_code,
    stock_code: item.stock_code,
    corp_name: item.corp_name,
    corp_cls: item.corp_cls,
    report_nm: String(item.report_nm || "").trim(),
    flr_nm: item.flr_nm,
    rm: item.rm,
    hits: context.hits,
    category: context.category,
    pef_entity: context.is_house,
    analysis,
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
  };
}

function candidateFromRow(row) {
  const raw = row?.raw_data || row || {};
  return {
    ...raw,
    rcept_no: raw.rcept_no || row.rcept_no,
    rcept_dt: raw.rcept_dt || String(row.receipt_date || "").replace(/-/g, ""),
    corp_code: raw.corp_code || row.corp_code,
    corp_name: raw.corp_name || row.corp_name,
    report_nm: raw.report_nm || row.report_nm,
    analysis: raw.analysis || { event_id: row.event_type },
    url: raw.url || row.dart_url,
  };
}

function attachPreviousEvents(items, previousRows = []) {
  const history = [...items, ...previousRows.map(candidateFromRow)];
  return items.map((item) => {
    const corpKey = item.corp_code || normalizeName(item.corp_name);
    const previous = history
      .filter((other) => {
        if (!other || other.rcept_no === item.rcept_no) return false;
        const otherKey = other.corp_code || normalizeName(other.corp_name);
        return otherKey === corpKey && other.analysis?.event_id === item.analysis?.event_id && String(other.rcept_no || "") < String(item.rcept_no || "");
      })
      .sort((a, b) => String(b.rcept_no || "").localeCompare(String(a.rcept_no || "")))[0];
    if (!previous) return item;
    const date = String(previous.rcept_dt || "");
    const formatted = /^\d{8}$/.test(date) ? `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}` : "이전";
    return {
      ...item,
      analysis: {
        ...item.analysis,
        previous_event: {
          rcept_no: previous.rcept_no,
          rcept_dt: previous.rcept_dt,
          report_nm: previous.report_nm,
          url: previous.url,
        },
        change_summary: `${formatted} ‘${previous.report_nm}’ 이후 같은 유형의 공시가 다시 나왔습니다. 두 원문의 조건과 숫자를 비교해야 합니다.`,
      },
    };
  });
}

function sortByStoryValue(items) {
  return [...items].sort((a, b) =>
    (b.analysis?.score || 0) - (a.analysis?.score || 0) || String(b.rcept_no || "").localeCompare(String(a.rcept_no || ""))
  );
}

module.exports = {
  analyzeDisclosure,
  attachPreviousEvents,
  bucketFor,
  entityContext,
  extractKeyNumbers,
  matchesWatchlist,
  normalizeName,
  shouldInclude,
  sortByStoryValue,
  toMonitoredItem,
};
