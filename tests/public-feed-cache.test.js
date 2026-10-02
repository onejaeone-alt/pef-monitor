'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../public-feed-cache');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const feed=title=>({ok:true,items:[{title,source_url:'https://example.test/article'}]});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};

test('public snapshots survive a page change, expire, remain bounded and refuse account keys',async()=>{
 const storage=memory();let now=1000;const options={storage,now:()=>now,maxAge:100,maxEntries:2};
 const a=create(options);await a.request('news:domestic:7',async()=>feed('domestic'));
 await a.request('news:foreign:7',async()=>feed('foreign'));await a.request('dart:3',async()=>feed('filings'));
 assert.equal(a.get('news:domestic:7'),null);
 const b=create(options);assert.equal(b.get('news:foreign:7').items[0].title,'foreign');assert.ok(b.get('dart:3'));
 await assert.rejects(b.request('news:reader:records',async()=>feed('private')),/Only public/);
 now+=101;assert.equal(b.get('dart:3'),null);
 const tiny=create({storage:null,maxBytes:50});await tiny.request('dart:3',async()=>feed('too large'));assert.equal(tiny.get('dart:3'),null);
});

test('concurrent readers share one request and aborting one reader leaves the other alive',async()=>{
 const cache=create({storage:null}),d=deferred(),a=new AbortController(),b=new AbortController();let calls=0,upstream;
 const fetcher=signal=>{calls++;upstream=signal;return d.promise;};
 const first=cache.request('news:domestic:7',fetcher,{signal:a.signal});
 const second=cache.request('news:domestic:7',fetcher,{signal:b.signal});
 await Promise.resolve();assert.equal(calls,1);a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(upstream.aborted,false);
 d.resolve(feed('shared'));assert.equal((await second).items[0].title,'shared');assert.ok(cache.get('news:domestic:7'));
});

test('aborted work cannot poison a later request even if its upstream ignores cancellation',async()=>{
 const cache=create({storage:null}),old=deferred(),next=deferred(),abort=new AbortController();let upstream;
 const first=cache.request('dart:3',signal=>{upstream=signal;return old.promise;},{signal:abort.signal});await Promise.resolve();abort.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(upstream.aborted,true);
 const second=cache.request('dart:3',()=>next.promise);next.resolve(feed('new'));await second;
 old.resolve(feed('old'));await Promise.resolve();await Promise.resolve();assert.equal(cache.get('dart:3').items[0].title,'new');
});

test('manual refresh is independent of an older request and late old completion cannot replace it',async()=>{
 const cache=create({storage:null}),old=deferred(),fresh=deferred();
 const first=cache.request('news:domestic:7',()=>old.promise);
 const second=cache.request('news:domestic:7',()=>fresh.promise,{fresh:true});
 const third=cache.request('news:domestic:7',()=>{throw Error('duplicate refresh');},{fresh:true});
 fresh.resolve(feed('fresh'));await Promise.all([second,third]);old.resolve(feed('old'));await first;
 assert.equal(cache.get('news:domestic:7').items[0].title,'fresh');
});
