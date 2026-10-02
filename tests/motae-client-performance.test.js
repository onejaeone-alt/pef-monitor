'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=[...fs.readFileSync(require.resolve('../motae.html'),'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes("const DASH='/api/kvic"));
function element(dataset={}){return {dataset,hidden:false,style:{},value:'',textContent:'',writes:0,classList:{toggle(){}},scrollIntoView(){},get innerHTML(){return this.html||''},set innerHTML(value){this.html=value;this.writes++}}}
function setup(){
 const nodes=new Map(),tabs=['notices','business','gp','funds','policy'].map(tab=>element({tab})),calls=[],timers=new Map();let nextTimer=0;
 const document={querySelector(s){const match=s.match(/^\[data-tab="(.+)"\]$/);if(match)return tabs.find(x=>x.dataset.tab===match[1]);if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)},querySelectorAll(s){return s==='[data-tab]'?tabs:[]},addEventListener(){}};
 const context=vm.createContext({document,console,URL,Date,setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)},fetch(url,options){return new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}))}});
 vm.runInContext(script,context,{filename:'motae.html'});
 const run=code=>vm.runInContext(code,context),el=s=>document.querySelector(s);
 return {calls,run,el,respond(call,value,status=200){call.resolve({ok:status<400,status,json:async()=>value})},clickTab(tab){el('#tabs').onclick({target:{closest:()=>tabs.find(x=>x.dataset.tab===tab)}})},flushTimers(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn())},timers};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const dash=(title='KVIC 공고')=>({ok:true,notice_count:1,groups:[{title,account:'혁신계정',year:2026,latest:{posted_date:'2026-10-02',source_url:'https://example.invalid/kvic'}}],stats:{businesses:1},gp_stats:[],funds:[],fund_years:[],account_stats:[]});
const vcs=(title='성장금융 출자공고')=>({ok:true,items:[{notice_id:title,title,organization:'성장금융',posted_date:'2026-10-02',source_url:'https://example.invalid/'+encodeURIComponent(title),status:'open'}],total:1,requested_pages:6,parsed_pages:6});
const find=(s,text)=>s.calls.filter(c=>c.url.includes(text));
async function loaded(){const s=setup();s.respond(find(s,'mode=dashboard')[0],dash());s.respond(find(s,'vcs-notices')[0],vcs());await flush();return s}

test('initial notices render as each source arrives without requesting policy or hidden tables',async()=>{
 const s=setup();assert.equal(s.calls.length,2);assert.equal(find(s,'mode=policy').length,0);
 s.respond(find(s,'vcs-notices')[0],vcs());await flush();
 assert.match(s.el('#noticeRows').innerHTML,/성장금융 출자공고/);assert.match(s.el('#status').textContent,/KVIC 조회 중/);
 for(const id of ['businessRows','gpRows','fundRows','policyRows'])assert.equal(s.el('#'+id).writes,0);
 s.respond(find(s,'mode=dashboard')[0],dash());await flush();assert.match(s.el('#noticeRows').innerHTML,/KVIC 공고/);assert.doesNotMatch(s.el('#status').textContent,/조회 중/);
});

test('dashboard is usable even when VCS fails, with visible partial failure',async()=>{
 const s=setup();s.respond(find(s,'mode=dashboard')[0],dash());await flush();assert.match(s.el('#noticeRows').innerHTML,/KVIC 공고/);
 find(s,'vcs-notices')[0].reject(new Error('VCS unavailable'));await flush();
 assert.match(s.el('#noticeRows').innerHTML,/KVIC 공고/);assert.match(s.el('#status').textContent,/일부 조회 실패/);assert.match(s.el('#refreshNote').textContent,/VCS unavailable/);
});

test('policy loads on demand once, and late policy results do not repaint hidden tables',async()=>{
 const s=await loaded();s.clickTab('policy');s.clickTab('notices');s.clickTab('policy');assert.equal(find(s,'mode=policy').length,1);
 s.clickTab('notices');const before=s.el('#policyRows').writes;
 s.respond(find(s,'mode=policy')[0],{ok:true,sources:[{source:'K-Startup 사업공고',ready:true,items:[{title:'정책 예시'}]}]});await flush();
 assert.equal(s.el('#policyRows').writes,before);s.clickTab('policy');assert.equal(find(s,'mode=policy').length,1);assert.match(s.el('#policyRows').innerHTML,/정책 예시/);
});

