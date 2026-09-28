const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../lib/news-translation'),C=require('../news-reader-core');
const item={title:'CVC explores $2 billion sale',source_url:'https://example.com/title',news_scope:'foreign',snippet:''};
const env={OPENAI_API_KEY:'test-not-a-secret',SUPABASE_URL:'https://example.test',SUPABASE_SECRET_KEY:'test-service'};
function storage(){const rows=new Map();return {rows,read:async ids=>ids.map(id=>rows.get(id)).filter(Boolean),claim:async xs=>xs.filter(x=>!rows.has(x.id)).map(x=>{const row={...x,status:'pending',updated_at:new Date().toISOString()};rows.set(x.id,row);return row;}),reclaim:async()=>[],save:async xs=>xs.forEach(x=>rows.set(x.id,x))};}
function provider(requests){return async(url,options)=>{requests.push({url,options});const inputs=JSON.parse(JSON.parse(options.body).input);return {ok:true,json:async()=>({id:'resp_test',status:'completed',usage:{input_tokens:123,output_tokens:22},output:[{content:[{type:'output_text',text:JSON.stringify({translations:inputs.map(x=>({id:x.id,title_ko:'CVC, 20억 달러 규모 매각 검토',snippet_ko:''}))})}]}]})};};}
test('translation is saved before reuse and never changes reading revision or original',async()=>{const db=storage(),requests=[];const first=await N.translateItems([item],{env,storage:db,fetcher:provider(requests)});assert.equal(first.items[0].title,item.title);assert.equal(first.status.translated,1);assert.equal(C.revision(first.items[0]),C.revision(item));assert.equal(db.rows.get(N.record(item).id).status,'ready');const second=await N.translateItems([item],{env,storage:db,fetcher:provider(requests)});assert.equal(second.items[0].title_ko,first.items[0].title_ko);assert.equal(requests.length,1);assert.ok(!requests[0].options.body.includes(item.source_url));});
test('Korean snapshots remain searchable after the live feed no longer contains the item',()=>{const translated={...item,title_ko:'CVC, 20억 달러 규모 매각 검토'};const state=C.apply(C.empty(),[{kind:'bookmark',key:item.source_url,value:{article:translated}}]);assert.equal(C.select([],state,{view:'saved',newsScope:'foreign',query:'매각'}).length,1);assert.equal(C.select([],state,{view:'saved',newsScope:'foreign',query:'explores'}).length,1);});
test('missing API key still serves already stored translations without generation',async()=>{const db=storage(),row=N.record(item);db.rows.set(row.id,{...row,status:'ready',title_ko:'CVC 매각 검토'});const x=await N.translateItems([item],{env:{...env,OPENAI_API_KEY:''},storage:db,fetcher:()=>{throw Error('no call');}});assert.equal(x.status.translated,1);});
test('failed translations are disclosed; original article is retained',async()=>{const db=storage();const x=await N.translateItems([item],{env,storage:db,fetcher:async()=>({ok:false,status:429})});assert.equal(x.items[0].title,item.title);assert.equal(x.status.failed,1);assert.equal(x.status.error,'translation_quota_or_rate_limit');assert.equal(db.rows.get(N.record(item).id).status,'failed');});
test('quota exhaustion is distinguished from a temporary rate limit without exposing provider messages',async()=>{for(const [code,expected] of [['insufficient_quota','translation_quota_exhausted'],['rate_limit_exceeded','translation_rate_limited']]){const db=storage();const x=await N.translateItems([item],{env,storage:db,fetcher:async()=>({ok:false,status:429,json:async()=>({error:{code,message:'private provider details'}})})});assert.equal(x.status.error,expected);assert.ok(!JSON.stringify(x).includes('private provider details'));}});
test('unmatched output IDs cannot attach a translation to the wrong article',async()=>{const row=N.record(item);await assert.rejects(N.generate([row],{key:'test',fetcher:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({translations:[{id:'wrong',title_ko:'다른 기사',snippet_ko:''}]})}]}]})})}),/invalid_response/);});

