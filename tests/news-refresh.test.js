const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
// Run the actual handler with deterministic upstream stubs; no network or database writes.
async function run(query, failures = 0) {
  const requests = [];
  const dependencies = {
    '../lib/context-sources': { parseGoogleNewsRss: value => JSON.parse(value) },
    '../lib/domestic-publisher-feeds': { fetchPublisherFeeds: async () => ({ items: [], succeeded: 0, failed: 0, total: 4 }) },
    '../lib/watch-config': { findWatchTarget: () => null, WATCH_TARGETS: [] },
    '../lib/drive-dossiers': { matchDossiersInText: () => [] },
    '../lib/jak-members': { fetchJakMembers: async () => ({ names: [], count: 1, source: 'official' }), isJakMemberSource: () => true },
    '../lib/news-monitor': { queries: days => [`first when:${days}d`, `second when:${days}d`],
      clusterIssues: () => [], eventLabel: () => '투자', hardExcludeFromRadar: () => false, theme: () => ['vc','VC'], shouldKeep: () => true },
  };
  const sandbox = { module: { exports: {} }, require: name => {
    assert.ok(Object.hasOwn(dependencies,name)); return dependencies[name];
  }, URLSearchParams, AbortController, setTimeout, clearTimeout, Date,
  fetch: async (url, options) => {
    requests.push({url,options});
    if (requests.length <= failures) throw new Error('offline');
    return { ok: true, text: async () => JSON.stringify([{title:'테스트 투자유치',source_url:'https://example.test/item',source_name:'테스트',published_at:'2026-09-08T00:00:00Z'}]) };
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/news.js'),'utf8'),sandbox);
  const res = { headers: {}, code: 0, body: null,
    setHeader(k,v){this.headers[k.toLowerCase()]=v;}, status(code){this.code=code;return this;},
    json(body){this.body=body;return this;},send(body){this.body=body;return this;} };
  await sandbox.module.exports({ query }, res);
  return {res, requests};
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
test('partial collection is disclosed and not cached',async()=>{
  const {res}=await run({},1);
  assert.equal(res.code,200);assert.equal(res.body.collection_status.partial,true);assert.equal(res.body.collection_status.failed,1);assert.match(res.headers['cache-control'],/no-store/);
});
test('invalid numeric parameters cannot produce NaN source requests',async()=>{
  const {res,requests}=await run({days:'NaN',limit:'bad'});
  assert.equal(res.body.range.days,7);assert.match(requests[0].url,/when%3A7d/);
});
test('ticker mode still returns CSS',async()=>{
  const {res}=await run({format:'ticker-css',days:'1'});
  assert.match(res.headers['content-type'],/text\/css/);assert.match(res.body,/ibLatestTicker/);
});
