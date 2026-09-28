'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Core=require('../discovery-core');
const B=require('../marketin-story-brief');

const stamp=new Date().toISOString();
const source={source_url:'https://www.example.com/lp-notice',title:'국민연금, 사모펀드 위탁운용사 선정에 8000억원 출자',source_name:'기관 공고',published_at:stamp};
const otherSource={source_url:'https://www.example.com/exit',title:'테스트PE, 식품기업 매각 추진',source_name:'경제신문',published_at:stamp};
// The desk consumes an engine contract, so these fixtures isolate interaction from text generation.
// A separate integration case below runs the actual recommendation engine.
function proposal(row,category='lp'){
 return {clue_id:category+'-proposal',detector:'recommendation',lane:'current',category,type_label:'출자 방향',headline:row.title+'의 의미',article_pitch:row.title+'의 의미',pitch_summary:'공개된 투자 대상과 선발 조건을 정리하는 기사다.',why_now:'새 출자 계획이 공개됐다.',comparison_axis:'투자 대상과 운용사 선발 조건',questions:['어떤 운용사에 기회가 있나'],sort_date:row.published_at,score:78,score_breakdown:{specificity:25,importance:23,timeliness:15,evidence:10,attention:5},ranking_reasons:['출자 계획에 구체적인 금액이 있다.'],research_topic:category==='lp'?'국민연금':undefined,sources:[{url:row.source_url,title:row.title,label:row.source_name,date:row.published_at}],evidence:[{text:row.title,url:row.source_url,label:row.source_name,date:row.published_at,read_level:'title'}]};
}
const fixtureEngine={build(input){return (input.news||[]).map(row=>proposal(row,row.source_url===source.source_url?'lp':'pef'));}};

function harness({engine=fixtureEngine,feedRows=[source,otherSource],researchError=false,holdResearch=false,failFeeds=false,savedPitches}={}){
 const nodes=new Map(),storage=new Map(),requests=[],timers=new Set();
 if(savedPitches)storage.set('ib_pitch_last_v1',JSON.stringify(savedPitches));
 let failed=failFeeds,rows=feedRows,releaseResearch;
 const researchGate=holdResearch?new Promise(resolve=>releaseResearch=resolve):Promise.resolve();
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},setAttribute(){},focus(){this.focused=true;},addEventListener(event,fn){this['on'+event]=fn;},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},hasAttribute(name){return name==='data-discovery-angle'&&Object.hasOwn(this.dataset,'discoveryAngle');}});
  return nodes.get(selector);
 };
 const context={IBDiscovery:{...Core,build:()=>[]},MarketInStoryBrief:B,DiscoveryRecommendations:engine,document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},navigator:{onLine:true},addEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref();timers.add(timer);return timer;},clearTimeout,AbortController,URL,console,location:{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},fetch:async(url,{signal}={})=>{
  requests.push(url);
  if(url.includes('mode=research')){
   await Promise.race([researchGate,new Promise((_,reject)=>signal?.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))]);
   return {ok:true,json:async()=>({ok:true,version:B.VERSION,status:researchError?'sources_only':'ready',error:researchError?'model_unavailable':null,as_of:stamp,sources:[{source_id:'s1',url:source.source_url,title:source.title,publisher:source.source_name,read_ok:true}],analysis:researchError?null:{summary:{text:'본문에서 확인한 출자 계획'},why_now:{text:'새 공고'},facts:[{id:'f1',source_id:'s1',text:source.title}],already_covered:[],changes:[],uncertainties:[],angles:[{headline:'AI가 제안한 별개의 후속 기사',reason:'다른 방향',new_information:'다른 비교',basis_ids:['f1'],question:'추가 질문',missing:'추가 취재',direction_key:'different-ai-angle'}]}})};
  }
  if(failed)throw Error('feed unavailable');
  return {ok:true,json:async()=>({ok:true,items:url.includes('feed=reader')?rows:[],events:[],source_signals:[]})};
 }};
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),context);
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
 const click=(selector,dataset)=>{const target=typeof dataset==='string'?node(dataset):{dataset,isConnected:true,focus(){},hasAttribute(name){return name==='data-discovery-angle'&&Object.hasOwn(this.dataset,'discoveryAngle');}};node('#discoveryDesk').onclick({target:{closest:query=>query===selector?target:null}});};
 return {node,storage,requests,context,settle,click,releaseResearch:()=>releaseResearch?.(),failFeeds:()=>failed=true,setRows:value=>rows=value,dispose:()=>{releaseResearch?.();for(const timer of timers)clearTimeout(timer);}};
}

