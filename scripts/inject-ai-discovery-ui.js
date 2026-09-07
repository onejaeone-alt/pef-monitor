const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'leads.html');
if (fs.existsSync(target)) {
  const original = fs.readFileSync(target, 'utf8');
  let next = original;
  if (!next.includes('/ai-discovery.css')) {
    next = next.replace('</head>', '<link rel="stylesheet" href="/ai-discovery.css"></head>');
  }
  next = next.replace(/;\$\('#sFollowup'\)\.textContent=DATA\.filter\(x=>x\.judgment==='추가취재'\)\.length/g, '');
  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
