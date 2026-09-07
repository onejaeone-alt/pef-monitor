const DART_KEY = process.env.DART_API_KEY || '';
const BASE_URL = 'https://opendart.fss.or.kr/api';

const COMMON_PURPOSE_FIELDS = [
  { key: 'fdpp_fclt', label: '시설자금', kind: 'money' },
  { key: 'fdpp_bsninh', label: '영업양수자금', kind: 'money' },
  { key: 'fdpp_op', label: '운영자금', kind: 'money' },
  { key: 'fdpp_dtrp', label: '채무상환자금', kind: 'money' },
  { key: 'fdpp_ocsa', label: '타법인 증권 취득자금', kind: 'money' },
  { key: 'fdpp_etc', label: '기타자금', kind: 'money' },
];

const SPECS = {
  capital_raise: {
    id: 'capital_raise',
    endpoint: 'piicDecsn.json',
    match: /유상증자/,
    fields: [
      { key: 'nstk_ostk_cnt', label: '신주 보통주', kind: 'shares' },
      { key: 'nstk_estk_cnt', label: '신주 기타주', kind: 'shares' },
      { key: 'fv_ps', label: '액면가', kind: 'money' },
      ...COMMON_PURPOSE_FIELDS,
      { key: 'ic_mthn', label: '증자방식', kind: 'text' },
    ],
  },
  cb: {
    id: 'cb',
    endpoint: 'cvbdIsDecsn.json',
    match: /전환사채/,
    fields: [
      { key: 'bd_tm', label: '사채 회차', kind: 'text' },
      { key: 'bd_fta', label: '권면총액', kind: 'money' },
      ...COMMON_PURPOSE_FIELDS,
      { key: 'bd_intr_ex', label: '표면이자율', kind: 'percent' },
      { key: 'bd_intr_sf', label: '만기이자율', kind: 'percent' },
      { key: 'bd_mtd', label: '사채만기일', kind: 'date' },
      { key: 'bdis_mthn', label: '발행방법', kind: 'text' },
      { key: 'cv_rt', label: '전환비율', kind: 'percent' },
      { key: 'cv_prc', label: '전환가액', kind: 'money_per_share' },
      { key: 'cvisstk_cnt', label: '전환가능 주식수', kind: 'shares' },
      { key: 'cvisstk_tisstk_vs', label: '전환시 주식총수 대비', kind: 'percent' },
      { key: 'cvrqpd_bgd', label: '전환청구 시작일', kind: 'date' },
      { key: 'cvrqpd_edd', label: '전환청구 종료일', kind: 'date' },
      { key: 'act_mktprcfl_cvprc_lwtrsprc', label: '최저 조정가액', kind: 'money_per_share' },
      { key: 'sbd', label: '청약일', kind: 'date' },
      { key: 'pymd', label: '납입일', kind: 'date' },
      { key: 'rpmcmp', label: '대표주관회사', kind: 'text' },
      { key: 'grint', label: '보증기관', kind: 'text' },
    ],
  },
  bw: {
    id: 'bw',
    endpoint: 'bdwtIsDecsn.json',
    match: /신주인수권부사채/,
    fields: [
      { key: 'bd_tm', label: '사채 회차', kind: 'text' },
      { key: 'bd_fta', label: '권면총액', kind: 'money' },
      ...COMMON_PURPOSE_FIELDS,
      { key: 'bd_intr_ex', label: '표면이자율', kind: 'percent' },
      { key: 'bd_intr_sf', label: '만기이자율', kind: 'percent' },
      { key: 'bd_mtd', label: '사채만기일', kind: 'date' },
      { key: 'bdis_mthn', label: '발행방법', kind: 'text' },
      { key: 'ex_rt', label: '행사비율', kind: 'percent' },
      { key: 'ex_prc', label: '행사가액', kind: 'money_per_share' },
      { key: 'bdwt_div_atn', label: '사채·인수권 분리여부', kind: 'text' },
      { key: 'nstk_isstk_cnt', label: '행사가능 주식수', kind: 'shares' },
      { key: 'nstk_isstk_tisstk_vs', label: '행사시 주식총수 대비', kind: 'percent' },
      { key: 'expd_bgd', label: '권리행사 시작일', kind: 'date' },
      { key: 'expd_edd', label: '권리행사 종료일', kind: 'date' },
      { key: 'act_mktprcfl_cvprc_lwtrsprc', label: '최저 조정가액', kind: 'money_per_share' },
      { key: 'pymd', label: '납입일', kind: 'date' },
    ],
  },
  eb: {
    id: 'eb',
    endpoint: 'exbdIsDecsn.json',
    match: /교환사채/,
    fields: [
      { key: 'bd_tm', label: '사채 회차', kind: 'text' },
      { key: 'bd_fta', label: '권면총액', kind: 'money' },
      ...COMMON_PURPOSE_FIELDS,
      { key: 'bd_intr_ex', label: '표면이자율', kind: 'percent' },
      { key: 'bd_intr_sf', label: '만기이자율', kind: 'percent' },
      { key: 'bd_mtd', label: '사채만기일', kind: 'date' },
      { key: 'bdis_mthn', label: '발행방법', kind: 'text' },
      { key: 'ex_rt', label: '교환비율', kind: 'percent' },
      { key: 'ex_prc', label: '교환가액', kind: 'money_per_share' },
      { key: 'extg', label: '교환대상', kind: 'text' },
      { key: 'extg_stkcnt', label: '교환대상 주식수', kind: 'shares' },
      { key: 'extg_tisstk_vs', label: '교환대상 주식총수 대비', kind: 'percent' },
      { key: 'exrqpd_bgd', label: '교환청구 시작일', kind: 'date' },
      { key: 'exrqpd_edd', label: '교환청구 종료일', kind: 'date' },
      { key: 'pymd', label: '납입일', kind: 'date' },
    ],
  },
  equity_acquisition: {
    id: 'equity_acquisition',
    endpoint: 'otcprStkInvscrInhDecsn.json',
    match: /(?:타법인.*(?:주식|출자증권).*(?:취득|양수)|주식.*양수)/,
    fields: [
      { key: 'iscmp_cmpnm', label: '대상회사', kind: 'text' },
      { key: 'inhdtl_stkcnt', label: '양수주식수', kind: 'shares' },
      { key: 'inhdtl_inhprc', label: '양수금액', kind: 'money' },
      { key: 'inhdtl_tast_vs', label: '총자산 대비', kind: 'percent' },
      { key: 'inhdtl_ecpt_vs', label: '자기자본 대비', kind: 'percent' },
      { key: 'atinh_owstkcnt', label: '양수후 소유주식수', kind: 'shares' },
      { key: 'atinh_eqrt', label: '양수후 지분율', kind: 'percent' },
      { key: 'inh_pp', label: '양수목적', kind: 'text' },
      { key: 'inh_prd', label: '양수예정일', kind: 'date' },
      { key: 'dlptn_cmpnm', label: '거래상대방', kind: 'text' },
      { key: 'dlptn_rl_cmpn', label: '상대방과의 관계', kind: 'text' },
      { key: 'dl_pym', label: '거래대금 지급조건', kind: 'text' },
    ],
  },
  equity_disposal: {
    id: 'equity_disposal',
    endpoint: 'otcprStkInvscrTrfDecsn.json',
    match: /(?:타법인.*(?:주식|출자증권).*(?:처분|양도)|주식.*양도)/,
    fields: [
      { key: 'iscmp_cmpnm', label: '대상회사', kind: 'text' },
      { key: 'trfdtl_stkcnt', label: '양도주식수', kind: 'shares' },
      { key: 'trfdtl_trfprc', label: '양도금액', kind: 'money' },
      { key: 'trfdtl_tast_vs', label: '총자산 대비', kind: 'percent' },
      { key: 'trfdtl_ecpt_vs', label: '자기자본 대비', kind: 'percent' },
      { key: 'attrf_owstkcnt', label: '양도후 소유주식수', kind: 'shares' },
      { key: 'attrf_eqrt', label: '양도후 지분율', kind: 'percent' },
      { key: 'trf_pp', label: '양도목적', kind: 'text' },
      { key: 'trf_prd', label: '양도예정일', kind: 'date' },
      { key: 'dlptn_cmpnm', label: '거래상대방', kind: 'text' },
      { key: 'dlptn_rl_cmpn', label: '상대방과의 관계', kind: 'text' },
      { key: 'dl_pym', label: '거래대금 지급조건', kind: 'text' },
    ],
  },
};

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripCorrection(value) {
  return clean(value).replace(/^\[(?:기재정정|첨부정정|정정)\]\s*/g, '').replace(/^\s*(?:기재정정|첨부정정|정정)\s*/g, '');
}

