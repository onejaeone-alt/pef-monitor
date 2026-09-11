const crypto = require('crypto');
const { DRIVE_DOSSIERS, matchDossiersInText } = require('./drive-dossiers');

const NOISE_PATTERNS = [
  /투자설명서\(집합투자증권\)/,
  /간이투자설명서\(집합투자증권\)/,
  /증권신고서\(집합투자증권\)/,
  /일괄신고서.*집합투자증권/,
  /효력발생안내.*집합투자증권/,
  /소액공모공시서류.*집합투자증권/,
  /증권발행실적보고서\(집합투자증권\)/,
  /임원[ㆍ·\s]*주요주주.*특정증권.*소유상황보고서/,
  /주식등의대량보유상황보고서\(약식\)/,
];

const PRIVATE_FUND_PATTERNS = [
  /기관전용\s*사모(?:집합투자기구)?/,
  /사모집합투자기구/,
  /사모투자(?:합자회사|기구)?/,
  /투자합자회사/,
  /벤처투자조합/,
  /신기술사업투자조합/,
  /신기술투자조합/,
  /창업투자조합/,
];

const PERSONAL_SCOPE_TYPES = new Set([
  'pef','vc','ac','lp','company','financial_institution'
]);
const HOUSE_TYPES = new Set(['pef','vc','ac']);
const PORTFOLIO_CONTEXT = /PEF.{0,12}포트폴리오|사모펀드.{0,12}포트폴리오|바이아웃|매각추진|회수검토|인수계약|기업회생|특수상황|M&A|리파이낸싱|인수금융|펀드\s*만기/i;
const DOSSIER_BY_KEY = new Map((DRIVE_DOSSIERS || []).map((item)=>[item.entity_key,item]));

const CORE_EVENTS = new Set([
  'control_change','equity_acquisition','equity_disposal','merger_restructuring',
  'distress_legal','capital_raise','capital_reduction','mezzanine','financing_support',
  'related_party_equity','related_party_funding','bond_retirement'
]);

function refineEvent(item) {
  const title = String(item?.report_nm || '');
  const analysis = { ...(item?.analysis || {}) };
  // A routine ownership-change notice is not proof that control changed.
  if (/최대주주등소유주식변동신고서/.test(title)) {
    analysis.event_id = 'ownership_report';
    analysis.event_label = '최대주주 보유주식 변동';
  } else if (/(전환사채|신주인수권부사채|교환사채|자기사채|사채)[\s\S]{0,30}(상환|소각|취득)/.test(title)) {
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
  const title = String(item?.report_nm || '');
  const corp = String(item?.corp_name || '');
  if (/해산사유발생/.test(title) && /기업인수목적|스팩|SPAC/i.test(corp)) return 'followup';
  if (/철회|중단|변경/.test(stage)) return 'change';
  if (CORE_EVENTS.has(id)) return 'core';
  if (['ownership_report','fund_change','performance_risk','group_disclosure'].includes(id)) return 'followup';
  if (id === 'periodic') return 'reference';
  return 'other';
}

function tierLabel(tier) {
  return ({ core:'핵심 변동', change:'정정·조건변경', followup:'후속 확인', reference:'기초자료', other:'참고' })[tier] || '참고';
}

function hasPrivateFundSignal(title) {
  return PRIVATE_FUND_PATTERNS.some((p)=>p.test(title));
}

function dossierContext(match) {
  const profile = DOSSIER_BY_KEY.get(match?.entity_key);
  if (!profile) return '';
  return [
    profile.type_label,
    profile.summary,
    ...(profile.current_status || []).map((entry)=>entry?.text),
    ...(profile.connections || []),
    profile.decision_boundary,
    ...(profile.next_updates || []),
  ].filter(Boolean).join(' ');
}

function matchFitsWatchReason(item, match) {
  if (!match || !PERSONAL_SCOPE_TYPES.has(match.entity_type)) return false;
  if (HOUSE_TYPES.has(match.entity_type)) return true;
  const title = String(item?.report_nm || '');
  // LPs and financial institutions are often watched for a specific fund role;
  // their unrelated corporate filings should not enter the reporter's DART desk.
  if (match.entity_type === 'lp' || match.entity_type === 'financial_institution') {
    return hasPrivateFundSignal(title);
  }
  if (match.entity_type === 'company') {
    // A company dossier qualifies broadly only when its canonical reason for
    // monitoring is a PEF portfolio, M&A/exit, refinancing or special-situation
    // line. Incidental roles such as an anchor LP in one policy fund do not make
    // every company filing relevant.
    return hasPrivateFundSignal(title) || PORTFOLIO_CONTEXT.test(dossierContext(match));
  }
  return false;
}

function reportingScopeMatches(item) {
  const text = [item?.corp_name, item?.flr_nm].filter(Boolean).join(' ');
  if (!text) return [];
  return matchDossiersInText(text, 12).filter((match)=>matchFitsWatchReason(item,match));
}

function inReportingScope(item) {
  // story-engine marks a filer as a PEF/VC house only when the corporate name
  // itself contains a strong private-market identifier. This is different from
  // a generic report title merely mentioning a fund.
  if (item?.pef_entity === true) return true;
  return reportingScopeMatches(item).length > 0;
}

function shouldKeep(item) {
  const refined = refineEvent(item);
  const title = String(refined.report_nm || '');
  if (NOISE_PATTERNS.some((p)=>p.test(title))) return false;
  const id = refined?.analysis?.event_id || 'general';
  const strength = Number(refined?.analysis?.entity_strength || 0);
  const directScope = inReportingScope(refined);
  if (id === 'general') return false;

  // Private-market fund formation can reveal a newly identified PEF/VC even
  // before it is fully represented in the dossier snapshot.
  if (id === 'fund_change') return hasPrivateFundSignal(title) && (directScope || refined.pef_entity === true || strength >= 2);

  // Every other disclosure must match both the entity and the reason it is
  // monitored. An unrelated listed-company correction is not enough.
  if (!directScope) return false;

  // Periodic reports are reference material only for directly identified PEF/VC houses.
  if (id === 'periodic') return refined.pef_entity === true;

  // Participation notices usually duplicate the actual capital-raise decision.
  if (/특수관계인의유상증자참여/.test(title)) return refined.pef_entity === true;

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

module.exports = { buildFamilies, enrich, familyKey, groupFor, inReportingScope, matchFitsWatchReason, refineEvent, reportingScopeMatches, shouldKeep };
