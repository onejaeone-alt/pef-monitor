(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.IBDailyReportGate=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY=86400000;
const GENERIC=/영향은|과제는|향방은|전망|주목|가능성|살펴보자|점검해볼|어떻게 될까|무엇이 남았|다음은|시장 반응|업계 반응|귀추|변수는/i;
const HARD=/\d|본입찰|예비입찰|우선협상|우협|SPA|본계약|클로징|기업결합|공개매수|경영권|회생계획|회생인가|파산선고|법원\s*(?:결정|인가)|DIP|변제율|회수율|채권\s*순위|담보\s*순위|인수금융|차환|만기|신용등급|EOD|기한이익|출자액|약정액|확약|최종\s*선정|GP\s*선정|최종\s*클로징|결성총회|출자사업|선정\s*기준|시행일|적용일|경과규정|지분율|매각가|인수가|취득가|처분가|공모가|발행금리|수요예측|폐점\s*\d|\d+개점|\d+곳/i;
const ACTION=/확인|요청|받아|자료|문서|계약|공시|법원|담당|운용사|매각주관|주관사|대주단|채권자|LP\b|GP\b|금융위|금감원|거래소|회사|당사자/i;
function kstDay(now=Date.now()){return new Date(now+9*3600000).toISOString().slice(0,10);}
function dayDiff(date,now=Date.now()){
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(clean(date)))return Infinity;
  return Math.round((Date.parse(kstDay(now)+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/DAY);
}
function until(date,now=Date.now()){
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(clean(date)))return Infinity;
  return Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(kstDay(now)+'T00:00:00Z'))/DAY);
}
function basisFacts(angle,analysis){const ids=new Set(angle?.basis_ids||[]);return (analysis?.facts||[]).filter(f=>ids.has(f.id));}
function hardFact(facts){return [...facts].sort((a,b)=>Number(/\d/.test(b.text))-Number(/\d/.test(a.text))||String(b.date||'').localeCompare(String(a.date||''))).find(f=>HARD.test(f.text))||null;}
function imminent(clue,now=Date.now()){const d=until(clue?.event_date,now);return Number.isFinite(d)&&d>=0&&d<=3;}
function evaluate(clue,result,now=Date.now()){
  const a=result?.analysis;if(result?.status!=='ready'||!a?.angles?.length)return null;
  const timing=imminent(clue,now);
  for(const angle of a.angles){
    const facts=basisFacts(angle,a),hard=hardFact(facts),recent=facts.some(f=>dayDiff(f.date,now)>=0&&dayDiff(f.date,now)<=2);
    const headline=clean(angle.headline),novel=clean(angle.new_information),why=clean(a.why_now?.text),first=clean(angle.first_action),missing=clean(angle.missing);
    const hardWhy=HARD.test(why)||timing,hardNovel=HARD.test(novel)||HARD.test(headline),specificHeadline=headline.length>=16&&!GENERIC.test(headline),specificNovel=novel.length>=18&&!GENERIC.test(novel)&&hardNovel;
    const actionable=first.length>=12&&ACTION.test(first)&&missing.length>=8;
    const compared=(a.already_covered||[]).length>0&&Array.isArray(angle.coverage_ids)&&angle.coverage_ids.length>0;
    const evidence=facts.length>=2&&new Set(facts.map(f=>f.source_id)).size>=2;
    if(!evidence||!compared||!specificHeadline||!specificNovel||!actionable||!hardWhy)continue;
    if(!timing&&(!recent||!hard))continue;
    const nugget=hard?.text||(facts.find(f=>HARD.test(f.text))?.text)||'';
    return {headline,today_reason:why,hard_nugget:clean(nugget),new_information:novel,missing,first_action:first,basis_ids:[...(angle.basis_ids||[])],coverage_ids:[...(angle.coverage_ids||[])],direction_key:clean(angle.direction_key),timing:timing?'imminent_event':'fresh_fact'};
  }
  return null;
}
function cloneResult(result,daily){
  if(!result?.analysis)return result;
  const original=result.analysis.angles||[],selected=daily?original.filter(a=>clean(a.direction_key)===daily.direction_key).slice(0,1):[];
  return {...result,daily_pitch:daily,watch_angles:daily?original.filter(a=>!selected.includes(a)):original,analysis:{...result.analysis,angles:selected},story_timeline:daily?result.story_timeline:undefined};
}
function renderDaily(d){
  if(!d)return '';
  return `<section class="daily-report-pitch" aria-label="일보 후보"><b>일보 후보 · 오늘 바로 확인</b><p class="daily-report-headline">${esc(d.headline)}</p><p><strong>오늘인 이유</strong> ${esc(d.today_reason)}</p>${d.hard_nugget?`<p><strong>제목에 박을 근거</strong> ${esc(d.hard_nugget)}</p>`:''}<p><strong>기보도보다 더 볼 것</strong> ${esc(d.new_information)}</p><p><strong>오늘 한 번 더 따야 할 것</strong> ${esc(d.missing)}</p><p class="daily-report-action"><strong>첫 취재</strong> ${esc(d.first_action)}</p></section>`;
}
function renderWatch(rows){if(!rows?.length)return '';return `<h4>일보 문턱에는 못 미친 취재 방향</h4><ul>${rows.slice(0,3).map(a=>`<li>${esc(a.headline)}${a.new_information?` — ${esc(a.new_information)}`:''}</li>`).join('')}</ul>`;}
function relabel(root){
  const doc=root?.document;if(!doc)return;
  for(const el of doc.querySelectorAll('.discovery-section-title')){const n=el.firstChild;if(n&&/^발제 후보/.test(n.textContent||''))n.textContent=(n.textContent||'').replace('발제 후보','일보 후보');}
  for(const el of doc.querySelectorAll('.discovery-proposal .discovery-meta span:first-child'))if(el.textContent==='발제 후보')el.textContent='일보 후보';
  const counts=doc.querySelector('#discoveryCounts');if(counts&&/^발제 후보/.test(counts.textContent||''))counts.textContent=counts.textContent.replace('발제 후보','일보 후보');
}
function install(root){
  const B=root?.MarketInStoryBrief;if(!B||B.__dailyReportGateInstalled)return false;
  const originalAttach=B.attach,originalRender=B.renderBriefHtml,originalDetails=B.renderDetails;if(typeof originalAttach!=='function'||typeof originalRender!=='function')return false;
  B.attach=function(clue,result){
    const attached=originalAttach.call(B,clue,result);if(!attached||result?.status!=='ready'||!result.analysis)return attached;
    const daily=evaluate(attached,result),filtered=cloneResult(attached.research||result,daily),brief=filtered?.analysis||attached.article_brief;
    return {...attached,research:filtered,article_brief:brief,article_pitch:daily?.headline,daily_pitch:daily,article_timeline:daily?attached.article_timeline:undefined};
  };
  B.renderBriefHtml=function(result,clueId){if(result?.headline_in_card&&result?.daily_pitch)return renderDaily(result.daily_pitch);return originalRender.call(B,result,clueId);};
  if(typeof originalDetails==='function')B.renderDetails=function(result,clueId){return originalDetails.call(B,result,clueId)+renderWatch(result?.watch_angles);};
  B.dailyPitch=evaluate;B.__dailyReportGateInstalled=true;
  if(root.document&&typeof root.MutationObserver==='function'){const target=root.document.querySelector('#discoveryDesk')||root.document.body;if(target){const observer=new root.MutationObserver(()=>relabel(root));observer.observe(target,{childList:true,subtree:true});relabel(root);}}
  return true;
}
return {HARD,GENERIC,ACTION,kstDay,dayDiff,until,basisFacts,hardFact,imminent,evaluate,cloneResult,renderDaily,renderWatch,relabel,install};
});
