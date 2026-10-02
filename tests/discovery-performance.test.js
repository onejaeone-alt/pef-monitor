'use strict';

const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Core=require('../discovery-core'),Patterns=require('../discovery-patterns'),Recommendations=require('../discovery-recommendations'),Brief=require('../marketin-story-brief');
const DAY=86400000,START=Date.parse('2026-09-28T03:00:00Z');
const news=(title='국민연금, 국내 사모펀드 8000억원 출자 위탁운용사 선정',url='https://example.com/lp',date=START)=>({title,source_url:url,source_name:'기관 공고',published_at:new Date(date).toISOString(),target:{name:'국민연금',category:'lp'}});
function harness({rows=[news()],archived=[],now:initialNow=START,dart=[],review,holdReview=false,researchCache}={}){
 const nodes=new Map(),storage=new Map(),writes=[],requests=[],calls={core:0,rank:0,connect:0,accumulate:0},inputs=[];
 let now=initialNow,currentRows=rows,timerId=0,releaseReview;
 const reviewGate=holdReview?new Promise(resolve=>releaseReview=resolve):Promise.resolve();
 if(archived.length)storage.set('ib_pitch_sources_v1',JSON.stringify({news:archived}));
 if(researchCache)storage.set('ib_discovery_research_v1',JSON.stringify(researchCache));
 class TestDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},setAttribute(){},focus(){},addEventListener(event,fn){this['on'+event]=fn;},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();}});
  return nodes.get(selector);
 };
 const context={
  IBDiscovery:{...Core,build(...args){calls.core++;return Core.build(...args);}},
  DiscoveryPatterns:{...Patterns,connect(...args){calls.connect++;return Patterns.connect(...args);},accumulate(...args){calls.accumulate++;return Patterns.accumulate(...args);}},
  DiscoveryRecommendations:{...Recommendations,build(...args){calls.rank++;inputs.push(args[0]);return Recommendations.build(...args);}},
  ...(researchCache?{MarketInStoryBrief:{...Brief,shortlist:()=>[]}}:{}),
  document:{hidden:false,querySelector:node,querySelectorAll:()=>[],addEventListener(){}},Date:TestDate,navigator:{onLine:true},
  setTimeout:()=>++timerId,clearTimeout(){},addEventListener(){},AbortController,URL,console,
  localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){storage.set(key,value);writes.push(key);}},
  fetch:async url=>{requests.push(url);if(url.includes('action=review')){await reviewGate;return {ok:true,json:async()=>review};}
   return {ok:true,json:async()=>({ok:true,items:url.includes('feed=reader')?currentRows:url.includes('dart-feed')?dart:[],events:[],source_signals:[]})};}
 };
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),context);
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
 const click=(selector,dataset)=>node('#discoveryDesk').onclick({target:{closest:key=>key===selector?{dataset,isConnected:true,focus(){}}:null}});
 const search=value=>node('#discoverySearch').oninput({target:{value}});
 return {node,calls,inputs,writes,requests,storage,settle,click,search,setRows:next=>currentRows=next,setNow:value=>now=value,releaseReview:()=>releaseReview?.(),refresh:async()=>{await node('#findToday').onclick();await settle();}};
}

test('typing, category switches, expansion and recommendation dialogs reuse calculated candidates without storage writes',async()=>{
 const h=harness();await h.settle();
 const counts={...h.calls},writes=h.writes.length,requests=h.requests.length;
 for(let i=0;i<8;i++){h.search('국민');h.search('');h.click('[data-pitch-category]',{pitchCategory:'lp'});h.click('[data-pitch-category]',{pitchCategory:'all'});}
 h.node('#discoveryMore').onclick();
 const id=/data-recommendation-open="([^"]+)"/.exec(h.node('#discoveryCards').innerHTML)?.[1];assert.ok(id);
 h.click('[data-recommendation-open]',{recommendationOpen:id});assert.equal(h.node('#recommendationDialog').open,true);
 h.node('#closeRecommendation').onclick();
 assert.deepEqual(h.calls,counts,'display controls must not regenerate or reconnect candidates');
 assert.equal(h.writes.length,writes,'display controls must not persist a new analysis timestamp');
 assert.equal(h.requests.length,requests);
});

