const crypto = require('crypto');

const SPREADSHEET_ID = '13kWKTy_KGjhhJCwOdW52mc3DlBQdfv5qCkWOxJIjaA0';
const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
const SNAPSHOT_DATE = '2026-09-07';

function id(type, parts) {
  return crypto.createHash('sha1').update(`${type}|${parts.join('|')}`).digest('hex').slice(0, 20);
}

function sheetUrl(gid, range) {
  return `${SPREADSHEET_URL}#gid=${gid}&range=${encodeURIComponent(range)}`;
}

const REPEAT_GPS = [
  { row: 3, name: '서울대학교기술지주', officialSelections: 2, officialLpCount: 2, lps: ['한국성장금융투자운용', '한국벤처투자'], latest: '2026-07-29' },
  { row: 4, name: '원익투자파트너스', officialSelections: 2, officialLpCount: 2, lps: ['한국성장금융투자운용', '한국벤처투자'], latest: '2026-07-29' },
  { row: 6, name: '뮤렉스파트너스', officialSelections: 2, officialLpCount: 2, lps: ['한국성장금융투자운용', '한국벤처투자'], latest: '2026-07-29' },
  { row: 7, name: '미래에셋벤처투자', officialSelections: 2, officialLpCount: 2, lps: ['국민연금공단 기금운용본부', '한국벤처투자'], latest: '2026-07-09' },
  { row: 11, name: '프렌드투자파트너스', officialSelections: 2, officialLpCount: 2, lps: ['한국성장금융투자운용', '한국벤처투자'], latest: '2026-07-29' },
  { row: 12, name: '프리미어파트너스', officialSelections: 2, officialLpCount: 2, lps: ['국민연금공단 기금운용본부', '한국벤처투자'], latest: '2026-07-09' },
];

const FORMATION_WATCH = [
  { row: 5, gp: '뮤렉스파트너스', lp: '한국벤처투자', selected: '2026-04-29', track: 'NUP 스케일업 AI융합', elapsed: 131, condition: '최종선정 후 3개월(공고 요약자료 확인·첨부 원문 직접검증 대기)', firstDeadline: '2026-07-29', daysToFirst: -40, extension: '연장 조건 원문확인 필요', current: '1차기한 경과·연장/철회 확인', next: '연장 승인·자진철회·조합등록 여부 즉시 확인' },
  { row: 7, gp: '원익투자파트너스', lp: '한국벤처투자', selected: '2026-04-29', track: 'NUP 스케일업 딥테크', elapsed: 131, condition: '최종선정 후 3개월(공고 요약자료 확인·첨부 원문 직접검증 대기)', firstDeadline: '2026-07-29', daysToFirst: -40, extension: '연장 조건 원문확인 필요', current: '1차기한 경과·연장/철회 확인', next: '연장 승인·자진철회·조합등록 여부 즉시 확인' },
  { row: 8, gp: '씨엔티테크', lp: '한국벤처투자', selected: '2026-04-29', track: '창업초기 소형·젠엑시스 공동GP', elapsed: 131, condition: '최종선정 후 3개월(공고 요약자료 확인·첨부 원문 직접검증 대기)', firstDeadline: '2026-07-29', daysToFirst: -40, extension: '연장 조건 원문확인 필요', current: '1차기한 경과·연장/철회 확인', next: '연장 승인·자진철회·조합등록 여부 즉시 확인' },
  { row: 4, gp: '프리미어파트너스', lp: '한국벤처투자', selected: '2026-06-24', track: 'K-바이오·백신 7호', elapsed: 75, condition: '3+3개월, 700억원 이상 우선결성 가능', firstDeadline: '2026-09-24', daysToFirst: 17, extension: '연장 가능 조건 있음', current: '1차기한 임박', next: '우선·최종 결성 공지와 민간 LP 확인' },
];

const GP_LP_SHIFTS = [
  { row: 35, gp: '이앤인베스트먼트', fromLp: '한국성장금융투자운용', toLp: '한국산업은행', tag: 'LP 교체', point: '기존 LP에서 다른 LP로 이동한 배경과 지원전략 확인' },
  { row: 37, gp: '인터베스트', fromLp: '대한지방행정공제회', toLp: '국민연금공단 기금운용본부', tag: 'LP 교체', point: '기존 LP에서 다른 LP로 이동한 배경과 지원전략 확인' },
  { row: 41, gp: '컴퍼니케이파트너스', fromLp: '한국벤처투자', toLp: '한국산업은행', tag: 'LP 교체', point: '기존 LP에서 다른 LP로 이동한 배경과 지원전략 확인' },
  { row: 49, gp: 'IMM인베스트먼트', fromLp: '한국성장금융투자운용', toLp: '한국산업은행', tag: 'LP 교체', point: '기존 LP에서 다른 LP로 이동한 배경과 지원전략 확인' },
  { row: 53, gp: 'LB인베스트먼트', fromLp: '한국교직원공제회', toLp: '한국산업은행', tag: 'LP 교체', point: '기존 LP에서 다른 LP로 이동한 배경과 지원전략 확인' },
];

