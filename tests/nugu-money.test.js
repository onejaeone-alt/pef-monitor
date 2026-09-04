const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findFirm,
  getNuguMoneyProfile,
  parseNuguPayload,
  resetNuguMoneyCache,
} = require("../lib/nugu-money");

const fixture = [
  {
    key: "마그나인베스트먼트",
    fundName: "마그나인베스트먼트",
    ratingAverage: 5.25,
    ratingTotal: 21,
    content: [
      { review: "첫 번째 후기", funding: false, rating: 1, reviewID: "내부 식별자" },
      { review: "투자를 받았습니다.", funding: "true", rating: "8" },
    ],
  },
  {
    key: "블루포인트파트너스",
    fundName: "블루포인트파트너스",
    ratingAverage: "6.2",
    ratingTotal: "10",
    content: [{ review: "  질문이 구체적이었습니다.  ", funding: true, rating: 7 }],
  },
];

test("누구머니 응답을 PEF Monitor 형식으로 정규화한다", () => {
  const items = parseNuguPayload(fixture);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    key: "마그나인베스트먼트",
    fund_name: "마그나인베스트먼트",
    rating_average: 5.25,
    rating_total: 21,
    reviews: [
      { review: "첫 번째 후기", funding: false, rating: 1 },
      { review: "투자를 받았습니다.", funding: true, rating: 8 },
    ],
  });
});

test("법인 표기와 투자사 유형 접미사가 달라도 하나만 일치하면 찾는다", () => {
  const items = parseNuguPayload(fixture);
  assert.equal(findFirm(items, "(주) 블루포인트파트너스").fund_name, "블루포인트파트너스");
  assert.equal(findFirm(items, "마그나").fund_name, "마그나인베스트먼트");
  assert.equal(findFirm(items, "블루포인트").fund_name, "블루포인트파트너스");
});

test("부분 문자열만 겹치는 투자사는 잘못 연결하지 않는다", () => {
  const items = parseNuguPayload(fixture);
  assert.equal(findFirm(items, "포인트"), null);
  assert.equal(findFirm(items, "마그"), null);
});

test("공개 프로필에는 후기 식별자를 제외하고 최대 세 건만 담는다", async () => {
  resetNuguMoneyCache();
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return ({
    ok: true,
    status: 200,
    json: async () => [{
      ...fixture[0],
      content: Array.from({ length: 6 }, (_, index) => ({
        review: `후기 ${index + 1}`,
        funding: index % 2 === 0,
        rating: index + 1,
        reviewID: `review-${index + 1}`,
      })),
    }],
    });
  };
  const profile = await getNuguMoneyProfile("마그나", { fetchImpl, force: true, reviewLimit: 3 });
  assert.equal(profile.found, true);
  assert.equal(profile.review_excerpts.length, 3);
  assert.equal("reviewID" in profile.review_excerpts[0], false);
  assert.equal(request.url, "https://nugu-backend.vercel.app/reviews");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.redirect, "follow");
  assert.equal(request.options.headers.Origin, "https://nugu.money");
  assert.equal(request.options.headers.Referer, "https://nugu.money/");
  assert.match(request.options.headers["User-Agent"], /^PEF-Monitor\//);
});
