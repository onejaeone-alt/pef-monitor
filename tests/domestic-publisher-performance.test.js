'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fetchPublisherFeeds}=require('../lib/domestic-publisher-feeds');
const {createSourceCache}=require('../lib/news-source-cache');
const now=Date.parse('2026-10-02T01:00:00Z');
const rss='<rss><channel><item><title>기업 매각 추진</title><link>https://www.hankyung.com/article/2026100212345</link><pubDate>Fri, 02 Oct 2026 01:00:00 GMT</pubDate></item></channel></rss>';
const sitemap='<html><main><a href="/article/2026100212346">펀드 출자사업 공고</a></main></html>';
function fixture() {
  const requests=[];
  let failure=false,invalid=false,emptyRss=false;
  const options={days:1,now,sourceCache:createSourceCache(),fetchFn:async(url,options)=>{
    requests.push({url,options});
    if(failure) throw new Error('offline');
    return {ok:true,text:async()=>invalid?'<html>Temporarily unavailable</html>':url.includes('/feed/')?(emptyRss?'<rss><channel></channel></rss>':rss):sitemap};
  }};
  return {requests,options,fail(){failure=true;},invalid(){invalid=true;},empty(){emptyRss=true;}};
}
test('RSS and sitemap requests start independently before a blocked RSS response resolves',async()=>{
  const started=[];let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const result=fetchPublisherFeeds({days:1,now,sourceCache:createSourceCache(),fetchFn:async url=>{
    started.push(url);
    if(url.includes('/feed/'))await gate;
    return {ok:true,text:async()=>url.includes('/feed/')?rss:sitemap};
  }});
  await new Promise(resolve=>setImmediate(resolve));
  const sitemapStarted=started.some(url=>url.includes('/sitemap/'));
  release();
  const response=await result;
  assert.equal(sitemapStarted,true);
  assert.equal(started.length,5);
  assert.equal(response.succeeded,5);
});
test('normal publisher reads reuse sources while refresh fetches every source with no-store',async()=>{
  const f=fixture();
  const first=await fetchPublisherFeeds(f.options),second=await fetchPublisherFeeds(f.options);
  assert.equal(f.requests.length,5);
  assert.equal(second.source_status.every(source=>source.from_cache),true);
  assert.deepEqual(second.source_status.map(source=>source.fetched_at),first.source_status.map(source=>source.fetched_at));
  await fetchPublisherFeeds({...f.options,fresh:true});
  assert.equal(f.requests.length,10);
  for(const request of f.requests.slice(5)) {
    assert.equal(request.options.cache,'no-store');
    assert.equal(request.options.headers['Cache-Control'],'no-cache');
  }
});
test('HTTP 200 error pages retain marked last-good source data and original collection times',async()=>{
  const f=fixture(),first=await fetchPublisherFeeds(f.options);
  f.invalid();
  const failed=await fetchPublisherFeeds({...f.options,fresh:true});
  assert.equal(failed.failed,5);
  assert.equal(failed.succeeded,0);
  assert.equal(failed.available,5);
  assert.deepEqual(failed.items,first.items);
  assert.equal(failed.source_status.every(source=>source.failed&&source.stale),true);
  assert.deepEqual(failed.source_status.map(source=>source.fetched_at),first.source_status.map(source=>source.fetched_at));
});
test('valid empty RSS is accepted and an uncached complete failure cannot become an empty success',async()=>{
  const f=fixture();f.empty();
  const empty=await fetchPublisherFeeds(f.options);
  assert.equal(empty.succeeded,5);
  assert.equal(empty.items.length,1);
  const failedFixture=fixture();failedFixture.fail();
  const failed=await fetchPublisherFeeds(failedFixture.options);
  assert.equal(failed.succeeded,0);
  assert.equal(failed.available,0);
  assert.equal(failed.failed,5);
  assert.deepEqual(failed.items,[]);
  assert.equal(failedFixture.options.sourceCache.stats().entries,0);
});
