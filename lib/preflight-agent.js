'use strict';
const C = require('./preflight-core');
const S = require('./preflight-sources');
async function mapLimit(values, n, fn) {
  const out = new Array(values.length); let index = 0;
  await Promise.all(Array.from({ length: Math.min(n, values.length) }, async () => {
    while (index < values.length) { const i = index++; out[i] = await fn(values[i], i); }
  }));
  return out;
}
function dedupeSources(rows) {
  const m = new Map();
  for (const r of rows) {
    const url = C.sourceKey(r.url || r.source_url); if (!url) continue;
    if (!m.has(url) || r.read_ok) m.set(url, { ...r, url });
  }
  return [...m.values()];
}
function candidateMatches(r, seeds) {
  const title = C.norm(`${r.title || ''} ${r.snippet || ''}`);
  return seeds.some(s => title.includes(C.norm(s.gp || s.lp)) && (s.playbook === 'lp_rules' ? /벤처/.test(r.title || '') : (/펀드|조합|결성|클로징|출자|선정|운용인력/.test(r.title || '') || s.tokens.filter(t=>!/^(소형|국내|스케일업)$/i.test(t)).some(t=>title.includes(C.norm(t))))));
}
async function runResearch(parent, options = {}) {
  const started = new Date().toISOString(), deadline = Date.now() + (options.budgetMs || 47000);
  const seeds = parent.cases.slice(0,3), logs = [], steps = [], limitations = [];
  if (parent.cases.length > seeds.length) limitations.push(`이 묶음에는 ${parent.cases.length}개 대상이 있으며 이번 실행은 앞의 ${seeds.length}개만 조사했습니다.`);
  const search = options.search || S.search, readDocument = options.readDocument || S.readDocument;
  const loadHistory = options.loadHistory || (() => require('./clue-data').loadReportingLeadHistory(730,900));
  const loadFunds = options.loadFunds || (() => require('./clue-data').fetchKvicFunds());
  const initialQueries = seeds.flatMap(seed => C.makeQueries(seed).map(q => ({ ...q, case_id: seed.case_id })));
  steps.push({ step: 'scope', status: 'done', detail: `${seeds.length}개 조사대상으로 분리. 정본 기록은 출발 단서로만 사용.` });
  const [historical, fundResult, initialSearch] = await Promise.all([
    loadHistory().then(rows => ({ ok:true, rows })).catch(() => ({ ok:false, rows:[] })),
    loadFunds().catch(() => ({ ready:false, items:[] })),
    mapLimit(initialQueries, 3, q => search(q.query, q.purpose, deadline).then(r => ({ ...r, case_id:q.case_id })).catch(() => ({ records:[], case_id:q.case_id, log:[{ query:q.query, purpose:q.purpose, status:'failed', count:0 }] }))),
  ]);
  for (const x of initialSearch) logs.push(...x.log.map(l => ({ ...l, case_id:x.case_id })));
  steps.push({ step:'search', status: logs.some(l => l.status === 'ok') ? 'done' : 'partial', detail:'완료·연장·철회 또는 직전 연도 조건을 각각 검색' });
  if (!historical.ok) limitations.push('기존 공개 원문 색인을 읽지 못했습니다. 이를 관련 기록 부재로 해석하지 않습니다.');
  if (!fundResult.ready) limitations.push('한국벤처투자 공개 펀드목록을 조회하지 못했습니다. 미등재·미결성 여부는 판단하지 않습니다.');
  const refs = seeds.flatMap(s => s.references).filter(r => S.publicKind(r.url) === 'official').map(r => ({ ...r, title:r.label, found_by:'canonical_reference' }));
  const history = S.historyRecords(historical.rows, seeds);
  const searched = initialSearch.flatMap(x => x.records).filter(r => candidateMatches(r,seeds));
  const gathered = dedupeSources([...refs, ...history, ...searched]);
  // Read original URLs first, not search-result pages. Keep non-readable results visible.
  const originals = gathered.filter(r => ['official','media'].includes(S.publicKind(r.url))).slice(0,8);
  const metadataOnly = gathered.filter(r => !originals.includes(r)).slice(0,20).map(r => ({ ...S.metaSource(r), access:S.publicKind(r.url) === 'search' ? 'headline_only' : 'link_only', read_error:'ORIGINAL_NOT_READ' }));
  let sources = [...await mapLimit(originals,4,r => readDocument(r,deadline)), ...metadataOnly];
  steps.push({ step:'read', status:sources.some(s => s.read_ok) ? 'done' : 'partial', detail:`본문 열람 ${sources.filter(s => s.read_ok).length}건. 나머지는 제목·링크 또는 접근 실패로 구분.` });
  const attachments = dedupeSources(sources.filter(s => s.kind === 'official' && s.read_ok).flatMap(s => (s.links || []).map(l => ({ ...l, title:`${s.title} / ${l.title}`, found_by:'official_attachment' }))))
    .filter(s => !sources.some(old => C.sourceKey(old.url) === C.sourceKey(s.url)))
    .filter(s => /\.pdf(?:$|[?#\s])|\.hwpx?(?:$|[?#\s])/i.test(s.title + ' ' + s.url))
    .sort((a,b) => Number(/선정\s*결과/.test(b.title))-Number(/선정\s*결과/.test(a.title))).slice(0,2);
  if (Date.now() < deadline - 2000 && attachments.length) sources.push(...await mapLimit(attachments,2,r => readDocument(r,deadline)));
  const preliminary = seeds.map(seed => C.buildCaseResult(seed,sources));
  const followups = seeds.flatMap((s,i) => C.followupQueries(s,preliminary[i].evidence).map(q => ({ ...q, case_id:s.case_id })));
  let followed = [];
  if (Date.now() < deadline - 2500) {
    followed = await mapLimit(followups,3,q => search(q.query,q.purpose,deadline).then(r => ({ ...r,case_id:q.case_id })).catch(() => ({ records:[],case_id:q.case_id,log:[{purpose:q.purpose,query:q.query,status:'failed',count:0}] })));
    for (const x of followed) logs.push(...x.log.map(l => ({ ...l, case_id:x.case_id })));
    const more = dedupeSources(followed.flatMap(x => x.records).filter(r => candidateMatches(r,seeds))).filter(r => !sources.some(s => C.sourceKey(s.url) === C.sourceKey(r.url)));
    const readable = more.filter(r => ['official','media'].includes(S.publicKind(r.url))).slice(0,2);
    if (Date.now() < deadline - 1000) sources.push(...await mapLimit(readable,2,r => readDocument(r,deadline)));
    sources.push(...more.filter(r => !readable.includes(r)).slice(0,8).map(r => ({ ...S.metaSource(r), access:S.publicKind(r.url)==='search'?'headline_only':'link_only', read_error:'ORIGINAL_NOT_READ' })));
  } else limitations.push('실행시간 한도 때문에 후속 검색을 마치지 못했습니다.');
  steps.push({ step:'followup', status:followed.some(x=>x.log.some(l=>l.status==='ok'))?'done':'partial', detail:followed.some(x=>x.log.some(l=>l.status==='ok'))?'앞서 찾은 완료 언급 여부에 따라 후속 검색을 바꿔 실행':'후속 검색 미완료' });
  sources = dedupeSources(sources);
  const cases = seeds.map(seed => C.buildCaseResult(seed,sources,{ fund_candidates:S.fundCandidates(fundResult.items || [],seed) }));
  const evidenceCount = cases.reduce((n,c) => n+c.evidence.length,0);
  const allSearchFailed = !logs.some(l => l.status === 'ok');
  const partial = !evidenceCount || allSearchFailed || !sources.some(s => s.read_ok) || sources.some(s => ['unread','attachment_unread'].includes(s.access)) || !historical.ok || Date.now() >= deadline || !followed.length;
  if (allSearchFailed) limitations.push('실시간 검색에 실패했습니다. 기존 색인·직접 연결 원문만 조사한 결과입니다.');
  if (logs.some(l => l.status === 'not_configured')) limitations.push('네이버 검색은 연결되지 않아 사용하지 않았습니다. Google News 검색은 뉴스 색인 범위이며 웹 전체를 검색한 결과가 아닙니다.');
  limitations.push('제목·검색 요약만 읽은 자료는 본문 근거로 쓰지 않았습니다. 유료·로그인·스캔·HWP 자료는 읽지 못할 수 있습니다.');
  limitations.push('관련 보도를 찾지 못해도 미보도·단독으로 판정하지 않습니다. 목록 부재는 미결성·미등록의 증거가 아닙니다.');
  limitations.push('본문 발췌는 자동 추출이며 [확인] 사실로 승격하지 않았습니다. 같은 펀드·회차·계정인지와 문맥을 기자가 검수해야 합니다.');
  limitations.push('금액의 기준과 단위를 추정하지 않습니다. 정책 출자액·목표액·약정액·납입액은 각각 따로 확인합니다.');
  const finished = new Date().toISOString();
  return {
    ok:true, version:C.VERSION, run_id:C.hash(parent.clue_id,started), clue_id:parent.clue_id, title:parent.title,
    started_at:started, finished_at:finished, canonical_as_of:seeds[0]?.canonical_as_of || null,
    state:partial?'partial':'completed', cases,
    sources:sources.map(({text,blocks,links,snippet,...meta}) => meta),
    coverage:{ canonical_source:'기존 정본의 읽기전용 스냅샷', index_rows:historical.rows.length, index_ready:historical.ok, fund_catalog_ready:Boolean(fundResult.ready), fund_rows:(fundResult.items || []).length,
      searches:logs, body_read:sources.filter(s=>s.read_ok).length, title_or_link_only:sources.filter(s=>!s.read_ok).length, evidence_count:evidenceCount, complete_market_coverage:false },
    steps, limitations,
    policy:{ public_only:true, notes_uploaded:false, canonical_write:false, article_judgment:false, article_score:false, paid_model_calls:0, mode:'bounded_public_source_playbook' },
  };
}
module.exports = { runResearch, mapLimit, dedupeSources };
