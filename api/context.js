const { collectSources } = require("../lib/context-sources");
const { persistRelatedSources } = require("../lib/supabase");

function clean(value, maxLength = 160) {
  return String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");

  try {
    const context = {
      rceptNo: clean(req.query.rcept_no, 14),
      corpCode: clean(req.query.corp_code, 8),
      corpName: clean(req.query.corp_name, 80),
      filerName: clean(req.query.filer_name, 100),
      eventLabel: clean(req.query.event, 80),
    };
    if (!context.corpName || context.corpName.length < 2) {
      return res.status(400).json({ ok: false, error: "회사명이 필요합니다." });
    }
    if (context.rceptNo && !/^\d{14}$/.test(context.rceptNo)) context.rceptNo = "";
    if (context.corpCode && !/^\d{8}$/.test(context.corpCode)) context.corpCode = "";

    const sources = await collectSources(context);
    const flat = [...sources.domestic, ...sources.foreign, ...sources.press_release];
    const storage = await persistRelatedSources(flat, context).catch((error) => ({
      ready: false,
      saved: 0,
      error: String(error.message || error).slice(0, 300),
    }));

    return res.status(200).json({
      ok: true,
      corp_name: context.corpName,
      rcept_no: context.rceptNo || null,
      domestic: sources.domestic,
      foreign: sources.foreign,
      press_release: sources.press_release,
      providers: sources.providers,
      storage,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
