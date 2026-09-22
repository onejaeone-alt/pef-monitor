'use strict';
// Run after the legacy integrations and their checks, which transform index as the news reader.
// Keep that complete reader at /news.html, and serve the recommendation desk at /.
const fs=require('node:fs'),path=require('node:path');
function navigation(html,home=false){
  html=html.replace(/(<a\b[^>]*href=")\/("[^>]*>)뉴스(<\/a>)/g,'$1/news.html$2뉴스$3')
    .replace(/(<a\b[^>]*href=")\/leads\.html("[^>]*>)(?:AI 발견|AI 취재단서|추천 기사)(<\/a>)/g,'$1/$2추천 기사$3')
    .replaceAll('뉴스 홈으로 이동','추천 기사 홈으로 이동').replaceAll('IB 취재 레이더 · 뉴스 홈','IB 취재 레이더 · 추천 기사');
  if(home)html=html.replace(/<nav\b[^>]*class="nav"[^>]*>[\s\S]*?<\/nav>/,
    '<nav class="nav" aria-label="주 메뉴"><a class="on" href="/" aria-current="page">추천 기사</a><a href="/news.html">뉴스</a><a href="/news.html?scope=foreign">외신</a><a href="/dart.html">DART 공시</a><a href="/calendar.html">취재 일정</a><a href="/motae.html">출자공고</a><a href="/projects.html">진행중 취재</a><a href="/relations.html">취재파일</a><a href="/judgment.html">기사화 판단</a><a href="https://article-engine-wjy-onejess.vercel.app/" target="_blank" rel="noopener">기사 엔진 ↗</a></nav>');
  // Keep foreign coverage one click away on every desk, including repeated builds.
  html=html.replace(/<nav\b[^>]*class="nav"[^>]*>[\s\S]*?<\/nav>/,nav=>{
    if(!nav.includes('href="/news.html?scope=foreign"'))nav=nav.replace(/(<a\b[^>]*href="\/news\.html"[^>]*>뉴스<\/a>)/,'$1<a href="/news.html?scope=foreign">외신</a>');
    const seen=new Set();
    return nav.replace(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g,(link,href)=>{
      if(seen.has(href))return '';
      seen.add(href);return link;
    });
  });
  return html;
}
function main(root=path.resolve(__dirname,'..')){
  const index=path.join(root,'index.html'),news=path.join(root,'news.html');
  const previous=fs.readFileSync(index,'utf8');
  if(previous.includes('class="page news-desk"'))fs.writeFileSync(news,navigation(previous));
  else if(!fs.readFileSync(news,'utf8').includes('news-desk'))throw Error('News reader must be preserved before replacing home');
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html')&&f!=='index.html')){
    const p=path.join(root,file);fs.writeFileSync(p,navigation(fs.readFileSync(p,'utf8'),file==='leads.html'));
  }
  fs.writeFileSync(index,fs.readFileSync(path.join(root,'leads.html'),'utf8'));
  const header=path.join(root,'site-header.js');
  fs.writeFileSync(header,fs.readFileSync(header,'utf8').replace("href: '/', class: 'site-account-action', text: '뉴스 보관함 관리'","href: '/news.html', class: 'site-account-action', text: '뉴스 보관함 관리'"));
}
function prepare(root=path.resolve(__dirname,'..')){
  const index=path.join(root,'index.html'),news=path.join(root,'news.html');
  if(!fs.readFileSync(index,'utf8').includes('id="discoveryDesk"'))return;
  const reader=fs.readFileSync(news,'utf8');
  if(!reader.includes('class="page news-desk"'))throw Error('Cannot rebuild without the preserved news reader');
  fs.writeFileSync(index,reader);
}
if(require.main===module){if(process.argv.includes('--prepare'))prepare();else main();}
module.exports={navigation,main,prepare};
