function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function currentPreviousNames(clue) {
  const facts = clue?.confirmed_facts || [];
  return {
    current: clean(facts[0]).replace(/^현재 공시:\s*/, ''),
    previous: clean(facts[1]).replace(/^직전 동일 유형 공시:\s*/, ''),
  };
}

function stripCorrection(value) {
  return clean(value)
    .replace(/^\[(?:기재정정|첨부정정|정정)\]\s*/g, '')
    .replace(/^(?:기재정정|첨부정정|정정)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCorrection(value) {
  return /^\s*(?:\[(?:기재정정|첨부정정|정정)\]|(?:기재정정|첨부정정|정정))/.test(String(value || ''));
}

function supportedReport(value) {
  const title = stripCorrection(value);
  return /유상증자|전환사채|신주인수권부사채|교환사채|타법인.*(?:주식|출자증권).*(?:취득|처분|양수|양도)|주식.*(?:양수|양도)/.test(title);
}

function sameReportFamily(current, previous) {
  const a = stripCorrection(current);
  const b = stripCorrection(previous);
  return Boolean(a && b && a === b);
}

function selectExactCorrectionCandidates(clues, limit = 8) {
  const seen = new Set();
  return (clues || [])
    .filter((clue) => clue?.detector === 'dart_change')
    .filter((clue) => {
      const { current, previous } = currentPreviousNames(clue);
      if (!isCorrection(current)) return false;
      if (!sameReportFamily(current, previous)) return false;
      if (!supportedReport(current)) return false;
      return true;
    })
    .sort((a, b) => String(b.sort_date || '').localeCompare(String(a.sort_date || '')))
    .filter((clue) => {
      const { current } = currentPreviousNames(clue);
      const entity = clue?.entities?.[0] || String(clue?.headline || '').split('·')[0].trim();
      const key = `${entity}|${stripCorrection(current)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, Number(limit) || 8));
}

function numericRaw(value) {
  const text = clean(value);
  if (!text || /^[-–—]$/.test(text)) return null;
  const stripped = text
    .replace(/,/g, '')
    .replace(/원\/주|억원|백만원|만원|원|주|%|배/g, '')
    .trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(stripped)) return null;
  return Number(stripped);
}

function validDelta(delta) {
  const kind = delta?.kind || 'text';
  const before = clean(delta?.before_raw);
  const after = clean(delta?.after_raw);
  if (!before || !after) return false;
  if (['money', 'money_per_share', 'shares', 'percent'].includes(kind)) {
    return numericRaw(before) !== null && numericRaw(after) !== null;
  }
  if (kind === 'date') {
    return before.replace(/[^0-9]/g, '').length >= 8 && after.replace(/[^0-9]/g, '').length >= 8;
  }
  return before.toLowerCase() !== after.toLowerCase();
}

function sanitizeExactDiffClue(clue) {
  const deltas = (clue?.material_deltas || []).filter(validDelta);
  if (!deltas.length) return null;
  const corp = clue?.entities?.[0] || String(clue?.headline || '').split('·')[0].trim() || '해당 회사';
  const event = String(clue?.headline || '').split('·').slice(1).join('·').trim() || '공시';
  const visible = deltas.slice(0, 4).map((d) => `${d.label} ${d.before} → ${d.after}`);
  const extra = Math.max(0, deltas.length - visible.length);
  const labels = deltas.slice(0, 3).map((d) => d.label).join('·');
  const baseFacts = (clue?.confirmed_facts || []).filter((fact) => /^현재 공시:|^직전 동일 유형 공시:/.test(String(fact || ''))).slice(0, 2);
  return {
    ...clue,
    detector_label: 'DART 실질변화',
    one_line_signal: `${corp}의 ${event}에서 ${labels}${deltas.length > 3 ? ` 등 ${deltas.length}개` : ''} 항목이 직전 공시와 실제로 달라졌습니다.`,
    changed_fact: `${visible.join(' · ')}${extra ? ` · 외 ${extra}개 항목` : ''}`,
    confirmed_facts: [...baseFacts, ...deltas.slice(0, 6).map((d) => `${d.label}: ${d.before} → ${d.after}`)],
    material_deltas: deltas,
    unknowns: ['변경 사유와 거래·자금조달에 미치는 실제 영향'],
    next_action: `DART 원문에서 ${deltas.slice(0, 2).map((d) => d.label).join('·')} 변경 사유를 확인하고 회사·거래상대방에 실제 영향을 교차확인`,
  };
}

function sanitizeExactDiffClues(clues) {
  return (clues || []).map(sanitizeExactDiffClue).filter(Boolean);
}

module.exports = {
  currentPreviousNames,
  sameReportFamily,
  sanitizeExactDiffClue,
  sanitizeExactDiffClues,
  selectExactCorrectionCandidates,
  stripCorrection,
};
