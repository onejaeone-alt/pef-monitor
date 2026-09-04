const DAILY_JOBS = [
  { name: "dart", path: "/api/enriched?days=1" },
  { name: "kvic", path: "/api/kvic-backfill?pages=2&pdf=all" },
];

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

async function runJob(origin, job) {
  const response = await fetch(`${origin}${job.path}`, {
    headers: { "User-Agent": "PEF-Monitor-Daily-Refresh/1.0" },
    signal: AbortSignal.timeout(55000),
  });
  const body = await response.json();
  if (!response.ok || body.ok === false) {
    throw new Error(`${job.name} ${response.status}: ${body.error || "실행 실패"}`);
  }
  return {
    name: job.name,
    ok: true,
    scanned: body.scanned ?? body.candidates ?? 0,
    saved: body.storage?.saved ?? 0,
    fetched_at: body.fetched_at || null,
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!authorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return res.status(400).json({ ok: false, error: "Host header missing" });
  const origin = `https://${host}`;
  const settled = await Promise.allSettled(DAILY_JOBS.map((job) => runJob(origin, job)));
  const jobs = settled.map((result, index) => result.status === "fulfilled"
    ? result.value
    : { name: DAILY_JOBS[index].name, ok: false, error: String(result.reason?.message || result.reason) });
  const ok = jobs.every((job) => job.ok);
  return res.status(ok ? 200 : 502).json({ ok, jobs, completed_at: new Date().toISOString() });
};

module.exports.authorized = authorized;
module.exports.runJob = runJob;
