const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildEntityDossier } = require("../lib/entity-dossier");
const { buildOntology } = require("../lib/ontology");
const { mergeCuratedGpKnowledge } = require("../lib/curated-gp-knowledge");
const {
  DRIVE_DOSSIERS,
  matchDossiersInText,
  mergeDriveDossiers,
  searchDriveDossiers,
  selectFeaturedDossiers,
} = require("../lib/drive-dossiers");

test("뉴스 제목과 요약에서 취재파일 이름과 별칭을 찾는다", () => {
  const matches = matchDossiersInText("국민연금이 VIG파트너스의 새 펀드에 출자하는 방안을 검토한다.");
  assert.deepEqual(
    matches.map((item) => item.canonical_name).sort(),
    ["국민연금공단 기금운용본부", "VIG파트너스"].sort(),
  );
  assert.equal(matches.every((item) => item.entity_key && item.type_label), true);
});

test("여러 취재파일이 함께 쓰는 짧은 별칭은 잘못 붙이지 않는다", () => {
  const matches = matchDossiersInText("IMM인베스트먼트가 후속 투자에 참여했다.");
  assert.equal(matches.some((item) => item.canonical_name === "IMM인베스트먼트"), true);
  assert.equal(matches.some((item) => item.canonical_name === "IMM프라이빗에쿼티"), false);
});

test("드라이브 기업카드 100곳 이상을 전체 검색 대상으로 보존한다", () => {
  assert.equal(DRIVE_DOSSIERS.length >= 100, true);
  assert.equal(searchDriveDossiers("VIG")[0].canonical_name, "VIG파트너스");
  assert.equal(searchDriveDossiers("씨케이")[0].canonical_name, "씨케이디창업투자");
  assert.deepEqual(
    searchDriveDossiers("현대").map((item) => item.canonical_name).sort(),
    ["현대건설", "현대차그룹 ZER01NE", "현대차증권"].sort(),
  );
  assert.equal(searchDriveDossiers("특허계정").some((item) => item.canonical_name === "디티앤인베스트먼트"), true);
});

test("바로가기는 최근 14일 이슈가 있는 취재파일만 6개까지 고른다", () => {
  const items = selectFeaturedDossiers({}, { now: "2026-09-04T12:00:00+09:00", days: 14, limit: 6 });
  assert.equal(items.length, 6);
  assert.equal(items.every((item) => item.updated_at >= "2026-08-21"), true);
  assert.equal(items.some((item) => item.canonical_name === "VIG파트너스"), true);
  assert.equal(items.some((item) => item.canonical_name === "대성창업투자"), false);
});

test("오래된 카드라도 최근 관계가 생기면 바로가기에 올린다", () => {
  const daesung = DRIVE_DOSSIERS.find((item) => item.canonical_name === "대성창업투자");
  const graph = {
    edges: [{
      from_entity_key: daesung.entity_key,
      to_entity_key: "company:test",
      relation_label: "매각 추진",
      basis: "대성창업투자, 신규 매각 절차 착수",
      valid_from: "2026-09-03",
      metadata: { occurred_at: "2026-09-03T00:00:00Z" },
    }],
  };
  const items = selectFeaturedDossiers(graph, { now: "2026-09-04T12:00:00+09:00", days: 14, limit: 6 });
  const featured = items.find((item) => item.canonical_name === "대성창업투자");
  assert.equal(featured.status_text.includes("신규 매각 절차"), true);
  assert.equal(featured.updated_at, "2026-09-03");
});

test("드라이브 카드와 기존 선정 이력을 같은 취재파일에 합친다", () => {
  const graph = mergeDriveDossiers(mergeCuratedGpKnowledge(buildOntology([])));
  const ckd = graph.nodes.find((node) => node.canonical_name === "씨케이디창업투자");
  const dossier = buildEntityDossier(graph, ckd.entity_key);

  assert.equal(graph.dossier_count, DRIVE_DOSSIERS.length);
  assert.equal(dossier.current_status.some((item) => item.text.includes("2026년 8월 27일")), true);
  assert.equal(dossier.selection_history.length, 2);
  assert.equal(dossier.decision_boundary.includes("인과는 아직 확인되지 않았다"), true);
  assert.equal(dossier.evidence.some((item) => item.source_name === "선정 공지"), true);
});

test("취재파일 화면은 전체 검색과 같은 상세 서랍을 사용한다", () => {
  const html = fs.readFileSync(path.join(__dirname, "../relations.html"), "utf8");
  assert.match(html, /<title>IB 취재 레이더 · 취재파일<\/title>/);
  assert.match(html, /<h2>취재파일<\/h2>/);
  assert.doesNotMatch(html, /관계·취재파일|관계 취재파일/);
  assert.match(html, /id="dossierSearch"/);
  assert.equal(html.indexOf('id="dossierSearch"') < html.indexOf('class="stats"'), true);
  assert.match(html, /\/api\/entity\?action=search/);
  assert.match(html, /data-entity/);
  assert.match(html, /관련 뉴스/);
  assert.match(html, /최근 14일 안에 새 이슈가 확인된 대상만 표시합니다/);
  assert.doesNotMatch(html, /<h3>드라이브 연결<\/h3>/);
  assert.match(html, /기업이나 운용사 이름, 확인하려는 이슈를 입력하세요/);
  assert.doesNotMatch(html, /최근 14일 취재 단서/);
  assert.match(html, /<h3>기본 정보<\/h3>/);
  assert.match(html, /<h3>투자·운용<\/h3>/);
  assert.match(html, /<h3>운용 현황<\/h3>/);
  assert.match(html, /\['운용규모',p\.assets_under_management\]/);
  assert.match(html, /\['투자기업',p\.portfolio_count\]/);
  assert.match(html, /showEmpty:true/);
  assert.doesNotMatch(html, /<h3>현재 상태<\/h3>|<h3>판단 경계<\/h3>|<h3>먼저 물어볼 것<\/h3>/);
  assert.doesNotMatch(html, /<h3>관련 거래<\/h3>|<h3>다음 갱신 조건<\/h3>|바로 물어볼 것|취재에 쓰는 이유/);
  assert.doesNotMatch(html, /최근 14일 직접 관계|<h3>직접 관계<\/h3>/);
});

test("뉴스 화면은 매체 이름표 대신 취재파일 키워드와 상세 서랍을 사용한다", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /dossier-drawer\.css/);
  assert.match(html, /dossier-drawer\.js/);
  assert.match(html, /related_entities/);
  assert.match(html, /DossierDrawer\?\.chips/);
  assert.doesNotMatch(html, /<div class="source-chips">/);
  assert.doesNotMatch(html, /source_name\|\|'출처 미상'/);
});
