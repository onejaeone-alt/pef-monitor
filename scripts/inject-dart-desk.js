'use strict';
const fs=require('node:fs'),path=require('node:path');
function inject(html){
  // Stop loading the retired question/lens UI without deleting its historical code or data.
  let s=html.replace(/<script\b[^>]*src=["']\/dart-reporting-topics\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/g,'');
  const js=/<script\b[^>]*src=["']\/dart-desk\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/g;
  let found=false;s=s.replace(js,()=>{if(found)return '';found=true;return '<script src="/dart-desk.js?v=3" defer></script>';});
  if(!found)s=s.replace('</body>','<script src="/dart-desk.js?v=3" defer></script></body>');
  const css=/<link\b[^>]*href=["']\/dart-desk\.css(?:\?[^"']*)?["'][^>]*>/g;
  found=false;s=s.replace(css,()=>{if(found)return '';found=true;return '<link rel="stylesheet" href="/dart-desk.css?v=3">';});
  if(!found)s=s.replace('</head>','<link rel="stylesheet" href="/dart-desk.css?v=3"></head>');
  return s;
}
if(require.main===module)for(const name of ['dart.html','projects.html','judgment.html']){const p=path.join(__dirname,'..',name);if(fs.existsSync(p)){const before=fs.readFileSync(p,'utf8'),after=inject(before);if(before!==after)fs.writeFileSync(p,after);}}
module.exports={inject};
