'use strict';
// Fixed public receipt fixtures. No credentials or request URLs are logged.
(async()=>{if(process.env.VERCEL_GIT_COMMIT_REF!=='feat/dart-research-desk-v1')return;const R=require('../lib/dart-review');
for(const n of ['20260908000103','20260907000332','20260908900149']){try{const d=await R.fetchArchive(n),r=R.analyzeMarkup(d.markup,{rcept_no:n,entry:d.entry}),ts=R.tables(d.markup);
console.log('DART_PUBLIC_PROBE '+JSON.stringify({receipt:n,state:r.state,changes:r.changes.slice(0,4).map(c=>({label:c.label,before:c.before.slice(0,140),after:c.after.slice(0,140),reason:c.reason})),warnings:r.warnings,table_start:ts.slice(4,6).map(t=>({table:t.number,rows:t.rows.slice(0,4).map(r=>({row:r.number,cells:r.cells.map(c=>({...c,value:c.value.slice(0,100)}))}))}))}));
}catch(e){console.log('DART_PUBLIC_PROBE '+JSON.stringify({receipt:n,error:/^(DART_|DOCUMENT_|PRIMARY_)/.test(e.message)?e.message:'READ_FAILED'}));}}
})().catch(()=>console.log('DART_PUBLIC_PROBE_FAILED'));
