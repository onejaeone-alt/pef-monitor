const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('../scripts/integrate-site-header');
const { createAuth } = require('../site-header');
const fixture = '<html><head></head><body><header class="topbar"><div class="brandrow"><div class="brand"><div class="eyebrow">MARKETIN</div><h1>IB 취재 레이더</h1><p>기존 설명</p></div><div class="status" id="status">뉴스 183건</div></div><nav class="nav"><a href="/">뉴스</a><a href="/dart.html">DART 공시</a></nav></header><main><textarea id="notes">keep me</textarea></main><script>document.getElementById("status").textContent="뉴스 200건";</script></body></html>';
const html = H.page(fixture);
const top = html.match(/<header class="topbar"[\s\S]*?<\/header>/)[0];
test('account top right precedes search; header counts are not displayed', () => {
  assert.ok(top.indexOf('id="readerAccount"') < top.indexOf('id="globalDossierSearch"'));
  assert.match(top, /class="site-header-tools"/);
  assert.match(top, /id="status" hidden aria-hidden="true"/);
  assert.doesNotMatch(top, /뉴스 183건/);
});
test('both icon and title are normal same-origin home links', () => {
  assert.match(top, /class="site-brand-home" href="\/"[^>]*>IB 취재 레이더<\/a>/);
  assert.match(top, /class="brand-home-icon" href="\/"/);
  let depth=0;for(const m of top.matchAll(/<\/?a\b[^>]*>/g)){depth+=m[0].startsWith('</')?-1:1;assert.ok(depth>=0&&depth<=1,'no nested anchors');}assert.equal(depth,0);
});
test('preserve navigation, page body, text areas and status target', () => {
  assert.ok(html.includes('<nav class="nav"><a href="/">뉴스</a><a href="/dart.html">DART 공시</a></nav>'));
  assert.ok(html.includes('<main><textarea id="notes">keep me</textarea></main>'));
  assert.ok(html.includes('document.getElementById("status").textContent="뉴스 200건";'));
});
test('one search entry and one shared controller', () => {
  assert.equal((html.match(/id="globalDossierSearch"/g)||[]).length, 1);
  assert.equal((html.match(/id="readerAccount"/g)||[]).length, 1);
  assert.equal((html.match(/src="\/site-header.js/g)||[]).length, 1);
  assert.match(html, /dossier-drawer\.js/);
});
test('replace old search handler rather than bind twice', () => {
  const before=fixture.replace('</body>','<script id="global-dossier-search-script">oldSearch()</script></body>');
  assert.doesNotMatch(H.page(before), /oldSearch|global-dossier-search-script/);
});
test('header integration is idempotent', () => assert.equal(H.page(html), html));
test('redirect-only pages stay exactly unchanged', () => {
  const redirect='<html><head><meta http-equiv="refresh" content="0;url=/"></head></html>';
  assert.equal(H.page(redirect),redirect);
});
test('old icon/title markup remains valid on another build', () => {
  const original=fixture.replace('<h1>IB 취재 레이더</h1>','<div class="brand-home-row"><a class="brand-home-icon" href="/"><img src="/radar-home.svg" alt=""></a><h1>IB 취재 레이더</h1></div>');
  const changed=H.page(original);
  assert.equal((changed.match(/class="brand-home-row"/g)||[]).length,1);
  assert.equal((changed.match(/class="brand-home-icon"/g)||[]).length,1);
  assert.equal(H.page(changed),changed);
});
test('changed navigation or reader anchors fail the build', () => {
  assert.throws(()=>H.page(fixture.replace('<nav class="nav">','<nav>')),/missing navigation/);
  assert.throws(()=>H.reader('unknown source'),/anchor changed/);
});
test('news button is not injected into the list; keep its existing account controller', () => {
  const original="const top=el('div',{class:'reader-top'},el('div',{id:'readerTabs'}),btn('이 브라우저 저장',{id:'readerAccount',class:'nd-button'}));\n $('#readerAccount').textContent=S.mode==='account'?'계정 저장':'로그인';\nconst Accounts=existingAccount();";
  const result=H.reader(original);
  assert.doesNotMatch(result, /id:'readerAccount'/);
  assert.match(result,/existingAccount\(\)/);
  assert.match(result,/S\.mode==='account'\?'내 계정':'로그인'/);
  assert.equal(H.reader(result),result);
  assert.doesNotThrow(()=>new vm.Script(result));
});
test('source files parse without executing DOM',()=>{
  for(const name of ['site-header.js','scripts/integrate-site-header.js']) assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(__dirname,'..',name),'utf8')));
});
test('shared header never accesses personal records, local storage, credentials or new endpoints',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../site-header.js'),'utf8');
  assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|reader=records|\/api\/(?!news|entity)/);
  assert.match(source,/if \(d\.querySelector\('\.news-desk'\)\) return;/);
});
const user={id:'11111111-1111-4111-8111-111111111111',email:'reader@example.test'};
const ok=data=>({ok:true,json:async()=>({ok:true,...data})});
test('header only requests status, never news personal records',async()=>{
  const calls=[];const auth=createAuth({fetcher:async(url,o)=>{calls.push([url,o]);return ok({ready:true,user});}});
  await auth.sync();assert.equal(auth.state().mode,'account');assert.equal(calls.length,1);
  assert.equal(calls[0][0],'/api/news?reader=status');assert.equal(calls[0][1].cache,'no-store');assert.equal(calls[0][1].credentials,'same-origin');
});
test('login POST uses the existing CSRF-protected endpoint',async()=>{
  const calls=[];const auth=createAuth({fetcher:async(url,o)=>{calls.push([url,o]);return ok({message:'sent'});}});
  await auth.sendCode('reader@example.test');const [url,o]=calls[0];
  assert.equal(url,'/api/news?reader=send-code');assert.equal(o.method,'POST');assert.equal(o.headers['X-News-Reader'],'1');
  assert.deepEqual(JSON.parse(o.body),{email:'reader@example.test'});
});
test('verification requires a fresh server status before showing an account',async()=>{
  const calls=[];const auth=createAuth({fetcher:async(url)=>{calls.push(url);return url.endsWith('status')?ok({ready:true,user}):ok({user});}});
  await auth.verifyCode('reader@example.test','000000');
  assert.deepEqual(calls,['/api/news?reader=verify-code','/api/news?reader=status']);assert.equal(auth.state().user.email,user.email);
});
test('logout clears old identity and checks the effective session',async()=>{
  let signedIn=true;const auth=createAuth({fetcher:async(url)=>{if(url.endsWith('logout'))signedIn=false;return ok({ready:true,user:signedIn?user:null});}});
  await auth.sync();await auth.logout();assert.equal(auth.state().user,null);assert.equal(auth.state().mode,'signedout');
});
test('failed status clears personal identity rather than keeping a stale email',async()=>{
  let fail=false;const auth=createAuth({fetcher:async()=>{if(fail)throw Error('offline');return ok({ready:true,user});}});
  await auth.sync();fail=true;await assert.rejects(auth.sync(),/offline/);assert.equal(auth.state().user,null);assert.equal(auth.state().mode,'blocked');
});
test('late status from another tab cannot restore an old account',async()=>{
  let resolve;const auth=createAuth({fetcher:()=>new Promise(r=>resolve=r)});
  const p=auth.sync();auth.invalidate();resolve(ok({ready:true,user}));await p;assert.equal(auth.state().user,null);
});
test('late verification is discarded after cross-tab invalidation',async()=>{
  let resolve;const auth=createAuth({fetcher:()=>new Promise(r=>resolve=r)});
  const p=auth.verifyCode('reader@example.test','000000');auth.invalidate();resolve(ok({user}));
  await assert.rejects(p,/다른 탭/);assert.equal(auth.state().user,null);
});
test('concurrent auth mutation is rejected',async()=>{
  let resolve;const auth=createAuth({fetcher:()=>new Promise(r=>resolve=r)});
  const p=auth.sendCode('reader@example.test');await assert.rejects(auth.sendCode('other@example.test'),/앞선 요청/);resolve(ok({}));await p;
});
test('API delivery error is not shown as login success',async()=>{
  const auth=createAuth({fetcher:async()=>({ok:false,json:async()=>({ok:false,error:'발송 실패'})})});
  await assert.rejects(auth.sendCode('reader@example.test'),/발송 실패/);assert.equal(auth.state().user,null);
});
test('all actual site pages with a topbar receive the same header without modifying main content',()=>{
  const root=path.join(__dirname,'..');
  const pages=fs.readdirSync(root).filter(x=>x.endsWith('.html'));
  for(const name of pages){
    const source=fs.readFileSync(path.join(root,name),'utf8');if(!source.includes('class="topbar"'))continue;
    const result=H.page(source);assert.equal((result.match(/id="readerAccount"/g)||[]).length,1,name);
    assert.match(result,/class="site-brand-home" href="\/"/,name);assert.equal(H.page(result),result,name);
    const main=source.match(/<main\b[\s\S]*?<\/main>/)?.[0];if(main)assert.ok(result.includes(main),name+' main retained');
  }
});
