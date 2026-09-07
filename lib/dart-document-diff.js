const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');

const DART_KEY = process.env.DART_API_KEY || '';
const DOCUMENT_URL = 'https://opendart.fss.or.kr/api/document.xml';

const DOC_SPECS = [
  {
    id: 'capital_raise',
    match: /유상증자/,
    fields: [
      { label: '신주 보통주', cell: /보통주식\s*\(주\)/, context: /신주의 종류와 수/, kind: 'shares' },
      { label: '신주 기타주', cell: /기타주식\s*\(주\)/, context: /신주의 종류와 수/, kind: 'shares' },
      { label: '1주당 액면가', cell: /1주당\s*액면가액/, kind: 'money_per_share' },
      { label: '신주 발행가액', cell: /신주\s*발행가액|발행가액\s*\(원\)/, kind: 'money_per_share' },
      { label: '시설자금', cell: /시설자금/, context: /자금조달의 목적|시설자금/, kind: 'money' },
      { label: '운영자금', cell: /운영자금/, context: /자금조달의 목적|운영자금/, kind: 'money' },
      { label: '채무상환자금', cell: /채무상환자금/, context: /자금조달의 목적|채무상환자금/, kind: 'money' },
      { label: '타법인 증권 취득자금', cell: /타법인.*증권.*취득자금/, kind: 'money' },
      { label: '납입일', cell: /납입일/, kind: 'date' },
      { label: '증자방식', cell: /증자방식/, kind: 'text' },
    ],
  },
  {
    id: 'cb',
    match: /전환사채/,
    fields: [
      { label: '권면총액', cell: /권면.*총액/, kind: 'money' },
      { label: '운영자금', cell: /운영자금/, context: /자금조달의 목적|운영자금/, kind: 'money' },
      { label: '채무상환자금', cell: /채무상환자금/, context: /자금조달의 목적|채무상환자금/, kind: 'money' },
      { label: '타법인 증권 취득자금', cell: /타법인.*증권.*취득자금/, kind: 'money' },
      { label: '표면이자율', cell: /표면이자율/, kind: 'percent' },
      { label: '만기이자율', cell: /만기이자율/, kind: 'percent' },
      { label: '사채만기일', cell: /사채만기일/, kind: 'date' },
      { label: '전환비율', cell: /전환비율/, kind: 'percent' },
      { label: '전환가액', cell: /전환가액/, kind: 'money_per_share' },
      { label: '전환가능 주식수', cell: /전환.*발행할 주식.*주식수|전환.*주식수/, kind: 'shares' },
      { label: '전환시 주식총수 대비', cell: /주식총수 대비 비율/, context: /전환|주식총수/, kind: 'percent' },
      { label: '전환청구 시작일', cell: /전환청구기간.*시작일|시작일/, context: /전환청구/, kind: 'date' },
      { label: '전환청구 종료일', cell: /전환청구기간.*종료일|종료일/, context: /전환청구/, kind: 'date' },
      { label: '최저 조정가액', cell: /최저 조정가액/, kind: 'money_per_share' },
      { label: '납입일', cell: /납입일/, kind: 'date' },
      { label: '대표주관회사', cell: /대표주관회사/, kind: 'text' },
    ],
  },
  {
    id: 'bw',
    match: /신주인수권부사채/,
    fields: [
      { label: '권면총액', cell: /권면.*총액/, kind: 'money' },
      { label: '운영자금', cell: /운영자금/, context: /자금조달의 목적|운영자금/, kind: 'money' },
      { label: '채무상환자금', cell: /채무상환자금/, context: /자금조달의 목적|채무상환자금/, kind: 'money' },
      { label: '표면이자율', cell: /표면이자율/, kind: 'percent' },
      { label: '만기이자율', cell: /만기이자율/, kind: 'percent' },
      { label: '사채만기일', cell: /사채만기일/, kind: 'date' },
      { label: '행사비율', cell: /행사비율/, kind: 'percent' },
      { label: '행사가액', cell: /행사가액/, kind: 'money_per_share' },
      { label: '행사가능 주식수', cell: /행사.*발행할 주식.*주식수|행사.*주식수/, kind: 'shares' },
      { label: '권리행사 시작일', cell: /권리행사기간.*시작일|시작일/, context: /권리행사/, kind: 'date' },
      { label: '권리행사 종료일', cell: /권리행사기간.*종료일|종료일/, context: /권리행사/, kind: 'date' },
      { label: '최저 조정가액', cell: /최저 조정가액/, kind: 'money_per_share' },
      { label: '납입일', cell: /납입일/, kind: 'date' },
    ],
  },
  {
    id: 'eb',
    match: /교환사채/,
    fields: [
      { label: '권면총액', cell: /권면.*총액/, kind: 'money' },
      { label: '운영자금', cell: /운영자금/, context: /자금조달의 목적|운영자금/, kind: 'money' },
      { label: '채무상환자금', cell: /채무상환자금/, context: /자금조달의 목적|채무상환자금/, kind: 'money' },
      { label: '표면이자율', cell: /표면이자율/, kind: 'percent' },
      { label: '만기이자율', cell: /만기이자율/, kind: 'percent' },
      { label: '사채만기일', cell: /사채만기일/, kind: 'date' },
      { label: '교환비율', cell: /교환비율/, kind: 'percent' },
      { label: '교환가액', cell: /교환가액/, kind: 'money_per_share' },
      { label: '교환대상', cell: /교환대상/, kind: 'text' },
      { label: '교환대상 주식수', cell: /교환대상.*주식수|주식수/, context: /교환대상/, kind: 'shares' },
      { label: '교환청구 시작일', cell: /교환청구기간.*시작일|시작일/, context: /교환청구/, kind: 'date' },
      { label: '교환청구 종료일', cell: /교환청구기간.*종료일|종료일/, context: /교환청구/, kind: 'date' },
      { label: '납입일', cell: /납입일/, kind: 'date' },
    ],
  },
  {
    id: 'equity_acquisition',
    match: /타법인.*(?:주식|출자증권).*(?:취득|양수)|주식.*양수/,
    fields: [
      { label: '대상회사', cell: /발행회사.*회사명|회사명/, context: /발행회사/, kind: 'text' },
      { label: '양수주식수', cell: /양수주식수/, kind: 'shares' },
      { label: '양수금액', cell: /양수금액/, kind: 'money' },
      { label: '총자산 대비', cell: /총자산대비/, context: /양수내역|총자산/, kind: 'percent' },
      { label: '자기자본 대비', cell: /자기자본대비/, context: /양수내역|자기자본/, kind: 'percent' },
      { label: '양수후 소유주식수', cell: /소유주식수/, context: /양수후/, kind: 'shares' },
      { label: '양수후 지분율', cell: /지분비율/, context: /양수후/, kind: 'percent' },
      { label: '양수목적', cell: /양수목적/, kind: 'text' },
      { label: '양수예정일', cell: /양수예정일자|양수예정일/, kind: 'date' },
      { label: '거래상대방', cell: /회사명\(성명\)|성명/, context: /거래상대방/, kind: 'text' },
      { label: '거래대금 지급조건', cell: /거래대금지급|거래대금 지급/, kind: 'text' },
    ],
  },
  {
    id: 'equity_disposal',
    match: /타법인.*(?:주식|출자증권).*(?:처분|양도)|주식.*양도/,
    fields: [
      { label: '대상회사', cell: /발행회사.*회사명|회사명/, context: /발행회사/, kind: 'text' },
      { label: '양도주식수', cell: /양도주식수/, kind: 'shares' },
      { label: '양도금액', cell: /양도금액/, kind: 'money' },
      { label: '총자산 대비', cell: /총자산대비/, context: /양도내역|총자산/, kind: 'percent' },
      { label: '자기자본 대비', cell: /자기자본대비/, context: /양도내역|자기자본/, kind: 'percent' },
      { label: '양도후 소유주식수', cell: /소유주식수/, context: /양도후/, kind: 'shares' },
      { label: '양도후 지분율', cell: /지분비율/, context: /양도후/, kind: 'percent' },
      { label: '양도목적', cell: /양도목적/, kind: 'text' },
      { label: '양도예정일', cell: /양도예정일자|양도예정일/, kind: 'date' },
      { label: '거래상대방', cell: /회사명\(성명\)|성명/, context: /거래상대방/, kind: 'text' },
      { label: '거래대금 지급조건', cell: /거래대금지급|거래대금 지급/, kind: 'text' },
    ],
  },
];

