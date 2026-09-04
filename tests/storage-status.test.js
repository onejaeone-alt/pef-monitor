const test = require("node:test");
const assert = require("node:assert/strict");

function loadFreshSupabase() {
  delete require.cache[require.resolve("../lib/supabase")];
  return require("../lib/supabase");
}

test("저장 상태는 최근 실행과 최근 공시 시각만 돌려준다", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = global.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  global.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes("monitor_runs")
      ? [{ source: "dart-story-desk", status: "success", fetched_count: 169, saved_count: 8, completed_at: "2026-09-04T05:19:55.000Z" }]
      : [{ receipt_date: "2026-09-04", last_updated_at: "2026-09-04T05:19:55.000Z" }],
  });
  try {
    const result = await loadFreshSupabase().loadStorageStatus();
    assert.equal(result.configured, true);
    assert.equal(result.last_run.saved_count, 8);
    assert.equal(result.latest_disclosure.receipt_date, "2026-09-04");
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousKey;
    delete require.cache[require.resolve("../lib/supabase")];
  }
});