const LP_RULE_CHANGES = [
  {
    row: 3,
    lp: '국민연금공단 기금운용본부',
    program: '2026 국내 벤처펀드',
    previous: '예년 연간 약 2,000억원 이내 배정·운용사 수 상대적으로 적음',
    changed: '총 4,000억원 이내·6개 운용사로 확대. 업계 건의를 반영해 핵심 운용인력 겸업 기준 완화',
    process: '4월 선정계획 공고 → 제안서 심사 → 현장실사 → 선정위원회',
    affected: '기존 펀드 핵심인력을 병행 투입해야 하는 중대형 VC·복수펀드 운용사',
    result: '14곳 지원·6곳 선정: 미래에셋벤처투자·에이티넘·파트너스·프리미어·SL·인터베스트',
    causality: '아니오. 기준 완화가 특정 GP 선정의 직접 원인인지는 미공개',
    question: '14곳 중 기존 기준이면 지원이 어려웠을 운용사는 누구였나? 겸업 완화가 지원자 확대와 선정 구성을 실제로 바꿨나?',
    source: 'https://fund.nps.or.kr/impa/nscvrgdatadtl/getOHEF0014M0.do?hmpgBbsCd=BS20240174&pstId=ZZ202600000000000791',
    verification: '원문확인',
  },
];

function repeatGpClues() {
  return REPEAT_GPS.map((row) => ({
    clue_id: id('canonical_gp_repeat', [row.name, row.latest]),
    detector: 'gp_repeat',
    detector_label: 'GP 반복선정',
    fact_status: '확인',
    detected_at: row.latest,
    sort_date: row.latest,
    headline: `${row.name} · 서로 다른 공식 LP ${row.officialLpCount}곳에서 반복 선정`,
    one_line_signal: `${row.name}가 2026년 수집 정본에서 공식 선정 ${row.officialSelections}회, 서로 다른 공식 LP ${row.officialLpCount}곳으로 확인됐습니다.`,
    previous_state: `공식 LP: ${row.lps.join(' · ')}`,
    changed_fact: '한 LP의 복수 트랙 반복이 아니라 서로 다른 공식 LP에서 선정이 겹치는 패턴이 확인됩니다.',
    axes: {
      money: '여러 기관 LP 자금에 반복 접근하면서 신규 펀드레이징 여력이 커지는지 확인',
      control: 'LP별 선정에서 동일 대표PM·핵심운용역이 반복되는지 확인',
      risk: '반복 선정된 펀드들이 실제 결성·납입까지 이어졌는지 확인',
      rule: 'LP별 선정기준 가운데 공통적으로 유리하게 작용한 요건이 있었는지 비교',
    },
    entities: [row.name, ...row.lps],
    confirmed_facts: [`공식선정 ${row.officialSelections}회`, `서로 다른 공식 LP ${row.officialLpCount}곳`, `공식 LP: ${row.lps.join(', ')}`],
    reported: [],
    unknowns: ['각 LP별 지원 횟수와 탈락 이력', '각 선정 펀드의 실제 결성액·민간 LP 구성', '동일 기간 경쟁 GP의 복수 LP 선정 빈도'],
    hypothesis: `${row.name}의 반복 선정이 특정 LP 한 곳의 반복 선호가 아니라 여러 LP가 공통으로 평가한 트랙레코드·운용역 경쟁력과 연결됐을 가능성`,
    falsification: '전체 지원 횟수 대비 선정률이 특별히 높지 않거나 동기간 경쟁 GP 상당수가 같은 수준으로 복수 LP에 선정됐다면 가설을 약화',
    compare_cases: ['동일 기간 다른 GP의 공식 LP 수', '각 LP별 지원·탈락 결과', '선정 후 실제 결성률'],
    sources: [{ label: '정본 · GP 반복선정 랭킹', url: sheetUrl(2034, `A${row.row}:H${row.row}`), date: SNAPSHOT_DATE }],
    contacts: [row.name, ...row.lps],
    questions: ['각 LP에서 제시한 핵심 투자전략과 대표PM은 동일했나', '복수 LP가 공통으로 높게 본 실적·팀 요인은 무엇이었나', '선정된 펀드의 현재 민간 LP 확약·결성 상태는 어떤가'],
    judgment: '추가취재',
    judgment_reason: '복수 공식 LP 선정 패턴은 정본에서 확인됐지만 원인과 시장 일반화 여부는 비교군·당사자 확인이 필요합니다.',
    next_action: '각 LP의 선정 공고·결과를 열어 동일 GP의 제안전략·대표PM·결성조건을 나란히 비교',
  }));
}

