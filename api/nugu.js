const { getNuguMoneyProfile } = require("../lib/nugu-money");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");

  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "GET 요청만 지원합니다." });
  }

  const query = String(req.query?.q || "").trim();
  if (query.length < 2 || query.length > 120) {
    return res.status(400).json({ ok: false, error: "투자사 이름을 2~120자로 입력하세요." });
  }

  try {
    const item = await getNuguMoneyProfile(query, { reviewLimit: 3 });
    return res.status(200).json({ ok: true, item });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "누구머니 정보를 불러오지 못했습니다.",
    });
  }
};
