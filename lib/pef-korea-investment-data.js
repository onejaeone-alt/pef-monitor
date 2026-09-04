const BASIS_DATE = "2026-09-04";

// 구글시트 `글로벌PEF_한국투자맵`과 확장된 `PEF_펀드_회수시계`의 앱 검색 스냅샷.
// 공식 자료에 펀드 vehicle이 명시되지 않은 거래는 특정 펀드에 임의 귀속하지 않는다.
const fundRows = [
  ["FUND-KKR-ASIA-IV","KKR Asian Fund IV","KKR 아시아 4호","KKR코리아","2020 빈티지·투자기간 2026-06 종료","147.35억달러","투자기간 종료·회수/후속펀드 전환","2026 Q2 미호출 약정 38.62억달러·누적투자 121.28억달러","한국 투자자산 개별 vehicle 매핑 필요","남은 38.62억달러의 사용 가능 범위와 한국 자산 회수·후속투자 계획은?","https://ir.kkr.com/media/document/15a25fa9-8226-4da1-9ff3-027b9803d436/assets/KKR_Q226_Earnings_Release.pdf?disposition=inline","회사공시원문확인","2026-06-30"],
  ["FUND-KKR-APII","KKR Asia Pacific Infrastructure Investors II SCSp","KKR AP Infrastructure II","KKR코리아","2022 빈티지·투자기간 2028-09까지","63.48억달러","운용중","2026 Q2 미호출 25억달러·누적투자 42.5억달러","한국 개별 딜의 fund 귀속은 거래별 공식 발표 확인 필요","한국 에너지·데이터센터 딜 중 실제 이 펀드 자금이 들어간 거래와 남은 한도는?","https://ir.kkr.com/media/document/15a25fa9-8226-4da1-9ff3-027b9803d436/assets/KKR_Q226_Earnings_Release.pdf?disposition=inline","회사공시원문확인","2026-09-04"],
  ["FUND-MAQ-MAIF2","Macquarie Asia Infrastructure Fund 2","MAIF2","맥쿼리자산운용그룹 한국","2018 최종클로징","33억달러","회수집중","DIG에어가스 2026-01 회수완료","잔여 한국·아시아 자산 회수와 펀드 청산 시계","DIG 회수 후 MAIF2의 잔여 한국자산·잔존가치·LP 분배·청산 일정은?","https://www.macquarie.com/us/en/about/news/2018/mira-closes-second-asian-regional-infrastructure-fund.html","회사원문확인","2026-01-13"],
  ["FUND-MAQ-MAIF4","Macquarie Asia-Pacific Infrastructure Fund 4","MAIF4","맥쿼리자산운용그룹 한국","2026 한국 투자 집행","펀드 총규모 추가 확인","투자초기","가비아 JV 4~6년 6000억원 투자 계획","MAIF4 총규모·LP·한국 배정액·양사 투자비율 미공개","MAIF4 총규모·한국 배정액과 가비아 6000억원 계획 중 실제 펀드 에쿼티는?","https://www.macquarie.com/kr/ko/news/2026/macquarie-asset-management-and-gabia-form-strategic-partnership-to-develop-next-generation-hyperscale-data-centre-platform-in-south-korea.html","회사원문확인","2026-02-25"],
  ["FUND-AFFINITY-IV","Affinity Asia Pacific Fund IV","Affinity Fund IV·어피니티 4호","어피니티에쿼티파트너스","2014 최종클로징","38억달러","회수집중","버거킹코리아 보유·버거킹재팬 2026-02 회수","2014 빈티지 장기 잔여자산 회수압력","Fund IV에서 아직 남은 한국자산과 버거킹코리아 매각 시점·구조는?","https://www.affinityequity.com/blogs/affinity-leverages-korea-operating-manual-transform-burger-king-japan","회사원문확인","2026-02-01"],
  ["FUND-AFFINITY-V","Affinity Asia Pacific Fund V","Affinity Fund V·어피니티 5호","어피니티에쿼티파트너스","2017 최종클로징","60억달러","운용·회수병행","요기요 등 한국 포트폴리오 추적","한국 자산별 현재 vehicle·부채·회수시점 추가 확인","요기요 등 한국 자산별 원가·평가가·부채와 Fund V 회수기한은?","https://www.affinityequity.com/blogs/affinity-equity-partners-completes-sale-burger-king-japan-goldman-sachs-alternatives","회사원문확인","2026-09-04"],
];

