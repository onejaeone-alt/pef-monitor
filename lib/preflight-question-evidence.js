'use strict';
// Read-only question/evidence view. No scores, canonical writes or factual promotion.
const crypto = require('node:crypto');
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = v => clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const ids = rows => [...new Set(rows.map(e => e.evidence_id))];
const has = (e, keys) => (e.topics || []).some(t => keys.includes(t.key));
const familyPatterns = [
  ['agri', /농림수산식품모태펀드|농식품모태펀드|농업정책보험금융원/],
  ['kvic', /한국벤처투자|(?:중기부|중소벤처기업부)\s*(?:소관|모태펀드)/],
  ['growth', /한국성장금융/],
  ['nps', /국민연금/],
];
function families(value) {
  const text = norm(value);
  return familyPatterns.filter(([, re]) => re.test(text)).map(([id]) => id);
}
function sourcePeriod(seed, source) {
  const titleYears = [...new Set((source.title || '').match(/20\d{2}/g) || [])];
  const explicit = source.program_year ? String(source.program_year) : titleYears.length === 1 ? titleYears[0] : null;
  const published = String(source.published_at || '').match(/^(20\d{2})/)?.[1];
  const year = explicit || (titleYears.length > 1 ? null : published);
  return year && seed.year ? Number(year) < Number(seed.year) ? 'past' : Number(year) > Number(seed.year) ? 'future' : 'current' : 'unknown';
}
function assessScope(seed, source, evidence) {
  const expected = families(seed.lp);
  // Only the quoted paragraph and its title establish scope; a different paragraph cannot donate an LP.
  const mentioned = families(`${source.title || ''} ${evidence.quote || ''}`);
  if (expected.length === 1 && mentioned.length === 1 && expected[0] !== mentioned[0]) {
    return { role: 'different_program', reason: '본문에 표시된 출자 주체·모태펀드 계열이 조사 대상과 다릅니다. 현재 펀드의 완료·연장 근거에서 제외했습니다.' };
  }
  if (source.program_id && seed.program_id && source.program_id !== seed.program_id) {
    return { role: 'different_program', reason: '출자사업 ID가 다릅니다. 같은 운용사의 다른 사업 자료로 분리했습니다.' };
  }
  const period = sourcePeriod(seed, source);
  if (period === 'past' || evidence.case_match === 'past_reference') return { role: 'past_reference', reason: '과거 비교자료입니다. 현재 선정분의 결성·약정·납입을 증명하지 않습니다.' };
  if (period === 'future') return { role: 'scope_unresolved', reason: '조사 대상보다 뒤의 연도 자료입니다. 같은 선정분인지 먼저 확인해야 합니다.' };
  if (mentioned.length > 1 || period === 'unknown') return { role: 'scope_unresolved', reason: '출자사업 또는 적용 연도를 하나로 특정하지 못했습니다.' };
  if (evidence.case_match === 'same_fund') return { role: 'current_candidate', reason: '정식 펀드명과 연도가 일치합니다. 원문 문맥과 개별 사실은 검수 전입니다.' };
  const strong = (seed.tokens || []).filter(t => !/^(소형|국내|스케일업|창업초기|벤처펀드)$/i.test(t));
  const text = norm(`${source.title || ''} ${evidence.quote || ''}`);
  const lpMatch = expected.length === 1 && mentioned.includes(expected[0]);
  const trackMatch = (seed.tokens || []).filter(t => !/^(소형|국내|스케일업|벤처펀드)$/i.test(t)).every(t => text.includes(norm(t)));
  if (['same_track_candidate', 'same_program_candidate', 'program_only_candidate'].includes(evidence.case_match) &&
      (lpMatch || strong.length > 0 && strong.every(t => text.includes(norm(t)))) && trackMatch) {
    return { role: 'current_candidate', reason: '연도·사업 분야가 대응하는 근거 후보입니다. 동일 펀드·계정 여부는 최종 대조가 필요합니다.' };
  }
  return { role: 'scope_unresolved', reason: '운용사 이름이나 일반 분야만 일치합니다. 같은 펀드의 사실로 사용하지 않습니다.' };
}
function extensionApproved(e) {
  return has(e, ['extension_claim']) && /연장.{0,20}(?:승인|허용|확정|됐|되었)|(?:승인|확정).{0,20}연장/.test(e.quote || '') &&
    !/신청|예정|검토|계획|미승인|불승인|승인되지|않았|거절|반려/.test(e.quote || '');
}
function applies(e) { return e.evidence_role === 'current_candidate'; }
function counterEligible(e) {
  return applies(e) && (has(e, ['completion_claim']) || extensionApproved(e));
}
function questions(seed, evidence, excluded) {
  const usable = keys => evidence.filter(e => e.evidence_role !== 'past_reference' && has(e, keys));
  const current = keys => usable(keys).filter(applies);
  const rows = [];
  function add(key, target, question, keys, contextKeys, missing) {
    const direct = current(keys), candidates = usable(keys).filter(e => !applies(e));
    const context = usable(contextKeys).filter(e => !direct.includes(e) && !candidates.includes(e));
    rows.push({ question_id: crypto.createHash('sha256').update(`${seed.case_id}|${key}`).digest('hex').slice(0,20),
      key, target, question, evidence_ids: ids(direct), context_evidence_ids: ids([...candidates, ...context]),
      excluded_evidence_ids: ids(excluded.filter(e => has(e, keys))), resolved: false,
      status: direct.length ? '근거 후보 있음 · 검수 전' : candidates.length ? '동일 대상인지 확인 필요' : '답할 근거 미확보',
      found: direct.length ? '해당 질문과 연결되는 본문을 찾았습니다. 아래 발췌와 출처를 대조하세요.' :
        candidates.length ? '관련 설명은 있지만 같은 펀드·계정의 자료인지 확인하지 못했습니다.' :
        context.length ? '배경 자료만 확보했습니다. 이 자료로 질문의 답을 대신하지 않습니다.' : '본문에서 답을 뒷받침할 근거를 확보하지 못했습니다.',
      still_needed: missing, reason: missing,
    });
  }
  if (seed.playbook === 'formation') {
    const completion = current(['completion_claim']);
    add('formation', seed.gp, completion.length ? '완료 발표의 펀드가 이번 선정분과 같은 펀드인가? 정식 조합명·선정계정·결성총회일과 등록일을 대조해달라.' :
      '이번 선정분의 정식 조합명과 현재 결성·등록 단계는 무엇인가? 결성총회일과 등록일을 각각 확인해달라.',
      ['completion_claim'], ['selection','formation_context'], '선정은 결성 완료가 아닙니다. 정식 조합명과 결성총회일·등록일을 각각 확인해야 합니다.');
    add('deadline', seed.lp, '적용 공고의 결성기한과 기산일은 무엇인가? 연장 승인이나 선정 철회가 있었는가?',
      ['deadline','extension_claim'], ['selection'], '원래 기한·기산일·연장 승인 여부와 변경 기한을 확인해야 합니다. 연장 신청은 승인이 아닙니다.');
    add('amounts', seed.gp, '정책 출자액·결성 목표액·현재 약정액·실제 납입액을 기준일과 함께 각각 확인해달라.',
      ['policy_amount','target_size','commitment','paid_in'], ['selection'], '목표액·약정액·납입액을 나눠 확인해야 합니다. 표의 숫자는 헤더·단위를 검수하기 전에는 금액 항목에 배정하지 않습니다.');
  } else {
    add('rules', seed.lp, '직전 공고와 이번 공고에서 바뀐 조항은 무엇인가? 같은 계정의 원문과 예외 규정을 대조해달라.',
      ['key_person','deadline','policy_amount'], ['selection'], '현재 조항과 직전 조항을 함께 확보하고 적용 계정·연도·예외 조건을 확인해야 합니다.');
    // Historical evidence belongs beside the comparison question, never in current-state fields.
    rows[0].context_evidence_ids = [...new Set([...rows[0].context_evidence_ids, ...ids(evidence.filter(e => e.evidence_role === 'past_reference' && has(e,['key_person','deadline','policy_amount'])))])];
    add('effect', seed.lp, '바뀐 조건이 개별 GP의 지원·선정에 실제로 영향을 줬는가? 지원·선정 결과와 당사자 설명으로 확인해달라.',
      [], ['selection','key_person'], '기준이 바뀌었다는 사실만으로 특정 GP가 수혜를 입었다고 단정할 수 없습니다. 영향과 반대 사례를 따로 확인해야 합니다.');
  }
  return rows;
}
function buildCaseResult(core, seed, sources, extra = {}) {
  const raw = core.buildCaseResult(seed, sources, extra);
  const byId = new Map(sources.map(s => [s.source_id, s]));
  const evidence = [], excluded = [];
  for (const e of raw.evidence || []) {
    const s = byId.get(e.source_id);
    if (!s?.read_ok || s.access !== 'body' || !clean(e.quote) || !clean(s.text).includes(clean(e.quote))) continue;
    const scope = assessScope(seed, s, e);
    const row = { ...e, fact_status: s.kind === 'official' ? '단서' : '보도', evidence_role: scope.role, scope_note: scope.reason };
    if (scope.role === 'different_program') excluded.push({ ...row, exclusion_reason: scope.reason });
    else evidence.push(row);
  }
  const counter = evidence.filter(counterEligible);
  const fields = (raw.fields || []).map(f => {
    const direct = evidence.filter(e => applies(e) && has(e, [f.field]));
    const contextual = evidence.filter(e => !applies(e) && e.evidence_role !== 'past_reference' && has(e,[f.field]));
    return { ...f, evidence_ids: ids(direct), context_evidence_ids: ids(contextual), resolved: false,
      status: direct.length ? '근거 후보 확보 · 검수 전' : contextual.length ? '대상 대조 필요' : '미확인' };
  });
  return { ...raw, question_evidence_version: 1, evidence, excluded_evidence: excluded, fields,
    new_evidence_ids: (raw.new_evidence_ids || []).filter(id => evidence.some(e=>e.evidence_id === id)),
    counterevidence_ids: ids(counter), questions: questions(seed, evidence, excluded),
    revision: seed.playbook === 'formation' ? counter.length ?
      '완료·연장에 관한 근거 후보를 찾았습니다. 같은 선정분인지와 원문 문맥을 검수하기 전에는 결성 상태를 확정하지 않습니다.' :
      excluded.length ? '다른 출자사업의 자료를 분리했습니다. 그 자료로 이번 펀드의 완료·지연 여부를 판단하지 않습니다.' :
      '공개자료만으로 이번 펀드의 결성·등록 상태를 확정하지 못했습니다. 검색 부재는 미결성의 증거가 아닙니다.' : raw.revision,
  };
}
function followupQueries(core, seed, evidence) {
  return core.followupQueries(seed, evidence.filter(e => counterEligible(e)));
}
module.exports = { assessScope, sourcePeriod, extensionApproved, counterEligible, buildCaseResult, followupQueries, questions };
