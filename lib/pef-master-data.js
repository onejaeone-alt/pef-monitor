const BASIS_DATE = "2026-09-04";

// 구글시트 `PEF_프로필`의 앱 검색용 기본 스냅샷.
// 상세 기업카드가 있으면 drive-dossier-data.json 쪽이 우선한다.
const rows = [
  ["ORG-026","MBK파트너스","MBK","대형 국내 PEF","A","홈플러스·규제·대형 바이아웃과 업계 신뢰 이슈의 중심","포트폴리오 재무·회생·펀드 만기·규제·리더십","https://www.bloter.net/news/articleView.html?idxno=666743"],
  ["ORG-027","한앤컴퍼니","Hahn & Co.","대형 국내 PEF","A","SK 계열 카브아웃과 대형 산업재 바이아웃의 대표 하우스","대형 인수·펀딩·리파이낸싱·포트폴리오 매각","https://www.thebell.co.kr/front/newsview.asp?key=202601271338358280104039"],
  ["ORG-028","IMM프라이빗에쿼티","IMM PE","대형 국내 PEF","A","국내 대형 바이아웃·소비재·환경 포트폴리오와 회수 이슈","펀딩·엑시트·포트폴리오 실적·리더십","https://www.bloter.net/news/articleView.html?idxno=671479"],
  ["ORG-029","VIG파트너스","VIG","중견 국내 PEF","A","미드마켓 바이아웃과 세대교체를 동시에 추적할 하우스","6호 펀드·대표 교체·파트너 이탈·미드마켓 딜","https://www.thebell.co.kr/front/newsview.asp?key=202605131539286080104159"],
  ["ORG-030","UCK파트너스","UCK","중견 국내 PEF","A","헬스케어·소비재 바이아웃 및 국내 독립 PE 대표 사례","펀딩·키맨·신규 인수·회수·포트폴리오 이사회","https://uckpartners.com/articles/"],
  ["ORG-031","JKL파트너스","JKL","중견 국내 PEF","A","구조조정·롯데손보·펀드 만기 및 대형 회수 이슈","매각·리파이낸싱·대표 인사·펀드 클로징","https://core.asiae.co.kr/article/2024090212032924132"],
  ["ORG-032","글랜우드프라이빗에쿼티","Glenwood PE","중견 국내 PEF","A","카브아웃·소비재·산업재 미드마켓의 주요 플레이어","신규 딜·블라인드펀드·크레딧 연계·회수","https://www.mk.co.kr/news/stock/11938038"],
  ["ORG-033","스틱인베스트먼트","STIC","상장 대체투자","A","상장 운용사로 공시를 통해 펀딩·투자·성과 추적 가능","펀드 결성·성과보수·대형 투자·국민성장펀드","https://eiec.kdi.re.kr/policy/materialView.do?num=282799"],
  ["ORG-034","H&Q에쿼티파트너스","H&Q","중견 국내 PEF","A","기관 LP 기반 블라인드펀드와 업계 협의회 핵심","클로징·LP 구성·신규 딜·협의회 활동","https://www.thebell.co.kr/front/newsview.asp?key=202606010936116880105144"],
  ["ORG-035","프랙시스캐피탈파트너스","Praxis","중견 국내 PEF","A","성장기업·헬스케어·소비재 및 PEF 업권 대표단","신규 딜·펀딩·파트너 인사·포트폴리오","https://www.mk.co.kr/news/stock/11938038"],
  ["ORG-036","스카이레이크에쿼티파트너스","SkyLake","중견 국내 PEF","B","ICT·제조업 바이아웃과 리더십 세대교체 관찰 대상","대표 인사·신규 펀드·ICT 포트폴리오 회수","https://www.mk.co.kr/news/stock/11938038"],
  ["ORG-037","도미누스인베스트먼트","Dominus","중견 국내 PEF","B","메자닌·그로스·바이아웃을 잇는 중견 하우스","펀딩·CB·RCPS·바이아웃·회수","https://www.mk.co.kr/news/stock/11938038"],
  ["ORG-038","어펄마캐피탈","Affirma","중견 국내 PEF","B","중견 바이아웃·해외 LP·리더십 이동 신호가 많은 하우스","펀딩·키맨·스핀아웃·포트폴리오 매각","https://www.thebell.co.kr/front/newsview.asp?key=202310121719192000103869"],
  ["ORG-039","E&F프라이빗에쿼티","E&F PE","중견 국내 PEF","A","환경·에너지 특화 및 정책 LP 네트워크가 강한 하우스","블라인드펀드·환경 인수·회수·정책출자","https://www.thebell.co.kr/front/newsview.asp?key=202605071420407200107732"],
  ["ORG-040","케이스톤파트너스","Keystone","중견 국내 PEF","B","중견기업 바이아웃·메자닌·승계형 M&A 관찰 대상","핌즈 매각·신규 펀드·중견기업 인수·회수","https://www.mk.co.kr/news/stock/12137036"],
  ["ORG-041","코스톤아시아","KStone Asia","중견 국내 PEF","B","중견·중소기업 투자 및 업계 규제 간담회 참여 하우스","신규 투자·출자 선정·대표 발언","https://www.mk.co.kr/news/stock/11938038"],
  ["ORG-042","캑터스프라이빗에쿼티","Cactus PE","중견 국내 PEF","B","미드마켓·상장사·구조화 거래의 반복 등장 하우스","케이카 공동인수·신규 인수·리파이낸싱·회수","https://www.etnews.com/20260401000059?m=1"],
  ["ORG-043","KL&파트너스","KL&Partners","중견 국내 PEF","B","정책자금·외식 프랜차이즈·미드마켓 M&A 강자","맘스터치 매각·펀딩·배당·회수","https://marketin.edaily.co.kr/News/Read?newsId=04785526645453840"],
  ["ORG-044","웰투시인베스트먼트","WeltoSea","중견 국내 PEF","B","정책 출자사업에서 부상하는 중견 하우스","국민성장펀드 M&A·펀드 결성·신규 인수","https://view.asiae.co.kr/article/2026052717332908640"],
  ["ORG-045","SG프라이빗에쿼티","SG PE","중견 국내 PEF","B","정책·성장자본·중견 M&A 펀드의 주요 지원·선정사","5호 블라인드·출자 선정·펀딩·회수","https://www.thebell.co.kr/front/newsview.asp?key=202603041548419920108847"],
  ["ORG-046","LB프라이빗에쿼티","LB PE","중견 국내 PEF","B","정책 LP 기반 미드마켓 블라인드펀드 조성","한국정보기술 회수·리파이낸싱·LP 구성","https://www.thebell.co.kr/front/newsview.asp?key=202607141608398840103312"],
  ["ORG-047","큐캐피탈파트너스","Q Capital","상장 PEF·VC","B","상장 운용사이자 정책 출자·중견 바이아웃 플레이어","두산건설 정상화·펀드 만기·포트폴리오 회수","https://www.thebell.co.kr/front/newsview.asp?key=202606261450510080108862"],
  ["ORG-048","대신프라이빗에쿼티","Daishin PE","금융계 PEF","B","PEF협의회장 하우스로 업권 규제·협회 전환의 창구","협회 전환·규제 의견·신규 펀드·인사","https://marketin.edaily.co.kr/News/ReadE?newsId=02174646642397536"],
  ["ORG-049","한국투자프라이빗에쿼티","Korea Investment PE","금융계 PEF","B","금융계 PEF·정책출자·공동투자의 핵심","GP 선정·공동투자·펀드 결성·대표 인사","https://www.mk.co.kr/news/stock/11938038"],
  ["ORG-050","프리미어파트너스","Premier Partners","PE·VC","B","PE·VC 동시 운용과 대형 펀딩·회수 성과","펀드 결성·투자·회수·파트너 인사","https://www.thebell.co.kr/front/newsview.asp?key=202602251459053440104840"],
  ["ORG-051","IMM인베스트먼트","IMM Investment","PE·VC","B","VC·PE 합산 대형 하우스이자 정책 출자 주요 후보","펀딩·세컨더리·조직개편·투자·회수","https://www.thebell.co.kr/front/newsview.asp?key=202607031735089080108541"],
  ["ORG-052","아주IB투자","Aju IB","PE·VC","B","상장 VC·PE로 대형 PEF 결성과 DART 추적 가능","국민성장펀드·공시·펀드 결성·실적·회수","https://view.asiae.co.kr/article/2026052717332908640"],
  ["ORG-054","아크앤파트너스","Ark & Partners","신생·중소 PEF","B","대형 하우스 출신 스핀아웃과 미드마켓 신생 GP 흐름","IBK 성장 M&A·신규 펀드·키맨·첫 딜","https://www.hankyung.com/article/202605083842O"],
  ["ORG-055","이스트브릿지파트너스","EastBridge","중견 국내 PEF","B","해외 LP 네트워크가 강한 크로스보더 하우스","국민성장펀드 지원 결과·해외 펀딩·크로스보더 딜","https://www.newstomato.com/readnews.aspx?no=1301390"],
  ["ORG-056","S2L파트너스","S2L","신생·중소 PEF","B","문화 M&A·세컨더리 등 특화 정책펀드 선정사","문화 M&A·세컨더리·GP 선정·펀드 결성","https://www.thebell.co.kr/front/newsview.asp?code=0204&key=202604221322420360106748"],
  ["ORG-057","인피니툼파트너스","Infinitum","신생·중소 PEF","B","라이프스타일·소형 바이아웃·문화 M&A 특화","관광 M&A·세컨더리·소형 바이아웃·펀드 결성","https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?id=5104"],
  ["ORG-058","AIM인베스트먼트","AIM","투자·자문","B","세컨더리·M&A 자문과 펀드 운용의 결합 사례","문화 M&A·세컨더리·방산펀드·자문 수임","https://dealsite.co.kr/articles/161429/075023"],
  ["ORG-059","KKR코리아","KKR","글로벌 PEF","A","대형 바이아웃·인프라·크레딧과 국내 대기업 소수지분 투자","대형 딜·인프라·CB·펀딩·대표 인사","https://marketin.edaily.co.kr/News/ReadE?newsId=02830646645416448"],
  ["ORG-060","맥쿼리자산운용그룹 한국","Macquarie","글로벌 PEF","A","인프라·PE·크로스보더 대형 매각의 핵심","자산 매각·신규 인수·펀딩·대표 인사","https://www.macquarie.com/kr/ko/careers-kr/eric-kim-leading-infrastructure-and-private-equity-investment-in-south-korea-ko.html"],
  ["ORG-061","어피니티에쿼티파트너스","Affinity","글로벌 PEF","A","한국 조직 리더십 교체와 소비재·플랫폼 포트폴리오","대표 교체·6호 펀드·포트폴리오 이사회·회수","https://www.thebell.co.kr/front/newsview.asp?key=202603241343560840107989"],
  ["ORG-062","베인캐피탈","Bain Capital","글로벌 PEF","A","한국 리더십 세대교체와 대형 헬스케어·소비재 딜","대표 인사·아시아펀드·신규 딜·회수","https://m.sedaily.com/amparticle/20036772"],
  ["ORG-063","블랙스톤","Blackstone","글로벌 PEF","B","PE·부동산·크레딧을 아우르는 글로벌 대형 하우스","한국 투자·대표 인사·사모대출·부동산","https://dealsite.co.kr/articles/167617"],
  ["ORG-064","칼라일그룹","Carlyle","글로벌 PEF","B","한국 PE 리더십 재편과 대형 바이아웃 복귀 여부","대표 인사·신규 딜·포트폴리오 회수","https://dealsite.co.kr/articles/167617"],
  ["ORG-065","EQT파트너스","EQT","글로벌 PEF","B","한국 리더십 재편·인프라·헬스케어 투자 신호","대표 선임·인프라 딜·포트폴리오 사후관리","https://dealsite.co.kr/articles/167617"],
  ["ORG-066","CVC캐피탈파트너스","CVC","글로벌 PEF","B","공동대표 체제와 헬스케어·소비재 대형 투자","공동대표·신규 펀드·대형 투자·회수","https://m.sedaily.com/amparticle/20036772"]
];

