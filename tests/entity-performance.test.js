const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createEntityService } = require('../lib/entity-service');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const storedNews = { title: '저장된 투자 기사', source_url: 'https://example.com/stored', published_at: '2026-10-01' };
function fixture(overrides = {}) {
  return createEntityService({
    loadRecentReportingLeads: async () => [storedNews],
    buildGraph: (items) => ({ items }),
    buildEntityDossier: (graph, key) => key === 'missing' ? null : ({
      entity: { entity_key: key, canonical_name: key, entity_type: 'pef' },
      related_news: graph.items, relations: [{ counterpart_name: '기존 관계' }],
      profile_overview: { founded_year: '2000년' },
    }),
    applyBasicInfo: (data) => data,
    fetchLatestEntityNews: async () => [storedNews],
    getNuguMoneyProfile: async () => ({ ready: true, found: true }),
    ...overrides,
  });
}

test('base dossier shares stored-data reads across cards and never waits for external providers', async () => {
  const stored = deferred();
  let databaseReads = 0;
  let newsReads = 0;
  let profileReads = 0;
  const service = fixture({
    loadRecentReportingLeads: () => { databaseReads++; return stored.promise; },
    fetchLatestEntityNews: () => { newsReads++; return new Promise(() => {}); },
    getNuguMoneyProfile: () => { profileReads++; return new Promise(() => {}); },
  });
  const first = service.base('firm-a');
  const second = service.base('firm-b');
  await tick();
  assert.equal(databaseReads, 1);
  stored.resolve([storedNews]);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.entity.canonical_name, 'firm-a');
  assert.equal(b.entity.canonical_name, 'firm-b');
  assert.equal(a.related_news[0].title, storedNews.title);
  assert.equal(a.relations[0].counterpart_name, '기존 관계');
  assert.equal(newsReads, 0);
  assert.equal(profileReads, 0);
});

test('news and profile enrichment run independently, share pending work and refresh after TTL', async () => {
  let now = 1000;
  let newsReads = 0;
  let profileReads = 0;
  const pendingNews = deferred();
  const pendingProfile = deferred();
  const service = fixture({
    now: () => now, graphTtlMs: 10, enrichmentTtlMs: 100,
    fetchLatestEntityNews: () => { newsReads++; return pendingNews.promise; },
    getNuguMoneyProfile: () => { profileReads++; return pendingProfile.promise; },
  });
  const first = service.news('firm');
  const second = service.news('firm');
  const profile = service.profile('firm');
  await tick();
  assert.equal(newsReads, 1);
  assert.equal(profileReads, 1);
  pendingNews.resolve([{ title: '최신 기사' }]);
  assert.equal((await first).related_news[0].title, '최신 기사');
  assert.deepEqual(await first, await second);
  assert.equal((await service.base('firm')).related_news[0].title, storedNews.title, 'enrichment must not mutate the stored base');
  await service.news('firm');
  assert.equal(newsReads, 1);
  now += 101;
  await service.news('firm');
  assert.equal(newsReads, 2);
  pendingProfile.resolve({ ready: true, found: true });
  assert.equal((await profile).profile_ready, true);
});

test('provider failures retain saved news and can retry without a cached failure', async () => {
  let newsReads = 0;
  const service = fixture({
    fetchLatestEntityNews: async () => {
      newsReads++;
      if (newsReads === 1) throw new Error('temporary provider failure');
      return [{ title: '회복한 기사' }];
    },
  });
  const failed = await service.news('firm');
  assert.equal(failed.latest_news_ready, false);
  assert.equal(failed.related_news[0].title, storedNews.title);
  const recovered = await service.news('firm');
  assert.equal(recovered.latest_news_ready, true);
  assert.equal(recovered.related_news[0].title, '회복한 기사');
  assert.equal(newsReads, 2);
});

