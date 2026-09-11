const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFamilies, enrich, refineEvent, shouldKeep } = require('../lib/dart-monitor');

function item(overrides={}) {
  return {
    rcept_no:'20260903000100', rcept_dt:'20260903', corp_code:'00123456', corp_name:'테스트회사', flr_nm:'테스트회사', corp_cls:'K',
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

test('filters public fund prospectus and issuance-result noise', () => {
  assert.equal(shouldKeep(item({ report_nm:'투자설명서(집합투자증권)', analysis:{event_id:'fund_change',entity_strength:2} })), false);
  assert.equal(shouldKeep(item({ report_nm:'증권발행실적보고서(집합투자증권)(한국투자퇴직연금마이스터증권자투자신탁1호)', analysis:{event_id:'fund_change',entity_strength:2} })), false);
});

test('keeps private-market fund formation signals but not generic fund words', () => {
  assert.equal(shouldKeep(item({ report_nm:'기관전용사모집합투자기구 변경보고', analysis:{event_id:'fund_change',entity_strength:2} })), true);
  assert.equal(shouldKeep(item({ report_nm:'일반 펀드 변경 안내', analysis:{event_id:'fund_change',entity_strength:2} })), false);
});

test('filters routine personal and simplified ownership reports', () => {
  assert.equal(shouldKeep(item({ report_nm:'임원ㆍ주요주주특정증권등소유상황보고서', analysis:{event_id:'ownership_report',entity_strength:0} })), false);
  assert.equal(shouldKeep(item({ report_nm:'주식등의대량보유상황보고서(약식)', analysis:{event_id:'ownership_report',entity_strength:0} })), false);
  assert.equal(shouldKeep(item({ report_nm:'주식등의대량보유상황보고서(일반)', analysis:{event_id:'ownership_report',entity_strength:0} })), true);
});

test('routine maximum-shareholder ownership notice is follow-up, not a control-change signal', () => {
  const refined = refineEvent(item({ report_nm:'최대주주등소유주식변동신고서', analysis:{event_id:'control_change',event_label:'경영권·최대주주 변동',entity_strength:0} }));
  assert.equal(refined.analysis.event_id,'ownership_report');
  const out=enrich(refined);
  assert.equal(out.tier,'followup');
  assert.equal(out.group_id,'equity');
});

test('filters routine unlisted related-party funding but keeps listed or monitored cases', () => {
  assert.equal(shouldKeep(item({corp_cls:'E',report_nm:'특수관계인으로부터자금차입',analysis:{event_id:'related_party_funding',entity_strength:0}})),false);
  assert.equal(shouldKeep(item({corp_cls:'K',report_nm:'특수관계인으로부터자금차입',analysis:{event_id:'related_party_funding',entity_strength:0}})),true);
  assert.equal(shouldKeep(item({corp_cls:'E',report_nm:'특수관계인으로부터자금차입',analysis:{event_id:'related_party_funding',entity_strength:2}})),true);
});

test('related-party capital participation is hidden unless the filer has a strong monitored signal', () => {
  assert.equal(shouldKeep(item({corp_cls:'E',report_nm:'특수관계인의유상증자참여',analysis:{event_id:'capital_raise',entity_strength:0}})),false);
  assert.equal(shouldKeep(item({corp_cls:'E',report_nm:'특수관계인의유상증자참여',analysis:{event_id:'capital_raise',entity_strength:2}})),true);
});

test('SPAC dissolution stays searchable but does not enter the first-look core tier', () => {
  const out=enrich(item({corp_name:'신영제10호기업인수목적',report_nm:'주요사항보고서(해산사유발생)',analysis:{event_id:'merger_restructuring',entity_strength:0}}));
  assert.equal(shouldKeep(out),true);
  assert.equal(out.tier,'followup');
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
