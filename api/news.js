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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
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
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