function formationClues() {
  return FORMATION_WATCH.map((row) => {
    const overdue = row.daysToFirst < 0;
    return {
      clue_id: id('canonical_formation_watch', [row.gp, row.lp, row.track, row.selected]),
      detector: 'formation_gap',
      detector_label: overdue ? '결성기한 경과 확인' : '결성기한 임박',
      fact_status: '단서',
      detected_at: SNAPSHOT_DATE,
      sort_date: SNAPSHOT_DATE,
      headline: `${row.gp} · ${row.track} ${row.current}`,
      one_line_signal: overdue
        ? `${row.gp}의 ${row.track}는 정본 기준 1차 예상 결성기한이 ${Math.abs(row.daysToFirst)}일 지났고 연장·철회·조합등록 여부가 아직 확인되지 않았습니다.`
        : `${row.gp}의 ${row.track}는 1차 예상 결성기한 ${row.firstDeadline}을 앞두고 우선·최종 결성 여부 확인이 필요합니다.`,
      previous_state: `${row.selected} ${row.lp} 선정 · 조건: ${row.condition}`,
      changed_fact: `현재 정본 상태: ${row.current} · 연장상태: ${row.extension}`,
      axes: {
        money: '민간 LP 확약액·실제 약정액·납입액이 계획대로 채워졌는지 확인',
        control: '공동GP·대표PM·핵심운용역 변경이 결성에 영향을 줬는지 확인',
        risk: overdue ? '결성기한 연장·자진철회·선정취소 가능성 확인' : '기한 내 결성 실패 또는 연장 필요 가능성 확인',
        rule: `공고 원문의 결성 조건(${row.condition})과 실제 연장 승인 여부 확인`,
      },
      entities: [row.gp, row.lp],
      confirmed_facts: [`선정일 ${row.selected}`, `정본 기록 결성조건: ${row.condition}`, `정본 현재상태: ${row.current}`],
      reported: [],
      unknowns: ['결성총회 개최일', '조합 등록일', '실제 약정액·납입액', '연장 승인 또는 자진철회 여부'],
      hypothesis: overdue ? '민간 LP 모집 또는 결성 절차가 당초 계획보다 길어졌을 가능성' : '1차 결성기한 전에 우선결성을 위한 민간 LP 확약이 집중되고 있을 가능성',
      falsification: '이미 조합이 결성·등록됐으나 정본 갱신이 늦은 경우 또는 공고 원문의 실제 기한이 정본의 예상기한과 다른 경우 가설을 기각',
      compare_cases: ['같은 출자사업에서 기한 내 결성된 GP', '직전 연도 동일 계정의 선정→결성 소요기간'],
      sources: [{ label: '정본 · 결성기한 감시', url: sheetUrl(2042, `A${row.row}:M${row.row}`), date: SNAPSHOT_DATE }],
      contacts: [row.gp, row.lp, '민간 앵커 LP 후보'],
      questions: ['결성총회와 조합 등록을 마쳤나. 정확한 날짜는 언제인가', '현재 약정액과 실제 납입액은 얼마인가', '연장 승인을 신청했거나 받았나', '민간 LP 모집에서 예상과 달라진 점은 무엇인가'],
      judgment: '추가취재',
      judgment_reason: '정본상 결성 확인이 필요한 상태지만 미결성·지연으로 단정하려면 GP와 LP의 직접 확인이 필요합니다.',
      next_action: row.next,
    };
  });
}

