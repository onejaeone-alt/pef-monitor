const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'dart.html', 'motae.html', 'relations.html', 'judgment.html', 'leads.html'];

function addClueNav(html) {
  if (html.includes('href="/leads.html"')) return html;
  const relationLink = /<a(\s+class="on")?\s+href="\/relations\.html">취재파일<\/a>/;
  const match = html.match(relationLink);
  if (!match) return html;
  return html.replace(match[0], `<a href="/leads.html">AI 취재단서</a>${match[0]}`);
}

function addClueFilters(html, file) {
  if (file !== 'leads.html' || html.includes('data-detector="gp_lp_shift"')) return html;
  const anchor = '<button class="chip" data-detector="formation_gap">결성 미확인</button><button class="chip" data-detector="cross_source">자료 연결</button>';
  if (!html.includes(anchor)) return html;
  const replacement = '<button class="chip" data-detector="formation_gap">결성 미확인</button><button class="chip" data-detector="gp_lp_shift">GP·LP 이동</button><button class="chip" data-detector="lp_rule_change">LP 기준 변화</button><button class="chip" data-detector="cross_source">자료 연결</button>';
  return html.replace(anchor, replacement);
}

for (const file of pages) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  const original = fs.readFileSync(target, 'utf8');
  let next = addClueNav(original);
  next = addClueFilters(next, file);
  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
