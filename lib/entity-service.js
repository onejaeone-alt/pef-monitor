const GRAPH_TTL_MS = 60 * 1000;
const ENRICHMENT_TTL_MS = 10 * 60 * 1000;

// Cache only successful work. Sharing the pending promise prevents parallel
// dossier cards from repeating the same database or provider request.
function memoizeAsync(loader, { ttlMs, now, maxEntries = 80, cacheable = () => true }) {
  const values = new Map();
  const pending = new Map();
  return (key, ...args) => {
    const cached = values.get(key);
    if (cached && now() - cached.at < ttlMs) return Promise.resolve(cached.value);
    if (pending.has(key)) return pending.get(key);
    const task = Promise.resolve().then(() => loader(key, ...args)).then((value) => {
      if (cacheable(value)) {
        values.delete(key);
        values.set(key, { value, at: now() });
        while (values.size > maxEntries) values.delete(values.keys().next().value);
      }
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}

function createEntityService({
  loadRecentReportingLeads, buildGraph, buildEntityDossier, applyBasicInfo,
  fetchLatestEntityNews, getNuguMoneyProfile, now = Date.now,
  graphTtlMs = GRAPH_TTL_MS, enrichmentTtlMs = ENRICHMENT_TTL_MS,
}) {
  const timestamp = () => new Date(now()).toISOString();
  const graph = memoizeAsync(async () => {
    let items = [];
    let available = true;
    try { items = await loadRecentReportingLeads(14); }
    catch { available = false; }
    // Collection and ontology persistence belong to the collection/ontology
    // endpoints. A read must still show curated/Drive files if storage is empty.
    return {
      graph: buildGraph(items || []), dossiers: new Map(),
      reportingLeads: available ? (items?.length ? 'stored' : 'empty') : 'unavailable',
      fetchedAt: timestamp(),
    };
  }, { ttlMs: graphTtlMs, now, maxEntries: 1, cacheable: (value) => value.reportingLeads !== 'unavailable' });

  async function base(entityKey) {
    const snapshot = await graph('recent');
    if (snapshot.dossiers.has(entityKey)) return snapshot.dossiers.get(entityKey);
    const dossier = buildEntityDossier(snapshot.graph, entityKey);
    if (!dossier) return null;
    const data = {
      ok: true, ...applyBasicInfo(dossier), nugu_money: null,
      storage: { mode: 'read-only' }, range: { days: 14 },
      enrichment: {
        news: 'pending',
        profile: ['pef', 'vc', 'ac'].includes(dossier.entity?.entity_type) ? 'pending' : 'not_applicable',
        reporting_leads: snapshot.reportingLeads,
      },
      fetched_at: snapshot.fetchedAt,
    };
    snapshot.dossiers.set(entityKey, data);
    while (snapshot.dossiers.size > 80) snapshot.dossiers.delete(snapshot.dossiers.keys().next().value);
    return data;
  }

  const fetchNews = memoizeAsync(async (entityKey, dossier) => {
    if (!dossier) return null;
    const rows = await fetchLatestEntityNews(dossier.entity, { existing: dossier.related_news, limit: 5 });
    return { related_news: rows, latest_news_ready: true, latest_news_checked_at: timestamp() };
  }, { ttlMs: enrichmentTtlMs, now, cacheable: Boolean });

  const fetchProfile = memoizeAsync(async (entityKey, dossier) => {
    if (!dossier) return null;
    const profile = ['pef', 'vc', 'ac'].includes(dossier.entity?.entity_type)
      ? await getNuguMoneyProfile(dossier.entity.canonical_name, { reviewLimit: 3 }) : null;
    return { nugu_money: profile, profile_ready: profile === null || profile.ready !== false };
  }, { ttlMs: enrichmentTtlMs, now, cacheable: (value) => value?.profile_ready });

  async function news(entityKey, dossier = null) {
    dossier = dossier || await base(entityKey);
    if (!dossier) return null;
    try { return await fetchNews(entityKey, dossier); }
    catch {
      return { related_news: (dossier.related_news || []).slice(0, 5), latest_news_ready: false };
    }
  }

  async function profile(entityKey, dossier = null) {
    dossier = dossier || await base(entityKey);
    if (!dossier) return null;
    try { return await fetchProfile(entityKey, dossier); }
    catch {
      return {
        profile_ready: false,
        nugu_money: { ready: false, found: false, provider: '누구머니', source_url: 'https://nugu.money/', error: '현재 누구머니 정보를 불러오지 못했습니다.' },
      };
    }
  }

  async function full(entityKey) {
    const dossier = await base(entityKey);
    if (!dossier) return null;
    const [latestNews, nuguProfile] = await Promise.all([news(entityKey, dossier), profile(entityKey, dossier)]);
    return {
      ...dossier, ...latestNews, ...nuguProfile,
      enrichment: {
        ...dossier.enrichment,
        news: latestNews.latest_news_ready ? 'ready' : 'unavailable',
        profile: nuguProfile.profile_ready ? 'ready' : 'unavailable',
      },
    };
  }

  return { base, news, profile, full };
}

module.exports = { createEntityService };
