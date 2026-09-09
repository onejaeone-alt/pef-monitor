const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../scripts/integrate-site-header');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'site-header.css'), 'utf8');
const nav = '<nav class="nav"><a href="/">뉴스</a><a href="/dart.html">DART 공시</a><a href="/motae.html">출자공고</a><a href="/leads.html">AI 발견</a><a href="/projects.html">진행중 취재</a><a href="/judgment.html">기사화 판단</a><a class="engine-link" href="https://article-engine-wjy-onejess.vercel.app/">기사 엔진 ↗</a></nav>';
const source = '<html><head><link rel="stylesheet" href="/site-header.css?v=old"></head><body><header class="topbar"><div class="brand"><h1>IB 취재 레이더</h1></div>' + nav + '</header><main>UNCHANGED</main></body></html>';

test('main navigation overrides legacy compact font size without changing body text', () => {
  const rules = [...css.matchAll(/\.topbar\[data-site-header\] \.nav > a\s*\{([^}]*)\}/g)].map(m => m[1]);
  assert.ok(rules.length >= 2);
  assert.match(rules[0], /font-size:1rem !important/);
  assert.match(rules[0], /min-height:48px/);
  assert.match(rules[0], /padding:11px 16px !important/);
  assert.ok(rules.slice(1).every(rule => !/font-size:/.test(rule)), 'Narrow screens must not shrink tab text');
  assert.match(rules.at(-1), /min-height:44px/);
});

test('long menu labels stay whole and the navigation scrolls rather than shrinking', () => {
  assert.match(css, /flex:0 0 auto/);
  assert.match(css, /white-space:nowrap/);
  assert.match(css, /overflow-x:auto; overflow-y:hidden/);
  assert.match(css, /\.nav > a:focus-visible \{ outline-offset:-3px/);
});

test('existing stylesheet links are refreshed once and repeated builds are idempotent', () => {
  const page = H.page(source);
  assert.match(page, /href="\/site-header\.css\?v=20260909-nav-readable1(?:&[^"]*)?"/);
  assert.equal((page.match(/href="\/site-header\.css/g) || []).length, 1);
  assert.equal(H.page(page), page);
});

test('menu text, destinations, current header controls and page body are preserved', () => {
  const page = H.page(source);
  assert.ok(page.includes(nav));
  assert.ok(page.includes('<main>UNCHANGED</main>'));
  assert.equal((page.match(/id="readerAccount"/g) || []).length, 1);
  assert.ok(page.indexOf('id="readerAccount"') < page.indexOf('id="globalDossierSearch"'));
  assert.match(page, /class="site-brand-home" href="\/"/);
});

test('all actual internal header pages use the larger navigation stylesheet', () => {
  const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
  let checked = 0;
  for (const name of pages) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    if (!/<header\b[^>]*class="[^"]*\btopbar\b/.test(source)) continue;
    const page = H.page(source);
    assert.match(page, /href="\/site-header\.css\?v=20260909-nav-readable1(?:&[^"]*)?"/, name);
    checked++;
  }
  assert.ok(checked >= 8, 'Expected at least the existing eight internal header pages');
});
