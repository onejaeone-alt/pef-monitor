const BASIS_DATE = "2026-09-04";

// 구글시트 `VC·AC_감시`의 앱 검색용 스냅샷.
// 상세 기업카드가 따로 있는 기관은 drive-dossier-data.json 쪽이 우선한다.
const rows = [
  ["VAC-008","VC","한국투자파트너스","Korea Investment Partners","Multi-stage","전 분야·글로벌","A","벤처펀드 AUM 1위권이자 출자사업의 기준점","한국투자파트너스, 한투파, AUM","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-009","VC","KB인베스트먼트","KB Investment","Series A~Growth","전 분야·금융계","A","대형 펀딩과 회수 실적이 반복되는 금융계 핵심 VC","KB인베스트먼트, 펀딩, 회수","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-010","VC","SBVA","SBVA","Series A~Growth","AI·플랫폼·글로벌","A","2조원대 벤처펀드와 글로벌 네트워크를 보유한 대형 VC","SBVA, 소프트뱅크벤처스, 펀드","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-011","VC","IMM인베스트먼트","IMM Investment","Multi-stage","전 분야·PE 연계","A","VC·PE 합산 대형 하우스로 정책 출자와 드라이파우더 영향력이 큼","IMM인베스트먼트, VC, 드라이파우더","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-012","VC","에이티넘인베스트먼트","Atinum Investment","Series A~Growth","전 분야·원펀드","A","대형 원펀드 운용과 회수·차기 펀드 결성이 핵심","에이티넘, 8600억 펀드, 차기 펀드","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-013","VC","DSC인베스트먼트","DSC Investment","Seed~Growth","딥테크·바이오","A","대형 홈런펀드와 정책 LP 기반 펀딩의 주요 하우스","DSC인베스트먼트, 홈런펀드, 딥테크","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-014","VC","인터베스트","InterVest","Series A~Growth","바이오·딥테크","A","2026년 상반기 회수 부문 상위권으로 엑시트 흐름의 기준점","인터베스트, 회수, 바이오","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-015","VC","미래에셋벤처투자","Mirae Asset Venture Investment","Series A~Growth","바이오·테크·글로벌","A","상장 VC이자 대규모 투자 집행과 그룹 네트워크 활용","미래에셋벤처투자, 투자집행, 상장 VC","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-016","VC","신한벤처투자","Shinhan Venture Investment","Series A~Growth","금융·테크·바이오","B","금융그룹 계열의 대형 벤처펀드와 정책 출자 참여","신한벤처투자, 신한금융, 펀드","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-017","VC","LB인베스트먼트","LB Investment","Series A~Growth","ICT·반도체·글로벌","B","3000억원대 펀딩으로 1조원대 하우스에 진입한 주요 VC","LB인베스트먼트, 넥스트퓨처펀드, AUM","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-018","VC","아주IB투자","Aju IB Investment","Multi-stage","바이오·테크·PE","B","상장 VC·PE로 펀드 결성·회수·실적을 공시로 추적 가능","아주IB투자, 벤처펀드, 회수","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-019","VC","스톤브릿지벤처스","Stonebridge Ventures","Series A~Growth","AI·딥테크","B","AI·딥테크와 주요 정책 LP를 잇는 상장 VC","스톤브릿지벤처스, AI 펀드, 국민연금","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-020","VC","우리벤처파트너스","Woori Venture Partners","Series A~Growth","ICT·바이오·글로벌","B","금융그룹 편입 이후 펀딩·회수·조직 변화가 중요한 VC","우리벤처파트너스, 우리금융, 회수","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-021","VC","컴퍼니케이파트너스","Company K Partners","Series A~Growth","콘텐츠·ICT·바이오","B","1조원대 AUM과 상장사 공시를 함께 추적할 수 있는 VC","컴퍼니케이, 벤처펀드, AUM","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-022","VC","프리미어파트너스","Premier Partners","Series A~Growth","테크·바이오·PE","B","VC·PE를 함께 운용하며 대형 펀딩과 회수에 반복 등장","프리미어파트너스, 벤처펀드, PEF","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-023","VC","TS인베스트먼트","TS Investment","Series A~Growth","세컨더리·M&A·테크","B","1조원대 벤처펀드와 세컨더리·M&A 연계 투자에 강점","TS인베스트먼트, 세컨더리, 펀딩","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-024","VC","포스코기술투자","POSCO Capital","Series A~Growth","소재·에너지·딥테크","B","그룹 산업 네트워크와 1조원대 벤처펀드를 보유한 전략적 VC","포스코기술투자, 딥테크, 소재","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-025","VC","SBI인베스트먼트","SBI Investment Korea","Series A~Growth","ICT·바이오·일본","B","한일 네트워크와 1조원 안팎 AUM·펀드 청산 흐름이 중요","SBI인베스트먼트, 청산, 일본","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-026","VC","하나벤처스","Hana Ventures","Series A~Growth","금융·테크·바이오","B","1조원대 진입 후보인 금융계 VC로 펀딩 확대 여부가 핵심","하나벤처스, 하나금융, AUM","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-027","VC","키움인베스트먼트","Kiwoom Investment","Series A~Growth","ICT·콘텐츠·바이오","B","7000억원대 이상 중견 하우스로 차기 대형 펀드 결성 후보","키움인베스트먼트, 벤처펀드, 출자사업","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-028","VC","K2인베스트먼트","K2 Investment Partners","Series A~Growth","ICT·바이오·소부장","B","중견 VC의 1조원대 성장과 정책출자 선정 흐름을 보여주는 하우스","K2인베스트먼트, 펀딩, 출자사업","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-029","VC","스틱벤처스","STIC Ventures","Series A~Growth","딥테크·바이오·글로벌","B","대체투자 그룹 계열 VC로 글로벌·성장투자와 조직 분화를 관찰","스틱벤처스, 글로벌 펀드, 벤처","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-030","VC","HB인베스트먼트","HB Investment","Series A~Growth","반도체·바이오·ICT","B","상장 VC이자 1조원대 진입 후보로 펀딩·회수 공시 추적 가능","HB인베스트먼트, 반도체, 펀딩","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-031","VC","뮤렉스파트너스","Murex Partners","Seed~Growth","ICT·콘텐츠·소비재","B","창업가 네트워크와 초기·성장 단계 연속투자가 활발","뮤렉스파트너스, 초기투자, 후속투자","신규 펀드·LP 구성·투자·회수·파트너 이동","주 2회","https://www.kvca.or.kr/Program/membership/list.html?a_cd=2&a_gb=member&a_item=0&sm=5_3_1"],
  ["VAC-032","VC","알토스벤처스","Altos Ventures","Series A~Growth","플랫폼·소비자·SaaS","B","국내 유니콘 투자와 미국계 장기투자의 핵심 플레이어","알토스벤처스, 유니콘, 후속투자","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-033","VC","본엔젤스벤처파트너스","BonAngels Venture Partners","Pre-seed~Seed","인터넷·SaaS·플랫폼","B","국내 초기투자 생태계의 대표 하우스로 창업자·파트너 이동 영향력이 큼","본엔젤스, 시드투자, TIPS","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-034","VC","카카오벤처스","Kakao Ventures","Seed~Series A","AI·디지털·헬스케어","B","초기 기술투자와 TIPS·딥테크 정책 연계가 활발한 VC","카카오벤처스, TIPS, 딥테크","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-035","VC","스마일게이트인베스트먼트","Smilegate Investment","Seed~Growth","게임·콘텐츠·바이오","B","게임·콘텐츠에서 전 분야로 확장한 대형 VC","스마일게이트인베스트먼트, 게임, 펀드","신규 펀드·LP 구성·투자·회수·파트너 이동","매일","https://dealsite.co.kr/articles/164849"],
  ["VAC-036","VC","캡스톤파트너스","Capstone Partners","Seed~Series A","ICT·콘텐츠·소비재","B","상장 초기투자 VC로 실적·펀드·TIPS 흐름을 공시로 추적","캡스톤파트너스, 초기투자, TIPS","신규 펀드·LP 구성·투자·회수·파트너 이동","주 2회","https://www.kvca.or.kr/Program/membership/list.html?a_cd=2&a_gb=member&a_item=0&sm=5_3_1"],
  ["VAC-037","VC","데일리파트너스","Daily Partners","Series A~Growth","바이오·헬스케어","B","바이오·헬스케어 특화 펀드와 임상·IPO 회수의 주요 하우스","데일리파트너스, 바이오, 헬스케어 펀드","신규 펀드·LP 구성·투자·회수·파트너 이동","주 2회","https://www.kvca.or.kr/Program/membership/list.html?a_cd=2&a_gb=member&a_item=0&sm=5_3_1"],
  ["VAC-038","VC","SL인베스트먼트","SL Investment","Series A~Growth","반도체·소부장·ICT","B","소부장·딥테크 정책펀드 선정 흐름을 추적할 중견 VC","SL인베스트먼트, 소부장, 딥테크","신규 펀드·LP 구성·투자·회수·파트너 이동","주 2회","https://www.kvca.or.kr/Program/membership/list.html?a_cd=2&a_gb=member&a_item=0&sm=5_3_1"],
  ["VAC-039","VC","UTC인베스트먼트","UTC Investment","Series A~Growth","바이오·소비재·ICT","B","중견 VC의 펀드레이징과 바이오·소비재 회수 흐름을 관찰","UTC인베스트먼트, 펀드, 회수","신규 펀드·LP 구성·투자·회수·파트너 이동","주 2회","https://www.kvca.or.kr/Program/membership/list.html?a_cd=2&a_gb=member&a_item=0&sm=5_3_1"],
  ["VAC-040","VC","메디치인베스트먼트","Medici Investment","Series A~Growth","ICT·콘텐츠·지역","B","정책출자·지역펀드와 중견 벤처투자 흐름을 확인","메디치인베스트먼트, 지역펀드, 출자사업","신규 펀드·LP 구성·투자·회수·파트너 이동","주 2회","https://www.kvca.or.kr/Program/membership/list.html?a_cd=2&a_gb=member&a_item=0&sm=5_3_1"],
  ["VAC-041","CVC","삼성벤처투자","Samsung Venture Investment","Seed~Growth","반도체·AI·바이오","B","삼성 계열의 신사업 탐색과 글로벌 전략투자의 핵심 창구","삼성벤처투자, 신사업, 전략투자","그룹 전략·신규 투자·포트폴리오 제휴·조직개편","매일","https://www.vcs.go.kr/"],
  ["VAC-042","CVC","GS벤처스","GS Ventures","Seed~Series A","에너지·유통·바이오","B","GS그룹 오픈이노베이션과 신사업 포트폴리오를 추적","GS벤처스, 오픈이노베이션, 신사업","그룹 전략·신규 투자·포트폴리오 제휴·조직개편","매일","https://www.vcs.go.kr/"],
  ["VAC-043","CVC","롯데벤처스","Lotte Ventures","Seed~Series A","유통·소비재·푸드테크","B","롯데그룹 유통·소비재 오픈이노베이션과 TIPS 연계","롯데벤처스, 엘캠프, TIPS","그룹 전략·신규 투자·포트폴리오 제휴·조직개편","매일","https://www.vcs.go.kr/"],
  ["VAC-044","CVC","현대차그룹 ZER01NE","ZER01NE","Pre-seed~Series A","모빌리티·로보틱스·AI","B","현대차그룹의 미래 모빌리티·딥테크 발굴과 전략투자 창구","제로원, 현대차, 모빌리티","그룹 전략·신규 투자·포트폴리오 제휴·조직개편","매일","https://www.vcs.go.kr/"],
  ["VAC-045","CVC","네이버 D2SF","NAVER D2SF","Pre-seed~Series A","AI·SaaS·딥테크","B","네이버 기술 전략과 초기 기술 스타트업 인수·제휴의 선행 신호","D2SF, 네이버, AI 스타트업","그룹 전략·신규 투자·포트폴리오 제휴·조직개편","매일","https://www.vcs.go.kr/"],
  ["VAC-046","AC","블루포인트파트너스","Bluepoint Partners","Pre-seed~Series A","딥테크·AI·제조","A","국내 대표 딥테크 AC로 본계정·펀드·후속투자를 함께 운용","블루포인트, 딥테크, TIPS","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-047","AC","퓨처플레이","FuturePlay","Pre-seed~Series A","AI·로봇·헬스케어","B","컴퍼니빌딩과 딥테크 초기투자·후속투자 모델의 대표 AC","퓨처플레이, 컴퍼니빌딩, 딥테크","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-048","AC","프라이머","Primer","Pre-seed~Seed","인터넷·SaaS·소비자","A","국내 1세대 AC이자 창업가 중심 시드투자의 기준점","프라이머, 배치, 시드투자","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-049","AC","스파크랩","SparkLabs","Pre-seed~Seed","글로벌·AI·바이오","B","1세대 AC로 배치 프로그램과 글로벌·바이오 확장을 추적","스파크랩, 배치, 스파크바이오랩","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-050","AC","매쉬업벤처스","Mashup Ventures","Pre-seed~Seed","AI·SaaS·플랫폼","B","창업자 출신 파트너 중심의 초기투자와 전 트랙 TIPS 운영","매쉬업벤처스, TIPS, 딥테크 TIPS","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-051","AC","소풍벤처스","Sopoong Ventures","Pre-seed~Series A","기후·임팩트·지역","B","기후테크·임팩트 투자와 정책펀드 연계를 추적할 핵심 AC","소풍벤처스, 기후테크, 임팩트","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-052","AC","엠와이소셜컴퍼니","MYSC","Pre-seed~Series A","임팩트·기후·지역","B","사회적 가치·기후·지역 스타트업의 투자와 보육을 연결","MYSC, 임팩트투자, 기후","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-053","AC","씨엔티테크","CNT Tech","Pre-seed~Series A","푸드테크·SaaS·지역","B","다수 초기기업 투자와 TIPS·지역 프로그램 운영 규모가 큼","씨엔티테크, TIPS, 액셀러레이팅","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-054","AC","서울대학교기술지주","SNU Holdings","Pre-seed~Series A","대학기술·바이오·딥테크","B","대학 기술사업화와 교수·학생 창업의 대표 투자기관","서울대기술지주, 기술사업화, 교원창업","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-055","AC","카이스트청년창업투자지주","KAIST Venture Investment Holdings","Pre-seed~Series A","딥테크·AI·로봇","B","KAIST 기반 딥테크 창업과 TIPS·기술지주 펀드 흐름을 확인","카이스트청년창업투자지주, 딥테크, TIPS","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-056","AC","앤틀러코리아","Antler Korea","Pre-seed","창업팀 빌딩·글로벌","B","아이디어·팀 구성 단계부터 투자하는 글로벌 AC 모델","앤틀러코리아, 프리시드, 시드 TIPS","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-057","AC","더인벤션랩","The Invention Lab","Pre-seed~Series A","SaaS·오픈이노베이션·동남아","B","대기업 오픈이노베이션과 동남아 초기투자를 연결","더인벤션랩, 오픈이노베이션, 동남아","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-058","AC","인포뱅크 아이엑셀","InfoBank iAccel","Pre-seed~Series A","ICT·콘텐츠·모빌리티","B","상장사 기반 AC이자 시드 TIPS·초기투자 트랙의 주요 운영사","인포뱅크, 아이엑셀, 시드 TIPS","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","매일","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=7"],
  ["VAC-059","AC","킹슬리벤처스","Kingsley Ventures","Pre-seed~Series A","딥테크·바이오·글로벌","B","TIPS 운영과 글로벌 액셀러레이팅을 결합한 초기 투자사","킹슬리벤처스, TIPS, 글로벌","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-060","AC","와이앤아처","Y&Archer","Pre-seed~Series A","지역·글로벌·관광","B","지역·관광·글로벌 보육사업과 초기투자 공고가 활발","와이앤아처, 지역 액셀러레이팅, 관광","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-061","AC","엔피프틴파트너스","N15 Partners","Pre-seed~Series A","하드웨어·제조·오픈이노베이션","B","제조·하드웨어와 대기업 오픈이노베이션 특화 AC","N15파트너스, 제조, 오픈이노베이션","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-062","AC","탭엔젤파트너스","TAP Angel Partners","Pre-seed~Seed","ICT·콘텐츠·지역","B","엔젤·시드 투자와 지역 보육 프로그램을 함께 추적","탭엔젤파트너스, 엔젤투자, TIPS","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-063","AC","빅뱅엔젤스","Bigbang Angels","Pre-seed~Seed","ICT·글로벌·콘텐츠","B","초기 투자와 글로벌 진출 지원·TIPS 추천 흐름을 확인","빅뱅엔젤스, 글로벌, TIPS","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-064","AC","로우파트너스","ROWE Partners","Pre-seed~Series A","지역·기술사업화·소부장","B","충청권 등 지역 기술창업과 공공 액셀러레이팅 사업에 강점","로우파트너스, 지역 스타트업, 기술사업화","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-065","AC","슈미트","Schmidt","Pre-seed~Series A","바이오·제조·모빌리티","B","초기기업 투자 실적이 큰 AC로 포트폴리오와 펀드 확장 관찰","슈미트, 초기투자, 포트폴리오","배치·TIPS 추천·펀드 결성·후속투자·대표·파트너 이동","주 2회","https://www.kised.or.kr/prePubDetail/index.es?mid=a10103010000&prePubId=9"],
  ["VAC-069","AC","페이스메이커스","Pacemakers","초기","콘텐츠·제조·AI·딥테크","B","초기기업 액셀러레이팅과 투자, 국내외 창업지원 프로그램 변화를 추적","페이스메이커스, Pacemakers, 김경락, 액셀러레이터, 투자","펀드 결성·신규 투자·보육 프로그램·대표·파트너 이동·정책사업 선정","주 2회","https://pacemakers.kr"],
  ["VAC-070","VC·AC","더벤처스","TheVentures","Seed~초기","소프트웨어·AI·소비재·글로벌","A","다수 초기 스타트업에 빠르게 투자하는 시드 중심 투자사로 신규펀드·투자속도·회수 흐름을 추적","더벤처스, TheVentures, 김철우, 시드투자, 파운더스","신규 투자·펀드 결성·회수·파트너 이동·TIPS 추천","주 3회","https://theventures.vc/ko"],
  ["VAC-071","VC","스프링캠프","Springcamp","Seed","AI·딥테크·커머스·헬스케어","A","시드 중심 다수 투자와 TIPS 운영 흐름, 초기기업 후속투자와 포트폴리오 변화를 추적","스프링캠프, Springcamp, 최인규, TIPS, 시드","신규 투자·후속투자·TIPS·펀드 결성·핵심인력 이동","주 3회","https://springcamp.co"],
  ["VAC-072","VC","패스트벤처스","Fast Ventures","Pre-seed~Seed","AI·커머스·헬스케어·소프트웨어","A","초기기업 전문 VC로 패스트트랙아시아와 창업자 네트워크를 함께 보고 신규 투자와 펀드 변화를 추적","패스트벤처스, Fast Ventures, 박지웅, 패스트트랙아시아, TIPS","신규 투자·후속투자·펀드 결성·파트너 이동·TIPS","주 3회","http://www.fastventures.co.kr"],
  ["VAC-073","VC","베이스인베스트먼트","BASE Investment","Pre-seed~Series A","소프트웨어·커머스·소비재","B","초기투자 시장의 공동투자와 후속 라운드 참여를 중심으로 포트폴리오·공동투자자 변화를 추적","베이스인베스트먼트, BASE Investment, 초기투자, 시드","신규 투자·후속투자·공동투자·펀드 결성·파트너 이동","주 2회","https://news.kaist.ac.kr/newsen/html/news/?GotoPage=1&list_e_date=&list_s_date=&mng_no=62150&mode=V&skey=&sval="],
  ["VAC-074","VC","스트롱벤처스","Strong Ventures","Seed~Series A","커머스·소프트웨어·AI·콘텐츠","A","한미 초기투자 네트워크와 높은 시드 투자 빈도를 중심으로 최근 투자·회수·파트너 움직임을 추적","스트롱벤처스, Strong Ventures, 배기홍, 시드투자","신규 투자·후속투자·회수·펀드 결성·파트너 이동","주 3회","https://strongvc.com/"],
  ["VAC-075","VC","빅베이슨캐피탈","Big Basin Capital","Seed~Series A","커머스·소프트웨어·콘텐츠","B","한국·미국 초기투자 네트워크와 TIPS 투자 이력을 바탕으로 크로스보더 공동투자·후속투자를 추적","빅베이슨캐피탈, Big Basin Capital, 윤필구, TIPS","신규 투자·후속투자·크로스보더 공동투자·펀드·핵심인력","주 2회","https://www.bigbasincapital.com"],
  ["VAC-076","AC","뉴패러다임인베스트먼트","New Paradigm Investment","Seed~Series A","창업초기·ICT·서비스","B","시드 투자와 액셀러레이팅, 후속투자 연계 및 티에스인베스트먼트 그룹 연계 흐름을 추적","뉴패러다임인베스트먼트, New Paradigm Investment, 박제현, 배상승, 시드투자","신규 투자·후속투자·펀드 결성·TIPS·대표·파트너 이동","주 2회","https://www.npinvestment.co.kr"],
  ["VAC-077","AC","한국투자액셀러레이터","Korea Investment Accelerator · 한투AC","Pre-seed~Series A","AI·바이오·헬스케어·기후테크","A","한국투자금융지주 계열 초기투자 플랫폼으로 그룹 시너지·보육·후속투자와 투자규모 변화를 추적","한국투자액셀러레이터, Korea Investment Accelerator, 한투AC, 백여현, 바른동행","신규 투자·후속투자·펀드 결성·그룹 공동투자·대표·핵심인력","주 3회","https://www.koreainvestment.ac/"],
  ["VAC-078","VC","인라이트벤처스","Enlight Ventures","Seed~Series A","기술형·딥테크·바이오·지역혁신","B","기술형 스타트업과 지역·정책펀드 참여가 활발해 신규펀드·공동GP·지역확장 흐름을 추적","인라이트벤처스, Enlight Ventures, 박문수, 기술형 스타트업, 지역펀드","신규 투자·펀드 결성·정책출자 선정·공동GP·파트너 이동","주 2회","https://enlightvc.com/"]
];