test('grounded rule recommendations remain visible after AI failure and their evidence is labelled honestly',async t=>{
 const h=harness({researchError:true});t.after(h.dispose);await h.settle();
 assert.ok(h.requests.some(url=>url.includes('mode=research')),'the model enrichment was attempted');
 assert.match(h.node('#discoveryCounts').textContent,/추천 기사 2건/);
 assert.match(h.node('#discoveryCards').innerHTML,/data-recommendation-open="lp-proposal"/);
 assert.match(h.node('#discoveryCards').innerHTML,/제목 확인/);
 assert.match(h.node('#discoveryResearchStatus').textContent,/추천은 유지/);
 h.click('[data-recommendation-open]',{recommendationOpen:'lp-proposal'});
 assert.equal(h.node('#recommendationDialog').open,true);
 assert.equal(h.node('#recommendationTitle').textContent,proposal(source).headline);
 assert.match(h.node('#recommendationBody').innerHTML,/어떤 기사인가/);
 assert.ok(h.node('#recommendationBody').innerHTML.includes('href="'+source.source_url+'"'));
 assert.match(h.node('#recommendationBody').innerHTML,/기관 공고/);
});

test('find today finishes once collection is ready while AI enrichment is still pending',async t=>{
 const h=harness({holdResearch:true});t.after(h.dispose);await h.settle();
 let completed=false;
 const finding=h.node('#findToday').onclick().then(()=>completed=true);
 await h.settle();
 assert.equal(completed,true,'a stalled AI request must not hold the find-today button');
 await finding;
 assert.equal(h.node('#findToday').disabled,false);
 assert.match(h.node('#todayPitchStatus').textContent,/추천 기사 2건/);
 assert.match(h.node('#discoveryCards').innerHTML,/추천기사 열기/);
});

test('saving a rule recommendation preserves that article direction when AI has proposed another angle',async t=>{
 const h=harness();t.after(h.dispose);await h.settle();
 h.click('[data-recommendation-open]',{recommendationOpen:'lp-proposal'});
 assert.equal(h.node('#recommendationTitle').textContent,proposal(source).headline);
 h.click('[data-discovery-project]','#saveRecommendation');
 const saved=JSON.parse(h.storage.get('pef_my_reporting_projects_v1'));
 assert.equal(saved.length,1);
 assert.equal(saved[0].title,proposal(source).headline);
 assert.equal(saved[0].clue.clue_id,'lp-proposal');
 assert.equal(saved[0].clue.research.analysis.angles[0].headline,'AI가 제안한 별개의 후속 기사');
 assert.equal(saved[0].clue.selected_angle,undefined);
 assert.equal(saved[0].clue.evidence[0].url,source.source_url);
 assert.match(h.context.location.href,/project=project-lp-proposal/);
});

test('category filters show matching article directions and can return to all recommendations',async t=>{
 const h=harness();t.after(h.dispose);await h.settle();
 h.click('[data-pitch-category]',{pitchCategory:'lp'});
 assert.match(h.node('#discoveryCards').innerHTML,/data-recommendation-open="lp-proposal"/);
 assert.doesNotMatch(h.node('#discoveryCards').innerHTML,/data-recommendation-open="pef-proposal"/);
 assert.match(h.node('#recommendationFilters').innerHTML,/data-pitch-category="lp" aria-pressed="true"/);
 h.click('[data-pitch-category]',{pitchCategory:'all'});
 assert.match(h.node('#discoveryCards').innerHTML,/data-recommendation-open="pef-proposal"/);
});