function gpLpShiftClues() {
  return GP_LP_SHIFTS.map((row) => ({
    clue_id: id('canonical_gp_lp_shift', [row.gp, row.fromLp, row.toLp]),
    detector: 'gp_lp_shift',
    detector_label: 'GP·LP 이동',
    fact_status: '단서',
    detected_at: SNAPSHOT_DATE,
    sort_date: SNAPSHOT_DATE,
    headline: `${row.gp} · 2025→2026 포착 LP 교체`,
    one_line_signal: `${row.gp}는 정본의 연도비교에서 2025 ${row.fromLp} → 2026 ${row.toLp} 선정으로 포착됐습니다.`,
    previous_state: `2025 포착 LP: ${row.fromLp}`,
    changed_fact: `2026 포착 LP: ${row.toLp} · 변화태그: ${row.tag}`,
    axes: {
      money: '어느 LP의 출자금이 해당 GP의 차기 펀드레이징을 뒷받침하는지 변화 확인',
      control: 'LP 교체와 펀드 전략·대표PM·거버넌스 조건 변화가 연결되는지 확인',
      risk: '기존 LP 재선정 실패인지 의도적 다변화인지 확인',
      rule: '두 LP의 선정요건 차이가 지원전략 변화에 영향을 줬는지 비교',
    },
    entities: [row.gp, row.fromLp, row.toLp],
    confirmed_facts: [],
    reported: [],
    unknowns: ['2025·2026 전체 LP 선정 결과의 백필 완결 여부', '기존 LP에 2026 실제 지원했는지', '탈락·미지원·결과대기 중 어느 상태인지'],
    hypothesis: `${row.gp}가 기존 LP 의존도를 줄이고 다른 기관 LP로 펀드레이징 채널을 넓히거나 전략을 이동했을 가능성`,
    falsification: '2025·2026 백필 완료 뒤 양 연도 모두 같은 LP에 선정된 사실이 추가 확인되거나 단순 수집 공백이었다면 가설을 기각',
    compare_cases: ['같은 GP의 다른 LP 지원·선정 이력', '두 LP의 출자전략·선정기준 차이'],
    sources: [{ label: '정본 · GP 연도비교', url: sheetUrl(2036, `A${row.row}:L${row.row}`), date: SNAPSHOT_DATE }],
    contacts: [row.gp, row.fromLp, row.toLp],
    questions: ['2026에도 기존 LP 출자사업에 지원했나', '새 LP에 지원할 때 펀드전략·대표PM·목표결성액을 바꿨나', 'LP 다변화가 의도된 펀드레이징 전략인가'],
    judgment: '추가취재',
    judgment_reason: '정본 자체가 2025 부분백필·2026 진행중 상태이므로 LP 교체를 확정하지 않고 취재 단서로만 사용합니다.',
    next_action: row.point,
  }));
}

function lpRuleClues() {
  return LP_RULE_CHANGES.map((row) => ({
    clue_id: id('canonical_lp_rule_change', [row.lp, row.program]),
    detector: 'lp_rule_change',
    detector_label: 'LP 선정기준 변화',
    fact_status: '확인',
    detected_at: SNAPSHOT_DATE,
    sort_date: SNAPSHOT_DATE,
    headline: `${row.lp} · ${row.program} 출자규모·운용인력 기준 변화`,
    one_line_signal: `${row.lp}가 ${row.program}에서 출자규모와 선정 운용사 수를 확대하고 핵심 운용인력 겸업 기준을 완화했습니다.`,
    previous_state: row.previous,
    changed_fact: row.changed,
    axes: {
      money: '출자규모 확대가 GP별 배정액과 민간매칭 부담을 어떻게 바꾸는지 확인',
      control: '핵심운용인력 겸업 완화가 기존 펀드와 신규 펀드의 인력배분에 미치는 영향 확인',
      risk: '동일 키맨의 복수펀드 겸업이 운용집중도·사후관리 위험을 높이는지 확인',
      rule: `선정 절차: ${row.process}`,
    },
    entities: [row.lp],
    confirmed_facts: [row.changed, `실제 결과: ${row.result}`],
    reported: [],
    unknowns: ['기준 완화가 개별 GP 선정에 미친 직접 영향', '기존 기준이면 지원이 어려웠을 GP가 실제 있었는지'],
    hypothesis: '핵심 운용인력 겸업 기준 완화와 출자규모 확대가 중대형·복수펀드 운용사의 지원 문턱을 낮춰 선정 구성을 바꿨을 가능성',
    falsification: '14개 지원사 가운데 완화된 기준의 실질 수혜사가 없거나 선정위원회가 해당 요건을 선정에 중요하게 반영하지 않았다면 가설을 약화',
    compare_cases: ['국민연금 직전 연도 국내 벤처펀드 선정 기준', '2026 지원 14개 GP의 기존 펀드 키맨 겸업 현황'],
    sources: [
      { label: '국민연금 공식 원문', url: row.source, date: SNAPSHOT_DATE },
      { label: '정본 · LP 선정기준 변화', url: sheetUrl(2050, `A${row.row}:L${row.row}`), date: SNAPSHOT_DATE },
    ],
    contacts: [row.lp, '2026 지원 GP', '선정 GP', '탈락 GP'],
    questions: [row.question, '기준 완화는 어떤 업계 건의를 반영한 것인가', '선정 6개사의 핵심운용인력 겸업 현황은 각각 어땠나'],
    judgment: '추가취재',
    judgment_reason: `${row.verification} 상태로 기준 변화와 선정 결과는 확인됐지만 인과관계는 미공개입니다.`,
    next_action: '지원 14개 GP의 핵심운용역 겸업 현황을 당시 기준과 대조하고 국민연금·지원사에 기준 완화의 실제 영향 확인',
  }));
}

function buildCanonicalClues() {
  return [
    ...lpRuleClues(),
    ...formationClues(),
    ...repeatGpClues(),
    ...gpLpShiftClues(),
  ];
}

module.exports = { buildCanonicalClues, SNAPSHOT_DATE, SPREADSHEET_ID, SPREADSHEET_URL };
