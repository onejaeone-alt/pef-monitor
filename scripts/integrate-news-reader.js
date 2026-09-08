'use strict';
const fs=require('node:fs'),path=require('node:path');
function replaceRequired(text,from,to){if(!text.includes(from))throw Error('News reader integration anchor missing: '+from.slice(0,80));return text.replace(from,to);}
function page(text){
 if(text.includes('/news-reader.js?v=20260908-r1'))return text;
 if(!/src="\/news-desk\.js[^\"]*"/.test(text))throw Error('Missing news desk entrypoint');
 return text.replace(/<script src="\/news-desk\.js[^\"]*"><\/script>/,'<script src="/news-reader-core.js?v=20260908-r1"></script><script src="/news-reader.js?v=20260908-r1"></script>')
 .replace('</head>','<link rel="stylesheet" href="/news-reader.css?v=20260908-r1"></head>')
 .replace(/data-news-version="[^"]*"/,'data-news-version="20260908-personal-reader"');
}
function api(text){
 if(text.includes('NEWS_READER_INTEGRATED'))return text;
 let n=text;
 n=replaceRequired(n,"const { fetchJakMembers } = require('../lib/jak-members');","const { fetchJakMembers, isJakMemberSource } = require('../lib/jak-members'); // NEWS_READER_INTEGRATED");
 n=replaceRequired(n,'module.exports = async (req, res) => {',"module.exports = async (req, res) => {\n  const readerFeed = String(req.query?.feed || '') === 'reader';\n  const NewsReader = readerFeed ? require('../news-reader-core') : null;\n  if (req.method && req.method !== 'GET') return res.status(405).json({ok:false,error:'GET only'});");
 n=replaceRequired(n,'if (!shouldKeep(item, target, jak.names)) continue;',"const relevance = NewsReader ? NewsReader.assess({...item, target, related_entities:relatedEntities}) : null;\n      if (!shouldKeep(item, target, jak.names) && !(relevance?.status === 'relevant' && isJakMemberSource(item.source_name, jak.names))) continue;");
 n=replaceRequired(n,"event_label: eventLabel(text), jak_member: true,","event_label: eventLabel(text), jak_member: true, relevance,");
 n=replaceRequired(n,'const limitedItems = items.slice(0,limit);',"const inRange = items.filter(item => { const t=Date.parse(item.published_at); return !Number.isFinite(t) || (t>=Date.now()-days*86400000 && t<=Date.now()+300000); });\n    const eligible = inRange.filter(item => item.relevance?.status === 'relevant');\n    const review = inRange.filter(item => item.relevance?.status !== 'relevant');\n    const limitedItems = (readerFeed ? eligible : inRange).slice(0,limit);\n    const reviewItems = readerFeed ? review.slice(0,limit) : [];");
 n=replaceRequired(n,'ok: true, items: limitedItems, issues,','ok: true, items: limitedItems, review_items: reviewItems, issues,');
 n=replaceRequired(n,'collection_status: { refresh: fresh, partial, succeeded, failed: queryList.length - succeeded },','collection_status: { refresh: fresh, partial, succeeded, failed: queryList.length - succeeded, truncated:eligible.length>limit || review.length>limit, relevant_count:eligible.length, review_count:review.length },');
 return n;
}
function reader(text){
 if(text.includes('READER_STABILITY_R2'))return text;
 let n=text;
 n=replaceRequired(n,"const previous=new Set(S.items.map(C.key));","const previous=new Map(S.items.map(x=>[C.key(x),C.revision(x)]));");
 n=replaceRequired(n,"if(hold&&S.loaded&&added){","const changed=[...data.items,...(data.review_items||[])].some(x=>previous.has(C.key(x))&&previous.get(C.key(x))!==C.revision(x));\n  if(hold&&S.loaded&&(added||changed)){");
 n=replaceRequired(n,"'새 보도 '+added+'건 · 눌러서 목록에 적용'","(added?'새 보도 '+added+'건':'제목·발행시각 변경 감지')+' · 눌러서 목록에 적용'");
 n=replaceRequired(n,"if(!S.rows.length)$('#newsList').append(","if(!S.rows.length&&!S.loaded)$('#newsList').append(el('div',{class:'nd-empty',text:'뉴스를 불러오는 중입니다.'}));\n if(!S.rows.length&&S.loaded)$('#newsList').append(");
 n=replaceRequired(n,"status.textContent='조회 실패 · '+(S.loaded?'이전 목록을 유지합니다.':'새로고침을 눌러 다시 시도해 주세요.');","status.textContent='조회 실패 · '+(S.loaded?'이전 목록을 유지합니다.':'새로고침을 눌러 다시 시도해 주세요.');if(!S.loaded)$('#newsList').replaceChildren(el('div',{class:'nd-empty',text:'뉴스 조회에 실패했습니다. 새로고침을 눌러 다시 시도해 주세요.'}));");
 n=replaceRequired(n,"S.issues=data.issues||[];S.days=days;","for(const item of S.items){const k=C.key(item),old=S.records.bookmark[k];if(old&&/^(기존 보관 기사|이전에 보관한 기사)/.test(old.article?.title||'')){old.article=C.snapshot(item);}}try{localStorage.setItem(STORE,JSON.stringify(S.records));}catch{}S.issues=data.issues||[];S.days=days;");
 return '// READER_STABILITY_R2\n'+n;
}
function css(text){return text.replace('.reader-watches{display:none}', '.reader-watches{display:block}.reader-watches h4{margin-top:0}');}
function main(root=path.resolve(__dirname,'..')){for(const[name,transform]of [['index.html',page],['api/news.js',api],['news-reader.js',reader],['news-reader.css',css]]){const file=path.join(root,name),before=fs.readFileSync(file,'utf8'),after=transform(before);if(before!==after)fs.writeFileSync(file,after);}}
if(require.main===module)main();
module.exports={page,api,reader,main};
