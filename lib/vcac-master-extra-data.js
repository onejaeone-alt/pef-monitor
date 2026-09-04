const rows = [
  ["VAC-066","파트너스인베스트먼트","","VC·국민연금 위탁운용사 선정","B","2026-09-03","https://fund.nps.or.kr/impa/nscvrgdatadtl/getOHEF0014M0.do?hmpgBbsCd=BS20240174&pstId=ZZ202600000000000791","원문명칭확인·법인식별대기","파트너스인베스트먼트 | 국민연금 2026 국내 벤처펀드 | 위탁운용사"],
  ["VAC-067","원익투자파트너스","","VC·핀테크혁신펀드 위탁운용사 선정","B","2026-09-03","https://www.kgrowth.or.kr/notice_view.asp?idx=1096&page=1&str_type=1&tab=1","원문명칭확인·법인식별대기","원익투자파트너스 | 핀테크혁신펀드 7차 | Follow-on"],
  ["VAC-068","프렌드투자파트너스","","VC·핀테크혁신펀드 위탁운용사 선정","B","2026-09-03","https://www.kgrowth.or.kr/notice_view.asp?idx=1096&page=1&str_type=1&tab=1","원문명칭확인·법인식별대기","프렌드투자파트너스 | 핀테크혁신펀드 7차 | Follow-on"],
  ["ORG-104","크로스로드파트너스","","VC·GP·KVIC 특허계정 선정","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5103","확인필요","크로스로드파트너스 | 특허계정 | IP직접투자"],
  ["ORG-105","디티앤인베스트먼트","DTNI","VC·GP·KVIC 특허계정 공동선정","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5103","확인필요","디티앤인베스트먼트 | DTNI | 특허계정 | IP거래·사업화"],
  ["ORG-106","씨케이디창업투자","CKD창업투자","VC·GP·KVIC 특허계정 공동선정","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5103","확인필요","씨케이디창업투자 | CKD창업투자 | 특허계정 | IP거래·사업화"],
  ["ORG-107","유니스트기술지주","UNIST기술지주","대학기술지주·GP·관광계정 선정","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5104","확인필요","유니스트기술지주 | UNIST기술지주 | 관광 | AI특성화"],
  ["ORG-110","비전벤처스","","VC·GP·문화·관광계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","비전벤처스 | 관광기업육성"],
  ["ORG-111","넥스트지인베스트먼트","","VC·GP·문화·관광계정 지원","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","넥스트지인베스트먼트 | CT 문화기술 | 2025 문화·관광 선정"],
  ["ORG-112","로간벤처스","","VC·GP·문화·관광계정 복수지원","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","로간벤처스 | CT 문화기술 | 청년콘텐츠 | 2025 문화·관광 선정"],
  ["ORG-113","비커밍벤처스","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","비커밍벤처스 | CT 문화기술"],
  ["ORG-114","어니스트벤처스","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","어니스트벤처스 | CT 문화기술"],
  ["ORG-115","에스비파트너스","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","에스비파트너스 | CT 문화기술"],
  ["ORG-116","이크럭스벤처파트너스","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","이크럭스벤처파트너스 | CT 문화기술"],
  ["ORG-118","크릿벤처스","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","크릿벤처스 | CT 문화기술"],
  ["ORG-119","펜처인베스트","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","펜처인베스트 | CT 문화기술"],
  ["ORG-120","쏠레어파트너스","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","쏠레어파트너스 | 청년콘텐츠"],
  ["ORG-121","아이비케이벤처투자","IBK벤처투자","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","아이비케이벤처투자 | IBK벤처투자 | 청년콘텐츠"],
  ["ORG-122","오거스트벤처파트너스","","VC·GP·문화계정 지원","C","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5105","확인필요","오거스트벤처파트너스 | 청년콘텐츠"],
  ["ORG-123","수인베스트먼트캐피탈","","VC·GP·특허기술사업화 지원","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5108","확인필요","수인베스트먼트캐피탈 | 특허기술사업화"],
  ["ORG-124","에이온인베스트먼트","","VC·공동GP·특허기술사업화 지원","B","2026-09-03","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchCategory=&searchType=all&searchWord=&id=5108","확인필요","에이온인베스트먼트 | 신한캐피탈 공동지원 | 특허기술사업화"],
  ["VAC-KDB-001","리인베스트먼트","","VC·KDB 남부권 지역성장지원펀드 선정","B","2026-09-03","https://www.yna.co.kr/amp/view/AKR20260729119600002","보도명칭확인·법인식별대기","리인베스트먼트 | 산업은행 | 남부권 지역성장지원펀드 | VC"],
  ["VAC-KDB-002","이앤인베스트먼트","","VC·KDB 남부권 지역성장지원펀드 선정","B","2026-09-03","https://www.yna.co.kr/amp/view/AKR20260729119600002","보도명칭확인·법인식별대기","이앤인베스트먼트 | 산업은행 | 남부권 지역성장지원펀드 | VC"],
  ["ORG-126","동국대학교기술지주","","대학기술지주·모태펀드 교육계정 공동GP","B","2026-09-03","https://rwcms.ewha.ac.kr/holdings/index.do","보도명칭확인·법인식별대기","동국대학교기술지주 | 교육부 2차 정시 | 대학창업1유형 | 공동GP"],
  ["ORG-127","이화여자대학교기술지주","","대학기술지주·모태펀드 교육계정 공동GP","B","2026-09-03","https://rwcms.ewha.ac.kr/holdings/index.do","원문명칭확인·법인식별대기","이화여자대학교기술지주 | 교육부 2차 정시 | 대학창업1유형 | 공동GP"],
  ["ORG-128","고려대학교기술지주","","대학기술지주·모태펀드 교육계정 GP","B","2026-09-03","https://m.thebell.co.kr/m/newsview.asp?newskey=202606290811014840105040","보도명칭확인·법인식별대기","고려대학교기술지주 | 교육부 2차 정시 | 대학창업2유형"],
  ["ORG-129","나이스투자파트너스","","VC·모태펀드 문화 수출 분야 GP","B","2026-09-03","https://dealsite.co.kr/articles/165960/075033","보도명칭확인·법인식별대기","나이스투자파트너스 | 문화 수출 | 2026 5월 수시"],
  ["ORG-130","새한창업투자","","VC·모태펀드 문화 수출 분야 GP","B","2026-09-03","https://dealsite.co.kr/articles/165960/075033","보도명칭확인·법인식별대기","새한창업투자 | 문화 수출 | 2026 5월 수시"],
  ["ORG-131","솔트룩스벤처스","","VC·모태펀드 문화 수출 분야 GP","B","2026-09-03","https://dealsite.co.kr/articles/165960/075033","보도명칭확인·법인식별대기","솔트룩스벤처스 | 문화 수출 | 2026 5월 수시"],
  ["ORG-132","일신창업투자","","VC·모태펀드 관광·스포츠 GP","B","2026-09-03","https://dealsite.co.kr/articles/165960/075033","보도명칭확인·법인식별대기","일신창업투자 | 관광기업육성 | 스포츠AI테크 | 2026 5월 수시"],
  ["ORG-138","코오롱인베스트먼트","","VC","B","2025-12-26","https://v.daum.net/v/20251226155551011","보도명칭확인·법인식별대기","코오롱인베스트먼트 | 행정공제회 | 우정사업본부 | AI코리아펀드"],
  ["ORG-139","L&S벤처캐피탈","","VC","C","2025-11-14","https://dealsite.co.kr/articles/151591","보도명칭확인·법인식별대기","L&S벤처캐피탈 | 우정사업본부"],
  ["ORG-140","케이넷투자파트너스","","VC","C","2025-11-14","https://dealsite.co.kr/articles/151591","보도명칭확인·법인식별대기","케이넷투자파트너스 | 우정사업본부"],
  ["ORG-147","위벤처스","","VC","B","2025","https://www.mt.co.kr/amp/future/2025/09/21/2025092109221259343","보도명칭확인·법인식별대기","위벤처스 | 산업은행 | AI 코리아 펀드"],
  ["ORG-148","마그나인베스트먼트","Magna Investment","VC·모태펀드 GP","B","2026-09-04","https://www.kvic.or.kr/upload/notice/20240329/20240329212121_22432.pdf","원문명칭확인·법인식별대기","마그나인베스트먼트 | Magna Investment | 임팩트 | 모태펀드 | 결성연장"],
  ["ORG-149","프로텍벤처스","Protec Ventures","VC·공동GP·모태펀드 재도전","B","2026-09-04","https://kvic.or.kr/upload/notice/20260429/20260429121837_76861.pdf","원문명칭확인·법인식별대기","프로텍벤처스 | Protec Ventures | 마그나인베스트먼트 공동GP | 재도전"],
  ["ORG-150","LSK인베스트먼트","LSK Investment","VC·바이오 전문 GP","B","2026-09-04","https://eiec.kdi.re.kr/policy/materialView.do?num=248030","원문명칭확인·법인식별대기","LSK인베스트먼트 | LSK Investment | K-바이오·백신 3호 | 결성실패 | GP 반납"],
  ["ORG-151","대성창업투자","Daesung Private Equity · 대성창투","VC·정책펀드 GP","B","2026-09-04","https://www.kvic.or.kr/upload/notice/20230428/20230428151742_88838.pdf","원문명칭확인·법인식별대기","대성창업투자 | 대성창투 | K-콘텐츠IP | 중견기업 혁신펀드 | GP 반납 | LP첫걸음"]
];

