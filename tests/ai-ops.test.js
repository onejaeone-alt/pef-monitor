'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Ops=require('../lib/ai-ops'),Research=require('../lib/discovery-research');
const identity=Ops.identity({version:'test',model:'test-model',prompt:'private prompt',schema:{type:'object'}});
test('telemetry omits documents, topic, keys and raw errors; sink failures never break analysis',()=>{
 const record=Ops.emit({trace_id:'t',stage:'request',status:'failed',identity,topic:'private company',key:'secret',sources:[{text:'interview'}],error:'upstream failed with secret',usage:{input_tokens:18,output_tokens:4},duration_ms:10},()=>{throw Error('offline');});
 assert.equal(record.error_code,'unexpected_error');assert.equal(record.input_tokens,18);
 assert.doesNotMatch(JSON.stringify(record),/private company|secret|interview|private prompt/);
});
test('identity detects a prompt change even when a manual version string is unchanged',()=>{
 assert.notEqual(identity.prompt_sha256,Ops.identity({version:'test',model:'test-model',prompt:'changed',schema:{type:'object'}}).prompt_sha256);
 assert.equal(Ops.identity({version:'test',model:'test-model',prompt:'private prompt',schema:{type:'object'}}).prompt_sha256,identity.prompt_sha256);
});
test('model tokens are recorded even if generated output fails evidence validation',async()=>{
 const events=[],previous=Ops.emit;Ops.emit=e=>events.push(e);
 try{
  await assert.rejects(()=>Research.synthesize([],{key:'test-key',topic:'private company',traceId:'trace-1',fetcher:async()=>({ok:true,json:async()=>({status:'completed',usage:{input_tokens:40,output_tokens:12},output:[{content:[{type:'output_text',text:JSON.stringify({scope:'supported',facts:[]})}]}]})})}),/insufficient_evidence/);
  assert.equal(events.length,1);assert.equal(events[0].stage,'model');assert.equal(events[0].usage.input_tokens,40);assert.equal(events[0].status,'failed');assert.equal(events[0].trace_id,'trace-1');
 }finally{Ops.emit=previous;}
});
test('provider failures retain an operational error code without leaking provider response',async()=>{
 const events=[],previous=Ops.emit;Ops.emit=e=>events.push(e);
 try{
  await assert.rejects(()=>Research.synthesize([],{key:'test-key',fetcher:async()=>({ok:false,status:429,json:async()=>({error:{code:'insufficient_quota',message:'private account details'}})})}),/model_quota_exhausted/);
  assert.equal(events[0].error,'model_quota_exhausted');assert.equal(events[0].usage,null);
 }finally{Ops.emit=previous;}
});
test('invalid research requests still emit request failure telemetry',async()=>{
 const events=[],previous=Ops.emit;Ops.emit=e=>events.push(e);
 try{
  await assert.rejects(()=>Research.cachedResearch({topic:'!',seeds:[]}),/invalid_topic/);
  assert.equal(events.length,1);assert.equal(events[0].stage,'request');assert.equal(events[0].status,'failed');
 }finally{Ops.emit=previous;}
});
