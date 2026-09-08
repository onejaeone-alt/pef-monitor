'use strict';
const { clean, norm, hash, sourceKey } = require('./preflight-core');
const R=require('./public-document-reader');
const {OFFICIAL,MEDIA,publicKind,safeUrl,decode,htmlBlocks,readLinks}=R;
const reader=R.createReader();
const boundedFetch=reader.boundedFetch;
const inDomain=(h,list)=>list.some(d=>h===d||h.endsWith('.'+d));
function metaSource(meta) {
  const url=sourceKey(meta.url||meta.source_url),host=new URL(url||'https://invalid.local').hostname;
  return {source_id:hash(url),url,title:clean(meta.title||meta.label||'공개자료'),published_at:meta.published_at||(meta.found_by==='canonical_reference'?null:meta.date)||null,reference_as_of:meta.found_by==='canonical_reference'?meta.date||null:meta.reference_as_of||null,
    kind:publicKind(url),publisher:inDomain(host,['kvic.or.kr','k-vic.co.kr'])?'한국벤처투자':inDomain(host,['nps.or.kr'])?'국민연금공단 기금운용본부':clean(meta.publisher||meta.source_name||''),found_by:meta.found_by||'canonical_reference',snippet:clean(meta.snippet||''),read_ok:false,access:'link_only',text:'',blocks:[]};
}
async function readDocument(meta,deadline){return reader.read({...metaSource(meta),parent_url:meta.parent_url||''},deadline);}
async function search(query,purpose,deadline) {
  const rssUrl='https://news.google.com/rss/search?'+new URLSearchParams({q:query,hl:'ko',gl:'KR',ceid:'KR:ko'});
  const tasks=[boundedFetch(rssUrl,{deadline}).then(r=>require('./context-sources').parseGoogleNewsRss(r.buffer.toString('utf8'),'domestic','ko'))],names=['google_news_rss'];
  const id=process.env.NAVER_CLIENT_ID,secret=process.env.NAVER_CLIENT_SECRET;
  if(id&&secret){const headers={'X-Naver-Client-Id':id,'X-Naver-Client-Secret':secret};
    for(const kind of ['news','webkr']){names.push('naver_'+kind);const simple=query.replace(/\([^)]*\)/g,' ').replace(/["()]/g,' ').replace(/\s+/g,' ').trim();
      const url=`https://openapi.naver.com/v1/search/${kind}.json?`+new URLSearchParams({query:simple,display:'10',...(kind==='news'?{sort:'date'}:{})});
      tasks.push(boundedFetch(url,{deadline,headers}).then(r=>{const p=JSON.parse(r.buffer.toString('utf8'));return (p.items||[]).map(x=>({title:clean(decode(String(x.title||'').replace(/<[^>]*>/g,''))),source_url:x.originallink||x.link,published_at:x.pubDate&&Number.isFinite(Date.parse(x.pubDate))?new Date(x.pubDate).toISOString():null,snippet:clean(decode(String(x.description||'').replace(/<[^>]*>/g,'')))}));}));
    }
  }
  const results=await Promise.allSettled(tasks),records=[],log=[];
  results.forEach((result,i)=>{log.push({provider:names[i],purpose,query,status:result.status==='fulfilled'?'ok':'failed',count:result.status==='fulfilled'?result.value.length:0,error:result.status==='rejected'?clean(result.reason?.message).slice(0,80):null});if(result.status==='fulfilled')records.push(...result.value.map(x=>({...x,url:x.source_url,found_by:names[i],search_purpose:purpose})));});
  if(!id||!secret)log.push({provider:'naver',purpose,status:'not_configured',count:0});return {records,log};
}
function historyRecords(rows,seeds) {
  const out=[];
  for(const r of rows||[]){if(publicKind(r.source_url)==='blocked')continue;
    // Only previously collected public source metadata, never private notes or raw_data.
    const m={url:r.source_url,title:clean(r.title),publisher:clean(r.source_name),published_at:r.published_at||null,found_by:'public_source_index'},title=norm(m.title);
    const hit=seeds.some(s=>{if(title.includes(norm(s.gp||s.lp)))return true;if(publicKind(m.url)!=='official'||!title.includes(s.year)||!norm(m.publisher).includes(norm(s.lp)))return false;
      if(s.tokens.filter(t=>!/^(소형|국내|스케일업|벤처펀드)$/i.test(t)).some(t=>title.includes(norm(t))))return true;
      const selected=(s.baseline.previous||'').match(/20\d{2}-\d{2}-\d{2}/)?.[0],gap=Math.abs(Date.parse(m.published_at)-Date.parse(selected));return norm(m.publisher)===norm(s.lp)&&Number.isFinite(gap)&&gap<=45*86400000;});if(hit)out.push(m);
  }
  const distance=r=>Math.min(...seeds.map(s=>{const d=(s.baseline.previous||'').match(/20\d{2}-\d{2}-\d{2}/)?.[0],gap=Math.abs(Date.parse(r.published_at)-Date.parse(d));return Number.isFinite(gap)?gap:Infinity;}));
  return out.sort((a,b)=>Number(/선정\s*결과/.test(b.title))-Number(/선정\s*결과/.test(a.title))||distance(a)-distance(b)).slice(0,20);
}
function fundCandidates(items,seed){if(!seed.gp)return [];return (items||[]).filter(f=>norm(f.manager).includes(norm(seed.gp))).slice(0,8).map(f=>({manager:clean(f.manager),association_name:clean(f.association_name),year:clean(f.year),field:clean(f.field),match_status:'동일 GP의 공개목록 등재 펀드 · 해당 선정분과 동일한지는 미확인',source:'한국벤처투자 공개 펀드 API',source_url:'https://www.kvic.or.kr/'}));}
module.exports={OFFICIAL,MEDIA,publicKind,safeUrl,htmlBlocks,readLinks,boundedFetch,readDocument,search,historyRecords,fundCandidates,metaSource};