test('identical refreshes reuse source calculations; a new article and body enrichment invalidate the matching cache',async()=>{
 const h=harness();await h.settle();
 const counts={...h.calls},writes=h.writes.length;
 await h.refresh();assert.deepEqual(h.calls,counts);assert.equal(h.writes.length,writes);
 const added=news('산업은행, 국내 사모펀드 5000억원 출자 위탁운용사 선정','https://example.com/kdb');
 h.setRows([news(),added]);await h.refresh();
 assert.ok(h.calls.rank>counts.rank);assert.ok(h.calls.accumulate>counts.accumulate);
 assert.ok(h.inputs.at(-1).news.some(row=>row.source_url===added.source_url));
 const before=h.calls.rank;
 h.setRows([{...news(),body_text:'국민연금의 국내 사모펀드 출자 규모는 8000억원이다.'},added]);await h.refresh();
 assert.ok(h.calls.rank>before,'same URL with newly obtained body must trigger recalculation');
 assert.match(h.inputs.at(-1).news.find(row=>row.source_url===news().source_url).body_text,/8000억원/);
 const after={...h.calls};h.search('국민');assert.deepEqual(h.calls,after);
});

test('a completed DART review invalidates candidates even when source lists are unchanged',async()=>{
 const receipt='20260928000001';
 const dart=[{rcept_no:receipt,rcept_dt:'20260928',corp_name:'시험기업',scope_kind:'watch',event_id:'equity_disposal',report_nm:'타법인주식및출자증권처분결정'}];
 const review={ok:true,rcept_no:receipt,version:Core.VERSION,current_fields:[{label:'처분금액',value:'100',unit:'억원',topic:'money',evidence_id:'money',source:{source_id:'dart:'+receipt}},{label:'거래상대방',value:'매수인',topic:'party',evidence_id:'party',source:{source_id:'dart:'+receipt}}]};
 const h=harness({rows:[],dart,review,holdReview:true});await h.settle();const before=h.calls.core;
 assert.doesNotMatch(h.node('#discoveryCards').innerHTML,/100 억원/);
 h.releaseReview();await h.settle();assert.ok(h.calls.core>before);assert.match(h.node('#discoveryCards').innerHTML,/100 억원/);
 const counts={...h.calls};h.search('시험');h.search('');assert.deepEqual(h.calls,counts);
});

test('Korean midnight invalidates recency ranking without waiting for another source response',async()=>{
 const beforeMidnight=Date.parse('2026-09-28T14:59:59Z'),row=news(undefined,undefined,Date.parse('2026-09-25T01:00:00Z'));
 const h=harness({rows:[row],now:beforeMidnight});await h.settle();const before=h.calls.rank,requests=h.requests.length;
 const original=Recommendations.build(h.inputs.at(-1),{limit:12,now:beforeMidnight})[0];assert.equal(original.score_breakdown.timeliness,17);
 h.setNow(beforeMidnight+1000);h.search('');
 assert.equal(h.calls.rank,before+1);assert.equal(h.requests.length,requests);
 const current=Recommendations.build(h.inputs.at(-1),{limit:12,now:beforeMidnight+1000})[0];assert.equal(current.score_breakdown.timeliness,14);
 assert.match(h.node('#discoveryCards').innerHTML,/시의성 <b>14<\/b>/);
});

test('the rolling archive drops expired sources at the exact 90-day boundary',async()=>{
 const old=news('옛운용사, 기존기업 인수 계약 체결','https://example.com/old',START-90*DAY+1000);
 const h=harness({archived:[old]});await h.settle();assert.ok(h.inputs.at(-1).news.some(row=>row.source_url===old.source_url));
 const before=h.calls.rank;h.setNow(START+1001);h.search('');
 assert.equal(h.calls.rank,before+1);assert.ok(!h.inputs.at(-1).news.some(row=>row.source_url===old.source_url));
});

test('expired AI attachments are removed without reranking unchanged source candidates',async()=>{
 const pitch=Recommendations.build({news:[news()]},{now:START,limit:12})[0],request=Brief.requestFor(pitch);assert.ok(request);
 const h=harness({researchCache:{[request.key]:{until:START+1000,value:{version:Brief.VERSION,status:'sources_only',error:'model_unavailable',sources:[]}}}});await h.settle();
 assert.match(h.node('#discoveryResearchStatus').textContent,/추가 AI 분석에 연결하지 못/);
 const rank=h.calls.rank;h.setNow(START+1000);h.search('');
 assert.doesNotMatch(h.node('#discoveryResearchStatus').textContent,/추가 AI 분석에 연결하지 못/);
 assert.equal(h.calls.rank,rank);
});
