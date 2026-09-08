'use strict';
const fs=require('node:fs'),path=require('node:path');
function inject(html){
  // Replace only this desk's asset tags. Never alter other tabs, account scripts or stored data.
  let s=html.replace(/<script\b[^>]*src=["']\/dart-reporting-topics\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/g,'');
  const script=/<script\b[^>]*src=["']\/dart-desk\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/g;
  const tags='<script src="/dart-reporting-topics.js?v=1" defer></script><script src="/dart-desk.js?v=2" defer></script>';
  let added=false;s=s.replace(script,()=>{if(added)return '';added=true;return tags;});
  if(!added)s=s.replace('</body>',tags+'</body>');
  const css=/<link\b[^>]*href=["']\/dart-desk\.css(?:\?[^"']*)?["'][^>]*>/g;
  added=false;s=s.replace(css,()=>{if(added)return '';added=true;return '<link rel="stylesheet" href="/dart-desk.css?v=2">';});
  if(!added)s=s.replace('</head>','<link rel="stylesheet" href="/dart-desk.css?v=2"></head>');
  return s;
}
if(require.main===module)for(const name of ['dart.html','projects.html','judgment.html']){const p=path.join(__dirname,'..',name);if(fs.existsSync(p)){const before=fs.readFileSync(p,'utf8'),after=inject(before);if(before!==after)fs.writeFileSync(p,after);}}
module.exports={inject};