function specFor(reportName, eventId) {
  const title = stripCorrection(reportName);
  if (/신주인수권부사채/.test(title)) return SPECS.bw;
  if (/전환사채/.test(title)) return SPECS.cb;
  if (/교환사채/.test(title)) return SPECS.eb;
  if (/유상증자/.test(title)) return SPECS.capital_raise;
  if (SPECS.equity_acquisition.match.test(title)) return SPECS.equity_acquisition;
  if (SPECS.equity_disposal.match.test(title)) return SPECS.equity_disposal;
  if (eventId && SPECS[eventId]?.match?.test(title)) return SPECS[eventId];
  return null;
}

function rceptNoFromUrl(url) {
  return String(url || '').match(/[?&]rcpNo=(\d{14})/)?.[1] || null;
}

function dateFromRcept(rceptNo) {
  const text = String(rceptNo || '');
  return /^20\d{12}$/.test(text) ? text.slice(0, 8) : null;
}

function dateMinusDays(yyyymmdd, days) {
  if (!/^\d{8}$/.test(String(yyyymmdd || ''))) return null;
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function normalize(value, kind) {
  const text = clean(value);
  if (!text || text === '-' || text === '해당사항없음' || text === '해당사항 없음') return '';
  if (['money', 'money_per_share', 'shares', 'percent'].includes(kind)) {
    const numeric = text.replace(/,/g, '').replace(/원\/주|원|주|%/g, '').trim();
    if (/^-?\d+(?:\.\d+)?$/.test(numeric)) return String(Number(numeric));
  }
  if (kind === 'date') return text.replace(/[^0-9]/g, '').slice(0, 8) || text;
  return text.toLowerCase();
}

function numberFrom(value) {
  const text = clean(value).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value, perShare = false) {
  const n = numberFrom(value);
  if (n === null) return clean(value);
  if (perShare) return `${Math.round(n).toLocaleString('ko-KR')}원`;
  const abs = Math.abs(n);
  if (abs >= 100000000) {
    const eok = n / 100000000;
    const digits = Math.abs(eok) >= 100 ? 0 : Math.abs(eok) >= 10 ? 1 : 2;
    return `${Number(eok.toFixed(digits)).toLocaleString('ko-KR')}억원`;
  }
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

function formatValue(value, kind) {
  const text = clean(value);
  if (!text) return '—';
  if (kind === 'money') return formatMoney(text, false);
  if (kind === 'money_per_share') return formatMoney(text, true);
  if (kind === 'shares') {
    const n = numberFrom(text);
    return n === null ? text : `${Math.round(n).toLocaleString('ko-KR')}주`;
  }
  if (kind === 'percent') {
    const n = numberFrom(text);
    return n === null ? text : `${Number(n.toFixed(4))}%`;
  }
  if (kind === 'date') {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function compareRows(previous, current, fields) {
  if (!previous || !current) return [];
  const deltas = [];
  for (const field of fields || []) {
    const beforeRaw = clean(previous[field.key]);
    const afterRaw = clean(current[field.key]);
    const before = normalize(beforeRaw, field.kind);
    const after = normalize(afterRaw, field.kind);
    if (!before && !after) continue;
    if (before === after) continue;
    deltas.push({
      field: field.key,
      label: field.label,
      kind: field.kind,
      before_raw: beforeRaw || null,
      after_raw: afterRaw || null,
      before: formatValue(beforeRaw, field.kind),
      after: formatValue(afterRaw, field.kind),
    });
  }
  return deltas;
}

async function fetchRows(spec, corpCode, endDate) {
  if (!DART_KEY || !spec || !corpCode || !endDate) return { ready: false, rows: [], reason: 'missing-config' };
  const bgn = dateMinusDays(endDate, 370) || endDate;
  const params = new URLSearchParams({
    crtfc_key: DART_KEY,
    corp_code: corpCode,
    bgn_de: bgn,
    end_de: endDate,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${BASE_URL}/${spec.endpoint}?${params}`, { signal: controller.signal });
    if (!response.ok) return { ready: false, rows: [], reason: `http-${response.status}` };
    const payload = await response.json();
    if (payload.status === '013') return { ready: true, rows: [], reason: 'no-data' };
    if (payload.status !== '000') return { ready: false, rows: [], reason: `dart-${payload.status}` };
    return { ready: true, rows: payload.list || [], reason: null };
  } catch (error) {
    return { ready: false, rows: [], reason: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error) };
  } finally {
    clearTimeout(timeout);
  }
}

function disclosureMap(disclosures) {
  const map = new Map();
  for (const row of disclosures || []) {
    const rcept = String(row?.rcept_no || row?.raw_data?.rcept_no || '');
    if (rcept) map.set(rcept, row);
  }
  return map;
}

function reportNameFor(row) {
  return row?.report_nm || row?.raw_data?.report_nm || '';
}

function corpCodeFor(row) {
  return row?.corp_code || row?.raw_data?.corp_code || '';
}

function currentAndPreviousRcept(clue) {
  const sources = clue?.sources || [];
  return {
    current: rceptNoFromUrl(sources[0]?.url),
    previous: rceptNoFromUrl(sources[1]?.url),
  };
}

function deltaSummary(deltas, max = 4) {
  const rows = (deltas || []).slice(0, max).map((d) => `${d.label} ${d.before} → ${d.after}`);
  const extra = Math.max(0, (deltas || []).length - rows.length);
  return `${rows.join(' · ')}${extra ? ` · 외 ${extra}개 항목` : ''}`;
}

function labelsSummary(deltas, max = 3) {
  const labels = (deltas || []).slice(0, max).map((d) => d.label);
  return `${labels.join('·')}${(deltas || []).length > max ? ` 등 ${deltas.length}개 항목` : ''}`;
}

function enrichClue(clue, spec, deltas, currentRow, previousRow) {
  const corp = (clue.entities || [])[0] || currentRow?.corp_name || '해당 회사';
  const summary = deltaSummary(deltas);
  const genericUnknowns = new Set(['실제 변경된 표의 항목과 숫자', '거래상대방·지분율·일정의 실질 변경 여부']);
  const unknowns = (clue.unknowns || []).filter((item) => !genericUnknowns.has(item));
  if (!unknowns.length) unknowns.push('변경 사유와 거래·자금조달에 미치는 실제 영향');
  return {
    ...clue,
    detector_label: 'DART 실질변화',
    one_line_signal: `${corp}의 ${clue.headline?.split('·').slice(1).join('·').trim() || '주요사항 공시'}에서 ${labelsSummary(deltas)}가 직전 공시와 실제로 달라졌습니다.`,
    changed_fact: summary,
    confirmed_facts: [
      ...(clue.confirmed_facts || []),
      ...deltas.slice(0, 6).map((d) => `${d.label}: ${d.before} → ${d.after}`),
    ],
    unknowns,
    material_deltas: deltas,
    structured_diff: {
      verified: true,
      source: 'OpenDART 주요사항보고서 주요정보 API',
      endpoint: spec.endpoint,
      current_rcept_no: currentRow?.rcept_no || null,
      previous_rcept_no: previousRow?.rcept_no || null,
    },
    next_action: `DART 원문에서 ${labelsSummary(deltas, 2)} 변경 사유를 확인하고 회사·거래상대방에 실제 영향을 교차확인`,
  };
}

async function enrichOne(clue, map) {
  const ids = currentAndPreviousRcept(clue);
  if (!ids.current || !ids.previous) return { clue, verified: false, reason: 'missing-rcept' };
  const currentDisclosure = map.get(ids.current);
  const previousDisclosure = map.get(ids.previous);
  if (!currentDisclosure || !previousDisclosure) return { clue, verified: false, reason: 'missing-history' };
  const corpCode = corpCodeFor(currentDisclosure) || corpCodeFor(previousDisclosure);
  const reportName = reportNameFor(currentDisclosure) || reportNameFor(previousDisclosure);
  const eventId = currentDisclosure?.raw_data?.analysis?.event_id || previousDisclosure?.raw_data?.analysis?.event_id || '';
  const spec = specFor(reportName, eventId);
  if (!spec) return { clue, verified: false, reason: 'unsupported-report' };
  const endDate = dateFromRcept(ids.current);
  const fetched = await fetchRows(spec, corpCode, endDate);
  if (!fetched.ready) return { clue, verified: false, reason: fetched.reason || 'fetch-failed' };
  const currentRow = fetched.rows.find((row) => String(row.rcept_no) === ids.current);
  const previousRow = fetched.rows.find((row) => String(row.rcept_no) === ids.previous);
  if (!currentRow || !previousRow) return { clue, verified: false, reason: 'structured-row-missing' };
  const deltas = compareRows(previousRow, currentRow, spec.fields);
  if (!deltas.length) return { clue, verified: false, reason: 'no-material-delta' };
  return { clue: enrichClue(clue, spec, deltas, currentRow, previousRow), verified: true, reason: null };
}

async function enrichDartCluesWithMaterialDiff(clues, disclosures, options = {}) {
  const candidates = (clues || []).filter((clue) => clue?.detector === 'dart_change');
  const map = disclosureMap(disclosures);
  if (!DART_KEY || !candidates.length) {
    return { items: [], diagnostics: { attempted: candidates.length, verified: 0, reasons: { 'missing-key-or-candidates': candidates.length } } };
  }
  const batchSize = Math.min(Math.max(Number(options.concurrency) || 4, 1), 6);
  const results = [];
  for (let start = 0; start < candidates.length; start += batchSize) {
    const batch = candidates.slice(start, start + batchSize);
    results.push(...await Promise.all(batch.map((clue) => enrichOne(clue, map))));
  }
  const reasons = {};
  for (const result of results) if (!result.verified) reasons[result.reason || 'unknown'] = (reasons[result.reason || 'unknown'] || 0) + 1;
  return {
    items: results.filter((result) => result.verified).map((result) => result.clue),
    diagnostics: {
      attempted: candidates.length,
      verified: results.filter((result) => result.verified).length,
      reasons,
    },
  };
}

module.exports = {
  compareRows,
  enrichDartCluesWithMaterialDiff,
  formatValue,
  specFor,
};
