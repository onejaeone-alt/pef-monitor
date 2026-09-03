const test = require('node:test');
const assert = require('node:assert/strict');
const { groupNotices, attachFormation, buildGpStats, canonicalBusinessKey } = require('../lib/motae-monitor');

test('groups plan and selection into one mother-fund business', () => {
  const notices = [
    { notice_id:'1', title:'모태펀드(특허계정) 2026년 6월 수시 출자사업 계획 공고', stage:'plan', posted_date:'2026-06-01', business_year:2026, aggregate:{} },
    { notice_id:'2', title:'모태펀드(특허계정) 2026년 6월 수시 출자사업 선정 결과', stage:'selection', posted_date:'2026-08-27', business_year:2026, aggregate:{selected_funds:'2개',mother_commitment:'350억원'}, manager_candidates:['테스트인베스트먼트'] },
  ];
  const groups = groupNotices(notices);
  assert.equal(groups.length,1);
  assert.equal(groups[0].selected_count,2);
  assert.equal(groups[0].account,'특허계정');
});

test('normalizes changed notice and selection result to the same business key', () => {
  const plan = canonicalBusinessKey('[변경공고] 모태펀드(특허계정) 2026년 6월 수시 출자사업 계획 공고');
  const result = canonicalBusinessKey('모태펀드(특허계정) 2026년 6월 수시 출자사업 최종 선정 결과');
  assert.equal(plan,result);
});

test('marks formation as confirmed when a selected manager matches fund API', () => {
  const groups = [{ year:2026, selection:{}, selected_managers:['테스트인베스트먼트'], application_managers:[], document_managers:[], account:'특허계정', business_key:'x' }];
  const funds = [{ year:'2026', manager:'(주)테스트인베스트먼트', association_name:'테스트 벤처조합' }];
  const result = attachFormation(groups,funds);
  assert.equal(result[0].formation_status,'confirmed');
});

test('accepts next-year fund formation after selection', () => {
  const groups = [{ year:2025, selection:{}, selected_managers:['테스트인베스트먼트'], application_managers:[], document_managers:[], account:'특허계정', business_key:'x' }];
  const funds = [{ year:'2026', manager:'테스트인베스트먼트', association_name:'2026 테스트 벤처조합' }];
  const result = attachFormation(groups,funds);
  assert.equal(result[0].formation_status,'confirmed');
  assert.equal(result[0].manager_formation[0].match_timing,'next_year');
});

test('does not match a fund formed two years later', () => {
  const groups = [{ year:2024, selection:{}, selected_managers:['테스트인베스트먼트'], application_managers:[], document_managers:[], account:'특허계정', business_key:'x' }];
  const funds = [{ year:'2026', manager:'테스트인베스트먼트', association_name:'2026 테스트 벤처조합' }];
  const result = attachFormation(groups,funds);
  assert.equal(result[0].formation_status,'unconfirmed');
});

test('counts repeated GP selections', () => {
  const groups = attachFormation([
    { year:2026, selection:{}, selected_managers:['A인베스트먼트'], application_managers:[], document_managers:[], account:'특허', business_key:'a' },
    { year:2026, selection:{}, selected_managers:['A인베스트먼트'], application_managers:[], document_managers:[], account:'문화', business_key:'b' },
  ],[]);
  const stats = buildGpStats(groups);
  assert.equal(stats[0].selected,2);
});

test('shows fund API managers even when selection PDF pipeline is empty', () => {
  const stats = buildGpStats([], [
    { year:'2026', manager:'테스트벤처스', association_name:'테스트 1호 조합', field:'청년창업' },
    { year:'2026', manager:'테스트벤처스', association_name:'테스트 2호 조합', field:'딥테크' },
  ]);
  assert.equal(stats.length,1);
  assert.equal(stats[0].manager,'테스트벤처스');
  assert.equal(stats[0].fund_api_only,true);
  assert.equal(stats[0].formation_confirmed,2);
});
