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
};

function getInstitutionBasicExtraInfo(companyId) {
  return BASIC_EXTRA[companyId] || null;
}

module.exports = { BASIC_EXTRA, getInstitutionBasicExtraInfo, basis_date:BASIS_DATE };
