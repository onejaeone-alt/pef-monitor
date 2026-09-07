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
    .replace(/^\[[^\]]{1,40}\]\s*/,'')
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

function extractNotice(anchorHtml, href, context) {
  const anchorText = stripTags(anchorHtml);
  const contextText = stripTags(context);
  const combined = `${anchorText} ${contextText}`.replace(/\s+/g,' ').trim();
  const id = String(href).match(/\/invtnotice\/(\d+)/)?.[1] || null;
  const postedDate = combined.match(/공고일\s*:?\s*((?:19|20)\d{2}[-./]\d{2}[-./]\d{2})/)?.[1]?.replace(/[./]/g,'-') || null;
  const deadline = combined.match(/신청기한\s*:?\s*((?:19|20)\d{2}[-./]\d{2}[-./]\d{2})/)?.[1]?.replace(/[./]/g,'-') || null;
  const registeredAt = combined.match(/등록일자\s*((?:19|20)\d{2}[-./]\d{2}[-./]\d{2})/)?.[1]?.replace(/[./]/g,'-') || null;

  let organization = anchorText.match(/^(.{1,60}?)\s*공고일\s*:/)?.[1]?.trim() || null;
  let title = anchorText
    .replace(/^.{1,60}?\s*공고일\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2}\s*/,'')
    .replace(/^신청기한\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2}\s*/,'')
    .trim();
  if (!title || title === anchorText) {
    const afterDeadline = anchorText.match(/신청기한\s*:?\s*(?:19|20)\d{2}[-./]\d{2}[-./]\d{2}\s*(.+)$/);
    if (afterDeadline) title = afterDeadline[1].trim();
  }
  if (!organization) organization = title.match(/^\[([^\]]{1,40})\]/)?.[1]?.trim() || null;
  title = title.replace(/^\[[^\]]{1,40}\]\s*/,'').trim() || anchorText;

  if (!id || !title || !postedDate) return null;
  const cleanTitle = normalizeTitle(title);
  return {
    notice_id: `VCS-${id}`,
    vcs_id: id,
    organization: organization || '기관 미상',
    posted_date: postedDate,
    deadline,
    registered_at: registeredAt,
    title: cleanTitle,
    category: classify(cleanTitle),
    status: deadlineState(deadline),
    source_name: '벤처투자종합포털',
    source_type: '출자공고',
    source_url: absoluteUrl(href),
    dedupe_key: `${normalizeKeyPart(organization||'')}|${postedDate}|${normalizeKeyPart(cleanTitle)}`,
  };
}

function parseVcsListPage(html='', page=1) {
  const source = String(html || '');
  const total = Number((source.match(/전체\s*([\d,]+)\s*건/)?.[1] || '0').replace(/,/g,'')) || 0;
  const items = [];
  const re = /<a\b[^>]*href=["']([^"']*\/web\/portal\/bbs\/invtnotice\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(source))) {
    const start = Math.max(0, match.index - 700);
    const end = Math.min(source.length, re.lastIndex + 900);
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
