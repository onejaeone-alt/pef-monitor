const BASIS_DATE = "2026-09-04";

// 구글시트 `PEF_펀드_회수시계`의 앱 검색용 스냅샷.
// 펀드 자체를 검색 개체로 노출하고 규모·LP·소진·만기·회수 압력을 함께 보여준다.
const rows = [
  ["FUND-MBK-VI","MBK Partners Fund VI, L.P.","MBK 6호 펀드","MBK파트너스","2024 빈티지","약 55억달러·8조원 출자약정","운용중","CalPERS 2.5억달러 공식 확인","전체 미소진 약정액 추가 확인","고려아연 등 6호 재원 활용 딜 추적","신규 빈티지로 만기보다 딜 집중도·LP 요구사항 감시","6호의 현재 미소진 약정액과 한국 딜별 배정 한도, 홈플러스 이슈 이후 LP 요구사항은?","https://www.calpers.ca.gov/investments/about-investment-office/investment-organization/pep-fund-performance","공식·보도교차확인","2026-01-28","A"],
  ["FUND-HAHN-IV","Hahn & Company Fund IV","한앤컴퍼니 4호 블라인드펀드","한앤컴퍼니","2024 결성","4.7조원","운용중·투자재개","글로벌·국내 LP","2026년 7월 기준 드라이파우더 2조원 이상","SK스페셜티 등 기존 투자·첨단 제조업 신규딜","회수보다 남은 2조원 이상의 집행속도·집중도 감시","남은 실탄을 어느 산업·딜에 우선 배분하고 단일딜 에쿼티 한도는 어디까지인가?","https://en.sedaily.com/news/2026/07/13/koreas-pef-giant-awakens-hahn-co-readies-2-trillion-won-war","보도확인","2026-07-13","A"],
  ["FUND-IMM-RGIII","IMM RoseGold III","로즈골드 3호","IMM프라이빗에쿼티","2016 빈티지","11억달러","회수집중·만기접근","세부 LP 비공개","신규투자보다 잔여자산 회수 단계","에이블씨엔씨·케이뱅크, 에어퍼스트는 Evergreen으로 이관","2026년 말 최종 만기","연말까지 잔여자산 회수가 끝나지 않으면 연장·세컨더리·현물분배 중 어떤 선택을 하나?","https://www.thebell.co.kr/front/newsview.asp?code=0202&key=202605061020497520109232","회사·보도교차확인","2026-05-06","A"],
  ["FUND-IMM-RGV","IMM RoseGold V","로즈골드 5호","IMM프라이빗에쿼티","2023/2024 조성","17억달러","운용중","세부 LP 비공개","현재 소진율 추가 확인 필요","대형 바이아웃 신규 투자 재원","신규 빈티지로 만기보다 소진율·집중도 감시","현재 소진율과 단일 대형 딜 집중도, 남은 신규 투자 여력은?","https://am.imm.co.kr/company/","회사원문확인","2024-01-01","A"],
  ["FUND-IMM-EVERGREEN","IMM Evergreen Fund","에어퍼스트 컨티뉴에이션 펀드","IMM프라이빗에쿼티","2026 컨티뉴에이션","공개자료상 미확인","운용중·자산이관","기존·신규 LP 혼합, 명단 확인 필요","단일·집중 자산 vehicle 성격","에어퍼스트","기존 3·4호 만기압력을 장기보유 구조로 전환","누가 롤오버했고 신규 LP는 누구이며 이관가격·GP 이해상충 관리는 어떻게 했나?","https://www.thebell.co.kr/front/newsview.asp?code=0202&key=202605061020497520109232","보도확인","2026-05-06","A"],
  ["FUND-VIG-III","VIG Partners Fund III","VIG 3호 블라인드펀드","VIG파트너스","2017 결성","규모 추가 확인","회수집중·청산가시권","국민연금 앵커로 보도","신규투자 종료·잔여자산 회수","오토플러스·본촌·PNC랩스·유영산업 등","잔여 매각 완료 뒤 청산 단계","최종 만기·연장 가능성과 잔여 자산별 목표 회수액은?","https://en.sedaily.com/news/2026/08/05/vig-accelerates-fund-iii-exits-boosting-prospects-for-fund","보도확인","2026-08-04","A"],
  ["FUND-VIG-V","VIG Partners Fund V","VIG 5호 블라인드펀드","VIG파트너스","2026년 3월 최종클로징","7000억원","투자후반부","산업은행 등 국내 주요 연기금·공제회·금융기관","율곡 투자 후 소진율 약 80% 예상","바이오퓨얼홀딩스·비올메디컬·리브사이언스·PTC·율곡 등","남은 20% 집행 뒤 차기 펀드레이징 전환","남은 20%를 어디에 배분하고 6호 펀드레이징은 언제·얼마 규모로 시작하나?","https://www.yna.co.kr/view/AKR20260904048200008","회사발표·최신보도확인","2026-09-04","A"],
  ["FUND-UCK-III","UCK Partners Fund III","UCK 3호 블라인드펀드","UCK파트너스","3호 블라인드","1.2조원","투자후반부","해외 LP 약 2500억원 포함","2026년 8월 기준 소진율 약 60%","헬스케어·소비재 바이아웃 포트폴리오","2027년 상반기 4호 펀딩 거론","3호 해외 LP 중 4호 리업 기관과 4호의 앵커 LP·목표규모는?","https://www.thebell.co.kr/front/newsview.asp?code=0205&key=202608281226592040109234","보도확인","2026-08-28","A"],
  ["FUND-JKL-13","JKL 제13호 사모투자합자회사","JKL 13호·여섯번째 블라인드펀드","JKL파트너스","2025년 5월 최종클로징","9765억원","운용중","국민연금·산업은행·노란우산·우정사업본부·IBK·교공·산재기금·수은·삼성증권","현재 소진율 추가 확인 필요","LBM 첫 투자·후속 포트폴리오 추적","신규 펀드라 만기보다 소진율·포트폴리오 집중도 감시","현재 소진율과 LBM 이후 후속딜, LP별 실제 납입·GP커밋은?","https://www.thebell.co.kr/front/newsview.asp?code=0401&key=202508251324240280101063","보도교차확인","2025-08-25","A"],
  ["FUND-GLENWOOD-III","Glenwood Private Equity Fund III","글랜우드PE 3호 블라인드펀드","글랜우드프라이빗에쿼티","2025 결성","1.6조원","운용중","국민연금·교직원공제회 등 국내 기관 + 캐나다·싱가포르 등 해외 LP","현재 소진율 확인 필요","나노H2O 등 2·3호 공동 활용·코인베스트 구조","신규 투자 집행과 2호 잔여 회수 병행","3호 소진율과 해외 LP별 약정, 2·3호를 함께 쓰는 대형딜의 자금배분 원칙은?","https://www.thebell.co.kr/front/newsview.asp?code=0303&key=202601091108269040106670","보도교차확인","2026-01-09","A"],
  ["FUND-HQ-V","H&Q PEF V","H&Q 5호 블라인드펀드","H&Q에쿼티파트너스","2026년 5월 1차클로징","1차 4000억원·최대 6000~7000억원 목표","펀드레이징","교직원공제회 1000억원 앵커·우정사업본부·군인공제회·과학기술인공제회 등","1차클로징 단계·추가 모집 진행","첫 신규 투자 대상 확인 필요","연내 최종클로징 목표","최종 6000~7000억원을 채울 추가 LP와 1호 투자 집행 시점은?","https://www.thebell.co.kr/front/newsview.asp?code=0408&key=202606010936116880105144","보도교차확인","2026-05-27","A"],
  ["FUND-BAIN-ASIA-VI","Bain Capital Asia Fund VI","베인캐피탈 아시아 6호","베인캐피탈","2026-05-17 최종클로징","105억달러","운용중","외부 커밋 약 91억달러·글로벌 기관 LP","파트너·임직원·관계사 출자군이 단일 투자자군 중 최대","한국 헬스케어·소비재 등 신규 딜 추적","만기보다 한국 배정액·투자속도 감시","105억달러 중 한국 투자에 배정 가능한 실탄과 한국 내 대형딜 우선순위는?","https://www.baincapital.com/news/bain-capital-announces-final-close-asia-fund-vi-raising-105-billion-total-capital","회사원문확인","2026-05-17","A"],
];