test('refresh reuses its sole VCS result while KVIC updates, and coalesces double clicks',async()=>{
 const s=await loaded();s.run('refresh()');s.run('refresh()');assert.equal(find(s,'vcs-notices').length,2);assert.equal(find(s,'kvic-backfill').length,1);assert.equal(s.el('#refresh').disabled,true);
 s.respond(find(s,'vcs-notices')[1],vcs('새 출자공고'));await flush();assert.match(s.el('#noticeRows').innerHTML,/새 출자공고/);assert.match(s.el('#status').textContent,/KVIC 조회 중/);
 s.respond(find(s,'kvic-backfill')[0],{ok:true});await flush();s.respond(find(s,'mode=dashboard')[1],dash('새 KVIC 공고'));await flush();
 assert.equal(find(s,'vcs-notices').length,2);assert.match(s.el('#noticeRows').innerHTML,/새 KVIC 공고/);assert.equal(s.el('#refresh').disabled,false);
});

test('old initial responses cannot overwrite a newer refresh',async()=>{
 const s=setup();s.run('refresh()');s.respond(find(s,'vcs-notices')[1],vcs('새 공고'));s.respond(find(s,'kvic-backfill')[0],{ok:true});await flush();
 s.respond(find(s,'mode=dashboard')[1],dash('새 KVIC'));await flush();
 s.respond(find(s,'vcs-notices')[0],vcs('이전 공고'));s.respond(find(s,'mode=dashboard')[0],dash('이전 KVIC'));await flush();
 assert.match(s.el('#noticeRows').innerHTML,/새 공고/);assert.match(s.el('#noticeRows').innerHTML,/새 KVIC/);assert.doesNotMatch(s.el('#noticeRows').innerHTML,/이전/);assert.equal(find(s,'kvic-backfill').length,1);
});

test('empty KVIC data bootstrap does not block VCS or fetch it a second time',async()=>{
 const s=setup();s.respond(find(s,'mode=dashboard')[0],{ok:true,notice_count:0,stats:{businesses:0},groups:[]});await flush();
 assert.equal(find(s,'kvic-backfill').length,1);s.respond(find(s,'vcs-notices')[0],vcs());await flush();assert.match(s.el('#noticeRows').innerHTML,/성장금융 출자공고/);assert.match(s.el('#status').textContent,/KVIC 조회 중/);
 s.respond(find(s,'kvic-backfill')[0],{ok:true});await flush();s.respond(find(s,'mode=dashboard')[1],dash());await flush();assert.equal(find(s,'vcs-notices').length,1);
});

test('refresh failure preserves known notices and reports failed backfill',async()=>{
 const s=await loaded();s.run('refresh()');find(s,'vcs-notices')[1].reject(new Error('source timeout'));
 s.respond(find(s,'kvic-backfill')[0],{ok:false,error:'backfill failed'},502);await flush();s.respond(find(s,'mode=dashboard')[1],dash());await flush();
 assert.match(s.el('#noticeRows').innerHTML,/성장금융 출자공고/);assert.match(s.el('#refreshNote').textContent,/backfill failed/);assert.match(s.el('#refreshNote').textContent,/source timeout/);assert.equal(s.el('#refresh').disabled,false);
});

test('partial VCS refresh keeps previously known pages and marks incomplete collection',async()=>{
 const s=await loaded();s.run('refresh()');s.respond(find(s,'vcs-notices')[1],{...vcs('다른 페이지 공고'),parsed_pages:5,errors:[{page:2,error:'timeout'}]});await flush();
 assert.match(s.el('#noticeRows').innerHTML,/성장금융 출자공고/);assert.match(s.el('#noticeRows').innerHTML,/다른 페이지 공고/);assert.match(s.el('#refreshNote').textContent,/일부 공고 페이지/);
});

test('search waits for Korean composition to end, debounces input and never fetches',async()=>{
 const s=await loaded(),input=s.el('#search'),before=s.el('#noticeRows').writes,calls=s.calls.length;
 input.oncompositionstart();input.oninput({target:{value:'성'},isComposing:true});s.flushTimers();assert.equal(s.el('#noticeRows').writes,before);
 input.oncompositionend({target:{value:'성장'}});input.oninput({target:{value:'성장금융'},isComposing:false});assert.equal(s.timers.size,1);s.flushTimers();
 assert.equal(s.el('#noticeRows').writes,before+1);assert.match(s.el('#noticeRows').innerHTML,/성장금융/);assert.doesNotMatch(s.el('#noticeRows').innerHTML,/KVIC 공고/);assert.equal(s.calls.length,calls);
});

test('partial updates and refresh retain active filters and selected tab',async()=>{
 const s=await loaded();s.run("year='2025';account='성장금융';stage='open';query='선정';render()");s.run('refresh()');
 assert.equal(s.run('year'),'2025');assert.equal(s.run('account'),'성장금융');assert.equal(s.run('stage'),'open');assert.equal(s.run('query'),'선정');
 s.clickTab('business');const noticeWrites=s.el('#noticeRows').writes;s.respond(find(s,'vcs-notices')[1],vcs('새 공고'));await flush();
 assert.equal(s.run('tab'),'business');assert.equal(s.el('#noticeRows').writes,noticeWrites);assert.equal(s.el('#businessView').hidden,false);
});
