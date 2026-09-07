const crypto = require('crypto');

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hashId(type, parts) {
  return crypto.createHash('sha1').update(`${type}|${(parts || []).join('|')}`).digest('hex').slice(0, 20);
}

function isoDate(value) {
  const text = String(value || '');
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function ageDays(value, now = Date.now()) {
  const date = new Date(value || '').getTime();
  if (!Number.isFinite(date)) return Infinity;
  return Math.max(0, Math.floor((now - date) / 86400000));
}

function sourceLink(label, url, date) {
  if (!url) return null;
  return { label: clean(label) || '원문', url, date: isoDate(date) };
}

function uniqueLinks(values) {
  const seen = new Set();
  return (values || []).filter(Boolean).filter((item) => {
    const key = item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function axesForEvent(eventId) {
  const map = {
    control_change: {
      money: '거래대금·인수금융·잔여 지분의 변화 확인',
      control: '최대주주·의결권·경영권 이동 여부 확인',
      risk: '종결조건·승인·자금조달 실패 위험 확인',
      rule: '공개매수·기업결합·계약상 선행조건 확인',
    },
    equity_acquisition: {
      money: '취득가액과 자금원 변화 확인',
      control: '취득 전후 지분율·의결권 변화 확인',
      risk: '추가 자금부담과 투자회수 조건 확인',
      rule: '이사회 승인·공시상 거래 목적 확인',
    },
    equity_disposal: {
      money: '처분대금·투자원가·회수액 확인',
      control: '처분 뒤 잔여 지분과 영향력 확인',
      risk: '매각 종결·대금 회수 위험 확인',
      rule: '계약·승인·보호예수 조건 확인',
    },
    capital_raise: {
      money: '조달액·발행가·자금 사용처 변화 확인',
      control: '제3자배정 대상과 기존주주 희석 확인',
      risk: '추가 조달 필요성과 상환 부담 확인',
      rule: '발행조건·납입일·보호예수 여부 확인',
    },
    mezzanine: {
      money: '발행액·전환가·만기·옵션 변화 확인',
      control: '전환 시 잠재 지분율 변화 확인',
      risk: '풋옵션·차환·상환재원 위험 확인',
      rule: '리픽싱·담보·전환조건 확인',
    },
    financing_support: {
      money: '차입·대여·보증 규모와 비용 변화 확인',
      control: '자금 지원의 수혜자와 의사결정 주체 확인',
      risk: '만기·담보·차환 위험 확인',
      rule: '이사회·특수관계인 거래 조건 확인',
    },
    distress_legal: {
      money: '채무액·회수가능액·추가 지원 규모 확인',
      control: '채권자·법원·대주주의 통제권 변화 확인',
      risk: '유동성·회생·매각 일정 위험 확인',
      rule: '법원·채권단 절차와 기한 확인',
    },
    fund_change: {
      money: '약정액·납입액·LP 구성 변화 확인',
      control: 'GP·핵심운용역·의사결정 구조 변화 확인',
      risk: '결성·납입·투자 집행 지연 위험 확인',
      rule: '존속기간·출자조건·핵심인력 요건 확인',
    },
  };
  return map[eventId] || {
    money: '금액·자금 흐름에서 달라진 점 확인',
    control: '지분·의결권·계약상 결정권 변화 확인',
    risk: '신용·유동성·거래종결 위험 변화 확인',
    rule: '법·공고·계약 조건 변화 확인',
  };
}

function hypothesisForEvent(eventId, name) {
  const subject = name || '해당 회사';
  const map = {
    control_change: `${subject}의 경영권 이전 또는 지배구조 재편이 한 단계 더 진행됐을 가능성`,
    equity_acquisition: `${subject}의 신규 지분 취득이 단순 재무투자가 아니라 영향력 확대와 연결됐을 가능성`,
    equity_disposal: `${subject}의 지분 처분이 부분 회수 또는 엑시트 단계 진전과 연결됐을 가능성`,
    capital_raise: `${subject}의 자금조달 조건 변화가 기존 주주 희석 또는 추가 유동성 수요를 반영했을 가능성`,
    mezzanine: `${subject}의 메자닌 조건 변화가 차환 필요성이나 잠재 지배구조 변화와 연결됐을 가능성`,
    financing_support: `${subject}의 차입·담보·보증 변화가 유동성 대응 또는 인수금융 재편과 연결됐을 가능성`,
    distress_legal: `${subject}의 법적·재무 위험 변화가 채권 회수와 매각 일정에 영향을 주고 있을 가능성`,
    fund_change: `${subject} 관련 펀드 구조 변화가 LP 구성 또는 실제 결성 상태 변화와 연결됐을 가능성`,
  };
  return map[eventId] || `${subject}에서 같은 유형의 사건이 다시 발생한 이유가 단순 반복이 아니라 구조적 변화일 가능성`;
}

function falsificationForEvent(eventId) {
  if (eventId === 'control_change') return '직전 공시와 비교해 지분율·거래상대방·종결조건이 실질적으로 동일하거나 단순 정정에 그치면 가설을 기각';
  if (['capital_raise', 'mezzanine', 'financing_support'].includes(eventId)) return '금액·만기·상대방·자금용도가 직전 조건과 실질적으로 같고 단순 행정 정정이면 가설을 기각';
  if (eventId === 'distress_legal') return '채무액·법원 절차·채권자 지위에 실질 변화가 없고 기존 사건의 반복 공시면 가설을 기각';
  return '직전 원문과 나란히 비교했을 때 핵심 금액·지분·상대방·일정에 실질적인 변화가 없으면 가설을 기각';
}

function disclosureRowDate(row) {
  return row.receipt_date || row.raw_data?.rcept_dt || row.rcept_dt || null;
}

function disclosureRaw(row) {
  return row.raw_data || row || {};
}

function detectDartChanges(disclosures, options = {}) {
  const recentDays = Number(options.recentDays || 14);
  const byRcept = new Map((disclosures || []).map((row) => [String(row.rcept_no || row.raw_data?.rcept_no || ''), row]));
  const clues = [];
  for (const row of disclosures || []) {
    if (ageDays(disclosureRowDate(row)) > recentDays) continue;
    const raw = disclosureRaw(row);
    const analysis = raw.analysis || {};
    const previous = analysis.previous_event;
    if (!analysis.is_correction && !previous) continue;
    const eventId = analysis.event_id || 'general';
    const corp = raw.corp_name || row.corp_name || '회사명 미상';
    const previousRow = previous?.rcept_no ? byRcept.get(String(previous.rcept_no)) : null;
    const prevAnalysis = disclosureRaw(previousRow || {}).analysis || {};
    const currentNumbers = analysis.key_numbers || [];
    const previousNumbers = prevAnalysis.key_numbers || [];
    const numericChanged = currentNumbers.length && previousNumbers.length && JSON.stringify(currentNumbers) !== JSON.stringify(previousNumbers);
    const changedFact = numericChanged
      ? `자동 추출된 핵심 숫자 후보가 이전 ${previousNumbers.join(', ')} → 현재 ${currentNumbers.join(', ')}로 달라졌습니다. 같은 항목인지 원문 표에서 재확인해야 합니다.`
      : analysis.change_summary || (analysis.is_correction
        ? '정정 공시가 나왔습니다. 정정 전후의 금액·지분율·상대방·일정을 나란히 대조해야 합니다.'
        : '같은 유형의 공시가 다시 나왔습니다. 직전 공시와 조건을 비교해야 합니다.');
    const currentUrl = raw.url || row.dart_url;
    const prevUrl = previous?.url || disclosureRaw(previousRow || {}).url || previousRow?.dart_url;
    clues.push({
      clue_id: hashId('dart_change', [raw.rcept_no || row.rcept_no, previous?.rcept_no || 'none']),
      detector: 'dart_change',
      detector_label: 'DART 변화',
      fact_status: '확인',
      detected_at: isoDate(disclosureRowDate(row)),
      sort_date: isoDate(disclosureRowDate(row)),
      headline: `${corp} · ${analysis.event_label || row.event_type || '공시 변화'}`,
      one_line_signal: analysis.is_correction
        ? `${corp}에서 ${analysis.event_label || '동일 사건'} 정정 공시가 나왔습니다.`
        : `${corp}에서 ${analysis.event_label || '같은 유형'} 공시가 다시 나왔습니다.`,
      previous_state: previous
        ? `${isoDate(previous.rcept_dt) || '이전'} · ${previous.report_nm || '직전 동일 유형 공시'}`
        : '정정 전 원문 확인 필요',
      changed_fact: changedFact,
      axes: axesForEvent(eventId),
      entities: [corp],
      confirmed_facts: [
        `현재 공시: ${raw.report_nm || row.report_nm || '공시명 미상'}`,
        previous ? `직전 동일 유형 공시: ${previous.report_nm || '공시명 미상'}` : '정정 공시 여부 확인',
      ],
      reported: [],
      unknowns: ['실제 변경된 표의 항목과 숫자', '거래상대방·지분율·일정의 실질 변경 여부'],
      hypothesis: hypothesisForEvent(eventId, corp),
      falsification: falsificationForEvent(eventId),
      compare_cases: ['같은 회사의 직전 동일 유형 공시', '동종 거래의 최근 조건'],
      sources: uniqueLinks([
        sourceLink('현재 DART 공시', currentUrl, disclosureRowDate(row)),
        sourceLink('직전 DART 공시', prevUrl, previous?.rcept_dt),
      ]),
      contacts: ['공시 담당자', '거래 상대방 또는 주요 주주', '필요시 자문사·채권자'],
      questions: analysis.questions || [analysis.next_check || '정정 전후 무엇이 실제로 달라졌나', '금액·지분·일정 중 핵심 변경 항목은 무엇인가'],
      judgment: '추가취재',
      judgment_reason: '공식 공시상 변화 신호는 확인됐지만 변경의 실질 의미와 거래 영향은 원문 대조·당사자 확인이 필요합니다.',
      next_action: analysis.next_check || '현재 공시와 직전 공시를 나란히 열고 변경된 숫자·상대방·일정을 먼저 대조',
    });
  }
  return clues;
}

function programClass(group) {
  const title = clean(group?.plan?.title || group?.title || group?.latest?.title);
  const nth = title.match(/(\d+)\s*차\s*정시/);
  if (nth) return `정시-${nth[1]}차`;
  if (/정시/.test(title)) return '정시';
  const month = title.match(/(\d{1,2})월\s*수시/);
  if (month) return `수시-${month[1]}월`;
  if (/수시/.test(title)) return '수시';
  const track = title.match(/Track\s*([12])/i);
  if (track) return `Track-${track[1]}`;
  return clean(group?.account || '기타');
}

function metricNumber(value) {
  const text = String(value || '').replace(/,/g, '');
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function extractPlanTerms(group) {
  const plan = group?.plan || group?.latest || {};
  const aggregate = plan.aggregate || {};
  const text = clean(plan.page_text || '');
  const formationMonths = text.match(/(?:결성기한|결성시한|결성기간)[^0-9]{0,30}(\d+)\s*개월/)?.[1] || null;
  const contributionRatio = text.match(/(?:출자비율|모태출자비율)[^0-9]{0,30}([0-9]+(?:\.[0-9]+)?)\s*%/)?.[1] || null;
  const gpCount = text.match(/(?:선정(?:예정)?\s*(?:조합|운용사|GP)?\s*(?:수)?)[^0-9]{0,20}(\d+)\s*(?:개|곳)/i)?.[1] || null;
  return {
    mother_commitment: aggregate.mother_commitment || group?.mother_commitment || null,
    planned_formation: aggregate.planned_formation || group?.planned_formation || null,
    formation_months: formationMonths ? Number(formationMonths) : null,
    contribution_ratio: contributionRatio ? Number(contributionRatio) : null,
    gp_count: gpCount ? Number(gpCount) : null,
  };
}

function comparePlanTerms(previous, current) {
  const labels = {
    mother_commitment: '출자 관련 금액',
    planned_formation: '결성 예정액·최소결성규모',
    formation_months: '결성기한',
    contribution_ratio: '출자비율',
    gp_count: '선정 GP 수',
  };
  const changes = [];
  for (const key of Object.keys(labels)) {
    const before = previous[key];
    const after = current[key];
    if (before === null || before === undefined || after === null || after === undefined) continue;
    const beforeKey = typeof before === 'number' ? before : clean(before);
    const afterKey = typeof after === 'number' ? after : clean(after);
    if (beforeKey === afterKey) continue;
    const suffix = key === 'formation_months' ? '개월' : key === 'contribution_ratio' ? '%' : key === 'gp_count' ? '곳' : '';
    changes.push({ key, label: labels[key], before: `${before}${suffix}`, after: `${after}${suffix}` });
  }
  return changes;
}

function detectKvicPlanChanges(groups) {
  const buckets = new Map();
  for (const group of groups || []) {
    if (!group?.plan) continue;
    const key = `${clean(group.account)}|${programClass(group)}`;
    const rows = buckets.get(key) || [];
    rows.push(group);
    buckets.set(key, rows);
  }
  const clues = [];
  for (const rows of buckets.values()) {
    const sorted = [...rows].sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || String(b.plan?.posted_date || '').localeCompare(String(a.plan?.posted_date || '')));
    if (sorted.length < 2) continue;
    const current = sorted[0];
    const previous = sorted.find((row) => Number(row.year || 0) < Number(current.year || 0));
    if (!previous) continue;
    if (ageDays(current.plan?.posted_date) > 240) continue;
    const currentTerms = extractPlanTerms(current);
    const previousTerms = extractPlanTerms(previous);
    const changes = comparePlanTerms(previousTerms, currentTerms);
    if (!changes.length) continue;
    const changeText = changes.map((change) => `${change.label} ${change.before} → ${change.after}`).join(' · ');
    const moneyChanged = changes.some((change) => ['mother_commitment', 'planned_formation'].includes(change.key));
    const ruleChanged = changes.some((change) => ['formation_months', 'contribution_ratio', 'gp_count'].includes(change.key));
    clues.push({
      clue_id: hashId('kvic_plan_change', [current.business_key, previous.business_key, current.year]),
      detector: 'kvic_plan_change',
      detector_label: '출자공고 변화',
      fact_status: '확인',
      detected_at: isoDate(current.plan?.posted_date),
      sort_date: isoDate(current.plan?.posted_date),
      headline: `${current.account} · ${programClass(current)} 출자조건 변화`,
      one_line_signal: `${current.account} ${programClass(current)} 공고에서 전년 대비 ${changes.slice(0, 2).map((change) => change.label).join('·')}이 달라졌습니다.`,
      previous_state: `${previous.year || '이전 연도'} · ${previous.plan?.title || previous.title}`,
      changed_fact: changeText,
      axes: {
        money: moneyChanged ? '출자액·최소결성규모 변화가 GP별 실제 조달 부담을 어떻게 바꾸는지 확인' : '직접 확인된 금액 변화 없음 또는 자동 추출 범위 밖',
        control: '선정 GP 수·운용조건 변화가 어느 규모의 GP에 유리한지 확인',
        risk: '결성기한·민간매칭 조건이 펀드 결성 실패·지연 위험을 높였는지 확인',
        rule: ruleChanged ? '선정 수·출자비율·결성기한 등 공고 규칙이 전년과 달라짐' : '공고 본문의 세부 자격요건 추가 비교 필요',
      },
      entities: ['한국벤처투자', current.account],
      confirmed_facts: changes.map((change) => `${change.label}: ${change.before} → ${change.after}`),
      reported: [],
      unknowns: ['지원자격·트랙레코드·핵심인력 요건 변화', '변경 조건으로 실제 지원 GP 구성이 달라졌는지'],
      hypothesis: '출자조건 변화로 중소형·신생 GP와 대형·기성 GP 사이의 선정 유불리가 전년과 달라졌을 가능성',
      falsification: '두 공고가 서로 다른 계정·트랙을 대상으로 해 직접 비교가 부적절하거나, 전체 지원 결과에서 특정 규모 GP로의 쏠림이 나타나지 않으면 가설을 약화',
      compare_cases: [`${previous.year || '직전 연도'} 동일 계정·유형 공고`, '직전 지원·선정 결과와 경쟁률'],
      sources: uniqueLinks([
        sourceLink('현재 출자공고', current.plan?.source_url, current.plan?.posted_date),
        sourceLink('직전 비교 공고', previous.plan?.source_url, previous.plan?.posted_date),
      ]),
      contacts: ['한국벤처투자 출자사업 담당자', '지원 예정 GP', '직전 연도 선정·탈락 GP'],
      questions: [
        '이번 공고에서 전년 대비 바꾼 조건은 무엇이고 왜 바꿨나',
        '선정 GP 수·출자비율·결성기한 변경이 어떤 유형의 GP를 염두에 둔 것인가',
        '실제 지원 GP 구성과 경쟁률이 전년과 어떻게 달라졌나',
      ],
      judgment: '추가취재',
      judgment_reason: '공식 공고의 조건 변화는 확인됐지만 시장 참여자에게 실제 어떤 유불리를 만들었는지는 지원·선정 결과와 당사자 확인이 필요합니다.',
      next_action: '두 공고 원문을 나란히 두고 자격요건·선정기준·핵심인력·민간매칭 조항까지 추가 대조',
    });
  }
  return clues;
}

function latestGroupDateForManager(manager, groups) {
  const values = [];
  for (const group of groups || []) {
    if (!(group.selected_managers || []).some((name) => clean(name) === clean(manager))) continue;
    if (group.selection?.posted_date) values.push(group.selection.posted_date);
  }
  return values.sort().reverse()[0] || null;
}

function detectRepeatGps(gpStats, groups) {
  const clues = [];
  for (const gp of gpStats || []) {
    if (Number(gp.selected || 0) < 2 || gp.fund_api_only) continue;
    const latestDate = latestGroupDateForManager(gp.manager, groups);
    if (latestDate && ageDays(latestDate) > 365) continue;
    const businesses = (gp.businesses || []).filter((item) => item.stage === 'selected');
    clues.push({
      clue_id: hashId('gp_repeat', [gp.manager, gp.selected, businesses.map((item) => item.business_key).join(',')]),
      detector: 'gp_repeat',
      detector_label: 'GP 반복선정',
      fact_status: '확인',
      detected_at: isoDate(latestDate) || new Date().toISOString().slice(0, 10),
      sort_date: isoDate(latestDate) || '0000-00-00',
      headline: `${gp.manager} · 수집 범위 내 ${gp.selected}회 반복 선정`,
      one_line_signal: `${gp.manager}가 공식 선정자료에서 ${gp.selected}회 반복 선정됐습니다.`,
      previous_state: businesses.slice(0, 5).map((item) => `${item.year || ''} ${item.account || ''}`).join(' · ') || '과거 선정 이력 확인',
      changed_fact: `최근 수집된 선정 결과까지 포함하면 선정 횟수가 ${gp.selected}회입니다. 반복 선정이 특정 LP·계정에 집중되는지 비교할 필요가 있습니다.`,
      axes: {
        money: '정책·기관 LP 자금에 반복적으로 접근하면서 펀드레이징 여력이 누적되는지 확인',
        control: '반복 선정이 핵심 운용역·트랙레코드·LP 네트워크와 연결되는지 확인',
        risk: '반복 선정 이후 실제 결성 실패·지연 사례가 있는지 함께 확인',
        rule: '선정 기준이 동일 GP의 반복 선정에 구조적으로 유리한지 연도별 기준 비교',
      },
      entities: [gp.manager, ...(gp.accounts || []).slice(0, 4)],
      confirmed_facts: [`공식 선정자료 수집 범위에서 ${gp.selected}회 선정 확인`],
      reported: [],
      unknowns: ['전체 지원 횟수 대비 실제 선정률', '동일 기간 전체 GP 중 반복 선정 비중', '각 선정 펀드의 실제 결성·납입 여부'],
      hypothesis: `${gp.manager}의 반복 선정이 단순 우연이 아니라 특정 트랙레코드·LP 선호·선정기준과 연결돼 있을 가능성`,
      falsification: '전체 지원 횟수와 비교한 선정률이 특별히 높지 않거나, 동기간 다수 GP가 비슷한 횟수로 반복 선정됐다면 가설을 약화',
      compare_cases: ['동일 계정의 다른 GP 선정횟수', '해당 GP의 탈락·서류통과 이력', '선정 후 실제 결성률'],
      sources: [],
      contacts: [gp.manager, '해당 출자사업 LP 담당자', '동일 계정 경쟁 GP'],
      questions: [
        '반복 선정된 각 출자사업에서 제안전략과 핵심운용역이 같았나',
        'LP가 반복 선정의 핵심 이유로 본 트랙레코드는 무엇인가',
        '선정된 펀드들은 실제로 모두 계획대로 결성됐나',
      ],
      judgment: '추가취재',
      judgment_reason: '반복 선정이라는 패턴은 확인됐지만 이것이 시장 관행 변화인지 개별 GP 경쟁력인지 비교군 확인이 필요합니다.',
      next_action: '동일 계정·동일 기간 GP별 선정 횟수와 지원 횟수를 나란히 비교',
    });
  }
  return clues;
}

function detectFormationGaps(groups) {
  const clues = [];
  for (const group of groups || []) {
    if (!group.selection || !(group.selected_managers || []).length) continue;
    if (!['unconfirmed', 'partial'].includes(group.formation_status)) continue;
    const selectedDate = group.selection.posted_date;
    const elapsed = ageDays(selectedDate);
    if (!Number.isFinite(elapsed) || elapsed < 90) continue;
    const managers = group.selected_managers || [];
    const confirmed = Number(group.formation_confirmed_count || 0);
    const unconfirmedManagers = (group.manager_formation || []).filter((row) => !row.confirmed).map((row) => row.manager);
    clues.push({
      clue_id: hashId('formation_gap', [group.business_key, selectedDate, unconfirmedManagers.join(',')]),
      detector: 'formation_gap',
      detector_label: '결성 미확인',
      fact_status: '단서',
      detected_at: new Date().toISOString().slice(0, 10),
      sort_date: isoDate(selectedDate) || '0000-00-00',
      headline: `${group.title} · 선정 후 ${elapsed}일, 결성 ${confirmed}/${managers.length} 확인`,
      one_line_signal: `${group.title}는 최종 선정 후 ${elapsed}일이 지났지만 KVIC 펀드 현황에서 ${managers.length - confirmed}개 GP의 실제 결성이 아직 확인되지 않습니다.`,
      previous_state: `${isoDate(selectedDate) || selectedDate} 최종 GP 선정 · ${managers.join(', ')}`,
      changed_fact: `현재 대조 기준으로 ${confirmed}개 GP는 결성 확인, ${unconfirmedManagers.join(', ') || '나머지 GP'}는 결성 미확인입니다. 미결성으로 단정할 수는 없습니다.`,
      axes: {
        money: '민간 LP 확약·실제 약정액·납입액이 계획대로 채워졌는지 확인',
        control: '핵심운용역 변경·공동GP 역할 변화가 결성에 영향을 줬는지 확인',
        risk: '펀드레이징 지연·결성기한 연장·선정 취소 가능성 확인',
        rule: '해당 출자사업의 실제 결성기한·연장조건·제재 기준 확인',
      },
      entities: [...managers, group.account].filter(Boolean),
      confirmed_facts: [`${isoDate(selectedDate) || selectedDate} 최종 선정`, `KVIC 펀드 현황 대조상 ${confirmed}/${managers.length} 결성 확인`],
      reported: [],
      unknowns: ['실제 결성총회 개최일', '조합 등록일', 'LP 확약액·실제 약정액·납입액', '결성기한 연장 승인 여부'],
      hypothesis: '민간 LP 모집 또는 결성 절차가 당초 계획보다 길어지고 있을 가능성',
      falsification: '이미 펀드가 결성·등록됐지만 KVIC API 반영이 늦었거나 다른 명칭으로 등록된 경우 가설을 기각',
      compare_cases: ['같은 출자사업에서 이미 결성된 GP', '직전 연도 동일 계정의 선정→결성 소요기간'],
      sources: uniqueLinks([sourceLink('GP 선정 결과', group.selection.source_url, selectedDate)]),
      contacts: [...unconfirmedManagers.slice(0, 4), '한국벤처투자 출자사업 담당자', '민간 앵커 LP 후보'],
      questions: [
        '결성총회와 조합 등록을 마쳤나. 정확한 날짜는 언제인가',
        '현재 약정액과 실제 납입액은 각각 얼마인가',
        '결성기한 연장을 신청했거나 승인받았나',
        '민간 LP 모집에서 예상과 달라진 점이 있었나',
      ],
      judgment: '추가취재',
      judgment_reason: '선정 이후 결성이 자동 대조에서 확인되지 않는 신호는 있으나 실제 미결성·지연 여부는 GP·LP 확인이 필수입니다.',
      next_action: '미확인 GP에 결성총회·조합등록·약정액·납입액을 먼저 확인하고 LP에 결성기한 연장 여부 교차확인',
    });
  }
  return clues;
}

function leadTargetName(item) {
  return clean(item?.target?.name || item?.subject_name || '');
}

function detectCrossSourceSequences(leads) {
  const now = Date.now();
  const recent = (leads || []).filter((item) => ageDays(item.published_at, now) <= 45 && leadTargetName(item));
  const buckets = new Map();
  for (const item of recent) {
    const target = leadTargetName(item);
    if (target.length < 2 || /^20\d{2}/.test(target)) continue;
    const key = target.toLowerCase();
    const rows = buckets.get(key) || [];
    rows.push(item);
    buckets.set(key, rows);
  }
  const clues = [];
  for (const rows of buckets.values()) {
    const sorted = [...rows].sort((a, b) => String(a.published_at || '').localeCompare(String(b.published_at || '')));
    const eventTypes = [...new Set(sorted.map((item) => item.event_type).filter((type) => type && type !== 'general'))];
    const sourceNames = [...new Set(sorted.map((item) => item.source_name).filter(Boolean))];
    if (eventTypes.length < 2 || sourceNames.length < 2) continue;
    const target = leadTargetName(sorted[0]);
    const latest = sorted[sorted.length - 1];
    const previous = [...sorted].reverse().find((item) => item.event_type !== latest.event_type);
    if (!previous) continue;
    const status = sorted.some((item) => item.source_type === 'domestic_news') ? '단서' : '확인';
    clues.push({
      clue_id: hashId('cross_source', [target, eventTypes.sort().join(','), latest.signal_id]),
      detector: 'cross_source',
      detector_label: '자료 연결',
      fact_status: status,
      detected_at: isoDate(latest.published_at) || new Date().toISOString().slice(0, 10),
      sort_date: isoDate(latest.published_at) || '0000-00-00',
      headline: `${target} · 서로 다른 사건 신호 ${eventTypes.length}종 연속 발생`,
      one_line_signal: `${target}에서 ${previous.event_label || previous.event_type} → ${latest.event_label || latest.event_type} 신호가 45일 안에 이어졌습니다.`,
      previous_state: `${isoDate(previous.published_at) || ''} ${previous.title}`,
      changed_fact: `${isoDate(latest.published_at) || ''} ${latest.title}이 추가되면서 서로 다른 자료가 하나의 사건선으로 연결될 가능성이 생겼습니다.`,
      axes: {
        money: '두 사건 사이 자금조달·출자·투자·회수 흐름이 실제로 연결되는지 확인',
        control: '인사·지분·GP 역할 변화가 의사결정 구조와 연결되는지 확인',
        risk: '후속 사건이 앞선 사건의 지연·실패·리스크 전이를 의미하는지 확인',
        rule: '공시·LP 조건·계약 조항상 두 사건이 같은 의사결정선에 있는지 확인',
      },
      entities: [target],
      confirmed_facts: sorted.filter((item) => item.source_type !== 'domestic_news').slice(-3).map((item) => `${item.source_name}: ${item.title}`),
      reported: sorted.filter((item) => item.source_type === 'domestic_news').slice(-3).map((item) => `${item.source_name}: ${item.title}`),
      unknowns: ['두 사건의 실제 인과관계', '공통 의사결정자·LP·거래상대방 존재 여부'],
      hypothesis: `${target}의 최근 사건들이 별개가 아니라 하나의 자금·조직·거래 변화 과정에서 연속적으로 발생했을 가능성`,
      falsification: '당사자 확인 결과 두 사건의 담당 조직·펀드·거래가 서로 무관하거나 시간상 우연히 겹친 것이라면 가설을 기각',
      compare_cases: ['같은 대상의 최근 6개월 사건 연표', '동일 운용사·기업에서 비슷한 사건 순서가 있었던 과거 사례'],
      sources: uniqueLinks(sorted.slice(-5).map((item) => sourceLink(item.source_name, item.source_url, item.published_at))),
      contacts: [target, '각 사건의 직접 당사자', '관련 LP·자문사·거래상대방'],
      questions: [
        '두 사건은 같은 펀드·거래·의사결정과 연결돼 있나',
        '앞선 사건 때문에 뒤의 사건 일정이나 조건이 달라졌나',
        '외부에 아직 공개되지 않은 중간 단계가 있었나',
      ],
      judgment: '추가취재',
      judgment_reason: '복수 자료가 같은 대상에서 연속 발생한 사실은 확인할 수 있지만 인과관계는 독자 취재가 필요합니다.',
      next_action: '사건 연표를 만든 뒤 두 사건의 담당자에게 인과관계와 중간 단계 존재 여부를 각각 확인',
    });
  }
  return clues;
}

function dedupeClues(clues) {
  const seen = new Set();
  return (clues || []).filter((clue) => {
    if (!clue?.clue_id || seen.has(clue.clue_id)) return false;
    seen.add(clue.clue_id);
    return true;
  });
}

function buildClues({ disclosures = [], leads = [], groups = [], gpStats = [] } = {}) {
  const clues = dedupeClues([
    ...detectDartChanges(disclosures),
    ...detectKvicPlanChanges(groups),
    ...detectRepeatGps(gpStats, groups),
    ...detectFormationGaps(groups),
    ...detectCrossSourceSequences(leads),
  ]);
  return clues.sort((a, b) => String(b.sort_date || '').localeCompare(String(a.sort_date || '')) || a.detector.localeCompare(b.detector)).slice(0, 40);
}

module.exports = {
  buildClues,
  detectCrossSourceSequences,
  detectDartChanges,
  detectFormationGaps,
  detectKvicPlanChanges,
  detectRepeatGps,
  extractPlanTerms,
};