test('failed collection restores the previous grounded recommendation with its original timestamp',async t=>{
 const at=Date.now()-3600000;
 const h=harness({failFeeds:true,savedPitches:{at,items:[proposal(source)]}});t.after(h.dispose);await h.settle();
 assert.match(h.node('#discoveryCards').innerHTML,/data-recommendation-open="lp-proposal"/);
 assert.match(h.node('#discoveryCards').innerHTML,/이전 추천/);
 assert.ok(h.node('#discoveryCards').innerHTML.includes(new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));
 assert.equal(JSON.parse(h.storage.get('ib_pitch_last_v1')).at,at);
 assert.match(h.node('#discoverySources').innerHTML,/불러오기 실패/);
});

test('failed refresh labels retained source recommendations instead of claiming a fresh recommendation timestamp',async t=>{
 const h=harness();t.after(h.dispose);await h.settle();
 const previous=JSON.parse(h.storage.get('ib_pitch_last_v1'));
 h.failFeeds();await h.node('#findToday').onclick();await h.settle();
 assert.match(h.node('#discoveryCards').innerHTML,/data-recommendation-open="lp-proposal"/);
 assert.match(h.node('#discoveryCards').innerHTML,/이전 추천/);
 assert.ok(h.node('#discoveryCards').innerHTML.includes(new Date(previous.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));
 assert.equal(JSON.parse(h.storage.get('ib_pitch_last_v1')).at,previous.at);
 assert.match(h.node('#todayPitchStatus').textContent,/수집원은 확인하지 못/);
});

test('actual rule engine turns collected LP and PEF news into selectable articles with the exact evidence',async t=>{
 const R=require('../discovery-recommendations');
 const feedRows=[
  {title:'국민연금, 국내 사모펀드 8000억원 출자 위탁운용사 선정',source_url:'https://example.com/lp',source_name:'한국경제',published_at:stamp,target:{name:'국민연금',category:'lp'}},
  {title:'MBK, 네파 K2그룹에 매각',source_url:'https://example.com/ma',source_name:'더벨',published_at:stamp,target:{name:'MBK파트너스',category:'pef'},related_entities:[{canonical_name:'네파',entity_type:'company'}]},
  {title:'네파, K2그룹 새 최대주주로…주주배정 유상증자 추진',source_url:'https://example.com/ma-capital',source_name:'이데일리',published_at:stamp,target:{name:'네파',category:'company'},related_entities:[{canonical_name:'MBK파트너스',entity_type:'pef'},{canonical_name:'K2그룹',entity_type:'company'}]}
 ];
 const generated=R.build({news:feedRows},{limit:12});
 const lp=generated.find(pitch=>pitch.category==='lp');
 const pef=generated.find(pitch=>pitch.category==='pef');
 assert.ok(lp&&pef,'the production engine must produce both editorial categories from the source fixtures');
 const h=harness({engine:R,feedRows,researchError:true});t.after(h.dispose);await h.settle();
 assert.ok(h.node('#discoveryCards').innerHTML.includes(lp.headline));
 assert.ok(h.node('#discoveryCards').innerHTML.includes(pef.headline));
 h.click('[data-pitch-category]',{pitchCategory:'lp'});
 assert.ok(h.node('#discoveryCards').innerHTML.includes(lp.headline));
 assert.ok(!h.node('#discoveryCards').innerHTML.includes(pef.headline));
 h.click('[data-recommendation-open]',{recommendationOpen:lp.clue_id});
 assert.equal(h.node('#recommendationTitle').textContent,lp.headline);
 assert.ok(h.node('#recommendationBody').innerHTML.includes(lp.pitch_summary));
 assert.ok(h.node('#recommendationBody').innerHTML.includes('href="'+feedRows[0].source_url+'"'));
 assert.ok(h.node('#recommendationBody').innerHTML.includes(feedRows[0].title));
 assert.match(h.node('#recommendationBody').innerHTML,/제목 확인/);
 h.click('[data-discovery-project]','#saveRecommendation');
 const [saved]=JSON.parse(h.storage.get('pef_my_reporting_projects_v1'));
 assert.equal(saved.title,lp.headline);
 assert.equal(saved.clue.type,lp.type);
 assert.equal(saved.clue.evidence[0].url,feedRows[0].source_url);
});
