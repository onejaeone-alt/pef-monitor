const BASE_URL = 'https://www.vcs.go.kr';
const LIST_PATH = '/web/portal/bbs/invtnotice/list';

function decodeEntities(value='') {
  return String(value)
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)||32));
}

function stripTags(value='') {
  return decodeEntities(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ')
    .trim();
}

function absoluteUrl(href='') {
  try { return new URL(decodeEntities(href), BASE_URL).toString(); }
  catch (_) { return href || null; }
}

function normalizeTitle(value='') {
  return stripTags(value)
    .replace(/^\[([^\]]{1,24})\]\s+(?=.+)/,'')
    .replace(/\s+NEW\s*$/i,'')
    .replace(/[「」『』“”‘’"']/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function normalizeKeyPart(value='') {
  return normalizeTitle(value).replace(/[^0-9a-z가-힣]/gi,'').toLowerCase();
}

function classify(title='') {
  const text = String(title);
  if (/세컨더리|회수시장|구주/.test(text)) return '세컨더리·회수';
  if (/PEF|사모|바이아웃/i.test(text)) return 'PEF';
  if (/VC|벤처|스타트업|창업/i.test(text)) return 'VC';
  if (/모태펀드|모펀드/.test(text)) return '모태펀드';
  if (/인수금융|대출|융자|보증/.test(text)) return '금융';
  return '기타 출자';
}

function deadlineState(deadline, now = new Date(Date.now()+9*3600*1000)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deadline||''))) return 'unknown';
  const today = now.toISOString().slice(0,10);
  return deadline >= today ? 'open' : 'closed';
}

function dateValue(text, label) {
  return text.match(new RegExp(`${label}\\s*:?\\s*((?:19|20)\\d{2}[-./]\\d{2}[-./]\\d{2})`))?.[1]?.replace(/[./]/g,'-') || null;
}

function extractOrganization(anchorText, contextText, title) {
  const fromAnchor = anchorText.match(/^(.{1,60}?)\s*공고일\s*:/)?.[1]?.trim();
  if (fromAnchor) return fromAnchor;
  const fromTitle = title.match(/^\[([^\]]{1,30})\]/)?.[1]?.trim();
  if (fromTitle) return fromTitle;
  const aroundDate = contextText.match(/(?:^|\s)([가-힣A-Za-z0-9·&()㈜주식회사\s]{2,60}?)\s+공고일\s*:/)?.[1]?.trim();
  if (aroundDate) return aroundDate.replace(/.*(?:조회수|등록일자\s*\d{4}[-./]\d{2}[-./]\d{2})\s*/,'').trim();
  return null;
}

function cleanEmbeddedTitle(text='') {
  let value=String(text).replace(/\s+/g,' ').trim();
  const arrow=value.match(/-->\s*(.+?)\s+신청기한\s*:/)?.[1]?.trim();
  if (arrow) value=arrow;
  else {
    value=value
      .replace(/선정\(예정\)일\s*:\s*/g,' ')
      .replace(/결성\(예정\)일\s*:\s*/g,' ')
      .replace(/-->/g,' ')
      .replace(/신청기한\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2}/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    const half=Math.floor(value.length/2);
    if (half>12) {
      const left=value.slice(0,half).trim(), right=value.slice(half).replace(/\s*NEW\s*$/i,'').trim();
      if (compactLoose(left)===compactLoose(right)) value=left;
    }
  }
  return value.replace(/\s+NEW\s*$/i,'').trim();
}

function compactLoose(value='') { return String(value).replace(/[^0-9a-z가-힣]/gi,'').toLowerCase(); }

