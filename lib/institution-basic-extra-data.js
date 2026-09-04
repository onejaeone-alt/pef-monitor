const BASIS_DATE = '2026-09-04';

const BASIC_EXTRA = {
  'ORG-050': { portfolio_count:'107개사', investment_count:'140건', homepage:'https://premierpartners.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/premierpartners/portfolios' },
  'VAC-024': { portfolio_count:'210개사', investment_count:'245건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/poscotechnologyinvestment/portfolios' },
  'VAC-027': { portfolio_count:'116개사', investment_count:'132건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/kiwoominvestment/portfolios' },
  'VAC-028': { portfolio_count:'77개사', investment_count:'94건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/k2investmentpartners/portfolios' },
  'VAC-030': { portfolio_count:'126개사', investment_count:'162건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/hbinvestment/portfolios' },
  'VAC-031': { portfolio_count:'65개사', investment_count:'93건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/murexpartners/portfolios' },
  'VAC-032': { portfolio_count:'98개사', investment_count:'184건', homepage:'https://www.altosventures.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/altosventures/portfolios' },
  'VAC-037': { portfolio_count:'87개사', investment_count:'118건', homepage:'https://dayli.partners', basis_date:BASIS_DATE, source_url:'https://thevc.kr/daylipartners/portfolios' },
  'VAC-038': { portfolio_count:'94개사', investment_count:'112건', homepage:'https://slinvestment.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/slinvestment/portfolios' },
  'VAC-040': { portfolio_count:'50개사', investment_count:'58건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/mediciinvestment/portfolios' },
  'VAC-042': { portfolio_count:'25개사', investment_count:'29건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/gsventures/portfolios' },
  'VAC-043': { portfolio_count:'265개사', investment_count:'342건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/lotteventures/portfolios' },
  'VAC-044': { portfolio_count:'72개사', investment_count:'82건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/zer01neventures/portfolios' },
  'VAC-052': { portfolio_count:'166개사', investment_count:'183건', homepage:'https://mysc.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/mysocialcompany/portfolios' },
  'VAC-056': { portfolio_count:'69개사', investment_count:'84건', homepage:'https://ko.antler.co/location/korea', basis_date:BASIS_DATE, source_url:'https://thevc.kr/antlerkorea/portfolios' },
  'VAC-057': { portfolio_count:'199개사', investment_count:'266건', homepage:'https://theilab.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/theinventionlab/portfolios' },
  'VAC-058': { portfolio_count:'255개사 (인포뱅크 전체)', investment_count:'274건 (인포뱅크 전체)', homepage:'https://www.infobank.net', basis_date:BASIS_DATE, source_url:'https://thevc.kr/infobank/portfolios' },
  'VAC-060': { portfolio_count:'162개사', investment_count:'174건', homepage:'https://ynarcher.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/ynarcher/portfolios' },
  'VAC-063': { portfolio_count:'105개사', investment_count:'120건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/bigbangangels/portfolios' },
  'VAC-064': { portfolio_count:'48개사', investment_count:'51건', homepage:'https://www.rowe.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/rowepartners/portfolios' },
  'VAC-066': { portfolio_count:'105개사', investment_count:'139건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/partnersinvestment/portfolios' },
  'VAC-078': { portfolio_count:'158개사', investment_count:'212건', homepage:'https://enlightvc.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/enlightventures/portfolios' },
  'VAC-039': { founded_year:'1998-04-14', assets_under_management:'총 AUM 공식 공개치 미확보', portfolio_count:'110개사 (Crunchbase 외부집계)', investment_count:'125건 (Crunchbase 외부집계)', homepage:'https://utc.co.kr', basis_date:BASIS_DATE, source_url:'https://englishdart.fss.or.kr/dsbc001/selectPopup.ax?selectKey=00254920' },
  'VAC-045': { founded_year:'2015', assets_under_management:'기업내 CVC 프로그램·별도 AUM 미공개', portfolio_count:'공식 포트폴리오 페이지 108개', investment_count:'투자 라운드 누적건수 별도 미공개', homepage:'https://d2sf.naver.com', basis_date:BASIS_DATE, source_url:'https://d2sf.naver.com/ko/portfolio' },
  'VAC-054': { assets_under_management:'총 AUM 공개 누적치 미확보', portfolio_count:'159개사', investment_count:'185건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/seoultechnoholdings/portfolios' },
  'VAC-055': { assets_under_management:'총 AUM 공개 누적치 미확보', portfolio_count:'72개사', investment_count:'76건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/kaistventureinvestmentholdings/portfolios' },
  'VAC-059': { assets_under_management:'총 AUM 공개 누적치 미확보', portfolio_count:'86개사', investment_count:'88건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/kingsleyventures/portfolios' },
  'VAC-061': { founded_year:'2018-05-18', representatives:['허제','손지형'], assets_under_management:'총 AUM 공개치 미확보', portfolio_count:'직접 귀속 집계 보류', investment_count:'직접 귀속 집계 보류', homepage:'https://n15partners.com', basis_date:BASIS_DATE, source_url:'https://bizok.incheon.go.kr/platform/ofc/ofcDetail.do?ofc_key=13620' },
  'VAC-062': { founded_year:'2018-08', representatives:['박재현'], assets_under_management:'총 AUM 공개치 미확보', portfolio_count:'39개사', investment_count:'46건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/tapangelpartners/portfolios' },
  'VAC-065': { assets_under_management:'총 AUM 공개 누적치 미확보', portfolio_count:'116개사', investment_count:'159건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/schmidt/portfolios' },
  'VAC-067': { assets_under_management:'총 AUM 공개 누적치 미확보', portfolio_count:'88개사', investment_count:'110건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/wonikinvestmentpartners/portfolios' },
  'VAC-068': { founded_year:'2018-02', representatives:['신진철','윤일석'], assets_under_management:'총 AUM 공개 누적치 미확보', portfolio_count:'33개사', investment_count:'36건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/friendinvestmentpartners' },
  'VAC-073': { founded_year:'2018', representatives:['신윤호'], assets_under_management:'공개 총 AUM 미확보', portfolio_count:'공개 누적 집계 미확보', investment_count:'공개 누적 집계 미확보', basis_date:BASIS_DATE, source_url:'https://start.zuzu.network/resource/blog/vc-interview-bass/' },
};

function getInstitutionBasicExtraInfo(companyId) {
  return BASIC_EXTRA[companyId] || null;
}

module.exports = { BASIC_EXTRA, getInstitutionBasicExtraInfo, basis_date:BASIS_DATE };