function clean(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function textFromMarkup(value) {
  return clean(decodeEntities(String(value || '')
    .replace(/<BR\b[^>]*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')));
}

function decodeXml(buffer) {
  const utf8 = buffer.toString('utf8');
  const replacementCount = (utf8.match(/�/g) || []).length;
  if (replacementCount === 0) return utf8;
  const cp949 = iconv.decode(buffer, 'euc-kr');
  const cp949Replacement = (cp949.match(/�/g) || []).length;
  return cp949Replacement < replacementCount ? cp949 : utf8;
}

function chooseXmlEntry(zip, rceptNo) {
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory && /\.xml$/i.test(entry.entryName));
  if (!entries.length) return null;
  const exact = entries.find((entry) => entry.entryName.split('/').pop()?.replace(/\.xml$/i, '') === String(rceptNo));
  if (exact) return exact;
  const nonAttach = entries.filter((entry) => !/attach|첨부|image|xbrl/i.test(entry.entryName));
  return [...(nonAttach.length ? nonAttach : entries)].sort((a, b) => Number(b.header?.size || 0) - Number(a.header?.size || 0))[0];
}

async function fetchDocumentXml(rceptNo) {
  if (!DART_KEY || !rceptNo) return { ready: false, reason: 'missing-config', xml: null };
  const params = new URLSearchParams({ crtfc_key: DART_KEY, rcept_no: String(rceptNo) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${DOCUMENT_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) return { ready: false, reason: `http-${response.status}`, xml: null };
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 4) return { ready: false, reason: 'empty-document', xml: null };
    if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
      const text = buffer.toString('utf8').slice(0, 500);
      const status = text.match(/<status>([^<]+)<\/status>/i)?.[1];
      return { ready: false, reason: status ? `dart-${status}` : 'not-zip', xml: null };
    }
    const zip = new AdmZip(buffer);
    const entry = chooseXmlEntry(zip, rceptNo);
    if (!entry) return { ready: false, reason: 'xml-entry-missing', xml: null };
    return { ready: true, reason: null, xml: decodeXml(entry.getData()), entry: entry.entryName };
  } catch (error) {
    return { ready: false, reason: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error), xml: null };
  } finally {
    clearTimeout(timeout);
  }
}

function parseRows(xml) {
  const rows = [];
  const rowRegex = /<TR\b[^>]*>([\s\S]*?)<\/TR>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(String(xml || '')))) {
    const cells = [];
    const cellRegex = /<(?:TD|TH)\b[^>]*>([\s\S]*?)<\/(?:TD|TH)>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      const value = textFromMarkup(cellMatch[1]);
      if (value) cells.push(value);
    }
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

