const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/daily-refresh");

test("CRON_SECRET이 없거나 다르면 실행을 거부한다", () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  assert.equal(handler.authorized({ headers: {} }), false);
  process.env.CRON_SECRET = "test-secret";
  assert.equal(handler.authorized({ headers: { authorization: "Bearer wrong" } }), false);
  assert.equal(handler.authorized({ headers: { authorization: "Bearer test-secret" } }), true);
  if (previous === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous;
});

test("하위 수집 결과에서 저장 건수만 추려 낸다", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, scanned: 169, storage: { saved: 8 }, fetched_at: "2026-09-04T00:00:00.000Z" }),
  });
  try {
    const result = await handler.runJob("https://example.com", { name: "dart", path: "/api/enriched?days=1" });
    assert.deepEqual(result, {
      name: "dart",
      ok: true,
      scanned: 169,
      saved: 8,
      fetched_at: "2026-09-04T00:00:00.000Z",
    });
  } finally {
    global.fetch = previousFetch;
  }
});
