const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../lib/foreign-news'),C=require('../news-reader-core'),T=require('../news-taxonomy');
test('foreign stored articles keep their scope across validation and saved lists',()=>{
 const foreign={source_url:'https://example.com/global',title:'VC fund closes at $1 billion',news_scope:'foreign'};
 const domestic={source_url:'https://example.com/kr',title:'VC 펀드 결성'};
 const records=C.apply(C.empty(),[foreign,domestic].map(x=>({kind:'bookmark',key:x.source_url,value:{article:x}})));
 assert.deepEqual(C.select([],records,{view:'saved',newsScope:'foreign'}).map(C.key),[foreign.source_url]);
 assert.deepEqual(C.select([],records,{view:'saved',newsScope:'domestic'}).map(C.key),[domestic.source_url]);
 assert.equal(C.scope(C.snapshot(domestic)),'domestic');
});
test('English events use the same event categories',()=>{
 for(const [title,id] of [['KKR acquires software company','deal'],['VC closes new fund at $2bn','fund_formation'],['Pension fund commits $200m to private equity','lp_selection'],['Startup raises Series B funding','investment_exit'],['Private credit faces defaults','credit'],['Private equity firm appoints partner','people']])assert.equal(T.classify({title}).category_id,id,title);
 assert.ok(T.classify({title:'Venture capital fund closes'}).actor_ids.includes('VC'));
});
test('foreign handler uses English RSS, separates source policy, filters dates and disclosures',async()=>{
 const original=global.fetch,requests=[];
 const item=(title,source,url,date=new Date().toUTCString())=>`<item><title>${title}</title><source>${source}</source><link>https://example.com/${url}</link><pubDate>${date}</pubDate></item>`;
 global.fetch=async(url,options)=>{requests.push({url,options});if(requests.length===1)throw Error('offline');return {ok:true,text:async()=>'<rss><channel>'+item('Private equity fund closes','Reuters','yes')+item('Private equity deal','Company PR','pr')+item('Private equity deal','Reuters','old','Mon, 01 Jan 2024 00:00:00 GMT')+'</channel></rss>'};};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(x){this.body=x;return this;}};
 try{await F.handle({query:{scope:'foreign',refresh:'1',days:'1'}},res,{translateItems:async items=>({items,status:{}})});assert.equal(res.code,200);assert.equal(res.body.items.length,1);assert.equal(res.body.items[0].news_scope,'foreign');assert.equal(res.body.collection_status.partial,true);assert.equal(res.headers['Cache-Control'],'no-store');for(const r of requests){assert.equal(new URL(r.url).searchParams.get('ceid'),'US:en');assert.equal(r.options.cache,'no-store');}}
 finally{global.fetch=original;}
});
