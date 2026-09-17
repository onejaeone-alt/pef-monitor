(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.IBDailyReportPitch=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
 const originalRequest=B.requestFor,originalAttach=B.attach,originalRender=B.renderBriefHtml;
 if(typeof originalRequest!=='function'||typeof originalAttach!=='function'||typeof originalRender!=='function'||typeof B.shortlist!=='function')return false;
 B.requestFor=function(x){const r=originalRequest.call(B,x);return r?{...r,key:'daily-report-gate-1:'+r.key}:r;};
 B.attach=function(x,result){const attached=originalAttach.call(B,x,result);if(!attached)return attached;const p=pitchOf(result);return p?{...attached,daily_candidate:true,detector_label:'일보 후보',article_pitch:p.headline}:attached;};
 B.renderBriefHtml=function(result,...args){
  const base=originalRender.call(B,result,...args),daily=render(result);if(!daily)return base;
  if(base.includes('<section class="marketin-story-brief"'))return base.replace(/<section class="marketin-story-brief"([^>]*)>/,`<section class="marketin-story-brief has-daily-pitch"$1>${daily}`);
  return daily+base;
 };
 B.dailyShortlist=function(rows,limit=6){return rows.filter(isDaily).sort((a,b)=>String(b.sort_date||'').localeCompare(String(a.sort_date||''))).slice(0,limit);};
 B.isDailyCandidate=isDaily;B.renderDailyPitch=render;B.__dailyReportPitchInstalled=true;return true;
}
return {pitchOf,isDaily,render,install};
});
