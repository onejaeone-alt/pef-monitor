const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildEntityDossier } = require("../lib/entity-dossier");
const { buildOntology } = require("../lib/ontology");
const { mergeCuratedGpKnowledge } = require("../lib/curated-gp-knowledge");
const {
  DRIVE_DOSSIERS,
  mergeDriveDossiers,
  searchDriveDossiers,
  selectFeaturedDossiers,
} = require("../lib/drive-dossiers");

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
  assert.equal(items.some((item) => item.canonical_name === "현대차증권"), true);
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
  assert.match(html, /취재에 쓰는 이유/);
  assert.match(html, /바로 물어볼 것/);
  assert.doesNotMatch(html, /최근 14일 직접 관계|<h3>직접 관계<\/h3>/);
});
