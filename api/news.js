const { parseGoogleNewsRss } = require('../lib/context-sources');
const { findWatchTarget, WATCH_TARGETS } = require('../lib/watch-config');

const GOOGLE_NEWS_URL = 'https://news.google.com/rss/search';

function googleNewsUrl(query) {
  const params = new URLSearchParams({ q: query, hl: 'ko', gl: 'KR', ceid: 'KR:ko' });
  return `${GOOGLE_NEWS_URL}?${params}`;
}

async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'IB-News-Monitor/3.0' } });
    if (!response.ok) throw new Error(`News HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function queries(days) {
  const suffix = `when:${days}d`;
  return [
    `(벤처캐피탈 OR VC OR CVC OR "스타트업 투자") ${suffix}`,
    `(사모펀드 OR PEF OR "private equity" OR 바이아웃) ${suffix}`,
    `(M&A OR 인수합병 OR 경영권 OR 공개매수 OR 매각 OR 인수) ${suffix}`,
    `("투자은행" OR "인수금융" OR 회사채 OR 전환사채 OR 유상증자 OR 자금조달) ${suffix}`,
    `(산업은행 OR 한국성장금융 OR 모태펀드 OR 국민연금 OR 공제회 OR LP OR 출자사업) ${suffix}`,
    `(펀드레이징 OR 블라인드펀드 OR 자산운용 OR "전략적 투자자" OR "재무적 투자자" OR SI OR FI) ${suffix}`,
  ];
}

function theme(text) {
  const t = String(text || '');
  if (/사모펀드|PEF|private equity|바이아웃|M&A|인수합병|공개매수|경영권|매각|인수/.test(t)) return ['ma_pef','M&A·PEF'];
  if (/벤처캐피탈|\bVC\b|\bCVC\b|스타트업|시리즈[A-D]?|벤처투자/.test(t)) return ['vc','VC·스타트업'];
  if (/모태펀드|한국성장금융|산업은행|국민연금|공제회|\bLP\b|출자사업|앵커LP/.test(t)) return ['lp','LP·정책자금'];
  if (/회사채|인수금융|투자은행|전환사채|유상증자|자금조달|IPO|주관사/.test(t)) return ['ib','IB·자금조달'];
  if (/펀드레이징|블라인드펀드|자산운용/.test(t)) return ['fund','펀드레이징·운용'];
  if (/전략적 투자자|재무적 투자자|\bSI\b|\bFI\b/.test(t)) return ['investor','SI·FI'];
  return ['other','기타 IB'];
}

function eventLabel(text) {
  const t = String(text || '');
  if (/회생|파산|워크아웃|채무불이행/.test(t)) return '회생·위험';
  if (/매각|인수|M&A|인수합병|공개매수|경영권|우선협상|본입찰|예비입찰/.test(t)) return 'M&A';
  if (/펀드레이징|결성|조성|블라인드펀드/.test(t)) return '펀드레이징';
  if (/출자|선정|모태펀드|공제회|국민연금|산업은행/.test(t)) return 'LP·출자';
  if (/회사채|전환사채|유상증자|인수금융|자금조달/.test(t)) return '자금조달';
  if (/투자 유치|투자유치|투자 참여|투자한다|투자 결정|후속 투자|시리즈[A-D]?/.test(t)) return '투자';
  if (/IPO|상장|블록딜|세컨더리|회수|엑시트/.test(t)) return '회수·IPO';
  if (/영입|선임|취임|사임|퇴사|이동|독립|합류|승진/.test(t)) return '인사';
  return 'IB 뉴스';
}

function normalizeTitle(value) {
  return String(value || '').toLowerCase().replace(/[^0-9a-z가-힣]/g,'').slice(0,140);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || '3', 10), 1), 14);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '160', 10), 20), 300);
    const settled = await Promise.allSettled(queries(days).map(async (q) => {
      const xml = await fetchText(googleNewsUrl(q));
      return parseGoogleNewsRss(xml, 'domestic', 'ko');
    }));
    const raw = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const seenUrl = new Set(), seenTitle = new Set(), items = [];
    for (const item of raw) {
      const cleanUrl = String(item.source_url || '').replace(/[?#].*$/,'');
      const key = normalizeTitle(item.title);
      if (!cleanUrl || !key || seenUrl.has(cleanUrl) || seenTitle.has(key)) continue;
      seenUrl.add(cleanUrl); seenTitle.add(key);
      const text = `${item.title} ${item.snippet || ''}`;
      const [theme_id, theme_label] = theme(text);
      const target = findWatchTarget(text, WATCH_TARGETS);
      items.push({
        signal_id: `${Date.parse(item.published_at || 0)}-${items.length}`,
        published_at: item.published_at,
        source_type: 'domestic_news',
        source_name: item.source_name,
        title: item.title,
        source_url: item.source_url,
        snippet: item.snippet || '',
        target: target ? { id: target.id, name: target.name, category: target.category } : null,
        theme_id,
        theme_label,
        event_label: eventLabel(text),
      });
    }
    items.sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
    return res.status(200).json({
      ok: true,
      items: items.slice(0,limit),
      count: Math.min(items.length,limit),
      scanned: raw.length,
      queries: ['VC·벤처캐피탈','M&A·PEF','투자은행·회사채·자금조달','산업은행·국민연금·공제회·LP','펀드레이징·자산운용','SI·FI'],
      providers: { google_news_rss: settled.some((r)=>r.status==='fulfilled') },
      range: { days },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
