const BASIS_DATE='2026-09-04';

const LATEST={
  'VAC-025':{aliases:['SBI Investment Korea'],assets_under_management:'약 1.5조원 (2026 상반기)',portfolio_count:'161개사',investment_count:'187건',basis_date:BASIS_DATE,source_url:'https://www.hankyung.com/article/202608141795r'},
  'VAC-038':{aliases:['SL Investment'],representatives:['이승헌'],assets_under_management:'3,260억원 (2026 DIVA 기준)',portfolio_count:'94개사',investment_count:'112건',homepage:'https://slinvestment.com',basis_date:BASIS_DATE,source_url:'https://v.daum.net/v/GwaHTGyO66'},
  'VAC-042':{aliases:['GS Ventures'],founded_year:'2022-01-07',representatives:['홍석현'],assets_under_management:'설립자본금 100억원·펀드 총 AUM 별도 비공개',portfolio_count:'25개사',investment_count:'29건',homepage:'https://gsventures.vc',basis_date:BASIS_DATE,source_url:'https://www.gs.co.kr/ko/news/view?bbsSq=739'},
  'VAC-044':{aliases:['ZER01NE Ventures','ZER01NE'],founded_year:'2018',representatives:['현대차그룹 오픈이노베이션 조직(별도 법인 대표 없음)'],assets_under_management:'ZER01NE Fund III 1,250억원 (2025)',portfolio_count:'Fund I·II 누적 107개 스타트업 (2024H1 공식)',investment_count:'107개 스타트업 투자·144개 협업 프로젝트',homepage:'https://www.hyundai.com/kr/ko/brand/brandstory/campaigns/zero-one-ventures',basis_date:BASIS_DATE,source_url:'https://www.hyundai.com/content/hyundai/worldwide/en/newsroom/detail/hyundai-motor-group-opens-zer01ne-fund-iii-to-drive-future-technology-innovation-with-startups-0000000958.html'},
  'VAC-054':{aliases:['SNU Holdings'],founded_year:'2008-10-30',representatives:['차인환'],assets_under_management:'1,200억원+ · 14개 펀드 운용 (2026)',portfolio_count:'159개사',investment_count:'185건',homepage:'http://www.snuholdings.com',basis_date:BASIS_DATE,source_url:'https://www.nicebizinfo.com/ep/EP0100M002GE.nice?kiscode=G08555'},
  'VAC-055':{aliases:['KAIST Venture Investment Holdings'],founded_year:'2014-10-31',representatives:['정회훈'],assets_under_management:'총 AUM 공개 누적치 미확보',portfolio_count:'72개사',investment_count:'76건',homepage:'http://www.kaistventures.com',basis_date:BASIS_DATE,source_url:'https://www.nicebizinfo.com/ep/EP0100M002GE.nice?kiscode=M30130'},
  'VAC-060':{aliases:['Y&Archer'],founded_year:'2015-10-19',representatives:['신진오','이호재'],assets_under_management:'총 AUM 공개자료 미확인',portfolio_count:'162개사',investment_count:'174건',homepage:'https://www.ynarcher.com',basis_date:BASIS_DATE,source_url:'https://www.saramin.co.kr/zf_user/company-info/view?csn=MXFqU3FwSEUvS0lxUFlDZEp4Vitldz09'},
  'VAC-065':{aliases:['Schmidt'],founded_year:'2017-04',representatives:['김현준'],assets_under_management:'1,957억원 (2026-03-31)',portfolio_count:'116개사',investment_count:'159건',basis_date:BASIS_DATE,source_url:'https://kind.krx.co.kr/external/2026/05/15/002443/20260515005493/11013.htm'},
  'VAC-069':{aliases:['Pacemakers'],founded_year:'2017-09-25',representatives:['김경락','조기환'],assets_under_management:'총 AUM 공개자료 미확인',portfolio_count:'11개사',investment_count:'11건',homepage:'https://pacemakers.kr',basis_date:BASIS_DATE,source_url:'https://bizno.net/article/8348100775'},
};

function getInstitutionBasicLatestOverride(companyId){return LATEST[companyId]||null;}
module.exports={LATEST,getInstitutionBasicLatestOverride,basis_date:BASIS_DATE};
