const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSearchQueries,
  dedupe,
  isPressReleaseItem,
  matchesContext,
  parseGdeltArticles,
  parseGoogleNewsRss,
} = require("../lib/context-sources");

test("Google News RSS에서 제목·출처·날짜를 추출한다", () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title><![CDATA[MBK의 새 인수 검토 - 한국경제]]></title>
    <link>https://news.google.com/rss/articles/abc</link>
    <pubDate>Wed, 02 Sep 2026 08:00:00 GMT</pubDate>
    <description><![CDATA[&lt;a href="https://example.com"&gt;MBK가 신규 인수를 검토하고 있다.&lt;/a&gt;]]></description>
    <source url="https://hankyung.com">한국경제</source>
  </item></channel></rss>`;
  const rows = parseGoogleNewsRss(xml, "domestic", "ko");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "MBK의 새 인수 검토");
  assert.equal(rows[0].source_name, "한국경제");
  assert.equal(rows[0].category, "domestic");
  assert.equal(rows[0].published_at, "2026-09-02T08:00:00.000Z");
  assert.equal(rows[0].snippet, "MBK가 신규 인수를 검토하고 있다.");
});

test("GDELT 기사를 국내·외신·보도자료로 나눈다", () => {
  const rows = parseGdeltArticles([
    { title: "국내 기사", url: "https://example.kr/a", domain: "example.kr", language: "Korean", seendate: "20260902T010000Z" },
    { title: "Global deal", url: "https://reuters.com/b", domain: "reuters.com", language: "English", seendate: "20260902T020000Z" },
    { title: "Company announces deal", url: "https://prnewswire.com/c", domain: "prnewswire.com", language: "English", seendate: "20260902T030000Z" },
  ]);
  assert.deepEqual(rows.map((row) => row.category), ["domestic", "foreign", "press_release"]);
});

test("검색어에 회사·제출자·사건을 함께 넣는다", () => {
  const queries = buildSearchQueries({ corpName: "홈플러스", filerName: "MBK파트너스", eventLabel: "회생·법적 위험" });
  assert.match(queries.domestic, /홈플러스/);
  assert.match(queries.foreign, /MBK파트너스/);
  assert.match(queries.pressRelease, /press release/);
});

test("같은 URL과 사실상 같은 제목은 한 번만 남긴다", () => {
  const rows = dedupe([
    { title: "같은 기사", source_url: "https://a.com/1?utm=one" },
    { title: "같은 기사", source_url: "https://a.com/1?utm=two" },
    { title: "다른 기사", source_url: "https://b.com/2" },
  ]);
  assert.equal(rows.length, 2);
});

test("회사명이나 제출자가 실제로 언급된 자료만 남긴다", () => {
  const context = { corpName: "가비아", filerName: "디씨케이인베스트먼트" };
  assert.equal(matchesContext({ title: "가비아 공개매수 추진", snippet: "" }, context), true);
  assert.equal(matchesContext({ title: "다른 회사 신제품 출시", snippet: "" }, context), false);
});

test("일반 언론 기사는 보도자료로 분류하지 않는다", () => {
  assert.equal(isPressReleaseItem({
    provider: "google_news_rss",
    category: "press_release",
    source_name: "한국경제",
    title: "지에프아이, 공급 계약 체결",
  }), false);
  assert.equal(isPressReleaseItem({
    provider: "google_news_rss",
    category: "press_release",
    source_name: "대한민국 정책브리핑",
    title: "금융위원회 보도자료",
  }), true);
});
