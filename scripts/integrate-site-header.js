'use strict';
// Run after the existing page/account integrations. Source pages and older assets stay intact.
const fs = require('node:fs');
const path = require('node:path');
const VERSION = '20260908-topright1';
const CSS_VERSION = '20260909-nav-readable1';
const headerPattern = /<header\b[^>]*class="[^"]*\btopbar\b[^"]*"[^>]*>[\s\S]*?<\/header>/;

function divWithClass(html, className) {
  const starts = [...html.matchAll(/<div\b[^>]*class="([^"]*)"[^>]*>/g)];
  const start = starts.find(m => m[1].split(/\s+/).includes(className));
  if (!start) throw Error('Shared header: missing ' + className);
  const tags = /<\/?div\b[^>]*>/g;
  tags.lastIndex = start.index;
  let depth = 0, token;
  while ((token = tags.exec(html))) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start.index, tags.lastIndex);
  }
  throw Error('Shared header: unclosed ' + className);
}

function brandHome(brand) {
  if (!brand.includes('class="brand-home-row"')) {
    brand = brand.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/, heading =>
      '<div class="brand-home-row"><a class="brand-home-icon" href="/" aria-label="뉴스 홈으로 이동"><img src="/radar-home.svg" alt=""></a>' + heading + '</div>');
  }
  if (!brand.includes('class="site-brand-home"')) {
    brand = brand.replace(/(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/, (_, open, title, close) => {
      if (/<a\b/.test(title)) throw Error('Shared header: review existing title link');
      return open + '<a class="site-brand-home" href="/" aria-label="IB 취재 레이더 · 뉴스 홈">' + title + '</a>' + close;
    });
  }
  return brand;
}

const searchMarkup = '<div class="global-dossier-search" role="search" aria-label="취재파일 검색"><div class="global-dossier-box"><span aria-hidden="true">⌕</span><input id="globalDossierSearch" type="search" autocomplete="off" placeholder="취재파일 검색 · 기업·GP·LP·펀드" aria-label="취재파일 검색" aria-controls="globalDossierResults" aria-expanded="false"></div><div class="global-dossier-results" id="globalDossierResults" hidden></div></div>';

function page(html) {
  const old = html.match(headerPattern);
  if (!old) return html; // Redirect-only news.html has no screen to change.
  const nav = old[0].match(/<nav\b[^>]*class="nav"[^>]*>[\s\S]*?<\/nav>/);
  if (!nav) throw Error('Shared header: missing navigation');
  const brand = brandHome(divWithClass(old[0], 'brand'));
  const header = '<header class="topbar" data-site-header="' + VERSION + '"><div class="brandrow">' + brand +
    '<div class="site-header-tools"><div class="site-account-row"><button type="button" id="readerAccount" class="site-login" aria-haspopup="dialog">로그인</button></div>' + searchMarkup + '</div>' +
    '<div class="status" id="status" hidden aria-hidden="true"></div></div>' + nav[0] + '</header>';
  let next = html.replace(old[0], header);
  // One search controller for every page; preserve the existing dossier renderer and IDs.
  next = next.replace(/<script\b[^>]*id="global-dossier-search-script"[^>]*>[\s\S]*?<\/script>/g, '');
  if (!next.includes('/dossier-drawer.css')) next = next.replace('</head>', '<link rel="stylesheet" href="/dossier-drawer.css"></head>');
  if (!next.includes('/dossier-drawer.js')) next = next.replace('</body>', '<script src="/dossier-drawer.js"></script></body>');
  if (!next.includes('/site-header.css')) next = next.replace('</head>', '<link rel="stylesheet" href="/site-header.css?v=' + VERSION + '"></head>');
  next = next.replace(/href="\/site-header\.css(?:\?[^"]*)?"/g, 'href="/site-header.css?v=' + CSS_VERSION + '"');
  if (!next.includes('/site-header.js')) next = next.replace('</body>', '<script src="/site-header.js?v=' + VERSION + '"></script></body>');
  next = next.replace(/src="(\/news-reader\.js\?[^"]*)"/g, (_, src) => 'src="' + src.replace(/&header=[^&"]*/g, '') + '&header=' + VERSION + '"');
  next = next.replace(/href="(\/site-header\.css[^"]*)"/g, (_, href) => 'href="' + href.replace(/&brand=[^&"]*/g, '') + '&brand=20260909-large1"');
  return next;
}

function reader(source) {
  if (source.includes('SITE_HEADER_NEWS_V1')) return source;
  const button = ",btn('이 브라우저 저장',{id:'readerAccount',class:'nd-button'})";
  if (!source.includes(button)) throw Error('Shared header: reader login button anchor changed');
  let next = source.replace(button, '');
  const label = /^\s*\$\('#readerAccount'\)\.textContent=[^\n]*;\s*$/m;
  if (!label.test(next)) throw Error('Shared header: reader account label anchor changed');
  next = next.replace(label, `
 const headerAccount=$('#readerAccount');
 headerAccount.textContent=S.mode==='account'?'내 계정':'로그인';
 headerAccount.title=S.mode==='account'?S.user.email:S.mode==='guest'?'브라우저 저장 사용 중 · 로그인 메뉴':S.mode==='checking'?'로그인 상태 확인 중':'로그인';
 headerAccount.setAttribute('aria-controls','readerDialog');
 headerAccount.setAttribute('aria-busy',String(S.mode==='checking'));
`);
  return '// SITE_HEADER_NEWS_V1: the header owns the button; the existing news controller owns its account dialog.\n' + next;
}

function main(root = path.resolve(__dirname, '..')) {
  const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
  for (const name of pages) {
    const target = path.join(root, name), before = fs.readFileSync(target, 'utf8'), after = page(before);
    if (after !== before) fs.writeFileSync(target, after);
  }
  const target = path.join(root, 'news-reader.js');
  const before = fs.readFileSync(target, 'utf8'), after = reader(before);
  if (after !== before) fs.writeFileSync(target, after);
}
if (require.main === module) main();
module.exports = { VERSION, page, reader, divWithClass, brandHome, main };
