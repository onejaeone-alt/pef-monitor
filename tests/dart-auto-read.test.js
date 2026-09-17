'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('screen loads, reads public sources two at a time, renders values and keeps failures visible',async()=>{
 const nodes=new Map(),make=()=>({textContent:'',innerHTML:'',hidden:false,disabled:false,handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,fn){this.handlers[k]=fn;}});
 const node=s=>{if(!nodes.has(s))nodes.set(s,make());return nodes.get(s);};
 const tabs=['priority','market','all'].map(feed=>({...make(),dataset:{feed}}));
 const labels=tabs.map(parentElement=>({...make(),parentElement}));
 const dates=[1,3,7,14].map(days=>({...make(),dataset:{days}}));
 const requests=[],items=Array.from({length:23},(_,i)=>({rcept_no:'20260917'+String(i+1).padStart(6,'0'),rcept_dt:'20260917',corp_name:'회사'+i,report_nm:'타법인주식및출자증권처분결정',scope_kind:'watch',group_id:'equity'}));
 let active=0,max=0;
 const document={addEventListener(){},querySelector:node,querySelectorAll:s=>s==='[data-feed]'?tabs:s==='[data-feed] b'?labels:s==='[data-days]'?dates:[]};
 const context={document,window:{},localStorage:{getItem(){return null;},setItem(){}},AbortController,AbortSignal,console,URLSearchParams,fetch:async url=>{
  requests.push(url);
  if(!url.includes('action=review'))return {ok:true,json:async()=>({ok:true,items,coverage:{complete:true},range:{}})};
  active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;
  const n=new URL(url,'https://example.test').searchParams.get('rcept_no');
  return {ok:!n.endsWith('000001'),json:async()=>n.endsWith('000001')?{ok:false,error:'원문 실패'}:{ok:true,rcept_no:n,version:'dart-review-1.6',changes:[],current_fields:[{label:'처분금액',value:'100',unit:'억원',topic:'money'}]}};
 }};
 vm.runInNewContext(fs.readFileSync('dart-desk.js','utf8'),context);
 for(let i=0;i<150&&!node('#sourceProgress').textContent.includes('대기');i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(requests.filter(x=>x.includes('action=review')).length,20);assert.equal(max,2);
 assert.match(node('#rawRows').innerHTML,/100 억원/);assert.match(node('#rawRows').innerHTML,/자동 추출 실패/);
 assert.match(node('#sourceProgress').textContent,/대기 3건/);assert.equal(node('#readMoreSources').hidden,false);
 await node('#readMoreSources').handlers.click();assert.equal(requests.filter(x=>x.includes('action=review')).length,23);
 assert.equal(node('#readMoreSources').hidden,true);
});
