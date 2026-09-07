const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'leads.html');
if (fs.existsSync(target)) {
  const original = fs.readFileSync(target, 'utf8');
  let next = original;
  if (!next.includes('/ai-discovery.css')) {
    next = next.replace('</head>', '<link rel="stylesheet" href="/ai-discovery.css"></head>');
  }
  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
