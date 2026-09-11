'use strict';
const {parseNaverItems}=require('./context-sources');
const {candidate,announcement}=require('./reporting-calendar-institutions');
const QUERIES={
 'fsc-releases':'금융위원회 투자','fss-releases':'금융감독원 사모','mss-releases':'중소벤처기업부 투자','mohw-fund':'국민연금 기금운용위원회',
 'lp-apfs':'농업정책보험금융원','lp-nps':'국민연금 투자','lp-cw':'건설근로자공제회','lp-kic':'한국투자공사','lp-ktcu':'교직원공제회 투자','lp-poba':'행정공제회 투자',
 'lp-geps':'공무원연금 투자','lp-tp':'사학연금 투자','lp-mmaa':'군인공제회 투자','lp-sema':'과학기술인공제회','lp-pmaa':'경찰공제회','lp-koreapost':'우정사업본부 투자','lp-kbiz':'노란우산 투자'
};
// Supplementary reporting is labelled as reporting; it never proves an official board is healthy.
async function collectNews(source,reader,deadline,H){
 if(!process.env.NAVER_CLIENT_ID||!process.env.NAVER_CLIENT_SECRET)throw Error('NEWS_SEARCH_UNAVAILABLE');
 const url='https://openapi.naver.com/v1/search/news.json?'+new URLSearchParams({query:QUERIES[source.id]||source.name,display:'100',sort:'date'});
 const response=await reader.boundedFetch(url,{deadline,maxBytes:1000000,headers:{'X-Naver-Client-Id':process.env.NAVER_CLIENT_ID,'X-Naver-Client-Secret':process.env.NAVER_CLIENT_SECRET}});
 const all=parseNaverItems(JSON.parse(response.buffer.toString('utf8')).items);
 const found=all.filter(x=>Date.parse(x.published_at)>Date.now()-30*86400000&&candidate(x.title,source,H));
 const chosen=found.slice(0,6),events=[],pending=[];let failed=0,cursor=0;
 await Promise.all(Array.from({length:Math.min(3,chosen.length)},async()=>{while(cursor<chosen.length){const x=chosen[cursor++],meta={title:x.title,url:x.source_url,published_at:x.published_at,source_id:source.id,source_name:source.name+' · 보도'};
  try{const doc=await reader.read(meta,deadline);if(!doc.read_ok)throw Error(doc.read_error||'ARTICLE_UNAVAILABLE');meta.url=doc.url||meta.url;
   let e=H.makeEvent(meta,doc.text);if(!e){e=announcement(meta,doc.text,source,H);if(e){e.date=H.kstDay(Date.parse(x.published_at));e.end_date=e.date;e.time='';e.status='published';e.date_basis='news_publication';e.evidence='관련 보도 게시일 '+e.date;e.source_name=meta.source_name;}}
   if(e){events.push({...e,source_type:'news',organizer:e.kind==='event'?e.organizer||'':''});continue;}
   if(H.isCandidate(x.title))pending.push({...meta,id:H.key(meta.url),source_url:meta.url,reason:'DATE_UNCONFIRMED',checked_at:new Date().toISOString()});
  }catch(e){failed++;pending.push({...meta,id:H.key(meta.url),source_url:meta.url,reason:e.message,checked_at:new Date().toISOString()});}
 }}));
 return {events,pending,stats:{news_ok:true,news_candidates:found.length,news_processed:chosen.length,news_failed:failed,news_remaining:Math.max(0,found.length-chosen.length)}};
}
module.exports={collectNews,QUERIES};
