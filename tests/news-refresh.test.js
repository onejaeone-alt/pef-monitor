const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createSourceCache } = require('../lib/news-source-cache');
// Run the actual handler with deterministic upstream stubs; no network or database writes.
async function run(query, failures = 0) {
  const requests = [];
  let offline=false, memberRequests=0,bodyOverride;
  const dependencies = {
    '../lib/context-sources': { parseGoogleNewsRss: value => JSON.parse(value.match(/<fixture>([\s\S]*?)<\/fixture>/)?.[1]||'[]') },
    '../lib/domestic-publisher-feeds': { fetchPublisherFeeds: async () => ({ items: [], succeeded: 0, failed: 0, total: 4 }) },
    '../lib/watch-config': { findWatchTarget: () => null, WATCH_TARGETS: [] },
    '../lib/drive-dossiers': { matchDossiersInText: () => [] },
    '../lib/jak-members': { fetchJakMembers: async () => {memberRequests++;return { names: [], count: 1, source: 'official' };}, isJakMemberSource: () => true },
    '../lib/news-source-cache': { createSourceCache },
    '../lib/news-monitor': { queries: days => [`first when:${days}d`, `second when:${days}d`],
      clusterIssues: () => [], eventLabel: () => '투자', theme: () => ['vc','VC'], shouldKeep: () => true },
  };
  const sandbox = { module: { exports: {} }, require: name => {
    assert.ok(Object.hasOwn(dependencies,name)); return dependencies[name];
  }, URLSearchParams, AbortController, setTimeout, clearTimeout, Date,
  fetch: async (url, options) => {
    requests.push({url,options});
    if (offline || requests.length <= failures) throw new Error('offline');
    return { ok: true, text: async () => bodyOverride??'<rss><channel><fixture>'+JSON.stringify([{title:'테스트 투자유치',source_url:'https://example.test/item',source_name:'테스트',published_at:new Date().toISOString()}])+'</fixture></channel></rss>' };
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/news.js'),'utf8'),sandbox);
  async function request(nextQuery) {
  const res = { headers: {}, code: 0, body: null,
    setHeader(k,v){this.headers[k.toLowerCase()]=v;}, status(code){this.code=code;return this;},
    json(body){this.body=body;return this;},send(body){this.body=body;return this;} };
  await sandbox.module.exports({ query:nextQuery }, res);
  return res;
  }
  return {res:await request(query), requests, request, goOffline(){offline=true;}, setBody(value){bodyOverride=value;},memberRequests:()=>memberRequests};
}
test('explicit refresh disables browser and both CDN caches', async()=>{
  const {res}=await run({refresh:'1',days:'1'});
  assert.equal(res.code,200);
  for(const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.match(res.headers[header],/no-store/);
  assert.equal(res.headers['x-news-refresh'],'live');
  assert.equal(res.body.collection_status.refresh,true);
});
test('explicit refresh reaches the source with no-store and retains range',async()=>{
  const {requests,res}=await run({refresh:'1',days:'1',_r:'unique'});
  assert.equal(requests.length,2);
  for(const {url,options} of requests){assert.equal(options.cache,'no-store');assert.equal(options.headers['Cache-Control'],'no-cache');assert.match(new URL(url).searchParams.get('q'),/when:1d/);assert.ok(!url.includes('unique'));}
  assert.equal(res.body.range.days,1);
});
test('ordinary public loading retains short shared cache',async()=>{
  const {res,requests}=await run({days:'7'});
  assert.equal(res.headers['cache-control'],'s-maxage=60, stale-while-revalidate=120');
  assert.equal(requests[0].options.cache,'default');
});
test('upstream total failure is not a cached success or empty news result',async()=>{
  const {res}=await run({refresh:'1'},2);
  assert.equal(res.code,500);assert.equal(res.body.ok,false);assert.match(res.headers['cache-control'],/no-store/);
});
test('useful partial collection is disclosed and briefly cached',async()=>{
  const {res}=await run({},1);
  assert.equal(res.code,200);assert.equal(res.body.collection_status.partial,true);assert.equal(res.body.collection_status.failed,1);assert.equal(res.headers['cache-control'],'s-maxage=15, stale-while-revalidate=30');
});
test('ordinary repeated requests reuse source data and preserve its collection time',async()=>{
  const fixture=await run({days:'7'}),second=await fixture.request({days:'7'});
  assert.equal(fixture.requests.length,2);
  assert.equal(fixture.memberRequests(),1);
  assert.equal(second.body.fetched_at,fixture.res.body.fetched_at);
  assert.equal(second.body.collection_status.cached_sources,2);
  assert.equal(second.body.collection_status.stale_sources,0);
});
test('explicit refresh recollects each source and marks last-good data honestly on failure',async()=>{
  const fixture=await run({days:'7'});
  fixture.goOffline();
  const failedRefresh=await fixture.request({days:'7',refresh:'1'});
  assert.equal(fixture.requests.length,4);
  assert.equal(fixture.memberRequests(),2);
  for(const request of fixture.requests.slice(2)) assert.equal(request.options.cache,'no-store');
  assert.equal(failedRefresh.code,200);
  assert.equal(failedRefresh.body.items.length,1);
  assert.equal(failedRefresh.body.collection_status.partial,true);
  assert.equal(failedRefresh.body.collection_status.succeeded,0);
  assert.equal(failedRefresh.body.collection_status.failed,2);
  assert.equal(failedRefresh.body.collection_status.stale_sources,2);
  assert.equal(failedRefresh.body.fetched_at,fixture.res.body.fetched_at);
  assert.match(failedRefresh.headers['cache-control'],/no-store/);
  const normal=await fixture.request({days:'7'});
  assert.equal(fixture.requests.length,4);
  assert.equal(normal.body.collection_status.partial,true);
  assert.equal(normal.body.collection_status.stale_sources,2);
  assert.equal(normal.headers['cache-control'],'s-maxage=15, stale-while-revalidate=30');
});
test('HTTP 200 HTML cannot overwrite last-good news, but a valid empty RSS channel can',async()=>{
  const fixture=await run({days:'7'});
  fixture.setBody('<html><body>Service unavailable</body></html>');
  const invalid=await fixture.request({days:'7',refresh:'1'});
  assert.equal(invalid.body.items.length,1);
  assert.equal(invalid.body.collection_status.stale_sources,2);
  assert.equal(invalid.body.fetched_at,fixture.res.body.fetched_at);
  fixture.setBody('<rss><channel></channel></rss>');
  const empty=await fixture.request({days:'7',refresh:'1'});
  assert.equal(empty.code,200);
  assert.equal(empty.body.items.length,0);
  assert.equal(empty.body.collection_status.partial,false);
  assert.equal(empty.body.collection_status.stale_sources,0);
});
test('invalid numeric parameters cannot produce NaN source requests',async()=>{
  const {res,requests}=await run({days:'NaN',limit:'bad'});
  assert.equal(res.body.range.days,7);assert.match(requests[0].url,/when%3A7d/);
});
test('ticker mode still returns CSS',async()=>{
  const {res}=await run({format:'ticker-css',days:'1'});
  assert.match(res.headers['content-type'],/text\/css/);assert.match(res.body,/ibLatestTicker/);
});
