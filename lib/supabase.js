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

async function loadStorageStatus() {
  if (!configured()) return { configured: false, last_run: null, latest_disclosure: null };
  const [runResponse, disclosureResponse] = await Promise.all([
    request("monitor_runs?select=source,status,fetched_count,saved_count,started_at,completed_at&source=eq.dart-story-desk&order=completed_at.desc&limit=1", { method: "GET", headers: headers() }),
    request("disclosures?select=receipt_date,last_updated_at&order=last_updated_at.desc&limit=1", { method: "GET", headers: headers() }),
  ]);
  const [runs, disclosures] = await Promise.all([runResponse.json(), disclosureResponse.json()]);
  return {
    configured: true,
    last_run: runs[0] || null,
    latest_disclosure: disclosures[0] || null,
  };
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

function safeSearchTerms(values) {
  const seen = new Set();
  return (values || []).map((value) => String(value || "")
    .replace(/[^0-9A-Za-z가-힣·&.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (value.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

async function searchDisclosures(terms, limit = 40) {
  if (!configured()) return [];
  const safeTerms = safeSearchTerms(terms);
  if (!safeTerms.length) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 5), 80);
  const select = "rcept_no,corp_code,corp_name,report_nm,filer_name,receipt_date,dart_url,event_type,raw_data";
  const queries = safeTerms.flatMap((term) => ["corp_name", "filer_name"].map((field) => {
    const pattern = encodeURIComponent(`*${term}*`);
    return request(`disclosures?select=${select}&${field}=ilike.${pattern}&order=receipt_date.desc&limit=${safeLimit}`, { method: "GET", headers: headers() });
  }));
  const settled = await Promise.allSettled(queries);
  const rows = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const values = (await Promise.all(rows.map((response) => response.json()))).flat();
  const seen = new Set();
  return values.filter((row) => {
    if (!row.rcept_no || seen.has(row.rcept_no)) return false;
    seen.add(row.rcept_no);
    return true;
  }).sort((a, b) => String(b.receipt_date || "").localeCompare(String(a.receipt_date || ""))).slice(0, safeLimit);
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

async function upsertReturning(table, conflict, rows) {
  if (!rows.length) return [];
  const response = await request(`${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: headers("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify(rows),
  });
  return response.json();
}

function postgrestList(values) {
  return (values || []).map((value) => `"${String(value).replace(/["\\]/g, "")}"`).join(",");
}

async function clearRebuiltOntology(graph) {
  const list = postgrestList((graph?.source_signal_ids || []).slice(0, 300));
  if (!list) return;
  const options = { method: "DELETE", headers: headers("return=minimal") };
  await Promise.all([
    request(`entity_relations?source_signal_id=in.(${list})`, options),
    request(`fact_claims?source_signal_id=in.(${list})`, options),
    request(`deal_events?source_signal_id=in.(${list})`, options),
  ]);
  await request(`deals?source_signal_id=in.(${list})`, options);
}

async function persistOntology(graph) {
  if (!configured()) return { ready: false, code: "SUPABASE_NOT_CONFIGURED", saved: {} };
  const source = graph || {};
  const entityRows = (source.nodes || []).map((node) => ({
    entity_key: node.entity_key,
    canonical_name: node.canonical_name,
    entity_type: node.entity_type,
    aliases: node.aliases || [],
    watch_priority: Number(node.watch_priority || 0),
    metadata: node.metadata || {},
    updated_at: new Date().toISOString(),
  })).filter((row) => row.entity_key && row.canonical_name);
  const documentRows = (source.documents || []).map((document) => ({
    source_key: document.source_key,
    source_type: document.source_type || "other",
    source_name: document.source_name || null,
    title: document.title,
    source_url: document.source_url || null,
    published_at: document.published_at || null,
    excerpt: document.excerpt || null,
    metadata: document.metadata || {},
  })).filter((row) => row.source_key && row.title);

  try {
    await clearRebuiltOntology(source);
    const [savedEntities, savedDocuments] = await Promise.all([
      upsertReturning("entities", "entity_key", entityRows),
      upsertReturning("source_documents", "source_key", documentRows),
    ]);
    const entityIds = new Map(savedEntities.map((row) => [row.entity_key, row.id]));
    const documentIds = new Map(savedDocuments.map((row) => [row.source_key, row.id]));

    const dealRows = (source.deals || []).map((deal) => ({
      deal_key: deal.deal_key,
      deal_name: deal.deal_name,
      deal_type: deal.deal_type || null,
      current_stage: deal.current_stage || null,
      status: deal.status || "watching",
      target_entity_id: entityIds.get(deal.target_entity_key) || null,
      estimated_value: deal.estimated_value || null,
      currency: deal.currency || "KRW",
      summary: deal.summary || null,
      metadata: deal.metadata || {},
      source_signal_id: deal.source_signal_id || deal.metadata?.source_signal_ids?.[0] || null,
      updated_at: new Date().toISOString(),
    })).filter((row) => row.deal_key && row.deal_name);
    const savedDeals = await upsertReturning("deals", "deal_key", dealRows);
    const dealIds = new Map(savedDeals.map((row) => [row.deal_key, row.id]));

    const relationRows = (source.edges || []).map((edge) => ({
      relation_key: edge.relation_key,
      from_entity_id: entityIds.get(edge.from_entity_key),
      to_entity_id: entityIds.get(edge.to_entity_key),
      relation_type: edge.relation_type,
      deal_id: dealIds.get(edge.deal_key) || null,
      basis: edge.basis || null,
      confidence: Number(edge.confidence || 3),
      valid_from: edge.valid_from || null,
      source_signal_id: edge.source_signal_id || null,
      source_rcept_no: edge.source_rcept_no || null,
      metadata: {
        ...(edge.metadata || {}),
        relation_label: edge.relation_label || edge.relation_type,
        from_entity_key: edge.from_entity_key,
        to_entity_key: edge.to_entity_key,
      },
    })).filter((row) => row.relation_key && row.from_entity_id && row.to_entity_id);

    const claimRows = (source.claims || []).map((claim) => ({
      claim_key: claim.claim_key,
      subject_entity_id: entityIds.get(claim.subject_entity_key) || null,
      deal_id: dealIds.get(claim.deal_key) || null,
      predicate: claim.predicate,
      value: claim.value || {},
      source_document_id: documentIds.get(claim.source_key) || null,
      source_signal_id: claim.source_signal_id || null,
      source_rcept_no: claim.source_rcept_no || null,
      verification_status: claim.verification_status || "unverified",
      valid_from: claim.valid_from || null,
    })).filter((row) => row.claim_key && row.predicate);

    const eventRows = (source.deal_events || []).map((event) => ({
      event_key: event.event_key,
      deal_id: dealIds.get(event.deal_key),
      source_signal_id: event.source_signal_id || null,
      rcept_no: event.source_rcept_no || null,
      event_date: event.event_date,
      event_type: event.event_type,
      headline: event.headline || null,
      facts: event.facts || [],
      evidence: event.evidence || [],
      confidence: Number(event.confidence || 3),
    })).filter((row) => row.event_key && row.deal_id && row.event_date && row.event_type);

    const [savedRelations, savedClaims, savedEvents] = await Promise.all([
      upsertReturning("entity_relations", "relation_key", relationRows),
      upsertReturning("fact_claims", "claim_key", claimRows),
      upsertReturning("deal_events", "event_key", eventRows),
    ]);

    return {
      ready: true,
      saved: {
        entities: savedEntities.length,
        sources: savedDocuments.length,
        deals: savedDeals.length,
        relations: savedRelations.length,
        facts: savedClaims.length,
        events: savedEvents.length,
      },
    };
  } catch (error) {
    return { ready: false, code: "ONTOLOGY_SCHEMA_MISSING", error: safeError(error), saved: {} };
  }
}

async function loadOntologyGraph(limit = 300) {
  if (!configured()) return null;
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 50), 800);
  const [entityResponse, relationResponse, dealResponse] = await Promise.all([
    request(`entities?select=id,entity_key,canonical_name,entity_type,aliases,watch_priority,metadata&entity_key=not.is.null&order=watch_priority.desc,updated_at.desc&limit=${safeLimit}`, { method: "GET", headers: headers() }),
    request(`entity_relations?select=relation_key,from_entity_id,to_entity_id,relation_type,deal_id,basis,confidence,valid_from,source_signal_id,metadata&relation_key=not.is.null&order=valid_from.desc.nullslast,created_at.desc&limit=${safeLimit}`, { method: "GET", headers: headers() }),
    request(`deals?select=id,deal_key,deal_name,deal_type,current_stage,status,target_entity_id,summary,metadata,source_signal_id&order=updated_at.desc&limit=${safeLimit}`, { method: "GET", headers: headers() }),
  ]);
  const [entities, relations, deals] = await Promise.all([
    entityResponse.json(),
    relationResponse.json(),
    dealResponse.json(),
  ]);
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const usedEntityIds = new Set([
    ...relations.flatMap((relation) => [relation.from_entity_id, relation.to_entity_id]),
    ...deals.map((deal) => deal.target_entity_id),
  ].filter(Boolean));
  const visibleEntities = entities.filter((entity) => usedEntityIds.has(entity.id));
  const nodes = visibleEntities.map((entity) => ({
    entity_key: entity.entity_key,
    canonical_name: entity.canonical_name,
    entity_type: entity.entity_type,
    aliases: entity.aliases || [],
    watch_priority: entity.watch_priority || 0,
    metadata: entity.metadata || {},
  }));
  const edges = relations.map((relation) => ({
    relation_key: relation.relation_key,
    from_entity_key: byId.get(relation.from_entity_id)?.entity_key || null,
    to_entity_key: byId.get(relation.to_entity_id)?.entity_key || null,
    relation_type: relation.relation_type,
    relation_label: relation.metadata?.relation_label || relation.relation_type,
    deal_key: deals.find((deal) => deal.id === relation.deal_id)?.deal_key || null,
    basis: relation.basis,
    confidence: relation.confidence,
    valid_from: relation.valid_from,
    source_signal_id: relation.source_signal_id,
    metadata: relation.metadata || {},
  })).filter((edge) => edge.from_entity_key && edge.to_entity_key);
  const normalizedDeals = deals.map((deal) => ({
    deal_key: deal.deal_key,
    deal_name: deal.deal_name,
    deal_type: deal.deal_type,
    current_stage: deal.current_stage,
    status: deal.status,
    target_entity_key: byId.get(deal.target_entity_id)?.entity_key || null,
    summary: deal.summary,
    metadata: deal.metadata || {},
    source_signal_id: deal.source_signal_id || null,
  }));
  return {
    nodes,
    edges,
    deals: normalizedDeals,
    stats: {
      entities: nodes.length,
      companies: nodes.filter((node) => node.entity_type === "company").length,
      houses: nodes.filter((node) => ["pef", "vc", "ac"].includes(node.entity_type)).length,
      funds: nodes.filter((node) => node.entity_type === "fund").length,
      people: nodes.filter((node) => node.entity_type === "person").length,
      deals: normalizedDeals.length,
      relations: edges.length,
    },
  };
}

module.exports = {
  loadOntologyGraph,
  loadPreviousDisclosures,
  loadRecentReportingLeads,
  loadStorageStatus,
  searchDisclosures,
  persistBriefing,
  persistDisclosures,
  persistOntology,
  persistReportingLeads,
  persistRelatedSources,
};
