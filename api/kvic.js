const {
  buildBusinessTypeUrl,
  buildFundUrl,
  parseBusinessTypePayload,
  parseFundPayload,
} = require("../lib/kvic");

const KVIC_KEY = process.env.KVIC_API_KEY || "";

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json,text/plain,*/*" },
    });
    if (!response.ok) throw new Error(`KVIC HTTP ${response.status}`);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error(`KVIC 응답을 JSON으로 해석하지 못했습니다: ${text.slice(0, 120)}`);
    }
  } catch (error) {
    if (error.name === "AbortError") throw new Error("KVIC 응답 지연(20초 초과)");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  try {
    if (!KVIC_KEY) {
      return res.status(503).json({ ok: false, error: "Vercel 환경변수 KVIC_API_KEY가 필요합니다." });
    }

    const mode = String(req.query.mode || "funds").toLowerCase();
    if (mode === "types") {
      const payload = await fetchJson(buildBusinessTypeUrl(KVIC_KEY, req.query));
      const parsed = parseBusinessTypePayload(payload);
      if (parsed.error) return res.status(502).json({ ok: false, error: parsed.error });
      return res.status(200).json({
        ok: true,
        mode: "types",
        items: parsed.items,
        count: parsed.items.length,
        fetched_at: new Date().toISOString(),
      });
    }

    const fundType = String(req.query.fundType || req.query.fund_type || "11").trim();
    const payload = await fetchJson(buildFundUrl(KVIC_KEY, req.query));
    const parsed = parseFundPayload(payload, fundType);
    if (parsed.error) return res.status(502).json({ ok: false, error: parsed.error });

    const items = parsed.items.sort((a, b) => {
      const yearDiff = Number(b.year || 0) - Number(a.year || 0);
      if (yearDiff) return yearDiff;
      return a.manager.localeCompare(b.manager, "ko");
    });

    return res.status(200).json({
      ok: true,
      mode: "funds",
      fund_type: fundType,
      filters: {
        year: req.query.year || req.query.y || null,
        field: req.query.fd || null,
        manager: req.query.mng || null,
        association_name: req.query.asn || null,
      },
      items,
      count: items.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
