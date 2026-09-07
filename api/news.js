const { parseGoogleNewsRss } = require('../lib/context-sources');
const { findWatchTarget, WATCH_TARGETS } = require('../lib/watch-config');
const { matchDossiersInText } = require('../lib/drive-dossiers');
const { fetchJakMembers } = require('../lib/jak-members');
const {
  clusterIssues,
  eventLabel,
  queries,
  shouldKeep,
  theme,
} = require('../lib/news-monitor');

const GOOGLE_NEWS_URL = 'https://news.google.com/rss/search';

function googleNewsUrl(query) {
  const params = new URLSearchParams({ q: query, hl: 'ko', gl: 'KR', ceid: 'KR:ko' });
  return `${GOOGLE_NEWS_URL}?${params}`;
}

async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'IB-News-Monitor/5.0' } });
    if (!response.ok) throw new Error(`News HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTitle(value) {
  return String(value || '').toLowerCase().replace(/[^0-9a-z가-힣]/g,'').slice(0,160);
}

function ageHours(value) {
  const time = new Date(value || '').getTime();
  if (!Number.isFinite(time)) return Infinity;
  return Math.max(0, (Date.now() - time) / 3600000);
}

function cssString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function relativeTime(value) {
  const time = new Date(value || '').getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function tickerText(item) {
  const source = cssString(item?.source_name || '뉴스');
  const title = cssString(item?.title || '');
  const time = cssString(relativeTime(item?.published_at));
  return `최신뉴스  [${source}] ${title}${time ? `  ·  ${time}` : ''}`;
}

function tickerCss(items) {
  const rows = (items || []).slice(0, 10);
  const fallback = '최신뉴스  새 기사를 불러오는 중입니다.';
  const secondsPerItem = 2.8;
  const duration = Math.max(secondsPerItem, rows.length * secondsPerItem);
  const frames = rows.length ? rows.map((item, index) => {
    const unit = 100 / rows.length;
    const start = index * unit;
    const enter = start + unit * 0.14;
    const hold = start + unit * 0.78;
    const exit = start + unit - 0.001;
    const text = cssString(tickerText(item));
    return `${start.toFixed(3)}%{content:"${text}";text-indent:22px;color:rgba(255,255,255,0)}${enter.toFixed(3)}%{content:"${text}";text-indent:0;color:#fff}${hold.toFixed(3)}%{content:"${text}";text-indent:0;color:#fff}${exit.toFixed(3)}%{content:"${text}";text-indent:-34px;color:rgba(255,255,255,0)}`;
  }).join('') : `0%,100%{content:"${fallback}";text-indent:0;color:#fff}`;
  const initial = rows.length ? tickerText(rows[0]) : fallback;

  return `
.topbar::before{content:"${cssString(initial)}";display:block;margin:-18px -26px 7px;padding:3px 22px;height:27px;line-height:21px;background:#0a0a0a;border-bottom:1px solid #222;color:#fff;font-size:10.5px;font-weight:760;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:ibLatestTicker ${duration}s linear infinite;will-change:text-indent,color}
@keyframes ibLatestTicker{${frames}}
@media(max-width:760px){.topbar::before{margin:-18px -14px 6px;padding:3px 14px;height:26px;line-height:20px;font-size:10px}}
@media(prefers-reduced-motion:reduce){.topbar::before{animation:none!important}}
`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const format = String(req.query.format || '').toLowerCase();
  res.setHeader('Cache-Control', format === 'ticker-css' ? 's-maxage=60, stale-while-revalidate=120' : 's-maxage=600, stale-while-revalidate=1800');
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || '7', 10), 1), 14);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '240', 10), 40), 500);
    const queryList = queries(days);
    const [jak, settled] = await Promise.all([
      fetchJakMembers(),
      Promise.allSettled(queryList.map(async (q) => {
        const xml = await fetchText(googleNewsUrl(q));
        return parseGoogleNewsRss(xml, 'domestic', 'ko');
      })),
    ]);

    const raw = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const seenUrl = new Set(), seenTitle = new Set(), items = [];

    for (const item of raw) {
      const cleanUrl = String(item.source_url || '').replace(/[?#].*$/,'');
      const key = normalizeTitle(item.title);
      if (!cleanUrl || !key || seenUrl.has(cleanUrl) || seenTitle.has(key)) continue;
      seenUrl.add(cleanUrl); seenTitle.add(key);

      const text = `${item.title} ${item.snippet || ''}`;
      const target = findWatchTarget(text, WATCH_TARGETS);
      const relatedEntities = matchDossiersInText(text, 6);
      if (!shouldKeep(item, target, jak.names)) continue;
      const [theme_id, theme_label] = theme(text);
      items.push({
        signal_id: `${Date.parse(item.published_at || 0)}-${items.length}`,
        published_at: item.published_at,
        source_type: 'domestic_news',
        source_name: item.source_name,
        title: item.title,
        source_url: item.source_url,
        snippet: item.snippet || '',
        target: target ? { id: target.id, name: target.name, category: target.category } : null,
        related_entities: relatedEntities,
        theme_id,
        theme_label,
        event_label: eventLabel(text),
        jak_member: true,
      });
    }

    items.sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
    const limitedItems = items.slice(0,limit);

    if (format === 'ticker-css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.status(200).send(tickerCss(limitedItems));
    }

    const issues = clusterIssues(limitedItems);
    const ongoing = issues.filter((issue)=>issue.ongoing).slice(0,30);
    const newIssues = issues.filter((issue)=>!issue.ongoing && ageHours(issue.latest_seen) <= 30).slice(0,40);
    const recentIssues = issues.filter((issue)=>!ongoing.includes(issue) && !newIssues.includes(issue)).slice(0,80);
    const latest24h = limitedItems.filter((item)=>ageHours(item.published_at) <= 24).length;

    return res.status(200).json({
      ok: true,
      items: limitedItems,
      issues,
      sections: {
        ongoing,
        new_issues: newIssues,
        recent: recentIssues,
      },
      stats: {
        scanned: raw.length,
        kept: limitedItems.length,
        issue_count: issues.length,
        ongoing_count: ongoing.length,
        new_issue_count: newIssues.length,
        latest_24h: latest24h,
      },
      source_policy: {
        name: '한국기자협회 회원사',
        member_count: jak.count,
        member_source: jak.source,
      },
      queries: queryList.length,
      providers: { google_news_rss: settled.some((r)=>r.status==='fulfilled'), jak_members: jak.source === 'official' },
      range: { days },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    if (format === 'ticker-css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.status(200).send('.topbar::before{content:"최신뉴스  불러오지 못했습니다";display:block;margin:-18px -26px 7px;padding:3px 22px;height:27px;line-height:21px;background:#0a0a0a;border-bottom:1px solid #222;color:#fff;font-size:10.5px;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
    }
    return res.status(500).json({ ok: false, error:String(error.message||error) });
  }
};