const items = rows.map(([id, name, alias, subtype, priority, reason, changes, url]) => {
  const status = [
    { label: "기본정보", text: subtype },
    { label: "감시", text: reason },
    { label: "추적", text: changes },
  ];
  return {
    company_id: id,
    canonical_name: name,
    aliases: alias ? [alias] : [],
    entity_type: "pef",
    type_label: `PEF·${subtype}`,
    identification_status: "PEF 프로필 정본 등록",
    basis_date: BASIS_DATE,
    latest_issue_at: null,
    source_system: "구글시트 · PEF_프로필",
    file_name: null,
    summary: `${name}: ${subtype}. ${reason}`,
    current_status: status,
    drive_sections: [{ title: "PEF 마스터", items: status }],
    connections: ["정본: PEF_프로필", "검색뷰: PEF_Monitor_검색뷰"],
    questions: [],
    decision_boundary: "PEF 프로필의 기본 검색 카드다. 펀드 결성·거래가격·LP 약정·회수 상태는 관계원장과 원문을 추가 확인한 뒤 판단한다.",
    next_updates: [changes],
    sources: url ? [{ title: `${name} 근거자료`, source_name: "PEF 프로필 근거", source_url: url, fact: null, verification_status: "프로필 정본" }] : [],
    watch_priority: priority,
  };
});

module.exports = { source: "구글시트/PEF_프로필", basis_date: BASIS_DATE, items };