const investmentRows = [
  ["ORG-101","삼성SDS","Samsung SDS","KKR코리아","정확한 fund vehicle 미공개","2026-04-15","1조2200억원 전환사채","적극적 소수지분 투자","최종계약","전환조건·전환 이후 지분·거버넌스 권한·회수기한 추적","어느 KKR 펀드가 CB를 인수했고 전환가·만기·콜·풋·이사회 권한은 어떻게 설계됐나?","https://www.kkr.com/content/dam/kkr/country-sites/kr/press-release/2026/20260415-KKR%C2%B7%EC%82%BC%EC%84%B1SDS%2C%20%EC%9E%A5%EA%B8%B0%EC%A0%81%20%EA%B8%B0%EC%97%85%EA%B0%80%EC%B9%98%20%EC%A0%9C%EA%B3%A0%20%EC%9C%84%ED%95%9C%20%EC%A0%84%EB%9E%B5%EC%A0%81%20%ED%8C%8C%ED%8A%B8%EB%84%88%EC%8B%AD%20%EC%B2%B4%EA%B2%B0.pdf","회사원문확인"],
  ["ORG-180","SK·KKR 재생에너지 플랫폼","Korea Renewable Energy Platform·법인명 미공개","KKR코리아","KKR 운용 인프라 펀드·정확한 vehicle 미공개","2026-06-30","플랫폼 가치 2조원","초기 KKR 경영권·SK 지분투자","출범계약","법인 설립·지분구조·차입·자산 편입 완료 여부 추적","KKR이 어떤 인프라 펀드로 얼마를 넣고 SK와의 지분·이사회·향후 경영권 전환 조건은 어떻게 정했나?","https://media.kkr.com/news-details?linkId=973168873&news_id=d294a153-9bcd-4cd0-95b6-45239bdb3dac","회사원문확인"],
  ["ORG-174","삼화","Samhwa","KKR코리아","KKR 운용 펀드·정확한 vehicle 미공개","2025-09-04","약 7330억원","전략 인수·경영권","인수완료","밸류업·글로벌 확장 뒤 중기 회수시계 추적","정확한 KKR fund vehicle·인수금융·에쿼티 비율·목표 보유기간은?","https://www.kkr.com/content/dam/kkr/country-sites/kr/press-release/%EC%82%BC%ED%99%94-%EC%83%88%EB%A1%9C%EC%9A%B4-%EB%8F%84%EC%95%BD-%EC%9C%84%ED%95%9C-KKR-%ED%88%AC%EC%9E%90-%ED%99%95%EB%B3%B4-%EC%99%84%EB%A3%8C-20250904.pdf","회사원문확인"],
  ["ORG-172","가비아","Gabia Inc.","맥쿼리자산운용그룹 한국","MAIF4","2026-02-25","4~6년 약 6000억원 공동투자","양사 투자비율 비공개","공동개발","안산 40MW→100MW+ 데이터센터 플랫폼·PF·추가 사이트 추적","6000억원 중 MAIF4 실제 에쿼티와 가비아 부담액, PF 조달액·금리·담보구조는?","https://www.macquarie.com/kr/ko/news/2026/macquarie-asset-management-and-gabia-form-strategic-partnership-to-develop-next-generation-hyperscale-data-centre-platform-in-south-korea.html","회사원문확인"],
  ["ORG-173","DIG에어가스","DIG Airgas","맥쿼리자산운용그룹 한국","MAIF2","2026-01-13","거래가격 공식자료상 미표기","전량 매각","회수완료","회수금 LP 분배·MAIF2 잔여 한국자산·청산시계 추적","DIG 매각의 Gross·Net IRR·MOIC와 MAIF2 LP 분배액, 한국 잔여자산은?","https://www.macquarie.com/kr/ko/news/2026/macquarie-asset-management-announces-financial-close-of-sale-of-dig-airgas-to-air-liquide.html","회사원문확인"],
  ["ORG-175","버거킹코리아","Burger King Korea","어피니티에쿼티파트너스","Affinity Fund IV","2016-04-01","투자금액 추가 확인","지배·운영","보유중","2014 빈티지 Fund IV 장기 보유자산으로 회수시계 우선 감시","일본 버거킹을 2026년 회수한 뒤 한국 버거킹은 언제 어떤 방식으로 매각하고 Tim Hortons는 함께 묶나?","https://www.affinityequity.com/blogs/affinity-leverages-korea-operating-manual-transform-burger-king-japan","회사원문확인"],
  ["ORG-177","요기요","Yogiyo","어피니티에쿼티파트너스","Affinity Fund V 맥락·정확한 지분구조 추가 확인","2021-10-01","투자금액 추가 확인","포트폴리오","보유중","손익 개선·리파이낸싱·매각·세컨더리 회수 여부 감시","요기요의 현재 지분구조·인수금융 잔액·추가 자금투입과 Fund V 회수기한은?","https://www.affinityequity.com/storage/app/media/sustainabilityreports/AEP_2022_2023%20Sustainability%20Report.pdf","회사원문·맥락확인"],
  ["ORG-176","서브원","ServeOne","어피니티에쿼티파트너스","정확한 fund vehicle 추가 확인","2026-07-09","2019 초기 60% 약 6020억원·2026 볼트온 금액 비공개","지배지분","보유·볼트온확장","헬스케어 볼트온 이후 실적·회수·재매각 시계 감시","현재 지분율과 fund vehicle, 볼트온 인수금융, 서브원 전체 매각 목표가·시점은?","https://www.affinityequity.com/blogs/serveone-expands-healthcare-procurement-platform-through-strategic-acquisitions-opera-salutaris-and-value-pro","회사원문확인"],
  ["ORG-178","SK렌터카","SK Rent-A-Car","어피니티에쿼티파트너스","정확한 fund vehicle 추가 확인","2024-08-01","공식 트랙레코드상 규모 미표기","포트폴리오","보유중","AI·차량 라이프사이클 개선 뒤 중기 회수경로 추적","현재 지분율·인수금융·정확한 fund vehicle·IPO·매각 회수 경로는?","https://www.affinityequity.com/investment-track-record","회사원문확인"],
  ["ORG-179","공차글로벌","Gong cha Global","베인캐피탈","정확한 fund vehicle 미공개","2026-08-06","거래가격 비공개","경영권 인수계약","계약체결·클로징추적","클로징→한국·일본 점포확장→중장기 회수","Asia Fund VI가 실제 투자 vehicle인지, 매입가·에쿼티·인수금융·클로징 조건은?","https://www.baincapital.com/news/bain-capital-acquire-gong-cha-one-worlds-fastest-growing-tea-brands-ta-associates","회사원문확인"],
];

