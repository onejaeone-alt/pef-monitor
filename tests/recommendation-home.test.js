'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const Home=require('../scripts/publish-recommendation-home');
test('published home serves recommendations and keeps the complete news reader and navigation',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'recommendation-home-'));
 try{
  for(const f of ['index.html','news.html','leads.html','projects.html','site-header.js'])fs.copyFileSync(f,path.join(dir,f));
  Home.main(dir);Home.main(dir);
  const home=fs.readFileSync(path.join(dir,'index.html'),'utf8'),news=fs.readFileSync(path.join(dir,'news.html'),'utf8');
  assert.match(home,/id="discoveryDesk"/);assert.match(home,/aria-current="page">추천 기사/);
  assert.match(news,/class="page news-desk"/);assert.doesNotMatch(news,/http-equiv="refresh"/);
  assert.match(home,/href="\/news.html">뉴스/);assert.match(fs.readFileSync(path.join(dir,'projects.html'),'utf8'),/href="\/news.html">뉴스/);
  assert.match(home,/<details class="discovery-coverage"><summary>/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('first screen shows only three ready proposals, with evidence collapsed; reference tab and more remain usable',async()=>{
 const nodes=new Map(),node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,fn){this[k]=fn;}});return nodes.get(s);};
 const rows=Array.from({length:5},(_,i)=>({clue_id:'p'+i,headline:'기업'+i,lane:'current',research:{status:'ready'},article_brief:{angles:[{headline:'추천 제목 '+i,reason:'추천 이유'}]},changed_fact:'자료에서 찾은 변화',sources:[{url:'https://example.com',label:'근거 원문'}]}));
 rows.push({clue_id:'raw',headline:'아직 검토하지 않은 자료',lane:'current',sources:[]});
 const C={build:()=>rows,date:()=>'',safeUrl:u=>u,dartCandidates:()=>[]};
 const B={requestFor:()=>null,shortlist:(r,n)=>r.slice(0,n),renderDetails:()=>'<p>상세 근거</p>',renderBriefHtml:()=>''};
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),{IBDiscovery:C,MarketInStoryBrief:B,document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},setTimeout:()=>1,clearTimeout(){},AbortController,localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>({ok:true,json:async()=>({ok:true,items:[]})})});
 await new Promise(r=>setImmediate(r));
 const html=node('#discoveryCards').innerHTML;
 assert.equal((html.match(/<article /g)||[]).length,3);assert.doesNotMatch(html,/아직 검토하지 않은 자료/);assert.doesNotMatch(html,/<details[^>]* open/);
 assert.match(html,/추천 이유/);assert.match(html,/자료에서 찾은 변화/);assert.match(html,/근거와 추적 내역/);assert.equal(node('#discoveryMore').hidden,false);
 node('#discoveryMore').onclick();assert.equal((node('#discoveryCards').innerHTML.match(/<article /g)||[]).length,5);
 node('#discoveryDesk').click({target:{closest:s=>s==='[data-discovery-view]'?{dataset:{discoveryView:'references'}}:null}});
 assert.match(node('#discoveryCards').innerHTML,/아직 검토하지 않은 자료/);assert.doesNotMatch(node('#discoveryCards').innerHTML,/추천 제목/);
});
