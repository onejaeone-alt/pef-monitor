const BASIS_DATE = '2026-09-04';

// Google Sheet `기관_기본정보` / `기관_기본정보_검증값` 앱용 스냅샷.
// 확인된 외부값만 넣고, 없는 값은 기존 취재파일 프로필 추론값을 유지한다.
const BASIC_INFO = {
  'VAC-008': { aliases:['Korea Investment Partners'], representatives:['황만순'], assets_under_management:'36,700억원 (2025-12-31)', portfolio_count:'404개사', investment_count:'556건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/koreainvestmentpartners/portfolios' },
  'VAC-009': { aliases:['KB Investment'], founded_year:'1990-03-27', representatives:['윤법렬'], assets_under_management:'21,660억원 (2025-12-31)', portfolio_count:'367개사', investment_count:'489건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/kbinvestment/portfolios' },
  'VAC-010': { aliases:['SBVA'], founded_year:'2000년 전신 출범 · 2023년 독립', representatives:['이준표'], assets_under_management:'22,916억원 (2025-12-31)', portfolio_count:'135개사', investment_count:'191건', homepage:'https://www.sbvacorp.com/ko', basis_date:BASIS_DATE, source_url:'https://thevc.kr/sbva/portfolios' },
  'ORG-051': { aliases:['IMM Investment'], representatives:['장동우','지성배','정일부','변재철'], assets_under_management:'19,729억원 (VC·2025-12-31)', basis_date:BASIS_DATE },
  'VAC-012': { aliases:['Atinum Investment'], founded_year:'1988-10-10', representatives:['신기천','이승용','맹두진'], assets_under_management:'약 18,600억원 (2026-06)', portfolio_count:'151개사', investment_count:'242건', homepage:'https://www.atinuminvest.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/atinuminvestment/portfolios' },
  'VAC-013': { aliases:['DSC Investment'], founded_year:'2012-01-18', representatives:['윤건수'], assets_under_management:'15,455억원 (2025-12-31)', portfolio_count:'194개사', investment_count:'296건', homepage:'http://www.dscinvestment.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/dscinvestment/portfolios' },
  'VAC-014': { aliases:['InterVest'], founded_year:'1999-09-14', representatives:['우충희','이태용'], assets_under_management:'15,938억원 (2025-12-31)', portfolio_count:'144개사', investment_count:'194건', homepage:'https://www.intervest.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/intervest/portfolios' },
  'VAC-015': { aliases:['Mirae Asset Venture Investment'], founded_year:'1999-06-08', representatives:['김응석'], assets_under_management:'15,250억원 (2025-12-31)', portfolio_count:'240개사', investment_count:'314건', homepage:'http://venture.miraeasset.co.kr', basis_date:BASIS_DATE, source_url:'https://venture.miraeasset.co.kr/company.jsp' },
  'VAC-016': { aliases:['Shinhan Venture Investment'], representatives:['박선배'], assets_under_management:'14,484억원 (2025-12-31)', portfolio_count:'185개사', investment_count:'212건', homepage:'https://shinhanvc.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/shinhanventureinvestment/portfolios' },
  'VAC-017': { aliases:['LB Investment'], representatives:['박기호'], assets_under_management:'14,990억원 (2025)', portfolio_count:'163개사', investment_count:'221건', homepage:'https://lbinvestment.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/lbinvestment/portfolios' },
  'ORG-052': { aliases:['Aju IB','Aju IB Investment'], representatives:['김지원'], assets_under_management:'VC 14,435억원 / PEF 9,977억원 (2025-12-31)', homepage:'https://www.ajuib.co.kr', basis_date:BASIS_DATE, source_url:'https://www.thebell.co.kr/front/newsview.asp?key=202601051540536840101290' },
  'ORG-053': { aliases:['Stonebridge Ventures'], founded_year:'2017-05-31', representatives:['유승운'], assets_under_management:'약 17,000억원 (2026-08)', portfolio_count:'193개사', investment_count:'276건', homepage:'http://www.stonebridgeventures.vc', basis_date:BASIS_DATE, source_url:'https://thevc.kr/stonebridgeventures/portfolios' },
  'VAC-020': { aliases:['Woori Venture Partners'], portfolio_count:'164개사', investment_count:'219건', homepage:'https://www.woorivp.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/wooriventurepartners/portfolios' },
  'VAC-021': { aliases:['Company K Partners'], founded_year:'2006-10-18', portfolio_count:'148개사', investment_count:'217건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/companykpartners/portfolios' },
  'VAC-023': { aliases:['TS Investment'], assets_under_management:'11,717억원 (2025)', portfolio_count:'93개사', investment_count:'115건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/tsinvestment/portfolios' },
  'VAC-025': { aliases:['SBI Investment Korea'], assets_under_management:'11,855억원 (2025)', portfolio_count:'161개사', investment_count:'187건', basis_date:BASIS_DATE, source_url:'https://thevc.kr/sbiinvestmentkorea/portfolios' },
  'VAC-026': { aliases:['Hana Ventures'], portfolio_count:'156개사', investment_count:'206건', homepage:'https://www.hanaventures.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/hanaventures/portfolios' },
  'VAC-029': { aliases:['STIC Ventures'], portfolio_count:'121개사', investment_count:'144건', homepage:'https://www.sticventures.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/sticventures/portfolios' },
  'VAC-033': { aliases:['BonAngels Venture Partners'], representatives:['강석흔','송인애'], portfolio_count:'243개사', investment_count:'300건', homepage:'https://www.bonangels.net', basis_date:BASIS_DATE, source_url:'https://thevc.kr/bonangelsventurepartners/portfolios' },
  'VAC-034': { aliases:['Kakao Ventures'], representatives:['김기준'], portfolio_count:'264개사', investment_count:'356건', homepage:'https://www.kakao.vc', basis_date:BASIS_DATE, source_url:'https://thevc.kr/kakaoventures/portfolios' },
  'VAC-035': { aliases:['Smilegate Investment'], portfolio_count:'273개사', investment_count:'365건', homepage:'https://www.smilegateinvestment.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/smilegateinvestment/portfolios' },
  'VAC-036': { aliases:['Capstone Partners'], portfolio_count:'179개사', investment_count:'261건', homepage:'https://www.cspartners.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/capstonepartners/portfolios' },
  'VAC-041': { aliases:['Samsung Venture Investment'], portfolio_count:'194개사', investment_count:'224건', homepage:'https://www.samsungventure.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/samsungventureinvestment/portfolios' },
  'VAC-046': { aliases:['Bluepoint Partners'], representatives:['이용관'], portfolio_count:'399개사', investment_count:'437건', homepage:'https://bluepoint.ac', basis_date:BASIS_DATE, source_url:'https://thevc.kr/bluepointpartners/portfolios' },
  'VAC-047': { aliases:['FuturePlay'], representatives:['권오형'], portfolio_count:'263개사', investment_count:'354건', homepage:'https://futureplay.co', basis_date:BASIS_DATE, source_url:'https://thevc.kr/futureplay/portfolios' },
  'VAC-048': { aliases:['Primer'], representatives:['권도균'], portfolio_count:'289개사', investment_count:'342건', homepage:'https://primer.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/primer/portfolios' },
  'VAC-049': { aliases:['SparkLabs'], representatives:['김유진','이한주'], portfolio_count:'202개사', investment_count:'214건', homepage:'https://sparklabs.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/sparklabs/portfolios' },
  'VAC-050': { aliases:['Mashup Ventures'], representatives:['이택경'], portfolio_count:'209개사', investment_count:'218건', homepage:'https://www.mashupventures.co', basis_date:BASIS_DATE, source_url:'https://thevc.kr/mashupventures/portfolios' },
  'VAC-051': { aliases:['Sopoong Ventures'], representatives:['한상엽'], portfolio_count:'169개사', investment_count:'194건', homepage:'https://sopoong.net', basis_date:BASIS_DATE, source_url:'https://thevc.kr/sopoongventures/portfolios' },
  'VAC-053': { aliases:['CNT Tech'], representatives:['전화성'], portfolio_count:'458개사', investment_count:'515건', homepage:'https://cntt.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/cnttech/portfolios' },
  'VAC-069': { aliases:['Pacemakers'], representatives:['김경락','조기환'], portfolio_count:'11개사', investment_count:'11건', homepage:'https://pacemakers.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/pacemakers/portfolios' },
  'VAC-070': { aliases:['TheVentures'], representatives:['김철우'], portfolio_count:'196개사', investment_count:'209건', homepage:'https://theventures.vc/ko', basis_date:BASIS_DATE, source_url:'https://thevc.kr/theventures/portfolios' },
  'VAC-071': { aliases:['Springcamp'], representatives:['최인규'], portfolio_count:'188개사', investment_count:'258건', homepage:'https://springcamp.co', basis_date:BASIS_DATE, source_url:'https://thevc.kr/springcamp/portfolios' },
  'VAC-072': { aliases:['Fast Ventures'], representatives:['박지웅'], portfolio_count:'65개사', investment_count:'72건', homepage:'http://www.fastventures.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/fastventures/portfolios' },
  'VAC-074': { aliases:['Strong Ventures'], representatives:['배기홍'], portfolio_count:'191개사', investment_count:'332건', homepage:'https://strongvc.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/strongventures/portfolios' },
  'VAC-075': { aliases:['Big Basin Capital'], representatives:['윤필구'], portfolio_count:'47개사', investment_count:'77건', homepage:'https://www.bigbasincapital.com', basis_date:BASIS_DATE, source_url:'https://thevc.kr/bigbasincapital/portfolios' },
  'VAC-076': { aliases:['New Paradigm Investment'], representatives:['박제현','배상승'], portfolio_count:'72개사', investment_count:'91건', homepage:'https://www.npinvestment.co.kr', basis_date:BASIS_DATE, source_url:'https://thevc.kr/newparadigminvestment/portfolios' },
  'VAC-077': { aliases:['Korea Investment Accelerator','한투AC'], representatives:['백여현'], portfolio_count:'120개사', investment_count:'134건', homepage:'https://www.koreainvestment.ac', basis_date:BASIS_DATE, source_url:'https://thevc.kr/koreainvestmentaccelerator/portfolios' },
};

const BASIC_BY_NAME = new Map();

function normalize(value) {
  return String(value || '').toLowerCase().replace(/주식회사|유한회사|유한책임회사|\(주\)|㈜/g, '').replace(/[^0-9a-z가-힣]/g, '');
}

function registerName(id, name) {
  if (!name) return;
  BASIC_BY_NAME.set(normalize(name), BASIC_INFO[id]);
}

for (const [id, item] of Object.entries(BASIC_INFO)) {
  for (const alias of item.aliases || []) registerName(id, alias);
}

function getInstitutionBasicInfo(companyId, canonicalName) {
  return BASIC_INFO[companyId] || BASIC_BY_NAME.get(normalize(canonicalName)) || null;
}

module.exports = { BASIC_INFO, getInstitutionBasicInfo, basis_date: BASIS_DATE };
