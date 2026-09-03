const crypto = require('crypto');

const NOISE_PATTERNS = [
  /투자설명서\(집합투자증권\)/,
  /증권신고서\(집합투자증권\)/,
  /일괄신고서.*집합투자증권/,
  /효력발생안내.*집합투자증권/,
  /소액공모공시서류.*집합투자증권/,
];

const CORE_EVENTS = new Set([
  'control_change','equity_acquisition','equity_disposal','merger_restructuring',
  'distress_legal','capital_raise','capital_reduction','mezzanine','financing_support',
  'related_party_equity','related_party_funding','bond_retirement'
]);

function refineEvent(item) {
  const title = String(item?.report_nm || '');
  const analysis = { ...(item?.analysis || {}) };
  if (/(전환사채|신주인수권부사채|교환사채|자기사채|사채)[\s\S]{0,30}(상환|소각|취득)/.test(title)) {
    analysis.event_id = 'bond_retirement';
    analysis.event_label = '메자닌 상환·소각';
  } else if (/(최대주주.*변경|경영권|주식양수도|공개매수)/.test(title)) {
    analysis.event_id = 'control_change';
    analysis.event_label = '경영권·최대주주 변동';
  } else if (/(회생절차|워크아웃|부도|대출원리금.*연체|횡령|배임|가압류|강제집행)/.test(title)) {
    analysis.event_id = 'distress_legal';
    analysis.event_label = '회생·법적 위험';
  }
  return { ...item, analysis };
}

function groupFor(item) {
  const id = item?.analysis?.event_id || 'general';
  if (['control_change','merger_restructuring','related_party_equity'].includes(id)) return ['deal','M&A·지배구조'];
  if (['equity_acquisition','equity_disposal','ownership_report'].includes(id)) return ['equity','지분·회수'];
  if (['capital_raise','capital_reduction','mezzanine','bond_retirement','financing_support','related_party_funding'].includes(id)) return ['finance','자금조달'];
  if (['distress_legal','performance_risk'].includes(id)) return ['risk','회생·재무위험'];
  if (['fund_change'].includes(id)) return ['fund','펀드·조합'];
  if (['group_disclosure'].includes(id)) return ['governance','계열·내부거래'];
  if (['periodic'].includes(id)) return ['reference','정기·기초자료'];
  return ['other','기타'];
}

