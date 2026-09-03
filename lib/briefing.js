function kstDateString(value) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() + 9 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function weeklyStart(value) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() + 9 * 3600 * 1000);
  const day = shifted.getUTCDay();
  shifted.setUTCDate(shifted.getUTCDate() - ((day + 6) % 7));
  return shifted.toISOString().slice(0, 10);
}

function reasonFor(item, type) {
  const repeated = Number(item.related_count || 1);
  if (type === "weekly" && repeated > 1) return `서로 다른 기사 ${repeated}건이 같은 사건으로 모였습니다. 후속 확인 가치가 높습니다.`;
  if (item.event_type === "selection_result") return "GP 선정 결과는 운용사별 펀드 결성과 투자 여력을 바로 바꿉니다.";
  if (item.event_type === "capital_call") return "신규 출자금이 어느 전략과 운용사로 향하는지 확인할 수 있습니다.";
  if (item.event_type === "deal_process") return "가격·원매자·인수금융을 확인하면 거래 성사 가능성을 판단할 수 있습니다.";
  if (item.event_type === "fund_formation") return "실제 약정액과 LP 구성이 운용사의 다음 투자 여력을 보여줍니다.";
  if (item.event_type === "exit") return "회수액과 잔여 지분을 확인하면 펀드 성과를 추정할 수 있습니다.";
  if (item.event_type === "investment") return "투자금액·밸류에이션·공동투자자를 확인하면 시장 가격대를 읽을 수 있습니다.";
  return item.interpretation || "새 사실과 핵심 숫자를 원문에서 확인해야 합니다.";
}

function pickItems(items, type) {
  const sorted = [...(items || [])]
    .filter((item) => Number(item.story_score || 0) >= 50)
    .sort((a, b) => Number(b.story_score || 0) - Number(a.story_score || 0)
      || String(b.published_at || "").localeCompare(String(a.published_at || "")));
  if (type === "weekly") return sorted.slice(0, 10);
  const urgent = sorted.filter((item) => ["P1", "P2"].includes(item.alert_grade));
  const fill = sorted.filter((item) => item.alert_grade === "P3");
  return [...urgent, ...fill].slice(0, 8);
}

function buildBriefing(items, type = "daily", now = new Date()) {
  const briefingType = type === "weekly" ? "weekly" : "daily";
  const selected = pickItems(items, briefingType).map((item, index) => ({
    ...item,
    rank: index + 1,
    candidate_reason: reasonFor(item, briefingType),
  }));
  const periodEnd = kstDateString(now);
  const periodStart = briefingType === "weekly" ? weeklyStart(now) : periodEnd;
  const urgent = selected.filter((item) => ["P1", "P2"].includes(item.alert_grade)).length;
  const official = selected.filter((item) => ["capital_call", "selection_result"].includes(item.source_type)).length;
  const title = briefingType === "weekly" ? `${periodStart} 주간 기사 후보` : `${periodEnd} 오늘 확인할 단서`;
  const summary = briefingType === "weekly"
    ? `이번 주 기사 후보 ${selected.length}건입니다. 복수 보도·공식 출자 결과·거래 진전 순으로 골랐습니다.`
    : `오늘 확인할 단서 ${selected.length}건입니다. 즉시·당일 확인 대상은 ${urgent}건, 공식 출자 단서는 ${official}건입니다.`;
  return {
    briefing_type: briefingType,
    period_start: periodStart,
    period_end: periodEnd,
    title,
    summary,
    items: selected,
    stats: { total: selected.length, urgent, official },
  };
}

module.exports = { buildBriefing, kstDateString, pickItems, weeklyStart };
