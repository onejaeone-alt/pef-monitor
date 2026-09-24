'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../discovery-patterns'),C=require('../discovery-core'),B=require('../marketin-story-brief');
const now=Date.parse('2026-09-23T03:00:00Z');
const pattern={clue_id:'repeat-a',detector:'gp_repeat',headline:'시험투자파트너스 복수 LP 선정',one_line_signal:'서로 다른 LP 두 곳에서 선정',entities:['시험투자파트너스','한국벤처투자'],sort_date:'2026-07-29',sources:[{url:'https://example.com/baseline',date:'2026-09-07'}],lane:'background'};
const news={title:'시험투자파트너스, 신규 펀드 1000억원 결성',source_url:'https://example.com/new',source_name:'시험매체',published_at:'2026-09-22T01:00:00Z'};
test('patterns stay in accumulated material regardless of recent source date',()=>{
 const x=C.build({canonical:[{...pattern,sort_date:'2026-09-23'}]},now)[0];assert.equal(x.lane,'background');
 assert.equal(B.select([x],{}).length,1);
});
test('newer relevant material links both ways without confirming the hypothesis or altering its baseline',()=>{
 const rows=P.connect([pattern],{news:[news]},now),update=rows[0],old=rows[1];
 assert.equal(update.lane,'current');assert.equal(update.pattern_ref.clue_id,old.clue_id);assert.equal(old.linked_update.clue_id,update.clue_id);
 assert.equal(update.pattern_ref.date,'2026-09-07');assert.deepEqual(update.confirmed_facts,[]);assert.match(update.reason,/동일 사건 여부/);
 assert.equal(old.sort_date,pattern.sort_date);assert.equal(pattern.linked_update,undefined);
 assert.match(P.summary(update).update,/변화는 아직 확인하지 못/);
 assert.equal(P.connect([pattern],{news:[{...news,published_at:'2026-09-23T01:00:00Z'}]},now)[0].clue_id,update.clue_id);
});
test('same LP, near-name companies, irrelevant news and stale or future evidence do not revive a pattern',()=>{
 for(const n of [{...news,title:'한국벤처투자, 신규 펀드 결성'},{...news,title:'시험투자파트너스증권, 신규 펀드 결성'},{...news,title:'시험투자파트너스 채용 공고'},{...news,published_at:'2026-09-06'},{...news,published_at:'2026-09-24'},{...news,source_url:pattern.sources[0].url},{...news,source_url:'javascript:alert(1)'}]){
  const rows=P.connect([pattern],{news:[n]},now);assert.equal(rows.length,1,n.title);assert.equal(rows[0].linked_update,undefined);
 }
});
test('repeated headlines and sources do not inflate new evidence counts; GP names ending in venture investment remain eligible',()=>{
 assert.equal(P.connect([pattern],{news:[news,news,{...news,source_url:'https://example.com/reprint'}]},now)[0].sources.length,1);
 assert.equal(P.relevant({...pattern,entities:['다른벤처투자']},{title:'다른벤처투자, 펀드 결성'}),true);
});
test('LP rules only connect to rule-related updates, not ordinary selections or ceremonies',()=>{
 const x={...pattern,detector:'lp_rule_change',entities:['한국벤처투자']};
 assert.equal(P.relevant(x,{title:'한국벤처투자, 출자 기준 완화'}),true);
 assert.equal(P.relevant(x,{title:'한국벤처투자, 위탁운용사 선정'}),false);
 assert.equal(P.relevant(x,{title:'한국벤처투자, 출자 확대 설명회'}),false);
});
test('saving a follow-up preserves both baseline and new source evidence',()=>{
 const update=P.connect([pattern],{news:[news]},now)[0];
 const saved=C.mergeProject([],update).rows[0];assert.equal(saved.clue.pattern_ref.sources[0].url,pattern.sources[0].url);assert.equal(saved.clue.sources[0].url,news.source_url);
 const next=C.mergeProject([{...saved,notes:'기자 메모'}],update);assert.equal(next.rows.length,1);assert.equal(next.rows[0].notes,'기자 메모');
});
test('desk renders all three explanations and jumps between a pattern and its new evidence',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),nodes=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,fn){this[k]=fn;}});return nodes.get(s);};
 const core={...C};B.install({IBDiscovery:core});
 const old={...pattern,sort_date:'2020-01-01',sources:[{url:'https://example.com/baseline',date:'2020-01-01'}]};
 const current={...news,published_at:new Date().toISOString()};
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),{IBDiscovery:core,MarketInStoryBrief:B,DiscoveryPatterns:P,document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},setTimeout:()=>1,clearTimeout(){},AbortController,localStorage:{getItem:()=>null,setItem(){}},fetch:async url=>({ok:true,json:async()=>({ok:true,items:url.includes('mode=clues')?[old]:url.includes('feed=reader')?[current]:[],events:[]})})});
 await new Promise(r=>setImmediate(r));
 let html=node('#discoveryCards').innerHTML;for(const label of ['발견한 특징','비교한 자료','새로 확인된 내용','기존 특징과 근거 보기'])assert.ok(html.includes(label),label);
 const click=id=>node('#discoveryDesk').click({target:{closest:s=>s==='[data-discovery-jump]'?{dataset:{discoveryJump:id}}:null}});
 click(pattern.clue_id);html=node('#discoveryCards').innerHTML;assert.match(html,/2020-01-01/);assert.match(html,/오늘 다시 검증한 결과는 아닙니다/);assert.match(html,/연결된 새 자료 1건/);assert.match(node('#discoveryCounts').textContent,/누적 특징 1건/);
 click('pattern-update-'+pattern.clue_id);assert.match(node('#discoveryCards').innerHTML,/신규 펀드 1000억원 결성/);
});
