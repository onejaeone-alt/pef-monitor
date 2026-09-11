'use strict';
const news = require('./news');
function capture(){
  return {code:200,headers:{},body:null,setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}};
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method&&req.method!=='GET')return res.status(405).json({ok:false,error:'GET only'});
  const q=String(req.query?.q||'').trim().toLowerCase().slice(0,180);
  if(q.length<3)return res.status(400).json({ok:false,error:'검색어를 3자 이상 입력하세요.'});
  const inner=capture();
  const query={days:String(req.query?.days||'3'),limit:'500',feed:'reader',refresh:String(req.query?.refresh||'1')};
  await news({method:'GET',query,headers:req.headers||{}},inner);
  if(inner.code!==200||!inner.body?.ok||!Array.isArray(inner.body.items))return res.status(inner.code||502).json({ok:false,error:'현재 뉴스 수집 결과를 확인하지 못했습니다.'});
  const matches=inner.body.items.filter(item=>[item.source_url,item.title,item.source_name,item.snippet].some(value=>String(value||'').toLowerCase().includes(q)));
  return res.status(200).json({ok:true,q,matches:matches.slice(0,30),count:matches.length,fetched_at:inner.body.fetched_at,providers:inner.body.providers,collection_status:inner.body.collection_status});
};