function aliases(value) {
  return String(value || "").split(/·|,/).map((item) => item.trim()).filter(Boolean);
}

function entityType(type) {
  if (type === "AC") return "ac";
  return "vc";
}

const items = rows.map(([id, type, name, english, stage, sectors, priority, reason, keywords, changes, cadence, url]) => {
  const typeLabel = [type, stage, sectors].filter(Boolean).join("·");
  const status = [
    { label: "기본정보", text: `${stage} 중심 · ${sectors}` },
    { label: "감시", text: reason },
    { label: "검색어", text: keywords },
    { label: "추적", text: changes },
  ];
  return {
    company_id: id,
    canonical_name: name,
    aliases: aliases(english),
    entity_type: entityType(type),
    type_label: typeLabel,
    identification_status: "VC·AC 감시목록 정본 등록",
    basis_date: BASIS_DATE,
    latest_issue_at: null,
    source_system: "구글시트 · VC·AC_감시",
    file_name: null,
    summary: `${name}: ${stage} 중심, ${sectors}. ${reason}`,
    current_status: status,
    drive_sections: [{ title: "VC·AC 마스터", items: status }],
    connections: [`감시목록: VC·AC_감시 ${id}`, "검색뷰: PEF_Monitor_검색뷰"],
    questions: [],
    decision_boundary: "감시목록의 기본 프로필이다. 개별 투자·펀드·인물에 관한 사실은 관련 공시·보도·공식자료를 추가 확인한 뒤 판단한다.",
    next_updates: [changes, `권장 점검주기: ${cadence}`],
    sources: url ? [{ title: `${name} 근거자료`, source_name: "VC·AC 감시목록 근거", source_url: url, fact: null, verification_status: "감시목록 정본" }] : [],
    watch_priority: priority,
  };
});

module.exports = { source: "구글시트/VC·AC_감시", basis_date: BASIS_DATE, items };
