const { collectSources } = require("../lib/context-sources");
const { buildContextInsight } = require("../lib/context-insight");
const { persistRelatedSources } = require("../lib/supabase");

function clean(value, maxLength = 160) {
  return String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

module.exports = async (req, res) => {
  // Public-source preflight shares this function; private notes and arbitrary URLs are not accepted.
  if (["preflight", "preflight-catalog"].includes(String(req.query?.mode || ""))) {
    try { return await require("../lib/preflight-api").handlePreflight(req, res); }
    catch (_) { res.setHeader("Cache-Control", "no-store"); return res.status(500).json({ ok: false, error: "공개자료 사전조사를 시작하지 못했습니다. 기존 취재자료는 변경하지 않았습니다." }); }
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");

  try {
    const context = {
      rceptNo: clean(req.query.rcept_no, 14),
      corpCode: clean(req.query.corp_code, 8),
      corpName: clean(req.query.corp_name, 80),
      filerName: clean(req.query.filer_name, 100),
      eventLabel: clean(req.query.event, 80),
      stage: clean(req.query.stage, 60),
      reportName: clean(req.query.report_name, 160),
    };
    if (!context.corpName || context.corpName.length < 2) {
      return res.status(400).json({ ok: false, error: "회사명이 필요합니다." });
    }
    if (context.rceptNo && !/^\d{14}$/.test(context.rceptNo)) context.rceptNo = "";
    if (context.corpCode && !/^\d{8}$/.test(context.corpCode)) context.corpCode = "";

    const sources = await collectSources(context);
    const insight = buildContextInsight(context, sources);
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
      insight,
      providers: sources.providers,
      storage,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
