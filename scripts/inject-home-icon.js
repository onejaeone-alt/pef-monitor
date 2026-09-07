const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html','dart.html','motae.html','leads.html','projects.html','relations.html','judgment.html'];

for (const file of pages) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  const original = fs.readFileSync(target, 'utf8');
  let next = original;

  if (!next.includes('/home-icon.css')) {
    next = next.replace('</head>', '<link rel="stylesheet" href="/home-icon.css"></head>');
  }

  if (!next.includes('class="brand-home-row"')) {
    next = next.replace(
      '<h1>IB 취재 레이더</h1>',
      '<div class="brand-home-row"><a class="brand-home-icon" href="/" aria-label="뉴스 홈으로 이동" title="뉴스 홈"><img src="/favicon.svg" alt=""></a><h1>IB 취재 레이더</h1></div>'
    );
  }

  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
