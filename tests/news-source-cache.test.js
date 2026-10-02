'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSourceCache } = require('../lib/news-source-cache');

function fixture(options = {}) {
  let time = Date.parse('2026-10-02T00:00:00Z');
  const cache = createSourceCache({ ttlMs: 100, maxStaleMs: 1000, retryMs: 50, ...options, now: () => time });
  return { cache, advance: ms => { time += ms; } };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function unexpectedLoad() {
  throw new Error('loader should not run');
}

test('normal requests share one load, reuse a fresh result, and reload after TTL', async () => {
  const { cache, advance } = fixture();
  const gate = deferred(), started = deferred();
  let calls = 0;
  const first = cache.get('rss', () => { calls++; started.resolve(); return gate.promise; });
  await started.promise;
  const joined = cache.get('rss', () => { calls++; return ['duplicate']; });
  assert.equal(cache.stats().inflight, 1);
  gate.resolve(['headline']);
  const [initial, shared] = await Promise.all([first, joined]);
  assert.equal(calls, 1);
  assert.deepEqual(shared.value, initial.value);
  assert.equal(initial.from_cache, false);
  assert.equal(initial.stale, false);
  assert.equal(initial.failed, false);
  assert.equal(cache.stats().inflight, 0);

  advance(99);
  const hit = await cache.get('rss', unexpectedLoad);
  assert.equal(hit.from_cache, true);
  assert.equal(hit.fetched_at, initial.fetched_at);
  assert.deepEqual(hit.value, ['headline']);
  advance(2);
  const refreshed = await cache.get('rss', () => { calls++; return ['new headline']; });
  assert.equal(calls, 2);
  assert.equal(refreshed.from_cache, false);
  assert.notEqual(refreshed.fetched_at, initial.fetched_at);
  assert.deepEqual(refreshed.value, ['new headline']);
});

test('fresh loads bypass stored data and normal in-flight work, but share other fresh loads', async () => {
  const { cache, advance } = fixture();
  await cache.get('rss', () => ['old']);
  const live = await cache.get('rss', () => ['live'], { fresh: true });
  assert.deepEqual(live.value, ['live']);
  assert.equal(live.from_cache, false);

  advance(101);
  const normalGate = deferred(), freshGate = deferred(), normalStarted = deferred(), freshStarted = deferred();
  let normalCalls = 0, freshCalls = 0, extraCalls = 0;
  const normal = cache.get('rss', () => { normalCalls++; normalStarted.resolve(); return normalGate.promise; });
  await normalStarted.promise;
  const fresh = cache.get('rss', () => { freshCalls++; freshStarted.resolve(); return freshGate.promise; }, { fresh: true });
  await freshStarted.promise;
  const freshJoin = cache.get('rss', () => { extraCalls++; return ['duplicate fresh']; }, { fresh: true });
  const ordinaryJoin = cache.get('rss', () => { extraCalls++; return ['duplicate normal']; });
  assert.equal(cache.stats().inflight, 2);
  normalGate.resolve(['normal result']);
  freshGate.resolve(['fresh result']);
  const [normalResult, freshResult, sharedFresh, sharedOrdinary] = await Promise.all([normal, fresh, freshJoin, ordinaryJoin]);
  assert.deepEqual(normalResult.value, ['normal result']);
  assert.deepEqual(freshResult.value, ['fresh result']);
  assert.deepEqual(sharedFresh.value, ['fresh result']);
  assert.ok(['normal result', 'fresh result'].includes(sharedOrdinary.value[0]));
  assert.equal(normalCalls, 1);
  assert.equal(freshCalls, 1);
  assert.equal(extraCalls, 0);
  assert.equal(cache.stats().inflight, 0);
});

test('a late older normal request cannot overwrite a completed fresh result or its healthy metadata', async () => {
  for (const fails of [false, true]) {
    const { cache, advance } = fixture();
    const oldGate = deferred(), oldStarted = deferred();
    const old = cache.get('rss', () => { oldStarted.resolve(); return oldGate.promise; });
    await oldStarted.promise;
    advance(10);
    const fresh = await cache.get('rss', () => ['newest'], { fresh: true });
    advance(10);
    if (fails) oldGate.reject(new Error('old request failed'));
    else oldGate.resolve(['older normal response']);
    await old;
    const hit = await cache.get('rss', unexpectedLoad);
    assert.deepEqual(hit.value, ['newest']);
    assert.equal(hit.fetched_at, fresh.fetched_at);
    assert.equal(hit.attempted_at, fresh.attempted_at);
    assert.equal(hit.failed, false);
    assert.equal(hit.stale, false);
  }
});

test('failure retains last-good freshness and failure metadata through cooldown; fresh retries immediately', async () => {
  const { cache, advance } = fixture();
  const good = await cache.get('rss', () => ['last good']);
  advance(101);
  let failures = 0;
  const failed = await cache.get('rss', () => { failures++; throw new Error('upstream unavailable'); });
  assert.deepEqual(failed.value, good.value);
  assert.equal(failed.from_cache, true);
  assert.equal(failed.failed, true);
  assert.equal(failed.stale, true);
  assert.equal(failed.fetched_at, good.fetched_at);
  assert.notEqual(failed.attempted_at, good.attempted_at);
  assert.ok(failed.error);

  advance(20);
  const paused = await cache.get('rss', () => { failures++; throw new Error('should be paused'); });
  assert.equal(failures, 1);
  assert.equal(paused.failed, true);
  assert.equal(paused.stale, true);
  assert.equal(paused.fetched_at, good.fetched_at);
  assert.equal(paused.attempted_at, failed.attempted_at);
  assert.equal(paused.error, failed.error);

  advance(31);
  const retried = await cache.get('rss', () => { failures++; throw new Error('still unavailable'); });
  assert.equal(failures, 2);
  assert.equal(retried.failed, true);
  assert.equal(retried.fetched_at, good.fetched_at);
  assert.notEqual(retried.attempted_at, failed.attempted_at);

  advance(1);
  const recovered = await cache.get('rss', () => ['recovered'], { fresh: true });
  assert.deepEqual(recovered.value, ['recovered']);
  assert.equal(recovered.failed, false);
  assert.equal(recovered.stale, false);
  assert.equal(recovered.from_cache, false);
  assert.notEqual(recovered.fetched_at, good.fetched_at);
  const hit = await cache.get('rss', unexpectedLoad);
  assert.equal(hit.failed, false);
  assert.equal(hit.stale, false);
});

test('stale data expires from its successful fetch time, even while a retry cooldown is active', async () => {
  const { cache, advance } = fixture({ maxStaleMs: 300, retryMs: 500 });
  const good = await cache.get('rss', () => ['last good']);
  advance(101);
  const stale = await cache.get('rss', () => { throw new Error('source down'); });
  assert.equal(stale.fetched_at, good.fetched_at);
  assert.equal(stale.stale, true);
  advance(200);
  await assert.rejects(cache.get('rss', () => { throw new Error('source still down'); }));
  assert.equal(cache.stats().inflight, 0);
});

test('failed initial loads are never stored, and a later successful request can populate the cache', async () => {
  const { cache } = fixture();
  let attempts = 0;
  const fail = () => { attempts++; throw new Error('source down'); };
  await assert.rejects(cache.get('rss', fail), /source down/);
  await assert.rejects(cache.get('rss', fail), /source down/);
  assert.equal(attempts, 2);
  assert.deepEqual(cache.stats(), { entries: 0, bytes: 0, inflight: 0 });
  const good = await cache.get('rss', () => ['recovered']);
  assert.equal(good.failed, false);
  assert.equal(cache.stats().entries, 1);
});

test('entry limit evicts the least recently used source, including recency from cache hits', async () => {
  const { cache } = fixture({ maxEntries: 2 });
  await cache.get('a', () => ['a']);
  await cache.get('b', () => ['b']);
  await cache.get('a', unexpectedLoad);
  await cache.get('c', () => ['c']);
  assert.equal(cache.stats().entries, 2);
  assert.deepEqual((await cache.get('a', unexpectedLoad)).value, ['a']);
  let bReloads = 0;
  const reloaded = await cache.get('b', () => { bReloads++; return ['new b']; });
  assert.equal(bReloads, 1);
  assert.equal(reloaded.from_cache, false);
  assert.equal(cache.stats().entries, 2);
});

test('total-byte and per-value limits bound retained data without dropping successful oversized results', async () => {
  const { cache } = fixture({ maxEntries: 10, maxBytes: 90, maxValueBytes: 60 });
  for (const key of ['a', 'b', 'c', 'd']) {
    const result = await cache.get(key, () => key.repeat(30));
    assert.equal(result.value, key.repeat(30));
    assert.ok(cache.stats().bytes <= 90);
    assert.ok(cache.stats().entries <= 2);
  }
  assert.deepEqual((await cache.get('d', unexpectedLoad)).value, 'd'.repeat(30));
  const before = cache.stats();
  let oversizedCalls = 0;
  for (let i = 0; i < 2; i++) {
    const oversized = await cache.get('oversized', () => { oversizedCalls++; return 'x'.repeat(61); });
    assert.equal(oversized.value, 'x'.repeat(61));
    assert.equal(oversized.from_cache, false);
    assert.equal(oversized.failed, false);
  }
  assert.equal(oversizedCalls, 2);
  assert.deepEqual(cache.stats(), before);

  const totalOnly = fixture({ maxBytes: 20, maxValueBytes: 100 }).cache;
  assert.equal((await totalOnly.get('too-large-for-total', () => 'x'.repeat(30))).value.length, 30);
  assert.deepEqual(totalOnly.stats(), { entries: 0, bytes: 0, inflight: 0 });
});

test('in-flight cap rejects new uncached work, serves marked stale data, and still allows joining existing work', async () => {
  const { cache, advance } = fixture({ maxInflight: 1 });
  const good = await cache.get('stale', () => ['saved']);
  advance(101);
  const gate = deferred(), started = deferred();
  const busy = cache.get('busy', () => { started.resolve(); return gate.promise; });
  await started.promise;
  const joined = cache.get('busy', unexpectedLoad);
  let blockedLoads = 0;
  const blocked = () => { blockedLoads++; throw new Error('blocked loader should not run'); };
  await assert.rejects(cache.get('uncached', blocked));
  const stale = await cache.get('stale', blocked);
  assert.equal(blockedLoads, 0);
  assert.deepEqual(stale.value, ['saved']);
  assert.equal(stale.from_cache, true);
  assert.equal(stale.stale, true);
  assert.equal(stale.failed, true);
  assert.equal(stale.fetched_at, good.fetched_at);
  assert.equal(cache.stats().inflight, 1);
  gate.resolve(['loaded']);
  assert.deepEqual((await busy).value, ['loaded']);
  assert.deepEqual((await joined).value, ['loaded']);
  assert.equal(cache.stats().inflight, 0);
  assert.deepEqual((await cache.get('uncached', () => ['next'])).value, ['next']);
});
