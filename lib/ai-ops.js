'use strict';
const { createHash, randomUUID } = require('node:crypto');
const digest = value => createHash('sha256').update(String(value)).digest('hex');
const count = value => Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
const ERROR_CODES = new Set(['model_quota_exhausted','model_rate_limited','model_key_invalid',
  'model_unavailable','model_key_unconfigured','model_paused','analysis_incomplete',
  'analysis_unavailable','invalid_analysis','invalid_topic','insufficient_evidence',
  'insufficient_sources','no_recent_source','research_busy']);
const safeCode = value => ERROR_CODES.has(value) ? value : 'unexpected_error';

function identity({ version, model, prompt, schema }) {
  return { pipeline_version: version, model, prompt_sha256: digest(prompt),
    schema_sha256: digest(JSON.stringify(schema)),
    commit: /^[a-f0-9]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA || '') ? process.env.VERCEL_GIT_COMMIT_SHA : null };
}

// Deliberate allowlist: no topics, document bodies, URLs, prompts, API keys or raw errors.
function emit(event, sink) {
  const record = { event: 'ib_radar_ai_ops', schema_version: 1, at: new Date().toISOString(),
    trace_id: event.trace_id, stage: event.stage, status: event.status,
    duration_ms: count(event.duration_ms), cache: event.cache || null,
    pipeline_version: event.identity.pipeline_version, model: event.identity.model,
    prompt_sha256: event.identity.prompt_sha256, schema_sha256: event.identity.schema_sha256,
    commit: event.identity.commit, error_code: event.error ? safeCode(event.error) : null,
    input_tokens: count(event.usage?.input_tokens), output_tokens: count(event.usage?.output_tokens),
    cached_input_tokens: count(event.usage?.input_tokens_details?.cached_tokens),
    sources_read: count(event.coverage?.read), sources_total: count(event.coverage?.total),
    search_failed: event.coverage ? Boolean(event.coverage.search_failed) : null,
    facts: count(event.analysis?.facts?.length), angles: count(event.analysis?.angles?.length) };
  try {
    if (sink) sink(record);
    else if (process.env.VERCEL || process.env.RADAR_OPS_LOG === '1') console.info(JSON.stringify(record));
  } catch { /* Monitoring must never break reporting. */ }
  return record;
}
module.exports = { identity, emit, newTrace: randomUUID };