function splitAliases(value) {
  return String(value || "").split(/·|,/).map((item) => item.trim()).filter(Boolean);
}

const items = rows.map(([id, name, alias, typeLabel, priority, basisDate, url, identificationStatus, searchText]) => {
  const status = [
    { label: "마스터", text: typeLabel },
    { label: "검색어", text: searchText },
  ];
  return {
    company_id: id,
    canonical_name: name,
    aliases: splitAliases(alias),
    entity_type: "vc",
    type_label: typeLabel,
    identification_status: identificationStatus,
    basis_date: basisDate,
    latest_issue_at: null,
    source_system: "구글시트 · 개체_마스터",
    file_name: null,
    summary: `${name}: ${typeLabel}. 개체_마스터에 등록된 검색용 기본 프로필이다.`,
    current_status: status,
    drive_sections: [{ title: "개체 마스터", items: status }],
    connections: ["정본: 개체_마스터", "검색뷰: PEF_Monitor_검색뷰"],
    questions: [],
    decision_boundary: "개체_마스터의 기본 프로필이다. 법인 식별과 개별 투자 사실은 원문 상태에 따라 추가 확인한다.",
    next_updates: ["법인 식별·별칭·핵심인력·펀드·투자 이력이 확인되면 정본을 갱신"],
    sources: url ? [{ title: `${name} 등록 근거`, source_name: "개체_마스터 근거", source_url: url, fact: searchText, verification_status: identificationStatus }] : [],
    watch_priority: priority,
  };
});

module.exports = { source: "구글시트/개체_마스터", items };
