'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../discovery-core');
function harness(){
 const nodes=new Map(),timers=new Map(),events={},docEvents={},requests=[],storage=new Map();let now=Date.now(),timerId=0,version=1,fail=false,defer=null,open=false;
 const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',hidden:false,dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,fn){this[k]=fn;}});return nodes.get(s);};
 const detail={dataset:{detail:'clue-1'},open:true};
 const document={hidden:false,querySelector:node,querySelectorAll:s=>open&&s.includes('data-detail')?[detail]:[],addEventListener:(k,fn)=>{docEvents[k]=fn;}};
 const context={IBDiscovery:C,document,Date:class extends Date{static now(){return now;}},navigator:{onLine:true},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener:(k,fn)=>{events[k]=fn;},AbortController,URL,console,location:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async url=>{
  requests.push(url);if(defer)await defer;
  if(fail&&url.includes('signals'))throw Error('Offline source');
  const clue={clue_id:'clue-1',headline:'취재거리 '+version,sort_date:C.today(),sources:[{url:'https://example.com/'+version}],detector:'official_followup',lane:'current',questions:['확인 질문']};
  return {ok:true,json:async()=>({ok:true,items:url.includes('signals')?[clue]:[],events:[]})};
 }};
 const settle=()=>new Promise(r=>setImmediate(r));
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),context);
 return {nodes,node,timers,events,docEvents,requests,context,document,settle,setVersion:v=>version=v,setFail:v=>fail=v,setDefer:p=>defer=p,setOpen:v=>open=v,advance:async ms=>{now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);await t.fn();}await settle();}};
}
test('five-minute refresh retains existing cards until successful replacement, retries failures, and keeps filters',async()=>{
 const h=harness();await h.settle();assert.equal(h.requests.length,5);assert.match(h.node('#discoveryCards').innerHTML,/취재거리 1/);
 h.setVersion(2);await h.advance(300000);assert.equal(h.requests.length,10);assert.match(h.node('#discoveryCards').innerHTML,/취재거리 2/);
 h.setFail(true);await h.advance(300000);assert.match(h.node('#discoveryCards').innerHTML,/취재거리 2/);assert.match(h.node('#discoveryMessage').textContent,/이전 자료/);
 h.setFail(false);h.setVersion(3);await h.advance(300000);assert.match(h.node('#discoveryCards').innerHTML,/취재거리 3/);
 h.node('#discoverySearch').oninput({target:{value:'없는 검색어'}});await h.advance(300000);assert.doesNotMatch(h.node('#discoveryCards').innerHTML,/취재거리 3/);
 assert.match(h.node('#discoveryAutoStatus').textContent,/5분마다 자동 업데이트/);
});
test('hidden/offline tabs pause polling, overdue return and reconnection refresh once without overlapping requests',async()=>{
 const h=harness();await h.settle();h.document.hidden=true;await h.docEvents.visibilitychange();await h.advance(600000);assert.equal(h.requests.length,5);
 h.document.hidden=false;await h.docEvents.visibilitychange();assert.equal(h.requests.length,10);
 h.context.navigator.onLine=false;h.events.offline();await h.advance(600000);assert.equal(h.requests.length,10);
 let resolve;h.setDefer(new Promise(r=>resolve=r));h.context.navigator.onLine=true;const running=h.events.online();await h.settle();assert.equal(h.requests.length,15);
 await h.events.pageshow();await h.docEvents.visibilitychange();await h.node('#refresh').onclick();assert.equal(h.requests.length,15);
 resolve();h.setDefer(null);await running;assert.equal(h.node('#refresh').disabled,false);
});
test('open evidence remains stable until new results are accepted; accepting preserves the open card',async()=>{
 const h=harness();await h.settle();h.setOpen(true);h.setVersion(2);await h.advance(300000);
 assert.match(h.node('#discoveryCards').innerHTML,/취재거리 1/);assert.doesNotMatch(h.node('#discoveryCards').innerHTML,/취재거리 2/);assert.equal(h.node('#discoveryUpdates').hidden,false);
 h.node('#discoveryUpdates').onclick();assert.match(h.node('#discoveryCards').innerHTML,/취재거리 2/);assert.equal(h.node('#discoveryUpdates').hidden,true);
});
