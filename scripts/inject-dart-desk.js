'use strict';
const fs=require('node:fs'),path=require('node:path');
function inject(html){let s=html;if(!s.includes('src="/dart-desk.js?v=1"'))s=s.replace('</body>','<script src="/dart-desk.js?v=1" defer></script></body>');if(!s.includes('href="/dart-desk.css?v=1"'))s=s.replace('</head>','<link rel="stylesheet" href="/dart-desk.css?v=1"></head>');return s;}
if(require.main===module){for(const name of ['dart.html','projects.html','judgment.html']){const p=path.join(__dirname,'..',name);if(fs.existsSync(p)){const before=fs.readFileSync(p,'utf8'),after=inject(before);if(before!==after)fs.writeFileSync(p,after);}}if(process.env.VERCEL_GIT_COMMIT_REF==='feat/dart-research-desk-v1')require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'probe-dart-review.cjs')],{stdio:'inherit',timeout:50000});}
module.exports={inject};
