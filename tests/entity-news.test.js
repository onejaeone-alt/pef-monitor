const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEntityNewsQuery,
  fetchLatestEntityNews,
  matchesEntityNews,
} = require("../lib/entity-news");

const vig = {
  canonical_name: "VIG파트너스",
  aliases: ["VIG", "VIG Partners"],
  entity_type: "pef",
};

function rssItem(index, title, date, source = "한국경제") {
  return `<item><title><![CDATA[${title} - ${source}]]></title><link>https://news.google.com/rss/articles/${index}</link><pubDate>${date}</pubDate><description></description><source>${source}</source></item>`;
}

test("회사명과 별칭을 묶어 관련 최신뉴스 검색어를 만든다", () => {
  const query = buildEntityNewsQuery(vig);
  assert.match(query, /"VIG파트너스"/);
  assert.match(query, /"VIG"/);
  assert.match(query, / OR /);
});

test("제목이나 요약에 회사명 또는 별칭이 실제로 있어야 관련 뉴스로 본다", () => {
  assert.equal(matchesEntityNews({ title: "VIG파트너스, 새 블라인드펀드 결성" }, vig), true);
  assert.equal(matchesEntityNews({ title: "국내 사모펀드 신규 투자 확대" }, vig), false);
});

test("관련 최신뉴스를 날짜순으로 다섯 건만 남긴다", async () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    ${rssItem(1, "VIG파트너스 1호 투자", "Tue, 01 Sep 2026 00:00:00 GMT")}
    ${rssItem(2, "VIG파트너스 2호 투자", "Wed, 02 Sep 2026 00:00:00 GMT")}
    ${rssItem(3, "VIG파트너스 3호 투자", "Thu, 03 Sep 2026 00:00:00 GMT")}
    ${rssItem(4, "VIG파트너스 4호 투자", "Fri, 04 Sep 2026 00:00:00 GMT")}
    ${rssItem(5, "VIG파트너스 5호 투자", "Sat, 05 Sep 2026 00:00:00 GMT")}
    ${rssItem(6, "VIG파트너스 6호 투자", "Sun, 06 Sep 2026 00:00:00 GMT")}
    ${rssItem(7, "무관한 회사 투자", "Mon, 07 Sep 2026 00:00:00 GMT")}
  </channel></rss>`;
  const rows = await fetchLatestEntityNews(vig, {
    limit: 5,
    fetchImpl: async () => ({ ok: true, text: async () => xml }),
  });

  assert.equal(rows.length, 5);
  assert.equal(rows[0].title, "VIG파트너스 6호 투자");
  assert.equal(rows.some((item) => item.title === "무관한 회사 투자"), false);
});