function splitAliases(value) {
  return String(value || "").split(/·|,/).map((item) => item.trim()).filter(Boolean);
}

const items = rows.map(([id, name, alias, manager, vintage, size, stage, lps, deployment, assets, clock, question, url, verification, latestIssueAt, priority]) => {
  const status = [
    { label: "운용사", text: manager },
    { label: "펀드규모", text: `${vintage} · ${size}` },
    { label: "현재단계", text: stage },
    { label: "LP", text: lps },
    { label: "소진·실탄", text: deployment },
    { label: "자산", text: assets },
    { label: "회수·만기", text: clock },
  ];
  return {
    company_id: id,
    canonical_name: name,
    aliases: splitAliases(alias),
    entity_type: "fund",
    type_label: "PEF 펀드·회수시계",
    identification_status: verification,
    basis_date: BASIS_DATE,
    latest_issue_at: latestIssueAt,
    source_system: "구글시트 · PEF_펀드_회수시계",
    file_name: null,
    summary: `${name}: ${manager} 운용. ${size}. ${stage}. ${clock}`,
    current_status: status,
    drive_sections: [{ title: "펀드·회수 시계", items: status }],
    connections: [`운용사: ${manager}`, `정본: PEF_펀드_회수시계`],
    questions: [question],
    decision_boundary: "펀드 규모·LP·소진·만기 중 공개 확인되지 않은 항목은 확정값으로 쓰지 않는다. LP 약정과 GP커밋은 원문·공시 확인 뒤 승격한다.",
    next_updates: [question],
    sources: url ? [{ title: `${name} 근거`, source_name: verification, source_url: url, fact: `${size} · ${stage}`, verification_status: verification }] : [],
    watch_priority: priority,
  };
});

module.exports = { source: "구글시트/PEF_펀드_회수시계", basis_date: BASIS_DATE, items };
