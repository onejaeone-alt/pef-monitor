'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const C=require('../discovery-core');
const P=require('../discovery-patterns');
const R=require('../discovery-recommendations');

const START=Date.parse('2026-09-28T03:00:00Z');
const archiveArticle={title:'시험파트너스, 가온식품 경영권 인수 계약 체결',source_url:'https://example.com/ga-on',source_name:'첫째매체',published_at:'2026-09-08T01:00:00Z',target:{name:'시험파트너스',category:'gp'}};
const freshArticle={title:'시험파트너스, 나래식품 경영권 매각 본계약 체결',source_url:'https://example.com/na-rae',source_name:'둘째매체',published_at:'2026-09-28T01:00:00Z',target:{name:'시험파트너스',category:'gp'}};
const addedArticle={title:'시험파트너스, 다온물류 경영권 인수 계약 체결',source_url:'https://example.com/da-on',source_name:'셋째매체',published_at:'2026-09-28T02:00:00Z',target:{name:'시험파트너스',category:'gp'}};
const baseline={clue_id:'canonical-baseline',detector:'gp_repeat',lane:'background',headline:'옛운용사 복수 LP 선정',one_line_signal:'옛운용사는 서로 다른 두 LP에서 선정됐다.',entities:['옛운용사'],sort_date:'2026-07-29',previous_state:'7월 선정 결과 두 건',sources:[{url:'https://example.com/original-analysis',title:'옛운용사, LP 선정 결과',date:'2026-07-29',label:'기존 공고'}],confirmed_facts:['7월 선정 결과에 포함'],hypothesis:'펀드 결성 가능성'};

function harness({archived=[archiveArticle],news=[freshArticle],canonical=[baseline],storage:initialStorage}={}){
 const nodes=new Map(),timers=new Map(),storage=new Map(initialStorage||[]),accumulationCalls=[];
 let now=START,timerId=0,currentNews=news,currentCanonical=canonical;
 if(!storage.has('ib_pitch_sources_v1'))storage.set('ib_pitch_sources_v1',JSON.stringify({news:archived}));
 class TestDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,dataset:{},open:false,classList:{toggle(){}},setAttribute(){},focus(){},addEventListener(event,fn){this[event]=fn;},hasAttribute(){return false;},showModal(){this.open=true;},close(){this.open=false;}});
  return nodes.get(selector);
 };
 const patterns={...P,accumulate(input,options){accumulationCalls.push({input,options});return P.accumulate(input,options);}};
 const context={IBDiscovery:C,DiscoveryPatterns:patterns,DiscoveryRecommendations:R,document:{hidden:false,querySelector:node,querySelectorAll:()=>[],addEventListener(){}},Date:TestDate,navigator:{onLine:true},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener(){},AbortController,URL,console,location:{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},fetch:async url=>({ok:true,json:async()=>({ok:true,items:url.includes('mode=clues')?currentCanonical:url.includes('feed=reader')?currentNews:[],source_signals:[],events:[]})})};
 vm.runInNewContext(fs.readFileSync('discovery-desk.js','utf8'),context);
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
 const click=(selector,dataset)=>node('#discoveryDesk').click({target:{closest:query=>query===selector?{dataset,hasAttribute(){return false;}}:null}});
 const background=()=>click('[data-discovery-view]',{discoveryView:'background'});
 const saved=()=>JSON.parse(storage.get('pef_my_reporting_projects_v1')||'[]');
 const save=id=>{click('[data-discovery-project]',{discoveryProject:id});return saved().find(project=>project.clue.clue_id===id)?.clue;};
 const patternSnapshot=()=>{
  const value=JSON.parse(storage.get('ib_accumulated_patterns_v1')||'null');
  return value?.snapshot?{key:'ib_accumulated_patterns_v1',value:value.snapshot,items:value.items,stats:value.stats}:null;
 };
 return {node,storage,accumulationCalls,context,settle,background,cardHtml,patternSnapshot,setNews:value=>currentNews=value,setCanonical:value=>currentCanonical=value,setNow:value=>now=value,refresh:async()=>{await node('#refresh').onclick();await settle();}};
}

