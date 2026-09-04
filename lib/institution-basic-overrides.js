const BASIS_DATE = '2026-09-04';

// Google Sheet `기관_기본정보_검증값`에서 추가 검증된 최신 기본정보.
// 기존 institution-basic-data.js보다 이 파일의 값이 우선한다.
const OVERRIDES = {
  'ORG-051': {
    aliases:['IMM Investment'], founded_year:'1999-07', representatives:['장동우','정일부','변재철'],
    assets_under_management:'94,887억원 (VC+PEF·2025-12-31)', portfolio_count:'199개사', investment_count:'261건',
    homepage:'https://www.imm.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/imminvestment',
  },
  'VAC-032': {
    aliases:['Altos Ventures'], founded_year:'1996', representatives:['김한준'], assets_under_management:'총 AUM 비공개',
    portfolio_count:'한국 100개+·글로벌 400개+', investment_count:'184건 (THE VC 한국 집계)', homepage:'https://www.altosventures.com',
    basis_date:BASIS_DATE, source_url:'https://altos-vc.oopy.io/',
  },
  'VAC-038': {
    aliases:['SL Investment'], founded_year:'2000-01', representatives:['이승헌'], assets_under_management:'3,260억원 (2026 DIVA 공개치)',
    portfolio_count:'94개사', investment_count:'112건', homepage:'https://slinvestment.com', basis_date:BASIS_DATE,
    source_url:'https://v.daum.net/v/GwaHTGyO66',
  },
  'VAC-042': {
    aliases:['GS Ventures'], founded_year:'2022-01-07', representatives:['홍석현'],
    assets_under_management:'설립자본금 100억원·펀드 총 AUM 별도 비공개', portfolio_count:'25개사', investment_count:'29건',
    homepage:'https://gsventures.vc', basis_date:BASIS_DATE, source_url:'https://www.gs.co.kr/ko/news/view?bbsSq=739',
  },
  'VAC-044': {
    aliases:['ZER01NE','ZER01NE Ventures'], founded_year:'2018', representatives:['현대차그룹 오픈이노베이션 조직(별도 법인 대표 없음)'],
    assets_under_management:'ZER01NE Fund III 1,250억원 (2025)', portfolio_count:'Fund I·II 누적 107개 스타트업 (2024H1 공식)', investment_count:'107개 스타트업 투자·144개 협업 프로젝트',
    homepage:'https://www.hyundai.com/kr/ko/brand/brandstory/campaigns/zero-one-ventures', basis_date:BASIS_DATE,
    source_url:'https://www.hyundai.com/content/hyundai/worldwide/en/newsroom/detail/hyundai-motor-group-opens-zer01ne-fund-iii-to-drive-future-technology-innovation-with-startups-0000000958.html',
  },
  'VAC-054': {
    aliases:['Seoul National University Tech Holdings','SNU Holdings'], founded_year:'2008-10-30', representatives:['차인환'],
    assets_under_management:'AUM 1,200억원+·14개 펀드 (2026)', portfolio_count:'200개사+', investment_count:'200건+ 투자',
    homepage:'https://snutechholdings.snu.ac.kr', basis_date:BASIS_DATE, source_url:'https://snutechholdings.snu.ac.kr/notice/?mod=document&uid=338',
  },
  'VAC-055': {
    aliases:['KAIST Venture Investment Holdings'], founded_year:'2014-11', representatives:['정회훈'],
    assets_under_management:'총 AUM 비공개·설립 시드머니 100억원', portfolio_count:'72개사', investment_count:'76건',
    homepage:'http://kaistventures.com/', basis_date:BASIS_DATE, source_url:'https://ilp.kaist.ac.kr/sub040202/view/page/2/id/18',
  },
  'VAC-060': {
    aliases:['Y&Archer'], founded_year:'2015-10-19', representatives:['신진오','이호재'], assets_under_management:'총 AUM 비공개',
    portfolio_count:'162개사', investment_count:'174건', homepage:'https://ynarcher.com', basis_date:BASIS_DATE,
    source_url:'https://www.nicebizinfo.com/ep/EP0100M002GE.nice?kiscode=HJ9831',
  },
  'VAC-065': {
    aliases:['Schmidt'], founded_year:'2017-04', representatives:['김현준'], assets_under_management:'AUM 1,500억원+ (2023 공개치)',
    portfolio_count:'116개사', investment_count:'159건', basis_date:BASIS_DATE,
    source_url:'https://financialfilings.com/filings/dsc-investment-inc/interim-quarterly-report/2025/7872636/',
  },
  'VAC-069': {
    aliases:['Pacemakers'], founded_year:'2017-09-25', representatives:['김경락','조기환'], assets_under_management:'총 AUM 비공개',
    portfolio_count:'11개사', investment_count:'11건', homepage:'https://pacemakers.kr', basis_date:BASIS_DATE,
    source_url:'https://www.nicebizinfo.com/ep/EP0100M002GE.nice?kiscode=IU6806',
  },
  'VAC-070': {
    aliases:['TheVentures'], founded_year:'2014-01-02', representatives:['김철우'], assets_under_management:'500억원대 (2026-03 공개치)',
    portfolio_count:'196개사', investment_count:'209건', homepage:'https://theventures.vc/ko', basis_date:BASIS_DATE,
    source_url:'https://www.thebell.co.kr/front/newsview.asp?key=202603091356280800102153',
  },
  'VAC-071': {
    aliases:['Springcamp'], founded_year:'2015-12-01', representatives:['최인규'], assets_under_management:'1,652억원 (2024 공개치)',
    portfolio_count:'188개사', investment_count:'258건', homepage:'https://springcamp.co', basis_date:BASIS_DATE,
    source_url:'https://www.innoforest.co.kr/investor/IV00000842/%EC%8A%A4%ED%94%84%EB%A7%81%EC%BA%A0%ED%94%84',
  },
  'VAC-072': {
    aliases:['Fast Ventures'], founded_year:'2019', representatives:['박지웅'], assets_under_management:'총 AUM 비공개',
    portfolio_count:'65개사', investment_count:'72건', homepage:'http://www.fastventures.co.kr', basis_date:BASIS_DATE,
    source_url:'https://kr.linkedin.com/company/fastventures',
  },
  'VAC-074': {
    aliases:['Strong Ventures'], founded_year:'2012', representatives:['배기홍','John Nahm'], assets_under_management:'총 AUM 비공개',
    portfolio_count:'약 290개사 (2026 회사 공개)', investment_count:'332건 (THE VC 한국 집계)', homepage:'https://strongvc.com', basis_date:BASIS_DATE,
    source_url:'https://www.linkedin.com/company/strong-ventures',
  },
  'VAC-075': {
    aliases:['Big Basin Capital'], founded_year:'2013-12-13', representatives:['윤필구'], assets_under_management:'총 AUM 비공개',
    portfolio_count:'47개사', investment_count:'77건', homepage:'https://www.bigbasincapital.com', basis_date:BASIS_DATE,
    source_url:'https://www.saramin.co.kr/zf_user/company-info/view/csn/K25GUFBXR2VhUDRVUXFsSm04aWt5QT09/company_nm/%EB%B9%85%EB%B2%A0%EC%9D%B4%EC%8A%A8%EC%BA%90%ED%94%BC%ED%83%88%28%EC%9C%A0%29',
  },
  'VAC-076': {
    aliases:['New Paradigm Investment'], founded_year:'2016-10-04', representatives:['박제현','배상승'], assets_under_management:'총 AUM 비공개',
    portfolio_count:'72개사', investment_count:'91건', homepage:'https://www.npinvestment.co.kr', basis_date:BASIS_DATE,
    source_url:'https://www.saramin.co.kr/zf_user/company-info/view/csn/YWRCdEE2WFVDY0dHVTR5ZFFIWVQ1Zz09/company_nm/%EB%89%B4%ED%8C%A8%EB%9F%AC%EB%8B%A4%EC%9E%84%EC%9D%B8%EB%B2%A0%EC%8A%A4%ED%8A%B8%EB%A8%BC%ED%8A%B8%28%EC%A3%BC%29',
  },
  'VAC-077': {
    aliases:['Korea Investment Accelerator','한투AC'], founded_year:'2021-12-24', representatives:['백여현'],
    assets_under_management:'AUM 600억원 (회사 공식 현재값)', portfolio_count:'114개사 (회사 공식 현재값)', investment_count:'134건 (THE VC)',
    homepage:'https://www.koreainvestment.ac', basis_date:BASIS_DATE, source_url:'https://en.koreainvestment.ac/about',
  },
};

function getInstitutionBasicOverride(companyId) {
  return OVERRIDES[companyId] || null;
}

module.exports = { OVERRIDES, getInstitutionBasicOverride, basis_date:BASIS_DATE };
