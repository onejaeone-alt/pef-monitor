const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFamilies, enrich, inReportingScope, refineEvent, shouldKeep } = require('../lib/dart-monitor');

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

test('generic listed-company events stay out of the reporter desk', () => {
  assert.equal(shouldKeep(item({corp_name:'엠젠솔루션',flr_nm:'엠젠솔루션',report_nm:'[기재정정]경영권변경등에관한계약체결',analysis:{event_id:'control_change',event_label:'경영권·최대주주 변동',stage:'조건·내용 변경',entity_strength:0}})),false);
  assert.equal(shouldKeep(item({corp_name:'SGC에너지',flr_nm:'SGC에너지',report_nm:'타법인주식및출자증권취득결정',analysis:{event_id:'equity_acquisition',event_label:'지분 취득·인수',stage:'의사결정',entity_strength:0}})),false);
});

test('canonical reporting targets and portfolio companies stay in scope', () => {
  const homeplus=item({corp_name:'홈플러스',flr_nm:'홈플러스',corp_cls:'E',report_nm:'주요사항보고서(차입결정)',analysis:{event_id:'financing_support',event_label:'담보·보증·차입',entity_strength:0}});
  const mbk=item({corp_name:'MBK파트너스',flr_nm:'MBK파트너스',corp_cls:'E',report_nm:'주요사항보고서(타법인주식취득결정)',analysis:{event_id:'equity_acquisition',event_label:'지분 취득·인수',entity_strength:2}});
  assert.equal(inReportingScope(homeplus),true);
  assert.equal(inReportingScope(mbk),true);
  assert.equal(shouldKeep(homeplus),true);
  assert.equal(shouldKeep(mbk),true);
});

test('story-engine house flag can keep a newly identified PEF or VC filer', () => {
  assert.equal(shouldKeep(item({corp_name:'신규PEF하우스',flr_nm:'신규PEF하우스',corp_cls:'E',pef_entity:true,analysis:{event_id:'mezzanine',entity_strength:2}})),true);
});

test('filters routine personal and simplified ownership reports', () => {
  assert.equal(shouldKeep(item({ corp_name:'홈플러스',flr_nm:'홈플러스',report_nm:'임원ㆍ주요주주특정증권등소유상황보고서', analysis:{event_id:'ownership_report',entity_strength:0} })), false);
  assert.equal(shouldKeep(item({ corp_name:'홈플러스',flr_nm:'홈플러스',report_nm:'주식등의대량보유상황보고서(약식)', analysis:{event_id:'ownership_report',entity_strength:0} })), false);
  assert.equal(shouldKeep(item({ corp_name:'홈플러스',flr_nm:'홈플러스',report_nm:'주식등의대량보유상황보고서(일반)', analysis:{event_id:'ownership_report',entity_strength:0} })), true);
  assert.equal(shouldKeep(item({ report_nm:'주식등의대량보유상황보고서(일반)', analysis:{event_id:'ownership_report',entity_strength:0} })), false);
});

test('routine maximum-shareholder ownership notice is follow-up, not a control-change signal', () => {
  const refined = refineEvent(item({ corp_name:'홈플러스',flr_nm:'홈플러스',report_nm:'최대주주등소유주식변동신고서', analysis:{event_id:'control_change',event_label:'경영권·최대주주 변동',entity_strength:0} }));
  assert.equal(refined.analysis.event_id,'ownership_report');
  const out=enrich(refined);
  assert.equal(out.tier,'followup');
  assert.equal(out.group_id,'equity');
});

test('related-party funding only stays when the company is in the reporting universe', () => {
  assert.equal(shouldKeep(item({corp_cls:'K',report_nm:'특수관계인으로부터자금차입',analysis:{event_id:'related_party_funding',entity_strength:0}})),false);
  assert.equal(shouldKeep(item({corp_name:'홈플러스',flr_nm:'홈플러스',corp_cls:'E',report_nm:'특수관계인으로부터자금차입',analysis:{event_id:'related_party_funding',entity_strength:0}})),true);
});

test('related-party capital participation is hidden unless a PEF or VC house itself files it', () => {
  assert.equal(shouldKeep(item({corp_name:'홈플러스',flr_nm:'홈플러스',corp_cls:'E',report_nm:'특수관계인의유상증자참여',analysis:{event_id:'capital_raise',entity_strength:0}})),false);
  assert.equal(shouldKeep(item({corp_name:'신규PEF하우스',flr_nm:'신규PEF하우스',corp_cls:'E',pef_entity:true,report_nm:'특수관계인의유상증자참여',analysis:{event_id:'capital_raise',entity_strength:2}})),true);
});

test('unrelated SPAC dissolution no longer enters the personal DART feed', () => {
  const out=enrich(item({corp_name:'신영제10호기업인수목적',report_nm:'주요사항보고서(해산사유발생)',analysis:{event_id:'merger_restructuring',entity_strength:0}}));
  assert.equal(shouldKeep(out),false);
  assert.equal(out.tier,'followup');
});

test('periodic filings stay only for directly identified PEF or VC houses', () => {
  assert.equal(shouldKeep(item({ report_nm:'분기보고서', analysis:{event_id:'periodic',entity_strength:0} })), false);
  assert.equal(shouldKeep(item({ corp_name:'홈플러스',flr_nm:'홈플러스',report_nm:'분기보고서', analysis:{event_id:'periodic',entity_strength:0} })), false);
  assert.equal(shouldKeep(item({ corp_name:'신규PEF하우스',flr_nm:'신규PEF하우스',pef_entity:true,report_nm:'분기보고서', analysis:{event_id:'periodic',entity_strength:2} })), true);
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