test('background accumulation combines locally archived and newly collected news, retaining exact source URLs',async()=>{
 const h=harness();await h.settle();h.background();
 assert.ok(h.accumulationCalls.length,'the desk must run the background accumulation engine');
 const last=h.accumulationCalls.at(-1);
 assert.ok(last.input.news.some(row=>row.source_url===archiveArticle.source_url),'archive reaches the accumulation engine');
 assert.ok(last.input.news.some(row=>row.source_url===freshArticle.source_url),'fresh feed reaches the same accumulation run');
 const html=h.node('#discoveryCards').innerHTML;
 assert.ok(html.includes('시험파트너스'));
 assert.ok(html.includes(archiveArticle.source_url),'old evidence remains directly accessible');
 assert.ok(html.includes(freshArticle.source_url),'new evidence remains directly accessible');
 const snapshot=h.patternSnapshot();assert.ok(snapshot,'the comparison state survives a page reload');
 const pattern=Object.values(snapshot.value.patterns).find(item=>item.sources?.some(source=>source.url===archiveArticle.source_url));
 assert.ok(pattern);
 assert.ok(pattern.sources.some(source=>source.url===freshArticle.source_url));
});

test('recalculating accumulated news leaves the supplied canonical analysis and baseline date intact',async()=>{
 const original=JSON.parse(JSON.stringify(baseline));
 const h=harness();await h.settle();h.background();
 assert.ok(h.cardHtml().includes(baseline.one_line_signal));
 assert.ok(h.cardHtml().includes('2026-07-29'));
 h.setNow(START+5*60000);h.setNews([freshArticle,addedArticle]);await h.refresh();
 assert.ok(h.cardHtml().includes(baseline.one_line_signal));
 assert.ok(h.cardHtml().includes('2026-07-29'));
 assert.deepEqual(baseline,original,'original API analysis must not be mutated');
 const archive=JSON.parse(h.storage.get('ib_pitch_sources_v1'));
 assert.deepEqual(archive.canonical.find(item=>item.clue_id===baseline.clue_id).sources,baseline.sources);
 const reopened=harness({storage:h.storage,archived:[],news:[],canonical:[]});await reopened.settle();reopened.background();
 assert.ok(reopened.cardHtml().includes(baseline.one_line_signal),'saved canonical analysis remains available when absent from the next server response');
 assert.ok(reopened.cardHtml().includes('2026-07-29'));
});

test('a newly collected case updates the existing accumulated feature, and identical later polls preserve changed_at',async()=>{
 const h=harness();await h.settle();h.background();
 const initial=h.patternSnapshot();assert.ok(initial);
 const entry=Object.entries(initial.value.patterns).find(([,item])=>item.sources?.some(source=>source.url===archiveArticle.source_url));
 assert.ok(entry);const [id,first]=entry;
 const oldChangedAt=first.changed_at;
 h.setNow(START+5*60000);h.setNews([freshArticle,addedArticle]);await h.refresh();
 const second=h.patternSnapshot().value.patterns[id];
 assert.ok(second,'adding a source updates the same pattern identity');
 assert.notEqual(second.changed_at,oldChangedAt);
 assert.ok(second.sources.some(source=>source.url===addedArticle.source_url));
 assert.ok(h.node('#discoveryCards').innerHTML.includes(addedArticle.title),'new evidence is visible in the background card');
 assert.ok(h.node('#discoveryCards').innerHTML.includes(addedArticle.source_url));
 const updatedChangedAt=second.changed_at;
 h.setNow(START+10*60000);await h.refresh();
 const third=h.patternSnapshot().value.patterns[id];
 assert.equal(third.changed_at,updatedChangedAt,'checking identical material must not masquerade as a changed analysis');
 assert.deepEqual(third.sources,second.sources);
});