test('OpenAI 429 falls back automatically, records the actual provider, and reuses the saved Korean title',async()=>{
 const db=storage(),calls=[];
 const fetcher=async(url,options)=>{calls.push(url);if(url.includes('openai.com'))return {ok:false,status:429,json:async()=>({error:{code:'insufficient_quota'}})};
  assert.equal(new URL(url).searchParams.get('q'),item.title);assert.ok(!url.includes(item.source_url));assert.ok(!options.headers?.Authorization);
  return {ok:true,json:async()=>({responseStatus:200,quotaFinished:false,responseData:{translatedText:'CVC, 20억 달러 규모 매각 검토'}})};};
 const first=await N.translateItems([item],{env,storage:db,fetcher});
 assert.equal(first.status.failed,0);assert.equal(first.status.error,undefined);assert.equal(first.items[0].translation_provider,'MyMemory');assert.equal(first.status.fallback,1);
 assert.equal(first.items[0].title,item.title);assert.equal(db.rows.get(N.record(item).id).model,'mymemory-en-ko-v1');
 const second=await N.translateItems([item],{env,storage:db,fetcher});assert.equal(second.items[0].title_ko,first.items[0].title_ko);assert.equal(calls.length,2);
});

test('missing OpenAI key can translate a new headline through the backup',async()=>{
 const x=await N.translateItems([item],{env:{...env,OPENAI_API_KEY:''},storage:storage(),fetcher:async url=>{
  assert.ok(url.startsWith('https://api.mymemory.translated.net/'));return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'CVC, 매각 검토'}})};
 }});assert.equal(x.status.translated,1);
});

test('quota circuit stops repeat OpenAI calls across feed refreshes while still translating new items',async()=>{
 const state={},db=storage();let openaiCalls=0;
 const fetcher=async url=>{if(url.includes('openai.com')){openaiCalls++;return {ok:false,status:429,json:async()=>({error:{type:'insufficient_quota'}})};}return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'새 펀드 결성'}})};};
 await N.translateItems([item],{env,storage:db,fetcher,state});
 const next=await N.translateItems([{...item,title:'KKR closes new fund'}],{env,storage:db,fetcher,state});assert.equal(next.status.translated,1);assert.equal(openaiCalls,1);
});

test('backup quota messages are never cached or shown as a translation',async()=>{
 const db=storage();let calls=0;
 const x=await N.translateItems([item,{...item,title:'Another fund closes'}],{env:{...env,OPENAI_API_KEY:''},storage:db,fetcher:async()=>{calls++;return {ok:true,json:async()=>({quotaFinished:true,responseStatus:403,responseData:{translatedText:'MYMEMORY WARNING: daily limit'}})};}});
 assert.equal(x.status.translated,0);assert.equal(x.status.failed,2);assert.equal(x.status.fallback_error,'translation_fallback_quota_exhausted');assert.equal(calls,1);assert.ok(x.items.every(row=>!row.title_ko));
});

test('saving failure does not discard a successfully generated translation',async()=>{
 const db=storage();db.save=async()=>{throw Error('db offline');};
 const x=await N.translateItems([item],{env,storage:db,fetcher:provider([])});
 assert.equal(x.status.translated,1);assert.equal(x.status.storage_error,'translation_store_unavailable');assert.equal(x.items[0].title_ko,'CVC, 20억 달러 규모 매각 검토');
});

test('backup corrects finance terminology only when the English source contains the corresponding term',()=>{
 const F=require('../lib/news-translation-fallback');
 assert.equal(F.clean('개인 신용 혼란 완화','Private credit turmoil eases'),'사모대출 혼란 완화');
 assert.equal(F.clean('개인 신용 평가','Personal credit checks'),'개인 신용 평가');
});

test('stale failures are reclaimed in bulk and recovered; fresh leases are not duplicated',async()=>{
 const db=storage(),old=N.record(item);let claims=0;
 db.rows.set(old.id,{...old,status:'failed',updated_at:'2026-01-01T00:00:00Z'});
 db.reclaimMany=async rows=>{claims++;assert.equal(rows.length,1);return rows;};
 const x=await N.translateItems([item],{env,storage:db,fetcher:provider([])});assert.equal(x.status.translated,1);assert.equal(claims,1);
 const pending=storage();pending.rows.set(old.id,{...old,status:'pending',updated_at:new Date().toISOString()});
 const y=await N.translateItems([item],{env,storage:pending,fetcher:()=>{throw Error('must not duplicate work');}});assert.equal(y.status.translated,0);
});
