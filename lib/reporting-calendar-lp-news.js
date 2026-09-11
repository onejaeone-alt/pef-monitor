'use strict';
const {parseNaverItems,parseGoogleNewsRss}=require('./context-sources');
const {candidate,announcement}=require('./reporting-calendar-institutions');
const QUERIES={
 'fsc-releases':'금융위원회 투자','fss-releases':'금융감독원 사모','mss-releases':'중소벤처기업부 투자','mohw-fund':'국민연금 기금운용위원회',
 'lp-apfs':'농업정책보험금융원','lp-nps':'국민연금 투자','lp-cw':'건설근로자공제회','lp-kic':'한국투자공사','lp-ktcu':'교직원공제회 투자','lp-poba':'행정공제회 투자',
 'lp-geps':'공무원연금 투자','lp-tp':'사학연금 투자','lp-mmaa':'군인공제회 투자','lp-sema':'과학기술인공제회','lp-pmaa':'경찰공제회','lp-koreapost':'우정사업본부 투자','lp-kbiz':'노란우산 투자'
};
// Supplementary reporting is labelled as reporting; it never proves an official board is healthy.
async function collectNews(source,reader,deadline,H){
 const query=QUERIES[source.id]||source.name;let all,provider;
 if(process.env.NAVER_CLIENT_ID&&process.env.NAVER_CLIENT_SECRET){
  const url='https://openapi.naver.com/v1/search/news.json?'+new URLSearchParams({query,display:'100',sort:'date'});
  const response=await reader.boundedFetch(url,{deadline,maxBytes:1000000,headers:{'X-Naver-Client-Id':process.env.NAVER_CLIENT_ID,'X-Naver-Client-Secret':process.env.NAVER_CLIENT_SECRET}});
  all=parseNaverItems(JSON.parse(response.buffer.toString('utf8')).items);provider='naver';
 }else{
  const url='https://news.google.com/rss/search?'+new URLSearchParams({q:query+' when:30d',hl:'ko',gl:'KR',ceid:'KR:ko'});
  const response=await reader.boundedFetch(url,{deadline,maxBytes:1000000});all=parseGoogleNewsRss(response.buffer.toString('utf8'),'calendar','ko');provider='google_rss';
 }
 const found=all.filter(x=>Date.parse(x.published_at)>Date.now()-30*86400000&&candidate(x.title,source,H));
 const trusted=x=>/연합|이데일리|더벨|딜사이트|한국경제|매일경제|서울경제|머니투데이|파이낸셜뉴스|뉴시스|뉴스1|뉴스핌|비즈워치/.test(x.source_name);found.sort((a,b)=>Number(trusted(b))-Number(trusted(a))||String(b.published_at).localeCompare(String(a.published_at)));
 const chosen=found.slice(0,6),events=[],pending=[];let failed=0,cursor=0;
 await Promise.all(Array.from({length:Math.min(3,chosen.length)},async()=>{while(cursor<chosen.length){const x=chosen[cursor++],meta={title:x.title,url:x.source_url,published_at:x.published_at,source_id:source.id,source_name:source.name+' · '+x.source_name,publisher:x.source_name};
  try{const doc=await reader.read(meta,deadline);if(!doc.read_ok)throw Error(doc.read_error||'ARTICLE_UNAVAILABLE');meta.url=doc.url||meta.url;
   let e=H.makeEvent(meta,doc.text);if(!e){e=announcement(meta,doc.text,source,H);if(e){e.date=H.kstDay(Date.parse(x.published_at));e.end_date=e.date;e.time='';e.status='published';e.date_basis='news_publication';e.evidence='관련 보도 게시일 '+e.date;e.source_name=meta.source_name;}}
   if(e){events.push({...e,source_type:'news',organizer:e.kind==='event'?e.organizer||'':''});continue;}
   if(H.isCandidate(x.title))pending.push({...meta,id:H.key(meta.url),source_url:meta.url,reason:'DATE_UNCONFIRMED',checked_at:new Date().toISOString()});
  }catch(e){failed++;pending.push({...meta,id:H.key(meta.url),source_url:meta.url,reason:e.message,checked_at:new Date().toISOString()});}
 }}));
 return {events,pending,stats:{news_ok:true,news_provider:provider,news_candidates:found.length,news_processed:chosen.length,news_failed:failed,news_remaining:Math.max(0,found.length-chosen.length)}};
}
module.exports={collectNews,QUERIES};
