'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const B=require('../marketin-story-brief');
function harness({error=false,empty=false}={}){
 const nodes=new Map(),requests=[],storage=new Map();let release,hold=null,revision=1;
 const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},setAttribute(){},focus(){this.focused=true;},addEventListener(k,fn){this[k]=fn;},showModal(){this.open=true;},close(){this.open=false;this['close']?.();}});return nodes.get(s);};
 // Keep dialog's close method separate from its close event.
 node('#recommendationDialog').addEventListener=function(k,fn){this['on'+k]=fn;};
 node('#recommendationDialog').close=function(){this.open=false;this.onclose?.();};
 const source={url:'https://marketin.edaily.co.kr/News/ReadE?newsId=123',title:'테스트 펀드 결성',label:'마켓인',date:'2026-09-24'};
 const clue=()=>({clue_id:'clue',headline:'테스트 회사',detector:'news_followup',lane:'current',research_topic:'테스트 회사',sources:[{...source,title:source.title+revision}]});
 const result=()=>({ok:true,version:B.VERSION,status:error?'sources_only':'ready',error:error?(typeof error==='string'?error:'model_unavailable'):null,as_of:new Date().toISOString(),sources:[{...source,source_id:'s1',publisher:'마켓인',read_ok:true}],analysis:error?null:{summary:{text:'확인한 사실'},why_now:{text:'새 결성 자료 공개'},facts:[{id:'f1',source_id:'s1',text:'공개된 결성 규모'}],already_covered:[],changes:[],uncertainties:[],angles:empty?[]:[{headline:'추천 제목 '+revision,reason:'공고 조건을 대조한 발제 요지',new_information:'기존 보도에 더한 비교',basis_ids:['f1'],question:'같은 펀드인가',missing:'최종 배분은 미공개',first_action:'원문 확인',direction_key:'fund-terms'}]}});
 const C={safeUrl:u=>u,date:d=>d,dartCandidates:()=>[],build:()=>[clue()]};
 const context={IBDiscovery:C,MarketInStoryBrief:B,document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},navigator:{onLine:true},addEventListener(){},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t;},clearTimeout,AbortController,URL,console,location:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async url=>{requests.push(url);if(hold)await hold;return {ok:true,json:async()=>url.includes('mode=research')?result():{ok:true,items:[],events:[]}};}};
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),context);
 return {node,requests,context,settle:()=>new Promise(r=>setImmediate(r)),hold:()=>{hold=new Promise(r=>release=r);},release:()=>{hold=null;release();},next:()=>revision++,clickOpen:()=>node('#discoveryDesk').click({target:{closest:s=>s==='[data-recommendation-open]'?{dataset:{recommendationOpen:'clue'},isConnected:true,focus(){}}:null}})};
}
test('find today refreshes sources, waits for research, suppresses duplicate clicks and opens the matching evidence',async()=>{
 const h=harness();await h.settle();assert.equal(h.requests.filter(x=>x.includes('mode=research')).length,1);
 h.next();h.hold();const finding=h.node('#findToday').onclick();await h.settle();assert.equal(h.node('#findToday').disabled,true);
 const calls=h.requests.length;await h.node('#findToday').onclick();assert.equal(h.requests.length,calls);
 h.release();await finding;
 assert.equal(h.requests.filter(x=>x.includes('mode=research')).length,2);
 assert.match(h.node('#todayPitchStatus').textContent,/발제 후보 1건/);assert.equal(h.node('#findToday').disabled,false);
 assert.match(h.node('#discoveryCards').innerHTML,/추천기사 열기/);
 h.clickOpen();assert.equal(h.node('#recommendationDialog').open,true);assert.equal(h.node('#recommendationTitle').textContent,'추천 제목 2');
 assert.match(h.node('#recommendationBody').innerHTML,/공개된 결성 규모/);assert.match(h.node('#recommendationBody').innerHTML,/최종 배분은 미공개/);
 assert.equal(h.node('#saveRecommendation').dataset.discoveryProject,'clue');
 h.node('#closeRecommendation').onclick();assert.equal(h.node('#recommendationDialog').open,false);
});
test('model failure never produces a recommendation and finishes with a recoverable message',async()=>{
 const h=harness({error:true});await h.settle();h.next();await h.node('#findToday').onclick();
 assert.doesNotMatch(h.node('#discoveryCards').innerHTML,/data-recommendation-open/);assert.match(h.node('#todayPitchStatus').textContent,/AI 분석을 완료하지 못/);assert.equal(h.node('#findToday').disabled,false);
});
test('successful research without new angles is an honest empty result',async()=>{
 const h=harness({empty:true});await h.settle();await h.node('#findToday').onclick();
 assert.match(h.node('#todayPitchStatus').textContent,/새 발제 후보를 찾지 못/);assert.doesNotMatch(h.node('#discoveryCards').innerHTML,/data-recommendation-open/);
});

test('unread sources are distinct from a completed search without article angles',async()=>{
 const h=harness({error:'insufficient_sources'});await h.settle();await h.node('#findToday').onclick();
 assert.match(h.node('#todayPitchStatus').textContent,/원문을 충분히 확보하지 못/);assert.doesNotMatch(h.node('#todayPitchStatus').textContent,/새 발제 후보를 찾지 못/);
});