function baseTitle(value) {
  return String(value || '')
    .replace(/^\s*\[(?:기재정정|첨부정정|정정)\]\s*/g,'')
    .replace(/^\s*(?:기재정정|첨부정정|정정)\s*/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function familyKey(item) {
  const corp = item.corp_code || String(item.corp_name || '').replace(/\s+/g,'');
  const title = baseTitle(item.report_nm).toLowerCase().replace(/[^0-9a-z가-힣()]/g,'');
  return crypto.createHash('sha1').update(`${corp}|${title}`).digest('hex').slice(0,16);
}

function tierFor(item) {
  const id = item?.analysis?.event_id || 'general';
  const stage = item?.analysis?.stage || '';
  if (/철회|중단|변경/.test(stage)) return 'change';
  if (CORE_EVENTS.has(id)) return 'core';
  if (['ownership_report','fund_change','performance_risk','group_disclosure'].includes(id)) return 'followup';
  if (id === 'periodic') return 'reference';
  return 'other';
}

function tierLabel(tier) {
  return ({ core:'핵심 변동', change:'정정·조건변경', followup:'후속 확인', reference:'기초자료', other:'참고' })[tier] || '참고';
}

function shouldKeep(item) {
  const refined = refineEvent(item);
  const title = String(refined.report_nm || '');
  if (NOISE_PATTERNS.some((p)=>p.test(title))) return false;
  const id = refined?.analysis?.event_id || 'general';
  if (id === 'general') return false;
  if (id === 'periodic') return Number(refined?.analysis?.entity_strength || 0) >= 2;
  return true;
}

function monitorReason(item) {
  const id = item?.analysis?.event_id || 'general';
  const reasons = {
    control_change:'최대주주·경영권 이동 여부와 거래 종결 단계 확인',
    equity_acquisition:'취득 대상·지분율·거래 상대방·인수 목적 확인',
    equity_disposal:'매각 지분·회수금액·잔여 지분과 엑시트 여부 확인',
    merger_restructuring:'합병·분할·영업양수도 뒤 자산과 지배구조 변화 확인',
    distress_legal:'회생·소송·연체가 채권 회수와 매각 일정에 미치는 영향 확인',
    capital_raise:'제3자배정 대상·조달금액·자금 사용처와 지분 희석 확인',
    capital_reduction:'유상·무상감자 목적과 투자금 회수·결손 정리 여부 확인',
    mezzanine:'CB·EB·BW 인수자와 전환조건·자금 사용처 확인',
    bond_retirement:'메자닌 상환·소각과 투자자 회수·차환 여부 확인',
    financing_support:'차입·담보·보증의 수혜자·금리·만기와 차환 여부 확인',
    ownership_report:'직전 보고 대비 지분율과 보유 목적 변화 확인',
    fund_change:'운용사·LP·결성액·존속기간 등 펀드 구조 변화 확인',
    performance_risk:'실적·감사의견·계속기업 위험과 차입 상환능력 확인',
    group_disclosure:'신규 계열사·출자·대여·보증 등 내부거래 변화 확인',
    related_party_equity:'계열사 사이 지분 이동과 지배구조 변화 확인',
    related_party_funding:'계열 내 자금 지원 방향과 재무부담 확인',
    periodic:'감시 운용사·투자회사의 차입금·투자자산·감사 문구 기초 확인',
  };
  return reasons[id] || item?.analysis?.why || '원문에서 거래 상대방·금액·일정 확인';
}

function nextCheck(item) {
  const id = item?.analysis?.event_id || 'general';
  const checks = {
    control_change:'지분율 · 거래금액 · SPA/종결일',
    equity_acquisition:'취득지분 · 취득가 · 상대방 · 자금원',
    equity_disposal:'처분지분 · 처분가 · 원매자 · 잔여지분',
    merger_restructuring:'합병비율 · 존속법인 · 일정 · 주주구성',
    distress_legal:'사건번호 · 채무액 · 채권자 · 다음 법원일정',
    capital_raise:'발행가 · 배정대상 · 조달액 · 사용처',
    capital_reduction:'감자비율 · 대가 · 목적 · 일정',
    mezzanine:'발행액 · 인수자 · 전환가 · 만기 · 옵션',
    bond_retirement:'상환액 · 상환재원 · 잔액 · 차환 여부',
    financing_support:'금액 · 금리 · 만기 · 담보/보증 대상',
    ownership_report:'직전 지분율 · 현재 지분율 · 보유목적',
    fund_change:'GP · LP · 약정액 · 결성일 · 존속기간',
    performance_risk:'현금흐름 · 차입만기 · 감사의견 · 자본잠식',
    group_disclosure:'신규 계열 · 출자 · 대여 · 보증 변동',
    related_party_equity:'이동 지분 · 거래가격 · 거래 전후 지분율',
    related_party_funding:'대여/차입액 · 금리 · 만기 · 수혜법인',
    periodic:'차입금 · 투자자산 · 우발채무 · 계속기업 문구',
  };
  return checks[id] || '상대방 · 금액 · 지분 · 일정';
}

function enrich(item) {
  const refined = refineEvent(item);
  const [group_id, group_label] = groupFor(refined);
  const tier = tierFor(refined);
  return {
    ...refined,
    family_id: familyKey(refined),
    base_report_nm: baseTitle(refined.report_nm),
    group_id,
    group_label,
    tier,
    tier_label: tierLabel(tier),
    monitor_reason: monitorReason(refined),
    next_check: nextCheck(refined),
  };
}

function buildFamilies(items) {
  const map = new Map();
  for (const item of items || []) {
    const current = map.get(item.family_id) || [];
    current.push(item);
    map.set(item.family_id,current);
  }
  return [...map.entries()].map(([family_id, rows])=>{
    const sorted = [...rows].sort((a,b)=>String(b.rcept_no||'').localeCompare(String(a.rcept_no||'')));
    const latest = sorted[0];
    const corrections = sorted.filter((x)=>x.analysis?.is_correction || /정정/.test(x.report_nm||''));
    return {
      family_id,
      corp_name: latest.corp_name,
      corp_code: latest.corp_code,
      group_id: latest.group_id,
      group_label: latest.group_label,
      tier: corrections.length ? 'change' : latest.tier,
      tier_label: corrections.length ? '정정·조건변경' : latest.tier_label,
      event_id: latest.analysis?.event_id,
      event_label: latest.analysis?.event_label,
      latest,
      count: sorted.length,
      correction_count: corrections.length,
      items: sorted.slice(0,10),
    };
  }).sort((a,b)=>String(b.latest?.rcept_no||'').localeCompare(String(a.latest?.rcept_no||'')));
}

module.exports = { buildFamilies, enrich, familyKey, groupFor, refineEvent, shouldKeep };
