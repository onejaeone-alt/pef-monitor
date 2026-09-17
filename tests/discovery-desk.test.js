'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../discovery-core');
test('independent feeds render progressively; failures stay visible; shared DART cache is reused and two concurrent reads are bounded',async()=>{
 const nodes=new Map(),storage=new Map(),requests=[];
 const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',hidden:false,dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,fn){this[k]=fn;}});return nodes.get(s);};
 const today=C.today(),stamp=today.replace(/-/g,''),items=Array.from({length:23},(_,i)=>({rcept_no:stamp+String(i+1).padStart(6,'0'),rcept_dt:stamp,corp_name:'회사'+i,scope_kind:'watch',event_id:'equity_disposal',report_nm:'타법인주식및출자증권처분결정'}));
 const review=x=>({ok:true,rcept_no:x.rcept_no,version:C.VERSION,current_fields:[{label:'처분금액',value:'100',unit:'억원',topic:'money',evidence_id:'money',source:{source_id:'dart:'+x.rcept_no}},{label:'거래상대방',value:'매수인',topic:'party',evidence_id:'party',source:{source_id:'dart:'+x.rcept_no}}]});
 storage.set('ib_dart_reviews_v1',JSON.stringify({[items[0].rcept_no]:review(items[0])}));
 let active=0,max=0,resolveCalendar;
 const calendar=new Promise(r=>{resolveCalendar=r;});
 const context={IBDiscovery:C,document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t;},clearTimeout,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{},AbortController,URL,console,fetch:async url=>{
  requests.push(url);let body;
  if(url.includes('action=review')){active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;const n=new URL(url,'https://example.com').searchParams.get('rcept_no');body=review(items.find(x=>x.rcept_no===n));}
  else if(url.includes('scope=foreign'))throw Error('Foreign unavailable');
  else if(url.includes('feed=calendar')){await calendar;body={ok:true,events:[]};}
  else if(url.includes('dart-feed'))body={ok:true,items,coverage:{complete:true}};
  else body={ok:true,items:[]};
  return {ok:true,json:async()=>body};
 }};
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),context);
 for(let i=0;i<100&&requests.filter(x=>x.includes('action=review')).length<22;i++)await new Promise(r=>setTimeout(r,5));
 await new Promise(r=>setTimeout(r,20));
 assert.equal(max,2);assert.equal(requests.filter(x=>x.includes('action=review')).length,22);
 assert.ok(!requests.some(x=>x.includes('rcept_no='+items[0].rcept_no)));
 assert.match(node('#discoveryCards').innerHTML,/100 억원/);assert.match(node('#discoverySources').innerHTML,/외신 · 불러오기 실패/);
 assert.match(node('#discoverySources').innerHTML,/취재일정 · 수집 중/);assert.doesNotMatch(node('#discoveryReviewStatus').textContent,/대기/);
 assert.equal(node('#discoveryReadMore').hidden,true);assert.equal(node('#discoveryRetry').hidden,false);
 resolveCalendar();await new Promise(r=>setTimeout(r,5));assert.equal(node('#discoveryReadMore').hidden,true);
 assert.match(node('#discoveryCounts').textContent,/최근 자료 23건/);
});
