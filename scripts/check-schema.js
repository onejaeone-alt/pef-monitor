const fs = require("node:fs");
const path = require("node:path");

const CONTRACT = {
  disclosures: ["rcept_no", "corp_code", "corp_name", "report_nm", "filer_name", "receipt_date", "dart_url", "event_type", "importance", "why_watch", "related_companies", "related_disclosures", "raw_data", "last_updated_at"],
  monitor_runs: ["source", "status", "fetched_count", "saved_count", "error_message", "started_at", "completed_at"],
  article_candidates: ["rcept_no", "corp_code", "corp_name", "event_id", "event_type", "deal_stage", "story_score", "story_bucket", "headline", "change_summary", "why_story", "key_numbers", "call_targets", "reporter_questions", "article_angles", "score_breakdown", "evidence", "last_updated_at"],
  reporting_leads: ["signal_id", "occurred_at", "source_type", "source_name", "title", "source_url", "target_id", "target_name", "target_category", "event_type", "key_numbers", "key_dates", "interpretation", "checkpoints", "story_score", "alert_grade", "verification_status", "story_candidate", "workflow_status", "related_company_ids", "related_person_ids", "related_fund_ids", "related_deal_ids", "dedupe_key", "raw_data", "first_seen_at", "last_seen_at"],
  entities: ["entity_key", "canonical_name", "entity_type", "dart_corp_code", "stock_code", "aliases", "watch_priority", "metadata", "updated_at"],
  source_documents: ["source_key", "source_type", "source_name", "title", "source_url", "published_at", "excerpt", "metadata"],
  deals: ["deal_key", "deal_name", "deal_type", "current_stage", "status", "target_entity_id", "estimated_value", "currency", "summary", "source_signal_id", "metadata", "updated_at"],
  entity_relations: ["relation_key", "from_entity_id", "to_entity_id", "relation_type", "deal_id", "basis", "confidence", "valid_from", "valid_to", "source_rcept_no", "source_signal_id", "metadata"],
  fact_claims: ["claim_key", "subject_entity_id", "deal_id", "predicate", "value", "source_document_id", "source_rcept_no", "source_signal_id", "verification_status", "valid_from", "valid_to"],
  deal_events: ["event_key", "deal_id", "source_signal_id", "rcept_no", "event_date", "event_type", "stage_before", "stage_after", "headline", "facts", "changes", "evidence", "confidence"],
};

const UNIQUE_INDEXES = [
  "entities_entity_key_uidx",
  "source_documents_source_key_uidx",
  "entity_relations_relation_key_uidx",
  "fact_claims_claim_key_uidx",
  "deal_events_event_key_uidx",
  "reporting_leads_dedupe_uidx",
];

function normalizeSql(sql) {
  return sql.replace(/--.*$/gm, " ").replace(/\s+/g, " ").toLowerCase();
}

function localErrors(sql) {
  const normalized = normalizeSql(sql);
  const errors = [];
  for (const [table, columns] of Object.entries(CONTRACT)) {
    const tablePattern = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\);`);
    const tableMatch = normalized.match(tablePattern);
    if (!tableMatch) {
      errors.push(`schema.sql에 ${table} 테이블 선언이 없습니다.`);
      continue;
    }
    for (const column of columns) {
      const type = "(?:text|uuid|date|timestamptz|smallint|integer|bigint|numeric|jsonb)";
      const inCreate = new RegExp(`\\b${column}\\s+${type}\\b`).test(tableMatch[1]);
      const inAlter = new RegExp(`alter table public\\.${table} add column if not exists ${column} ${type}\\b`).test(normalized);
      if (!inCreate && !inAlter) errors.push(`schema.sql에 ${table}.${column} 열 선언이 없습니다.`);
    }
  }
  for (const index of UNIQUE_INDEXES) {
    if (!normalized.includes(`unique index if not exists ${index}`)) {
      errors.push(`schema.sql에 ${index} 고유 인덱스 선언이 없습니다.`);
    }
  }
  return errors;
}

async function remoteErrors() {
  const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!baseUrl || !key) return { skipped: true, errors: [] };

  const requestHeaders = { apikey: key, Accept: "application/openapi+json" };
  if (key.startsWith("eyJ")) requestHeaders.Authorization = `Bearer ${key}`;

  let response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/`, { headers: requestHeaders });
  } catch (error) {
    return { skipped: false, errors: [`운영 DB 스키마를 읽지 못했습니다: ${error.name || "network error"}`] };
  }
  if (!response.ok) {
    return { skipped: false, errors: [`운영 DB 스키마 조회가 HTTP ${response.status}로 실패했습니다.`] };
  }

  const document = await response.json();
  const definitions = document.definitions || document.components?.schemas || {};
  const errors = [];
  for (const [table, columns] of Object.entries(CONTRACT)) {
    const properties = definitions[table]?.properties;
    if (!properties) {
      errors.push(`운영 DB에 ${table} 테이블이 없습니다.`);
      continue;
    }
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(properties, column)) {
        errors.push(`운영 DB에 ${table}.${column} 열이 없습니다.`);
      }
    }
  }
  return { skipped: false, errors };
}

async function main() {
  const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
  const errors = localErrors(fs.readFileSync(schemaPath, "utf8"));
  const remote = await remoteErrors();
  errors.push(...remote.errors);

  if (errors.length) {
    console.error("Supabase 스키마 검사 실패");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(remote.skipped
    ? "Supabase 스키마 선언 검사 통과 (운영 DB 설정이 없어 원격 검사는 생략)"
    : "Supabase 스키마 선언·운영 DB 검사 통과");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Supabase 스키마 검사 실패: ${error.name || "unknown error"}`);
    process.exitCode = 1;
  });
}

module.exports = { CONTRACT, UNIQUE_INDEXES, localErrors, normalizeSql };