test('empty or failed stored-data reads still show curated files, with accurate status and retry', async () => {
  let attempts = 0;
  const service = fixture({ loadRecentReportingLeads: async () => {
    attempts++;
    if (attempts === 1) throw new Error('storage unavailable');
    return [];
  } });
  const fallback = await service.base('firm');
  assert.equal(fallback.enrichment.reporting_leads, 'unavailable');
  assert.equal(fallback.profile_overview.founded_year, '2000년');
  assert.equal((await service.base('firm')).enrichment.reporting_leads, 'empty');
  assert.equal(attempts, 2);
  assert.equal(await service.base('missing'), null);
});

function browserFixture(fetch) {
  const content = { innerHTML: '' };
  const drawer = { scrollTop: 0 };
  const backdrop = { hidden: true, querySelector: () => drawer };
  const document = {
    getElementById: (id) => id === 'newsDossierBackdrop' ? backdrop : id === 'newsDossier' ? content : null,
    addEventListener() {}, body: { style: {} },
  };
  const context = { window: {}, document, fetch, Map, Date, Promise };
  vm.runInNewContext(fs.readFileSync(require.resolve('../dossier-drawer.js'), 'utf8'), context);
  return { api: context.window.DossierDrawer, content, backdrop };
}
function response(body) { return { ok: true, json: async () => ({ ok: true, ...body }) }; }
function basePayload(key) {
  return { entity: { canonical_name: key }, profile_overview: { founded_year: '2000년' }, related_news: [storedNews], enrichment: { news: 'pending', profile: 'pending' } };
}

test('drawer displays saved file before either enrichment finishes; late data cannot overwrite next selection', async () => {
  const pending = new Map();
  const calls = [];
  const browser = browserFixture(async (url) => {
    calls.push(url);
    const query = new URL(url, 'https://example.com').searchParams;
    const key = query.get('entity_key');
    const part = query.get('action');
    if (part === 'base') return response(basePayload(key));
    const job = deferred();
    pending.set(`${key}:${part}`, job);
    return job.promise;
  });
  await Promise.all([browser.api.open('firm-a'), browser.api.load('firm-a')]);
  assert.match(browser.content.innerHTML, /firm-a/);
  assert.match(browser.content.innerHTML, /2000년/);
  assert.equal(calls.filter((url) => url.includes('action=base')).length, 1);
  await tick();
  await browser.api.open('firm-b');
  await tick();
  pending.get('firm-a:news').resolve(response({ latest_news_ready: true, related_news: [{ title: 'A의 뒤늦은 뉴스' }] }));
  pending.get('firm-a:profile').resolve(response({ profile_ready: true, nugu_money: null }));
  await tick();
  assert.match(browser.content.innerHTML, /firm-b/);
  assert.doesNotMatch(browser.content.innerHTML, /A의 뒤늦은 뉴스/);
  pending.get('firm-b:news').resolve(response({ latest_news_ready: true, related_news: [{ title: 'B의 최신뉴스' }] }));
  pending.get('firm-b:profile').resolve(response({ profile_ready: true, nugu_money: null }));
  await tick();
  assert.match(browser.content.innerHTML, /B의 최신뉴스/);
});

test('drawer shares enrichment requests, preserves base on failure and retries', async () => {
  let attempts = 0;
  const browser = browserFixture(async (url) => {
    if (url.includes('action=base')) return response(basePayload('firm'));
    attempts++;
    if (attempts === 1) throw new Error('temporary network error');
    return response({ latest_news_ready: true, related_news: [{ title: '재시도 성공' }] });
  });
  const failed = await Promise.allSettled([browser.api.loadRelatedNews('firm'), browser.api.loadRelatedNews('firm')]);
  assert.equal(failed[0].status, 'rejected');
  assert.equal(failed[1].status, 'rejected');
  assert.equal(attempts, 1);
  assert.equal((await browser.api.load('firm')).related_news[0].title, storedNews.title);
  assert.ok((await browser.api.loadRelatedNews('firm')).related_news.some((row) => row.title === '재시도 성공'));
  assert.equal(attempts, 2);
});
