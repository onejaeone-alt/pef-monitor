const BASIS_DATE = "2026-09-04";

// `PEF_프로필` 확장분. 핵심 40개 밖의 신생·중소·지역성장 PEF와 신규 보강 하우스.
const rows = [
  ["ORG-133","IMM크레딧앤솔루션","ICS","크레딧·PEF","B","IMM 계열 크레딧·PEF 운용사로 기관 LP 선정과 사모대출·특수상황 투자를 추적","기관 LP 선정·펀드 결성·사모대출·특수상황 투자·회수","https://view.asiae.co.kr/article/2025051315533920855"],
  ["ORG-134","KCGI","KCGI","독립계 PEF","B","주주행동주의에서 바이아웃·블라인드펀드로 영역을 넓힌 독립계 하우스","기관 LP 선정·신규 인수·펀드 결성·회수·지배구조 변화","https://view.asiae.co.kr/article/2025051315533920855"],
  ["ORG-135","제네시스PE","Genesis PE","신생·중소 PEF","B","기관 LP 출자에서 포착된 중소형 PEF로 실제 결성·첫 투자 성과를 추적","펀드 결성·민간 LP·첫 투자·핵심인력·회수","https://view.asiae.co.kr/article/2025051315533920855"],
  ["ORG-136","이음프라이빗에쿼티","이음PE","신생·중소 PEF","B","기관 LP 선정에서 포착된 중소형 PEF로 펀드레이징과 신규 바이아웃을 추적","펀드 결성·LP 구성·신규 인수·핵심인력·회수","https://view.asiae.co.kr/article/2025051315533920855"],
  ["ORG-137","다올PE","Daol PE","신생·중소 PEF","B","기관 LP 선정 이력이 있는 중소형 PEF로 펀드 결성과 딜 파이프라인을 추적","펀드 결성·민간 LP·신규 딜·인력 이동·회수","https://view.asiae.co.kr/article/2025051315533920855"],
  ["ORG-141","BNW인베스트먼트","BNW Investment","신생·중소 PEF","B","우정사업본부 PEF 우선협상에서 포착된 중소형 하우스","최종 선정·펀드 결성·LP 구성·핵심인력·첫 투자","https://dealsite.co.kr/articles/149918/075033"],
  ["ORG-143","헬리오스PE","Helios PE","신생·중소 PEF","C","우정사업본부 PEF 우선협상에서 포착된 신생·중소형 하우스","최종 선정·법인 식별·펀드 결성·핵심인력·첫 투자","https://dealsite.co.kr/articles/149918/075033"],
  ["ORG-144","에이치PE","H PE","신생·중소 PEF","C","우정사업본부 소형 PEF 우선협상에서 포착된 신생 하우스","법인 식별·최종 선정·펀드 결성·핵심인력·첫 투자","https://dealsite.co.kr/articles/149918/075033"],
  ["ORG-145","이상파트너스","LeeSang Partners","신생·중소 PEF·공동GP","B","IBK캐피탈과 공동GP로 우정사업본부 출자에서 포착된 신생·중소형 PEF","최종 선정·공동GP 권한·보수 배분·펀드 결성·첫 투자","https://dealsite.co.kr/articles/149918/075033"],
  ["ORG-KDB-001","더함파트너스","","지역성장 PEF","B","산업은행 남부권 지역성장지원펀드 PE GP로 포착된 하우스","법인 식별·실제 약정·결성·지역 LP·대표 운용역·첫 투자","https://www.yna.co.kr/amp/view/AKR20260729119600002"],
  ["ORG-KDB-002","릴슨프라이빗에쿼티","Rilson Private Equity","지역성장 PEF","B","산업은행 남부권 지역성장지원펀드 PE GP로 포착된 하우스","법인 식별·실제 약정·결성·지역 LP·대표 운용역·첫 투자","https://www.yna.co.kr/amp/view/AKR20260729119600002"],
  ["ORG-160","센트로이드인베스트먼트파트너스","Centroid Investment Partners","대형 국내 PEF","A","대형 소비재·브랜드 바이아웃과 크로스보더 회수 흐름을 추적할 주요 PEF","신규 펀드·LP·포트폴리오 매각·리파이낸싱·핵심인력",null],
  ["ORG-161","앵커에쿼티파트너스","Anchor Equity Partners","대형 국내 PEF","A","소비재·플랫폼·대형 소수지분 및 바이아웃 거래에서 반복 등장하는 주요 PEF","신규 딜·펀드레이징·포트폴리오 회수·핵심인력·LP 변화",null],
  ["ORG-162","J&W파트너스","J&W Partners","중견 국내 PEF","B","미드마켓 바이아웃과 중견기업 거래를 추적할 독립계 PEF","신규 펀드·기관 LP·바이아웃·포트폴리오 매각·핵심인력",null],
  ["ORG-163","SJL파트너스","SJL Partners","중견·글로벌 PEF","B","산업재·크로스보더 대형 거래에 등장하는 독립계 PEF","펀드레이징·신규 인수·해외 공동투자·회수·핵심인력",null],
  ["ORG-164","크레디언파트너스","Credian Partners","중견 국내 PEF","B","미드마켓·그로스 투자에서 추적할 독립계 PEF","신규 펀드·LP·그로스 투자·바이아웃·핵심인력·회수",null],
];

function aliases(value) {
  return String(value || "").split(/·|,/).map((item) => item.trim()).filter(Boolean);
}

const items = rows.map(([id, name, english, typeLabel, priority, reason, watch, url]) => {
  const status = [
    { label: "기본정보", text: typeLabel },
    { label: "감시", text: reason },
    { label: "추적", text: watch },
  ];
  return {
    company_id: id,
    canonical_name: name,
    aliases: aliases(english),
    entity_type: "pef",
    type_label: typeLabel,
    identification_status: url ? "PEF 프로필 등록" : "PEF 프로필 등록·세부검증필요",
    basis_date: BASIS_DATE,
    latest_issue_at: null,
    source_system: "구글시트 · PEF_프로필",
    file_name: null,
    summary: `${name}: ${typeLabel}. ${reason}`,
    current_status: status,
    drive_sections: [{ title: "PEF 마스터", items: status }],
    connections: ["정본: PEF_프로필", "검색뷰: PEF_Monitor_검색뷰"],
    questions: [],
    decision_boundary: "PEF 프로필의 검색용 기본정보다. 펀드 결성·LP 약정·거래·핵심인력은 원문 확인 뒤 확정한다.",
    next_updates: [watch],
    sources: url ? [{ title: `${name} 근거자료`, source_name: "PEF 프로필 근거", source_url: url, fact: null, verification_status: "프로필 등록" }] : [],
    watch_priority: priority,
  };
});

module.exports = { source: "구글시트/PEF_프로필 확장", basis_date: BASIS_DATE, items };
