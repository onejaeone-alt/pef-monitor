'use strict';
const fs = require('node:fs');
const path = require('node:path');
function inject(html) {
  let next=html;
  if(!next.includes('href="/preflight.css?v=1"'))next=next.replace('</head>','<link rel="stylesheet" href="/preflight.css?v=1"></head>');
  if(!next.includes('src="/preflight.js?v=1"'))next=next.replace('</body>','<script src="/preflight.js?v=1" defer></script></body>');
  return next;
}
function main(root=path.resolve(__dirname,'..')) {
  for(const name of ['leads.html','projects.html','judgment.html']){
    const file=path.join(root,name);if(!fs.existsSync(file))continue;
    const before=fs.readFileSync(file,'utf8'),after=inject(before);if(after!==before)fs.writeFileSync(file,after,'utf8');
  }
}
if(require.main===module)main();
module.exports={inject,main};
