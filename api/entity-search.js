const { searchDriveDossiers } = require("../lib/drive-dossiers");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
  const query = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 20);
  if (!query) return res.status(200).json({ ok: true, query, total: 0, items: [] });
  if (query.length > 80) return res.status(400).json({ ok: false, error: "검색어를 80자 이내로 입력해주세요." });

  const items = searchDriveDossiers(query, limit);
  return res.status(200).json({ ok: true, query, total: items.length, items });
};
