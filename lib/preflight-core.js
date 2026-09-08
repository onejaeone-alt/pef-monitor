'use strict';
// Public-source research only. A source match is not a confirmed causal claim.
const crypto = require('node:crypto');
const VERSION = 'preflight-1.0';
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = v => clean(v).toLowerCase().replace(/주식회사|\(주\)|㈜/g, '').replace(/[^a-z0-9가-힣]/g, '');
const hash = (...v) => crypto.createHash('sha256').update(v.join('|')).digest('hex').slice(0, 20);
const uniq = a => [...new Set(a.filter(Boolean))];
const SUPPORTED = new Set(['formation_gap', 'lp_rule_change', 'kvic_plan_change']);

function seedFromClue(c, snapshotDate) {
  if (!c?.clue_id || !SUPPORTED.has(c.detector)) return null;
  const formation = c.detector === 'formation_gap';
  const entities = (c.entities || []).map(clean).filter(Boolean);
  const title = clean(c.headline);
  const track = title.split('·').slice(1).join('·').replace(/(?:1차기한|결성기한|결성상태|출자규모|선정기준).*$/, '').trim();
  const year = (clean(c.previous_state).match(/20\d{2}/) || title.match(/20\d{2}/) || [])[0] || snapshotDate.slice(0, 4);
  const tokens = uniq((track.match(/NUP|스케일업|AI융합|딥테크|창업초기|소형|K-바이오|백신|국내|벤처펀드/gi) || []).map(clean));
  return {
    case_id: c.clue_id, title, playbook: formation ? 'formation' : 'lp_rules',
    gp: formation ? entities[0] || '' : '', lp: formation ? entities[1] || '' : entities[0] || '',
    year, track, tokens, fund_name: clean(c.fund_name || ''),
    canonical_as_of: snapshotDate,
    baseline: { previous: clean(c.previous_state), signal: clean(c.one_line_signal), unknowns: (c.unknowns || []).map(clean), hypothesis: clean(c.hypothesis), falsification: clean(c.falsification) },
    references: (c.sources || []).filter(s => s?.url).map(s => ({ url: s.url, label: clean(s.label), date: s.date || null })),
  };
}
function makeCatalog(clues, snapshotDate) {
  const seeds = (clues || []).map(c => seedFromClue(c, snapshotDate)).filter(Boolean);
  // Mirrors the existing discovery grouping ID, without copying its facts.
  const groups = new Map();
  const sorted = [...clues].sort((a, b) => String(b.sort_date || '').localeCompare(String(a.sort_date || '')) || String(a.headline || '').localeCompare(String(b.headline || ''), 'ko'));
  for (const c of sorted) {
    if (c.detector !== 'formation_gap' || !/기한 경과|지났/.test([c.detector_label, c.one_line_signal, c.changed_fact].join(' '))) continue;
    const selected = clean(c.previous_state).match(/20\d{2}-\d{2}-\d{2}/)?.[0] || c.sort_date || '';
    const lp = c.entities?.[1] || 'LP 미상', key = `${lp}|${selected}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const parents = seeds.map(s => ({ clue_id: s.case_id, title: s.title, cases: [s] }));
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    const gps = uniq(rows.map(c => c.entities?.[0]));
    const id = crypto.createHash('sha1').update(`formation_pattern|${key}|${gps.join('|')}`).digest('hex').slice(0, 20);
    parents.push({ clue_id: id, title: `${key.split('|')[0]} · 선정 GP별 결성 사전조사`, cases: rows.map(c => seeds.find(s => s.case_id === c.clue_id)).filter(Boolean) });
  }
  return parents;
}
function sourceKey(url) {
  try {
    const u = new URL(url); u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.toString();
  } catch (_) { return ''; }
}
function dateRole(seed, source) {
  const titleYear = String(source.title || '').match(/20\d{2}/)?.[0];
  const dateYear = String(source.published_at || '').match(/^20\d{2}/)?.[0];
  const y = titleYear || dateYear;
  if (y && Number(y) < Number(seed.year)) return 'past_reference';
  return y === seed.year ? 'same_year' : 'date_unresolved';
}
function matchCase(seed, source) {
  const text = norm(`${source.title || ''} ${source.text || source.snippet || ''}`);
  const actor = norm(seed.gp || seed.lp);
  if (!actor) return 'unrelated';
  if (!text.includes(actor)) {
    const strong = seed.tokens.filter(t => !/^(소형|국내|스케일업)$/i.test(t));
    if (source.kind === 'official' && norm(source.publisher).includes(norm(seed.lp)) && strong.length && strong.every(t => text.includes(norm(t)))) return dateRole(seed, source) === 'past_reference' ? 'past_reference' : 'program_only_candidate';
    return 'unrelated';
  }
  if (dateRole(seed, source) === 'past_reference') return 'past_reference';
  if (seed.fund_name && text.includes(norm(seed.fund_name))) return 'same_fund';
  const tokens = seed.tokens.filter(t => !/^(소형|국내|스케일업)$/i.test(t));
  if (tokens.length && tokens.every(t => text.includes(norm(t)))) return seed.playbook === 'lp_rules' ? 'same_program_candidate' : 'same_track_candidate';
  return 'same_actor_only';
}
function makeQueries(seed) {
  const who = clean(seed.gp || seed.lp).replace(/["\\]/g, '');
  const y = seed.year;
  if (seed.playbook === 'formation') return [
    { purpose: 'completion', query: `"${who}" ${y} (펀드 OR 조합) (결성 OR 클로징 OR 등록)` },
    { purpose: 'opposing_explanation', query: `"${who}" ${y} (결성기한 OR 연장 OR 철회 OR 미결성)` },
  ];
  return [
    { purpose: 'current_rule', query: `"${who}" ${y} 벤처펀드 (출자 OR 선정 OR 핵심운용인력)` },
    { purpose: 'previous_rule', query: `"${who}" ${Number(y) - 1} 벤처펀드 출자 선정` },
  ];
}
const TOPICS = [
  ['paid_in', '실제 납입액', /(?:실제\s*)?납입(?:액|금|규모|금액)|납입을\s*완료/],
  ['commitment', '실제 약정액', /(?:실제|총|최종)?\s*약정(?:액|금액|총액|규모)/],
  ['target_size', '결성 목표액', /(?:목표|예정)\s*(?:결성)?\s*(?:액|규모)|결성\s*목표/],
  ['policy_amount', '정책 출자액', /출자(?:규모|예산|예정액|금액|총액|액)/],
  ['key_person', '핵심인력·지원 조건', /핵심\s*운용\s*인력|핵심\s*운용역|겸업|지원\s*자격|공동\s*GP/i],
  ['deadline', '결성기한·연장 조건', /결성\s*기한|최종\s*선정\s*후|연장\s*(?:승인|조건|신청)/],
  ['selection', '선정 결과', /최종\s*(?:선정|선발)|선정(?:됐|되었|했다|된|된\s*운용)/],
];
function topicsFor(text) {
  const out = TOPICS.filter(([, , re]) => re.test(text)).map(([key, label]) => ({ key, label }));
  const complete = /결성(?:을)?\s*(?:완료|마쳤|마무리)|결성(?:했다|하였다|됐|되었)|결성\s*총회.{0,30}(?:개최|열었)|(?:등록|클로징).{0,12}(?:완료|마쳤)/.test(text);
  const negated = /미결성|미완료|완료되지|결성하지|결성되지|못했|못한|않았|아직/.test(text);
  const planned = /예정|계획|목표|추진|예상|전망|할\s*예정|한다면|경우/.test(text);
  if (complete && !negated && !planned) out.unshift({ key: 'completion_claim', label: '결성·등록 완료 언급' });
  else if (/결성|클로징|조합\s*등록/.test(text)) out.push({ key: 'formation_context', label: '결성 관련 설명' });
  if (/연장/.test(text)) out.push({ key: 'extension_claim', label: '기한 연장 언급' });
  return out;
}
function excerptEvidence(seed, source) {
  if (!source?.read_ok || !source.text || source.access !== 'body') return [];
  const match = matchCase(seed, source);
  if (match === 'unrelated') return [];
  const blocks = source.blocks || [{ location: '본문', text: source.text }];
  const candidates = [];
  for (const b of blocks) {
    const lines = b.text.split(/\n+/).map(clean).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      // Do not infer facts from an entire page or concatenate unrelated table cells.
      const text = lines[i];
      const topics = topicsFor(text);
      const mentionsGp = Boolean(seed.gp && norm(text).includes(norm(seed.gp)));
      const selectionRow = source.kind === 'official' && /선정\s*결과/.test(source.title || '') && mentionsGp;
      if (selectionRow) topics.unshift({ key:'selection', label:'선정자료 내 GP 명칭 포함 행' });
      if (seed.gp && !mentionsGp && match !== 'program_only_candidate') continue;
      if (!topics.length || text.length < (selectionRow ? 5 : 10) || text.length > 320) continue;
      if (/로그인|저작권|개인정보처리|구독신청/.test(text)) continue;
      const words = text.split(/\s+/);
      if (source.kind !== 'official' && words.length > 24) continue;
      candidates.push({ text, topics, selectionRow, location: `${b.location || '본문'} · 추출문단 ${i + 1}` });
    }
  }
  // One short exact excerpt per document; a snippet is never an original quote.
  const chosen = candidates.find(x => x.selectionRow) || candidates.find(x => x.topics.some(t => t.key === 'completion_claim')) || candidates.find(x => x.topics.some(t => t.key === 'deadline' || t.key === 'key_person')) || candidates[0];
  if (!chosen) return [];
  const factStatus = source.kind === 'official' ? '단서' : '보도';
  return [{
    evidence_id: hash(seed.case_id, sourceKey(source.url), chosen.location, chosen.text),
    source_id: source.source_id, case_id: seed.case_id, topics: chosen.topics,
    quote: chosen.text, location: chosen.location, fact_status: factStatus,
    verification: '자동 추출 · 원문 대조 전', case_match: match,
    scope_note: match === 'same_fund' ? '명칭 일치 · 실제 결성일·약정·납입은 별도 확인' : match === 'past_reference' ? '과거 비교자료 · 현재 상태의 근거 아님' : '동일 펀드·계정·출자사업인지 대조 필요',
  }];
}
function fieldRows(seed, evidence) {
  const defs = seed.playbook === 'formation'
    ? [['selection','선정'],['deadline','기한·연장'],['completion_claim','결성·등록'],['policy_amount','정책 출자액'],['target_size','결성 목표액'],['commitment','실제 약정액'],['paid_in','실제 납입액']]
    : [['policy_amount','출자규모'],['key_person','인력·지원 조건'],['deadline','결성기한'],['selection','선정 결과']];
  return defs.map(([key, label]) => {
    const found = evidence.filter(e => e.topics.some(t => t.key === key));
    return { field: key, label, evidence_ids: found.map(e => e.evidence_id), status: found.length ? '근거 후보 확보 · 검수 전' : '미확인', resolved: false };
  });
}
function nextQuestions(seed, evidence) {
  const find = key => evidence.filter(e => e.case_match !== 'past_reference' && e.topics.some(t => t.key === key));
  const complete = find('completion_claim'), extension = find('extension_claim');
  if (seed.playbook === 'formation') return [
    { target: seed.gp, question: complete.length ? '완료를 언급한 자료의 펀드가 이번 선정분과 같은 펀드인가? 정식 조합명·선정계정·결성총회일을 확인해달라.' : '이번 선정분의 정식 조합명과 현재 결성·등록 단계는 무엇인가? 결성총회일과 이를 확인할 자료가 있는가?', reason: complete.length ? '완료 언급을 찾았지만 동일 펀드 연결은 미확인' : '검색 부재만으로 미결성이라 판단할 수 없음', evidence_ids: complete.map(e => e.evidence_id) },
    { target: seed.lp, question: extension.length ? '확보한 연장 설명이 이 GP·계정에도 적용되는가? 승인일·변경 기한·적용 조건을 확인해달라.' : '적용 공고와 결성기한의 기산일은 무엇인가? 연장 승인·선정 철회가 있었는가?', reason: '기한·연장 조건은 같은 출자사업 원문으로 확인', evidence_ids: extension.map(e => e.evidence_id) },
    { target: seed.gp, question: '정책 출자액·결성 목표액·현재 약정액·실제 납입액을 기준일과 함께 각각 확인해달라.', reason: '서로 다른 금액을 결성액으로 합치지 않음', evidence_ids: [] },
  ];
  return [
    { target: seed.lp, question: '직전 연도와 이번 공고에서 바뀐 조항은 정확히 무엇인가? 원문·별첨·예외 규정의 적용 범위를 확인해달라.', reason: '검색 결과만으로 조항 변경을 확정하지 않음', evidence_ids: find('key_person').map(e => e.evidence_id) },
    { target: seed.lp, question: '변경된 조건으로 새롭게 지원할 수 있게 된 GP가 실제 있었는가? 지원·선정 결과로 확인할 수 있는가?', reason: '기준 변경과 선정 결과의 인과관계는 별도 취재', evidence_ids: [] },
  ];
}
function followupQueries(seed, evidence) {
  if (seed.playbook === 'formation') {
    const found = evidence.some(e => e.case_match !== 'past_reference' && e.topics.some(t => t.key === 'completion_claim'));
    return [{ purpose: found ? 'verify_completion_scope' : 'seek_disconfirming_completion', query: `"${seed.gp}" ${seed.tokens.slice(0, 2).join(' ')} ${seed.year} ${found ? '(조합명 OR 등록 OR 결성총회)' : '(결성완료 OR 최종클로징 OR 결성총회)'}` }];
  }
  return [{ purpose: 'exceptions_and_counterexamples', query: `"${seed.lp}" ${seed.year} 벤처펀드 (겸업 OR 예외 OR 변경공고 OR 질의응답)` }];
}
function buildCaseResult(seed, sources, extra = {}) {
  const relevant = sources.filter(s => matchCase(seed, s) !== 'unrelated');
  const evidence = relevant.flatMap(s => excerptEvidence(seed, s));
  const counter = evidence.filter(e => e.case_match !== 'past_reference' && e.topics.some(t => t.key === 'completion_claim' || t.key === 'extension_claim'));
  const baselineUrls = new Set(seed.references.map(r => sourceKey(r.url)));
  return {
    case_id: seed.case_id, title: seed.title, gp: seed.gp, lp: seed.lp, playbook: seed.playbook,
    baseline: seed.baseline, canonical_as_of: seed.canonical_as_of, evidence,
    new_evidence_ids: evidence.filter(e => !baselineUrls.has(sourceKey(sources.find(s => s.source_id === e.source_id)?.url))).map(e => e.evidence_id),
    counterevidence_ids: counter.map(e => e.evidence_id),
    revision: counter.length ? '완료·연장을 언급한 자료를 찾았습니다. 동일 펀드인지 대조하기 전까지 결성 지연을 단정하지 마세요.' : seed.playbook === 'formation' ? '공개자료만으로 실제 미결성 여부를 확정하지 못했습니다. 검색되지 않았다는 이유로 지연 가설을 강화하지 않습니다.' : evidence.length ? '조항과 관련된 근거 후보를 찾았습니다. 같은 계정의 현재·과거 조항인지 검수하기 전에는 조건 변경이나 수혜 GP를 확정하지 않습니다.' : '비교할 조항의 본문 근거를 확보하지 못했습니다. 조건 변경이나 수혜 GP를 확정하지 않습니다.',
    fields: fieldRows(seed, evidence), questions: nextQuestions(seed, evidence),
    coverage_source_ids: relevant.map(s => s.source_id), fund_candidates: extra.fund_candidates || [],
  };
}
function plainBrief(run) {
  const out = [`공개자료 사전조사 / ${run.run_id}`, `조사시각: ${run.finished_at}`, `정본 기준: ${run.canonical_as_of}`, '자동 추출 결과입니다. 기사의 사실확정·기사화 판단이 아닙니다.'];
  const refs = new Map(run.sources.map(s => [s.source_id, s]));
  for (const c of run.cases) {
    out.push('', c.title, c.revision);
    for (const e of c.evidence) { const s = refs.get(e.source_id); out.push(`[${e.fact_status}] ${e.quote}`, `근거: ${s?.title || ''} / ${e.location} / ${s?.url || ''}`, e.scope_note); }
    for (const q of c.questions) out.push(`질문 — ${q.target}: ${q.question}`);
  }
  out.push('', '조사 한계', ...(run.limitations || []));
  return out.join('\n');
}
module.exports = { VERSION, clean, norm, hash, sourceKey, seedFromClue, makeCatalog, matchCase, makeQueries, topicsFor, excerptEvidence, followupQueries, buildCaseResult, plainBrief };
