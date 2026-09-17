(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.IBDailyReportPitch=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function pitchOf(result){return result?.status==='ready'&&result?.analysis?.daily_pitch?.headline?result.analysis.daily_pitch:null;}
function isDaily(row){return !!(row?.daily_candidate||pitchOf(row?.research));}
function render(result){
 const p=pitchOf(result);if(!p)return '';
 const bullets=(p.bullets||[]).slice(0,5).map(x=>`<li>${esc(x.text)}</li>`).join('');
 const why=result.analysis?.why_now?.text?`<p class="daily-pitch-why"><b>오늘 쓰는 이유</b> ${esc(result.analysis.why_now.text)}</p>`:'';
 return `<section class="daily-report-pitch" aria-label="일보 후보"><div class="daily-pitch-label">일보 후보</div><h4>${esc(p.headline)}</h4><p class="daily-pitch-thesis">${esc(p.thesis?.text||'')}</p><ul>${bullets}</ul>${why}<p class="daily-pitch-new"><b>기존 보도보다 추가할 것</b> ${esc(p.new_information)}</p><p class="daily-pitch-gap"><b>오늘 채울 한 칸</b> ${esc(p.decisive_gap)}</p></section>`;
}
function install(root){
 const B=root?.MarketInStoryBrief;if(!B||B.__dailyReportPitchInstalled)return false;
 const originalRequest=B.requestFor,originalAttach=B.attach,originalRender=B.renderBriefHtml,originalShortlist=B.shortlist;
 if(typeof originalRequest!=='function'||typeof originalAttach!=='function'||typeof originalRender!=='function'||typeof originalShortlist!=='function')return false;
 B.requestFor=function(x){const r=originalRequest.call(B,x);return r?{...r,key:'daily-pitch-2:'+r.key}:r;};
 B.attach=function(x,result){const attached=originalAttach.call(B,x,result);if(!attached)return attached;const p=pitchOf(result);return p?{...attached,daily_candidate:true,detector_label:'일보 후보',article_pitch:p.headline}:attached;};
 B.renderBriefHtml=function(result){
  const base=originalRender.call(B,result),daily=render(result);if(!daily)return base;
  if(base.includes('<section class="marketin-story-brief"'))return base.replace('<section class="marketin-story-brief"','<section class="marketin-story-brief has-daily-pitch"').replace('>','>');
  return daily+base;
 };
 const previousRender=B.renderBriefHtml;
 B.renderBriefHtml=function(result){
  const base=originalRender.call(B,result),daily=render(result);if(!daily)return base;
  if(base.includes('<section class="marketin-story-brief"'))return base.replace('<section class="marketin-story-brief" aria-label="원문 기반 이슈 브리핑">',`<section class="marketin-story-brief has-daily-pitch" aria-label="원문 기반 이슈 브리핑">${daily}`);
  return daily+base;
 };
 B.shortlist=function(rows,limit=6){
  const daily=rows.filter(isDaily).sort((a,b)=>String(b.sort_date||'').localeCompare(String(a.sort_date||'')));
  return daily.slice(0,limit);
 };
 B.isDailyCandidate=isDaily;B.renderDailyPitch=render;B.__dailyReportPitchInstalled=true;
 if(root.document){
  const update=()=>{const note=root.document.querySelector('#discoveryCounts');if(!note)return;const m=note.textContent.match(/최근 자료\s*(\d+)건\s*·\s*기존 분석\s*(\d+)건/);if(!m)return;const total=Number(m[1]),cards=[...root.document.querySelectorAll('.daily-report-pitch')].length;note.textContent=`일보 후보 ${cards}건 · 탐색 중 ${Math.max(0,total-cards)}건 · 기존 분석 ${m[2]}건`;};
  const target=root.document.querySelector('#discoveryCards')||root.document.body;if(target&&root.MutationObserver)new root.MutationObserver(()=>queueMicrotask(update)).observe(target,{childList:true,subtree:true});queueMicrotask(update);
 }
 return true;
}
return {pitchOf,isDaily,render,install};
});
