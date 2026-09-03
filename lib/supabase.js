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

async function loadPreviousDisclosures(items, limit = 400) {
  if (!configured()) return [];
  const corpCodes = [...new Set((items || [])
    .map((item) => String(item.corp_code || ""))
    .filter((code) => /^\d{8}$/.test(code)))];
  if (!corpCodes.length) return [];

  const rows = [];
  const batchSize = 40;
  for (let index = 0; index < corpCodes.length; index += batchSize) {
    const batch = corpCodes.slice(index, index + batchSize);
    const select = "rcept_no,corp_code,corp_name,report_nm,receipt_date,dart_url,event_type,raw_data";
    const path = `disclosures?select=${select}&corp_code=in.(${batch.join(",")})&order=receipt_date.desc&limit=${Math.min(limit, 500)}`;
    const response = await request(path, { method: "GET", headers: headers() });
    rows.push(...(await response.json()));
  }
  return rows;
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

function toArticleCandidateRow(item) {
  const analysis = item.analysis || {};
  return {
    rcept_no: item.rcept_no,
    corp_code: item.corp_code || null,
    corp_name: item.corp_name || "",
    event_id: analysis.event_id || "general",
    event_type: analysis.event_label || "IB 관련 단서",
    deal_stage: analysis.stage || "신규 공시",
    story_score: Number(analysis.score || 0),
    story_bucket: analysis.bucket || "archive",
    headline: analysis.new_fact || null,
    change_summary: analysis.change_summary || null,
    why_story: analysis.why || null,
    key_numbers: analysis.key_numbers || [],
    call_targets: analysis.call_targets || [],
    reporter_questions: analysis.questions || [],
    article_angles: analysis.angles || [],
    score_breakdown: analysis.score_breakdown || {},
    evidence: {
      confidence: analysis.confidence || "DART 공시 확인",
      dart_url: item.url || null,
      previous_event: analysis.previous_event || null,
    },
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

    let candidateStorage = { ready: false, saved: 0 };
    const candidateRows = (items || [])
      .map(toArticleCandidateRow)
      .filter((row) => row.rcept_no && row.corp_name);
    if (candidateRows.length > 0) {
      try {
        await request("article_candidates?on_conflict=rcept_no", {
          method: "POST",
          headers: headers("resolution=merge-duplicates,return=minimal"),
          body: JSON.stringify(candidateRows),
        });
        candidateStorage = { ready: true, saved: candidateRows.length };
      } catch (_) {
        // 확장 스키마를 아직 실행하지 않아도 기존 disclosures 저장은 계속한다.
      }
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
      article_candidates: candidateStorage,
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

function relatedSourceRow(item, context = {}) {
  return {
    rcept_no: context.rceptNo || null,
    corp_code: context.corpCode || null,
    corp_name: context.corpName || "",
    category: item.category || "domestic",
    source_name: item.source_name || null,
    title: item.title || "",
    source_url: item.source_url || "",
    published_at: item.published_at || null,
    snippet: item.snippet || null,
    language: item.language || null,
    provider: item.provider || null,
    metadata: {
      filer_name: context.filerName || null,
      event_label: context.eventLabel || null,
    },
    last_seen_at: new Date().toISOString(),
  };
}

async function persistRelatedSources(items, context = {}) {
  if (!configured()) return { ready: false, saved: 0, code: "SUPABASE_NOT_CONFIGURED" };
  if (!context.rceptNo) return { ready: false, saved: 0, code: "RCEPT_NO_MISSING" };

  const rows = (items || [])
    .map((item) => relatedSourceRow(item, context))
    .filter((row) => row.rcept_no && row.corp_name && row.title && row.source_url);
  if (!rows.length) return { ready: true, saved: 0 };

  await request("related_sources?on_conflict=rcept_no,source_url", {
    method: "POST",
    headers: headers("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify(rows),
  });
  return { ready: true, saved: rows.length };
}

function reportingLeadRow(item) {
  return {
    signal_id: item.signal_id,
    collected_at: new Date().toISOString(),
    occurred_at: item.published_at || null,
    source_type: item.source_type || "other",
    source_name: item.source_name || null,
    title: item.title || "",
    source_url: item.source_url || "",
    target_id: item.target?.id || null,
    target_name: item.subject_name || item.target?.name || null,
    target_category: item.target?.category || null,
    event_type: item.event_type || "general",
    key_numbers: item.facts?.amounts || [],
    key_dates: item.facts?.dates || [],
    interpretation: item.interpretation || null,
    checkpoints: item.checkpoints || [],
    story_score: Number(item.story_score || 0),
    alert_grade: item.alert_grade || "P4",
    verification_status: "unverified",
    workflow_status: "new",
    dedupe_key: item.signal_id,
    raw_data: item,
    last_seen_at: new Date().toISOString(),
  };
}

async function persistReportingLeads(items) {
  if (!configured()) return { ready: false, saved: 0, code: "SUPABASE_NOT_CONFIGURED" };
  const rows = (items || []).map(reportingLeadRow)
    .filter((row) => row.signal_id && row.title && row.source_url);
  if (!rows.length) return { ready: true, saved: 0 };

  try {
    await request("reporting_leads?on_conflict=signal_id", {
      method: "POST",
      headers: headers("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify(rows),
    });
    return { ready: true, saved: rows.length };
  } catch (error) {
    return { ready: false, saved: 0, code: "REPORTING_LEADS_TABLE_MISSING", error: safeError(error) };
  }
}

async function loadRecentReportingLeads(days = 7) {
  if (!configured()) return [];
  const since = new Date(Date.now() - Math.min(Math.max(Number(days) || 7, 1), 30) * 24 * 3600 * 1000).toISOString();
  const select = "signal_id,occurred_at,source_type,source_name,title,source_url,target_id,target_name,target_category,event_type,key_numbers,key_dates,interpretation,checkpoints,story_score,alert_grade,raw_data";
  const path = `reporting_leads?select=${select}&occurred_at=gte.${encodeURIComponent(since)}&order=story_score.desc,occurred_at.desc&limit=300`;
  const response = await request(path, { method: "GET", headers: headers() });
  return (await response.json()).map((row) => ({
    ...(row.raw_data || {}),
    signal_id: row.signal_id,
    published_at: row.occurred_at,
    source_type: row.source_type,
    source_name: row.source_name,
    title: row.title,
    source_url: row.source_url,
    target: row.target_id ? { id: row.target_id, name: row.target_name, category: row.target_category, priority: "A" } : null,
    subject_name: row.target_id ? null : row.target_name,
    event_type: row.event_type,
    facts: { amounts: row.key_numbers || [], dates: row.key_dates || [] },
    interpretation: row.interpretation,
    checkpoints: row.checkpoints || [],
    story_score: row.story_score,
    alert_grade: row.alert_grade,
  }));
}

async function persistBriefing(briefing) {
  if (!configured()) return { ready: false, saved: 0, code: "SUPABASE_NOT_CONFIGURED" };
  const row = {
    briefing_type: briefing.briefing_type,
    period_start: briefing.period_start,
    period_end: briefing.period_end,
    title: briefing.title,
    summary: briefing.summary,
    lead_ids: briefing.items.map((item) => item.signal_id),
    content: { items: briefing.items, stats: briefing.stats },
  };
  try {
    await request("briefings?on_conflict=briefing_type,period_start,period_end", {
      method: "POST",
      headers: headers("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify(row),
    });
    return { ready: true, saved: 1 };
  } catch (error) {
    return { ready: false, saved: 0, code: "BRIEFINGS_TABLE_MISSING", error: safeError(error) };
  }
}

module.exports = {
  loadPreviousDisclosures,
  loadRecentReportingLeads,
  persistBriefing,
  persistDisclosures,
  persistReportingLeads,
  persistRelatedSources,
};
