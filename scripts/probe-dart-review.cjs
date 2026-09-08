'use strict';
// Fixed, public receipt fixtures only. Never log API keys, requests or environment values.
(async()=>{if(process.env.VERCEL_GIT_COMMIT_REF!=='feat/dart-research-desk-v1')return;
const R=require('../lib/dart-review');
for(const n of ['20260908000103','20260907000332','20260908900149']){
try{const d=await R.fetchArchive(n);const ts=R.tables(d.markup);const headers=ts.flatMap(t=>t.rows.filter(r=>r.cells.some(c=>/정정\s*전|정정\s*후/.test(c.value))).map(r=>({table:t.number,row:r.number,cells:r.cells.map(c=>({value:c.value.slice(0,160),span:c.span,rowspan:c.rowspan}))}))).slice(0,8);
console.log('DART_PUBLIC_PROBE '+JSON.stringify({receipt:n,entry:d.entry,table_count:ts.length,headers,first_tables:headers.length?[]:ts.slice(0,4).map(t=>({table:t.number,rows:t.rows.slice(0,3)}))}));
}catch(e){console.log('DART_PUBLIC_PROBE '+JSON.stringify({receipt:n,error:/^(DART_|DOCUMENT_|PRIMARY_)/.test(e.message)?e.message:'READ_FAILED'}));}}
})().catch(()=>{console.log('DART_PUBLIC_PROBE_FAILED');});
