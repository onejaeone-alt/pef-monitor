const { loadStorageStatus } = require("../lib/supabase");

module.exports = async (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  try {
    const storage = await loadStorageStatus();
    return res.status(200).json({ ok: true, storage, checked_at: new Date().toISOString() });
  } catch (_) {
    return res.status(500).json({ ok: false, error: "저장 상태를 확인하지 못했습니다." });
  }
};
