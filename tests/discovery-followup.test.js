'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),F=require('../discovery-followup'),B=require('../marketin-story-brief'),C=require('../discovery-core'),R=require('../lib/discovery-research');
const title='맥쿼리, 가비아 인수 최종 무산…공개매수 실패에 주식매매계약 해제';
const news=(t,url,id)=>({title:t,source_url:url,source_name:'테스트 매체',published_at:new Date(Date.now()-3600000).toISOString(),target:{name:id},source_type:'news'});
const article=news(title,'https://www.hankyung.com/article/1','맥쿼리');
function selected(items){const core={...C};B.install({IBDiscovery:core});return core.build({news:items});}
test('identical headlines from different entity paths merge and unrelated same-company events are excluded',()=>{
 const rows=selected([article,news(title,'https://news.google.com/rss/articles/abc','가비아'),news('가비아, 고객 2998명 개인정보 유출…공개매수 불발 이어 악재','https://www.hankyung.com/article/2','가비아')]);
 assert.equal(rows.length,1);assert.equal(rows[0].research_topic,'가비아');assert.equal(rows[0].sources.length,2);assert.ok(rows[0].sources.every(s=>!s.title.includes('개인정보')));
 const p=F.plan(rows[0]);assert.match(p.headline,/가비아 공개매수/);assert.notEqual(p.headline,title);assert.match(p.question,/최소 매수수량.*실제 응모수량/);assert.equal(p.checks.length,3);assert.match(p.provisional,/본문 대조 전/);assert.match(p.promotion,/기존 기사.*새 발제로 올리지/);assert.equal(rows[0].article_pitch,undefined);
});
test('ordinary sale announcements and stock roundups do not receive invented follow-up plans',()=>{
 for(const t of ['피자헛, 15억달러에 사모펀드에 매각','셀리드·블루엠텍, 경영권 매각 소식에 들썩…인벤테라 상승[바이오 맥짚기]','의무공개매수제까지…겹규제에 묶인 M&A']){
  assert.equal(F.plan({detector:'news_followup',headline:t,research_topic:'테스트',sources:[{url:article.source_url}]}),null);
 }
});
test('same corporation financing and fund formation remain separate research topics',()=>{
 const rows=selected([news('시험사, 인수금융 지원 확약','https://www.hankyung.com/article/3','시험사'),news('시험사, 사모펀드 결성','https://www.hankyung.com/article/4','시험사')]);
 assert.equal(rows.length,2);assert.notEqual(rows[0].clue_id,rows[1].clue_id);assert.ok(rows.every(r=>r.sources.length===1));
});
test('source selection follows tender evidence, excludes cyber news and prefers original over identical redirect',()=>{
 const records=[{title,url:'https://news.google.com/rss/articles/abc'},{title,url:article.source_url},{title:'가비아 고객 개인정보 유출…공개매수 불발 이어 악재',url:'https://www.hankyung.com/article/2'},{title:'가비아 공개매수신고서 최소 매수수량',url:'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260923000001'}];
 const rows=R.chooseSources(records,'가비아',Date.now(),[{title}]);assert.equal(rows.length,2);assert.ok(rows.some(s=>s.url===article.source_url));assert.ok(rows.every(s=>!s.title.includes('개인정보')));
});
test('research searches previous tender terms instead of only broad company news',async()=>{
 const queries=[];await R.research({topic:'가비아',seeds:[{title,url:article.source_url}]},{key:'',search:async(q,p)=>{queries.push([q,p]);return {records:[],log:[]};},index:async()=>[],read:async d=>({...d,read_ok:false})});
 assert.ok(queries.every(([q])=>q.includes('공개매수')));assert.ok(queries.some(([q,p])=>p==='previous_terms'&&q.includes('결과보고서')));
 assert.equal(R.marketinLinks('<a href="/News/ReadE?newsId=123">가비아 공개매수</a>','가비아').length,1);
});
test('desk keeps unanalysed news as collapsed sources without inventing a follow-up checklist',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),nodes=new Map(),storage=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,fn){this[k]=fn;}});return nodes.get(s);};
 const core={...C};B.install({IBDiscovery:core});
 const items=[article,news('피자헛, 15억달러에 사모펀드에 매각','https://www.hankyung.com/article/5','피자헛')];
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),{IBDiscovery:core,MarketInStoryBrief:B,DiscoveryFollowup:F,document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},setTimeout:()=>1,clearTimeout(){},AbortController,location:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async url=>({ok:true,json:async()=>url.includes('mode=research')?{ok:true,version:B.VERSION,status:'sources_only',error:'insufficient_sources',sources:[]}:{ok:true,items:url.includes('feed=reader')?items:[],events:[]}})});
 await new Promise(r=>setImmediate(r));const html=node('#discoveryCards').innerHTML;
 assert.match(html,/수집한 자료 2건/);
 assert.doesNotMatch(html,/후속 확인 후보|발제 확정 전|대조할 공개자료|발제로 올릴 조건|공개매수결과보고서|data-recommendation-open|data-discovery-project/);
 assert.equal((html.match(/data-discovery-card=/g)||[]).length,0);
 assert.match(html,/<details class="discovery-inbox" data-discovery-inbox >/);
 assert.ok(html.includes(article.source_url));
 assert.equal(node('#discoveryCounts').textContent,'추천 기사 0건');
});
