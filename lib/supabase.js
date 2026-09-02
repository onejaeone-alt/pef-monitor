const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers(prefer = "") {
  const result = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
  };

  // 새 sb_secret 키는 apikey 헤더로 보낸다. 기존 JWT형 service_role 키도 호환한다.
  if (SUPABASE_KEY.startsWith("eyJ")) {
    result.Authorization = `Bearer ${SUPABASE_KEY}`;
  }
  if (prefer) result.Prefer = prefer;
  return result;
}

function receiptDate(value) {
  const text = String(value || "");
  if (!/^\d{8}$/.test(text)) return null;
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function importanceScore(level) {
  if (level === "핵심") return 5;
  if (level === "주시") return 3;
  return 1;
}

function safeError(error) {
  return String(error && (error.message || error) || "알 수 없는 저장 오류").slice(0, 500);
}

async function request(path, options = {}) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      signal: ctrl.signal,
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Supabase HTTP ${response.status}: ${body}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function toDisclosureRow(item) {
  return {
    rcept_no: item.rcept_no,
    corp_code: item.corp_code || null,
    corp_name: item.corp_name || "",
    report_nm: item.report_nm || "",
    filer_name: item.flr_nm || null,
    receipt_date: receiptDate(item.rcept_dt),
    dart_url: item.url || null,
    event_type: item.analysis?.event_label || "PEF·VC 관련 공시",
    importance: importanceScore(item.analysis?.importance),
    why_watch: item.analysis?.why || null,
    related_companies: item.connections || [],
    related_disclosures: item.related_disclosures || [],
    raw_data: item,
    last_updated_at: new Date().toISOString(),
  };
}

async function writeMonitorRun(run) {
  await request("monitor_runs", {
    method: "POST",
    headers: headers("return=minimal"),
    body: JSON.stringify(run),
  });
}

async function persistDisclosures(items, options = {}) {
  if (!configured()) {
    return {
      enabled: false,
      ok: false,
      code: "SUPABASE_NOT_CONFIGURED",
      saved: 0,
    };
  }

  const startedAt = new Date().toISOString();
  const rows = (items || [])
    .map(toDisclosureRow)
    .filter((row) => row.rcept_no && row.receipt_date && row.corp_name && row.report_nm);

  try {
    if (rows.length > 0) {
      await request("disclosures?on_conflict=rcept_no", {
        method: "POST",
        headers: headers("resolution=merge-duplicates,return=minimal"),
        body: JSON.stringify(rows),
      });
    }

    try {
      await writeMonitorRun({
        source: options.source || "dart-enriched",
        status: "success",
        fetched_count: Number(options.scanned || items?.length || 0),
        saved_count: rows.length,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
    } catch (_) {
      // 공시 저장 성공 여부와 실행 로그 저장 실패를 분리한다.
    }

    return {
      enabled: true,
      ok: true,
      saved: rows.length,
    };
  } catch (error) {
    const message = safeError(error);

    try {
      await writeMonitorRun({
        source: options.source || "dart-enriched",
        status: "failed",
        fetched_count: Number(options.scanned || items?.length || 0),
        saved_count: 0,
        error_message: message,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
    } catch (_) {
      // 원래 오류를 유지한다.
    }

    return {
      enabled: true,
      ok: false,
      saved: 0,
      error: message,
    };
  }
}

module.exports = {
  persistDisclosures,
};