function extractTitle(anchorText, contextText) {
  const fromArrow = anchorText.match(/-->\s*(.+?)\s+신청기한\s*:/)?.[1]?.trim();
  if (fromArrow) return fromArrow;
  const afterDeadline = anchorText.match(/신청기한\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2}\s*(.+)$/)?.[1]?.trim();
  if (afterDeadline) return cleanEmbeddedTitle(afterDeadline);
  const afterDate = anchorText.match(/공고일\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2}(?:\s+신청기한\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2})?\s*(.+)$/)?.[1]?.trim();
  if (afterDate) return cleanEmbeddedTitle(afterDate);
  const cleanAnchor = cleanEmbeddedTitle(anchorText.replace(/^\s*상세보기\s*/,'').trim());
  if (cleanAnchor && !/^\d+$/.test(cleanAnchor)) return cleanAnchor;
  const contextMatch = contextText.match(/-->\s*(.+?)\s+신청기한\s*:/)?.[1]?.trim() || contextText.match(/신청기한\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2}\s+(.+?)(?:\s+등록일자|\s+조회수|$)/)?.[1]?.trim();
  return cleanEmbeddedTitle(contextMatch || cleanAnchor);
}

function extractNotice(anchorHtml, href, context) {
  const anchorText = stripTags(anchorHtml);
  const contextText = stripTags(context);
  const combined = `${anchorText} ${contextText}`.replace(/\s+/g,' ').trim();
  const id = String(href).match(/\/invtnotice\/(\d+)/)?.[1] || null;
  const postedDate = dateValue(combined,'공고일');
  const deadline = dateValue(combined,'신청기한');
  const registeredAt = dateValue(combined,'등록일자');
  let title = extractTitle(anchorText, contextText) || '';
  const organization = extractOrganization(anchorText, contextText, title) || '기관 미상';
  title = title.replace(/^\[([^\]]{1,24})\]\s+(?=.+)/,'').trim();

  if (!id || !title || !postedDate) return null;
  const cleanTitle = normalizeTitle(title);
  return {
    notice_id: `VCS-${id}`,
    vcs_id: id,
    organization,
    posted_date: postedDate,
    deadline,
    registered_at: registeredAt,
    title: cleanTitle,
    category: classify(cleanTitle),
    status: deadlineState(deadline),
    source_name: '벤처투자종합포털',
    source_type: '출자공고',
    source_url: absoluteUrl(href),
    dedupe_key: `${normalizeKeyPart(organization)}|${postedDate}|${normalizeKeyPart(cleanTitle)}`,
  };
}

function parseVcsListPage(html='', page=1) {
  const source = String(html || '');
  const total = Number((stripTags(source).match(/전체\s*([\d,]+)\s*건/)?.[1] || '0').replace(/,/g,'')) || 0;
  const items = [];
  const re = /<a\b[^>]*href=["']([^"']*\/web\/portal\/bbs\/invtnotice\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(source))) {
    const start = Math.max(0, match.index - 650);
    const end = Math.min(source.length, re.lastIndex + 650);
    const item = extractNotice(match[2], match[1], source.slice(start,end));
    if (item) items.push({ ...item, page });
  }
  const deduped = [...new Map(items.map(item=>[item.notice_id,item])).values()];
  return { total, items: deduped };
}

function buildListUrl(page=1, pageSize=10) {
  const url = new URL(LIST_PATH, BASE_URL);
  url.searchParams.set('baCommSelec','false');
  url.searchParams.set('baNotice','false');
  url.searchParams.set('baOpenDay','false');
  url.searchParams.set('baUse','true');
  url.searchParams.set('bcId','invtnotice');
  url.searchParams.set('cp', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  return url.toString();
}

function mergeVcsItems(pages=[]) {
  const map = new Map();
  for (const page of pages) {
    for (const item of page?.items || []) {
      const key = item.notice_id || item.dedupe_key;
      if (!map.has(key)) map.set(key,item);
    }
  }
  return [...map.values()].sort((a,b)=>
    String(b.posted_date||'').localeCompare(String(a.posted_date||'')) ||
    String(b.registered_at||'').localeCompare(String(a.registered_at||''))
  );
}

module.exports = { BASE_URL, LIST_PATH, buildListUrl, parseVcsListPage, mergeVcsItems, normalizeKeyPart, normalizeTitle };
