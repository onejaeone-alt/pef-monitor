const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFamilies, enrich, refineEvent, shouldKeep } = require('../lib/dart-monitor');

function item(overrides={}) {
  return {
    rcept_no:'20260903000100', rcept_dt:'20260903', corp_code:'00123456', corp_name:'테스트회사', flr_nm:'테스트회사',
    report_nm:'주요사항보고서(전환사채권발행결정)', url:'https://dart.fss.or.kr/test',
    analysis:{ event_id:'mezzanine', event_label:'메자닌·사채 조달', stage:'의사결정', entity_strength:0, is_correction:false },
    ...overrides,
  };
}

test('classifies bond retirement before generic mezzanine issuance', () => {
  const refined = refineEvent(item({ report_nm:'주요사항보고서(전환사채 취득 후 소각)' }));
  assert.equal(refined.analysis.event_id, 'bond_retirement');
  assert.equal(refined.analysis.event_label, '메자닌 상환·소각');
});

test('filters public fund prospectus noise', () => {
  assert.equal(shouldKeep(item({ report_nm:'투자설명서(집합투자증권)', analysis:{event_id:'fund_change',entity_strength:2} })), false);
});

test('keeps periodic filings only for strong PEF or VC entities', () => {
  assert.equal(shouldKeep(item({ report_nm:'분기보고서', analysis:{event_id:'periodic',entity_strength:0} })), false);
  assert.equal(shouldKeep(item({ report_nm:'분기보고서', analysis:{event_id:'periodic',entity_strength:2} })), true);
});

test('groups original and corrected filings into one family', () => {
  const original = enrich(item({ rcept_no:'20260901000100', report_nm:'주요사항보고서(유상증자결정)', analysis:{event_id:'capital_raise',event_label:'유상증자·자본 확충',stage:'의사결정',entity_strength:0,is_correction:false} }));
  const corrected = enrich(item({ rcept_no:'20260903000100', report_nm:'[기재정정]주요사항보고서(유상증자결정)', analysis:{event_id:'capital_raise',event_label:'유상증자·자본 확충',stage:'조건·내용 변경',entity_strength:0,is_correction:true} }));
  const families = buildFamilies([original,corrected]);
  assert.equal(families.length,1);
  assert.equal(families[0].count,2);
  assert.equal(families[0].correction_count,1);
  assert.equal(families[0].tier,'change');
});
