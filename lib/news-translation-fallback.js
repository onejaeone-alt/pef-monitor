'use strict';

// Public RSS headlines only. MyMemory's documented anonymous GET API has a
// 500-byte segment limit and a 5,000-character daily quota. Never rotate IPs,
// fabricate contact details, or retry a quota response. Successful results are
// saved by news-translation.js and shared by every reader.
const MODEL='mymemory-en-ko-v1';
function korean(text){return typeof text==='string'&&/[가-힣]/.test(text)&&text.length<=1500;}
function clean(text,source){
 let value=String(text||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
 // Correct only terms actually present in the source, not unrelated uses.
 if(/\bprivate credit\b/i.test(source))value=value.replace(/개인\s*신용|민간\s*신용|사적\s*신용/g,'사모대출');
 if(/\bprivate equity\b/i.test(source))value=value.replace(/개인\s*자본|사적\s*자본|사모\s*주식/g,'사모펀드');
 return value;
}
async function translateText(source,{fetcher=fetch,signal}={}){
 if(Buffer.byteLength(source,'utf8')>500)throw Error('translation_segment_too_long');
 const params=new URLSearchParams({q:source,langpair:'en|ko',mt:'1'});
 const response=await fetcher('https://api.mymemory.translated.net/get?'+params,{signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(6000)])});
 if(!response.ok)throw Error(response.status===429?'translation_fallback_rate_limited':'translation_fallback_unavailable');
 const data=await response.json();
 if(data.quotaFinished||Number(data.responseStatus)===429)throw Error('translation_fallback_quota_exhausted');
 if(Number(data.responseStatus)!==200)throw Error('translation_fallback_unavailable');
 const text=clean(data.responseData?.translatedText,source);
 if(!korean(text)||text===source||/MYMEMORY WARNING|QUERY LENGTH LIMIT|PLEASE SELECT TWO DISTINCT/i.test(text))throw Error('translation_fallback_invalid_response');
 return text;
}
async function generate(rows,{fetcher=fetch,signal,onReady,onFailed,state={}}={}){
 const ready=[];let error=null;
 for(const row of rows){
  if(signal?.aborted)break;
  if(state.blockedUntil>Date.now()){error=state.error;break;}
  try{
   const title_ko=await translateText(row.source_title,{fetcher,signal});
   // Preserve the headline even if a non-empty excerpt cannot be translated.
   let snippet_ko='';
   if(row.source_snippet&&Buffer.byteLength(row.source_snippet,'utf8')<=500){try{snippet_ko=await translateText(row.source_snippet,{fetcher,signal});}catch{}}
   const translated={...row,model:MODEL,status:'ready',title_ko,snippet_ko,response_id:null,error_code:null,updated_at:new Date().toISOString()};
   ready.push(translated);if(onReady)await onReady(translated);
  }catch(e){
   error=signal?.aborted?'translation_timeout':/^translation_/.test(e.message)?e.message:'translation_fallback_unavailable';
   if(/quota|rate_limit/.test(error)){state.error=error;state.blockedUntil=Date.now()+(error.includes('quota')?3600000:60000);}
   if(onFailed)await onFailed(row,error);
  }
 }
 return {rows:ready,error};
}
module.exports={generate,translateText,clean,MODEL};