function specFor(reportName) {
  const title = clean(reportName).replace(/^\[(?:기재정정|첨부정정|정정)\]\s*/g, '');
  if (/신주인수권부사채/.test(title)) return DOC_SPECS.find((x) => x.id === 'bw');
  if (/전환사채/.test(title)) return DOC_SPECS.find((x) => x.id === 'cb');
  if (/교환사채/.test(title)) return DOC_SPECS.find((x) => x.id === 'eb');
  return DOC_SPECS.find((spec) => spec.match.test(title)) || null;
}

function normalize(value, kind) {
  const text = clean(value);
  if (!text || /^[-–—]$/.test(text) || /해당사항\s*없음/.test(text)) return '';
  if (['money', 'money_per_share', 'shares', 'percent'].includes(kind)) {
    const numeric = text.replace(/,/g, '').replace(/원\/주|억원|백만원|만원|원|주|%/g, '').trim();
    if (/^-?\d+(?:\.\d+)?$/.test(numeric)) return String(Number(numeric));
  }
  if (kind === 'date') {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length >= 8) return digits.slice(0, 8);
  }
  return text.toLowerCase();
}

function numberFrom(value) {
  const text = clean(value).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function formatValue(value, kind) {
  const text = clean(value);
  if (!text) return '—';
  const n = numberFrom(text);
  if (kind === 'money' && n !== null) {
    if (/억원/.test(text)) return `${Number(n.toFixed(2))}억원`;
    if (/백만원/.test(text)) return `${Number(n.toFixed(2))}백만원`;
    if (/만원/.test(text)) return `${Number(n.toFixed(2))}만원`;
    if (Math.abs(n) >= 100000000) return `${Number((n / 100000000).toFixed(Math.abs(n) >= 10000000000 ? 0 : 1)).toLocaleString('ko-KR')}억원`;
    return `${Math.round(n).toLocaleString('ko-KR')}원`;
  }
  if (kind === 'money_per_share' && n !== null) return `${Math.round(n).toLocaleString('ko-KR')}원`;
  if (kind === 'shares' && n !== null) return `${Math.round(n).toLocaleString('ko-KR')}주`;
  if (kind === 'percent' && n !== null) return `${Number(n.toFixed(4))}%`;
  if (kind === 'date') {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function candidateValue(cells, index) {
  const following = cells.slice(index + 1).map(clean).filter(Boolean);
  if (!following.length) return '';
  return following[0];
}

function extractField(rows, field) {
  const matches = [];
  for (const cells of rows || []) {
    const rowText = cells.join(' | ');
    if (field.context && !field.context.test(rowText)) continue;
    for (let i = 0; i < cells.length; i += 1) {
      field.cell.lastIndex = 0;
      if (!field.cell.test(cells[i])) continue;
      const value = candidateValue(cells, i);
      if (!value || field.cell.test(value)) continue;
      matches.push(value);
    }
  }
  return matches.length ? matches[matches.length - 1] : '';
}

function compareDocuments(previousRows, currentRows, spec) {
  const deltas = [];
  for (const field of spec?.fields || []) {
    const beforeRaw = extractField(previousRows, field);
    const afterRaw = extractField(currentRows, field);
    const before = normalize(beforeRaw, field.kind);
    const after = normalize(afterRaw, field.kind);
    if (!before && !after) continue;
    if (before === after) continue;
    deltas.push({
      field: field.label,
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

function rceptNoFromUrl(url) {
  return String(url || '').match(/[?&]rcpNo=(\d{14})/)?.[1] || null;
}

function idsFromClue(clue) {
  return {
    current: rceptNoFromUrl(clue?.sources?.[0]?.url),
    previous: rceptNoFromUrl(clue?.sources?.[1]?.url),
  };
}

function reportNames(clue) {
  const facts = clue?.confirmed_facts || [];
  const current = clean(facts[0]).replace(/^현재 공시:\s*/, '');
  const previous = clean(facts[1]).replace(/^직전 동일 유형 공시:\s*/, '');
  return { current, previous };
}

function enrichClue(clue, deltas, currentDoc, previousDoc) {
  const corp = clue?.entities?.[0] || String(clue.headline || '').split('·')[0].trim() || '해당 회사';
  const event = String(clue.headline || '').split('·').slice(1).join('·').trim() || '공시';
  const visible = deltas.slice(0, 4).map((d) => `${d.label} ${d.before} → ${d.after}`);
  const extra = Math.max(0, deltas.length - visible.length);
  const changed = `${visible.join(' · ')}${extra ? ` · 외 ${extra}개 항목` : ''}`;
  const labels = deltas.slice(0, 3).map((d) => d.label).join('·');
  const unknowns = (clue.unknowns || []).filter((x) => !/실제 변경된 표의 항목과 숫자|거래상대방·지분율·일정의 실질 변경 여부/.test(x));
  if (!unknowns.length) unknowns.push('변경 사유와 거래·자금조달에 미치는 실제 영향');
  return {
    ...clue,
    detector_label: 'DART 실질변화',
    one_line_signal: `${corp}의 ${event}에서 ${labels}${deltas.length > 3 ? ` 등 ${deltas.length}개 항목` : ''}이 직전 공시와 실제로 달라졌습니다.`,
    changed_fact: changed,
    confirmed_facts: [...(clue.confirmed_facts || []), ...deltas.slice(0, 6).map((d) => `${d.label}: ${d.before} → ${d.after}`)],
    unknowns,
    material_deltas: deltas,
    document_diff: {
      verified: true,
      source: 'OpenDART 공시서류원본파일',
      current_entry: currentDoc.entry || null,
      previous_entry: previousDoc.entry || null,
    },
    next_action: `DART 원문에서 ${deltas.slice(0, 2).map((d) => d.label).join('·')} 변경 사유를 확인하고 회사·거래상대방에 실제 영향을 교차확인`,
  };
}

async function enrichOne(clue) {
  const ids = idsFromClue(clue);
  const names = reportNames(clue);
  const spec = specFor(names.current || names.previous);
  if (!ids.current || !ids.previous) return { verified: false, reason: 'missing-rcept', clue };
  if (!spec) return { verified: false, reason: 'unsupported-report', clue };
  const [currentDoc, previousDoc] = await Promise.all([fetchDocumentXml(ids.current), fetchDocumentXml(ids.previous)]);
  if (!currentDoc.ready || !previousDoc.ready) {
    return { verified: false, reason: `document-fetch:${currentDoc.reason || 'ok'}:${previousDoc.reason || 'ok'}`, clue };
  }
  const currentRows = parseRows(currentDoc.xml);
  const previousRows = parseRows(previousDoc.xml);
  if (!currentRows.length || !previousRows.length) return { verified: false, reason: 'table-rows-missing', clue };
  const deltas = compareDocuments(previousRows, currentRows, spec);
  if (!deltas.length) return { verified: false, reason: 'no-material-delta', clue };
  return { verified: true, reason: null, clue: enrichClue(clue, deltas, currentDoc, previousDoc) };
}

async function enrichDartCluesWithDocumentDiff(clues, options = {}) {
  const rows = (clues || []).filter((clue) => clue?.detector === 'dart_change');
  if (!DART_KEY || !rows.length) return { items: [], diagnostics: { attempted: rows.length, verified: 0, reasons: { 'missing-key-or-candidates': rows.length } } };
  const concurrency = Math.min(Math.max(Number(options.concurrency) || 3, 1), 4);
  const results = [];
  for (let start = 0; start < rows.length; start += concurrency) {
    results.push(...await Promise.all(rows.slice(start, start + concurrency).map(enrichOne)));
  }
  const reasons = {};
  for (const result of results) if (!result.verified) reasons[result.reason || 'unknown'] = (reasons[result.reason || 'unknown'] || 0) + 1;
  return {
    items: results.filter((result) => result.verified).map((result) => result.clue),
    diagnostics: { attempted: rows.length, verified: results.filter((result) => result.verified).length, reasons },
  };
}

module.exports = {
  compareDocuments,
  enrichDartCluesWithDocumentDiff,
  parseRows,
  specFor,
};
