'use strict';
const fs = require('node:fs');
const path = require('node:path');
const VERSION = '20261002-1';

// Run after the existing HTML integrations, which match their original URLs.
function update(html) {
  return html.replace(/((?:src|href)=["'])(\/(?:news-reader|dossier-drawer|discovery-desk|dart-desk|public-feed-cache)\.js(?:\?[^"']*)?)(["'])/g, (_, prefix, url, quote) => {
    const parsed = new URL(url, 'https://assets.invalid');
    parsed.searchParams.set('perf', VERSION);
    return prefix + parsed.pathname + parsed.search + quote;
  });
}
function main(root = path.resolve(__dirname, '..')) {
  for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
    const file = path.join(root, name), before = fs.readFileSync(file, 'utf8');
    const after = update(before);
    if (after !== before) fs.writeFileSync(file, after);
  }
}
if (require.main === module) main();
module.exports = { update, main };