function aliases(value) {
  return String(value || "").split(/·|,/).map((item) => item.trim()).filter(Boolean);
}

const fundItems = fundRows.map(([id, name, alias, manager, vintage, size, stage, deployment, unknown, question, url, verification, latest]) => {
  const status = [
    { label: "운용사", text: manager },
    { label: "펀드규모", text: `${vintage} · ${size}` },
    { label: "현재단계", text: stage },
    { label: "소진·실탄", text: deployment },
    { label: "미확인", text: unknown },
  ];
  return {
    company_id: id,
    canonical_name: name,
    aliases: aliases(alias),
    entity_type: "fund",
    type_label: "글로벌 PEF 펀드·회수시계",
    identification_status: verification,
    basis_date: BASIS_DATE,
    latest_issue_at: latest,
    source_system: "구글시트 · PEF_펀드_회수시계",
    file_name: null,
    summary: `${name}: ${manager} 운용. ${size}. ${stage}`,
    current_status: status,
    drive_sections: [{ title: "글로벌 펀드·회수 시계", items: status }],
    connections: [`운용사: ${manager}`, "정본: PEF_펀드_회수시계"],
    questions: [question],
    decision_boundary: "공개 원문에 특정 한국 거래의 fund vehicle이 명시되지 않으면 해당 펀드에 임의 귀속하지 않는다.",
    next_updates: [question],
    sources: [{ title: `${name} 근거`, source_name: verification, source_url: url, verification_status: verification }],
    watch_priority: "A",
  };
});

const investmentItems = investmentRows.map(([id, name, alias, manager, fund, date, amount, control, stage, clock, question, url, verification]) => {
  const status = [
    { label: "운용사", text: manager },
    { label: "펀드·전략", text: fund },
    { label: "거래", text: `${date} · ${amount}` },
    { label: "지분·통제", text: control },
    { label: "현재단계", text: stage },
    { label: "회수·후속", text: clock },
  ];
  if (/미공개|추가 확인|맥락/.test(fund)) status.push({ label: "미확인", text: `정확한 투자 vehicle: ${fund}` });
  return {
    company_id: id,
    canonical_name: name,
    aliases: aliases(alias),
    entity_type: "company",
    type_label: "글로벌 PEF 한국 투자대상",
    identification_status: verification,
    basis_date: BASIS_DATE,
    latest_issue_at: date,
    source_system: "구글시트 · 글로벌PEF_한국투자맵",
    file_name: null,
    summary: `${name}: ${manager} 관련 한국 투자. ${amount}. ${stage}.`,
    current_status: status,
    drive_sections: [{ title: "글로벌 PEF 한국 투자", items: status }],
    connections: [`운용사: ${manager}`, `펀드·전략: ${fund}`, "정본: 글로벌PEF_한국투자맵"],
    questions: [question],
    decision_boundary: "공식 발표에 fund vehicle·지분·인수금융이 없으면 미공개로 유지하며 특정 펀드에 임의 귀속하지 않는다.",
    next_updates: [question],
    sources: [{ title: `${name} 투자 근거`, source_name: verification, source_url: url, fact: `${date} · ${amount}`, verification_status: verification }],
    watch_priority: "A",
  };
});

module.exports = {
  source: "구글시트/글로벌PEF_한국투자맵",
  basis_date: BASIS_DATE,
  items: [...fundItems, ...investmentItems],
};
