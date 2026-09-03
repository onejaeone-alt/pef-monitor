const test = require("node:test");
const assert = require("node:assert/strict");
const {
  businessKey,
  extractAggregate,
  managerCandidates,
  parseDetailPage,
  parseListPage,
  stageFromTitle,
} = require("../lib/kvic-notices");

test("KVIC 목록에서 단계와 게시물 ID를 뽑는다", () => {
  const html = `
    <table><tbody>
      <tr><td>1103</td><td>[선정결과]</td><td><a href="/notice/kvic-notice/investment-business-notice?id=5078">모태펀드(특허계정) 2026년 6월 수시 출자사업 선정 결과</a></td><td>2026-08-27</td></tr>
      <tr><td>1102</td><td>[서류결과]</td><td><a href="/notice/kvic-notice/investment-business-notice?id=5077">모태펀드(특허계정) 2026년 6월 수시 출자사업 서류심사 결과</a></td><td>2026-08-07</td></tr>
    </tbody></table>`;
  const result = parseListPage(html);
  assert.equal(result.notices.length, 2);
  assert.equal(result.notices[0].notice_id, "5078");
  assert.equal(result.notices[0].stage, "selection");
  assert.equal(result.notices[1].stage, "document_review");
});

test("KVIC 상세 본문의 핵심 숫자를 뽑는다", () => {
  const html = `<main>선정 조합 수 : 3개 모태출자액 : 350억원 최소결성규모 : 1,038억원</main>`;
  const detail = parseDetailPage(html, { notice_id: "5052", title: "모태펀드(중기부 소관) 2026년 5월 수시 출자사업 선정 결과" });
  assert.equal(detail.aggregate.selected_funds, "3개");
  assert.equal(detail.aggregate.mother_commitment, "350억원");
  assert.equal(detail.aggregate.planned_formation, "1,038억원");
});

test("같은 출자사업의 단계 제목을 공통 키로 정리한다", () => {
  const selection = businessKey("모태펀드(특허계정) 2026년 6월 수시 출자사업 선정 결과");
  const document = businessKey("모태펀드(특허계정) 2026년 6월 수시 출자사업 서류심사 결과");
  assert.equal(selection, document);
});

test("PDF 텍스트에서 GP 후보 이름을 보수적으로 뽑는다", () => {
  const text = `운용사명\n알파인베스트먼트\n베타벤처스\n한국벤처투자 출자사업 선정결과\n감마파트너스`;
  assert.deepEqual(managerCandidates(text), ["알파인베스트먼트", "베타벤처스", "감마파트너스"]);
});

test("제목만으로 출자사업 단계를 분류한다", () => {
  assert.equal(stageFromTitle("2026년 1차 정시 출자사업 계획 공고"), "plan");
  assert.equal(stageFromTitle("2026년 1차 정시 출자사업 접수 현황"), "application");
  assert.equal(stageFromTitle("2026년 1차 정시 출자사업 최종 선정결과"), "selection");
  assert.equal(extractAggregate("통과 조합수 4개 결성 예정액 872.6억 원 출자 요청액 400억 원").passed_funds, "4개");
});
