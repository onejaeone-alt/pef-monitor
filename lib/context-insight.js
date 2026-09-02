const EVENT_PATTERNS = [
  [/경영권|최대주주/, /경영권|최대주주|공개매수|주식양수도|인수|매각/],
  [/대량보유|주주 변동/, /지분|주주|최대주주|대량보유|보유목적|장내매수|블록딜|특별관계자/],
  [/지분 취득|인수/, /인수|취득|투자|지분|출자|신주인수/],
  [/지분 매각|회수/, /매각|처분|회수|엑시트|지분|매각대금/],
  [/합병|분할|사업재편/, /합병|분할|사업재편|영업양수|영업양도|주식교환|주식이전/],
  [/유상증자|자본 확충/, /유상증자|제3자배정|신주발행|자본확충|투자유치/],
  [/메자닌|사채 조달/, /전환사채|신주인수권부사채|교환사채|CB|BW|EB|메자닌/],
  [/담보|보증|차입/, /담보|보증|차입|대출|리파이낸싱|인수금융/],
  [/회생|법적 위험/, /회생|워크아웃|부도|연체|횡령|배임|소송|가압류|강제집행/],
  [/감자|자본구조/, /감자|자본감소|결손|자본구조/],
  [/펀드|조합/, /펀드|조합|출자|LP|결성|클로징|청산/],
  [/실적|재무 위험/, /실적|손실|현금흐름|차입금|자본잠식|감사의견|계속기업/],
];

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function eventPattern(eventLabel) {
  return EVENT_PATTERNS.find(([labelPattern]) => labelPattern.test(String(eventLabel || "")))?.[1] || null;
}

function relevantEvidence(items, context) {
  const pattern = eventPattern(context.eventLabel);
  if (!pattern) return (items || []).slice(0, 5);
  return (items || []).filter((item) => pattern.test(`${item.title || ""} ${item.snippet || ""}`)).slice(0, 5);
}

function coreMeaning(context) {
  const event = compact(context.eventLabel);
  const stage = compact(context.stage);
  const report = compact(context.reportName);
  const text = `${event} ${stage} ${report}`;

  if (/철회|중단|불발|해제/.test(text)) {
    return "기존 거래가 예정대로 진행되지 않을 가능성이 커진 단계로, 철회 사유와 위약금·대체 원매자·재추진 가능성을 확인해야 합니다";
  }
  if (/정정|조건·내용 변경/.test(text)) {
    if (/경영권|최대주주/.test(event)) return "경영권 이전을 새로 결정한 공시가 아니라 공개매수·주식양수도 조건을 다시 고친 공시로, 가격·수량·기간 변화가 거래 종결 가능성에 미친 영향이 핵심입니다";
    if (/대량보유|주주 변동/.test(event)) return "새 지분 거래가 시작됐다는 뜻이 아니라 기존 대량보유 보고의 수량·비율·특별관계자 범위가 달라졌다는 뜻으로, 직전 보고와 바뀐 항목이 핵심입니다";
    if (/지분 취득|인수/.test(event)) return "인수를 새로 결정한 공시가 아니라 취득가격·지분율·대금 지급일을 고친 공시로, 변경 폭과 종결 전제조건을 확인해야 합니다";
    if (/지분 매각|회수/.test(event)) return "매각을 새로 결정한 공시가 아니라 처분가격·잔여지분·대금 회수 일정을 고친 공시로, 회수 성과와 거래 무산 가능성을 함께 봐야 합니다";
    return "새 사건이 생긴 공시가 아니라 기존 조건이나 숫자를 고친 공시로, 정정 전후 표에서 금액·지분율·상대방·일정을 먼저 대조해야 합니다";
  }
  if (/완료|결과|종결|종료/.test(text)) {
    return "검토나 계약 단계를 넘어 거래 결과가 확정된 공시로, 최종 지분율·실제 지급액·잔여 조건이 최초 발표와 같은지 확인해야 합니다";
  }
  if (/경영권|최대주주/.test(event)) return "단순 지분투자보다 경영권 이전 가능성을 보여주는 신호로, 매수 주체와 자금조달 구조·거래 종결 조건이 핵심입니다";
  if (/대량보유|주주 변동/.test(event)) return "주요 주주의 지분율이나 보유 목적이 달라졌다는 신호로, 실제 매매 주체와 추가 매수·경영참여 가능성을 확인해야 합니다";
  if (/지분 취득|인수/.test(event)) return "신규 투자와 경영권 인수 가운데 어느 쪽인지 가려야 하는 단계로, 취득 뒤 지분율과 자금조달 구조가 핵심입니다";
  if (/지분 매각|회수/.test(event)) return "투자금 회수나 경영권 매각이 진행되는 신호로, 취득원가 대비 회수액과 거래 뒤 남는 지분을 확인해야 합니다";
  if (/합병|분할|사업재편/.test(event)) return "법인과 자산의 소유구조가 바뀌는 거래로, 존속법인·합병비율·주주별 이해득실을 함께 봐야 합니다";
  if (/유상증자|자본 확충/.test(event)) return "회사에 새 자금과 새 주주가 들어오는 공시로, 배정 대상의 정체와 자금 사용처·기존 주주 희석 폭이 핵심입니다";
  if (/메자닌|사채 조달/.test(event)) return "당장 차입으로 보이지만 향후 지분으로 바뀔 수 있는 조달로, 인수자·전환가격·리픽싱·풋옵션 조건을 확인해야 합니다";
  if (/회생|법적 위험/.test(event)) return "기업가치와 채권 회수, 진행 중인 거래의 종결 가능성을 흔들 수 있는 신호로, 채권자 구성과 자금 지원 계획이 핵심입니다";
  return "공시 제목만으로 거래의 경제적 효과가 확정되지는 않으며, 금액·지분율·상대방·다음 일정을 원문에서 확인해야 합니다";
}

function buildContextInsight(context, sources) {
  const press = relevantEvidence(sources.press_release, context);
  const news = relevantEvidence([...(sources.domestic || []), ...(sources.foreign || [])], context);
  const evidence = press.length ? press : news;
  const basis = press.length ? "press_release" : news.length ? "news" : "disclosure";
  const prefix = basis === "press_release"
    ? "관련 보도자료와 공시를 함께 보면, "
    : basis === "news"
      ? "관련 기사와 공시를 함께 보면, "
      : "공시만 놓고 보면, ";
  return {
    text: `${prefix}${coreMeaning(context).replace(/[.!?]+$/, "")}.`,
    basis,
    evidence_count: evidence.length,
    evidence_titles: evidence.map((item) => compact(item.title)).filter(Boolean).slice(0, 3),
  };
}

module.exports = {
  buildContextInsight,
  relevantEvidence,
};
