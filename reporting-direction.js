(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.IBReportingDirection=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KEY='pef_my_reporting_projects_v1';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeUrl(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function evidenceHtml(c){
 return (c.selected_evidence||[]).map(f=>{const s=c.research?.sources?.find(s=>s.source_id===f.source_id),u=safeUrl(s?.url);return `<li>${esc(f.text)}${u?` <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(s.publisher||s.title||'원문')} ↗</a>`:''}</li>`;}).join('');
}
function render(p){
 const c=p.clue||{},a=c.selected_angle;if(!a)return '';
 return `<section class="reporting-direction" aria-label="선택한 취재 방향"><b>선택한 취재 질문</b><p>${esc(a.question)}</p><dl><dt>추천 이유</dt><dd>${esc(a.reason)}</dd><dt>기존 보도에서 더 나아갈 부분</dt><dd>${esc(a.new_information)}</dd><dt>가장 큰 빈칸</dt><dd>${esc(a.missing)}</dd><dt>첫 취재</dt><dd>${esc(a.first_action)}</dd><dt>가설을 재검토할 조건</dt><dd>${esc(a.falsification)}</dd></dl><details><summary>선택한 방향의 원문 근거 · 검수 전</summary><ul>${evidenceHtml(c)}</ul></details>${p.judgment?.decision==='기사화'?`<button type="button" data-daily-report="${esc(p.project_id)}">일보 초안 복사</button><span class="reporting-copy-status" role="status"></span>`:'<small>기사화 판단을 마치면 일보 초안을 복사할 수 있습니다.</small>'}</section>`;
}
function dailyReport(p){
 if(p.judgment?.decision!=='기사화'||!p.clue?.selected_angle)throw Error('기사화 판단을 마친 취재만 일보로 정리할 수 있습니다.');
 const c=p.clue,a=c.selected_angle,analysis=c.article_brief||{};
 const rows=[
  '[일보 초안] '+clean(p.title||a.question),
  '- 핵심: '+clean(p.judgment.claim||a.question),
  '- 현재 상황(공개자료): '+clean(analysis.summary?.text||c.one_line_signal),
  '- 직전 상태: '+clean(analysis.previous_state?.text||'비교 자료 미확보'),
  '- 확인한 변화: '+clean(c.changed_fact||'전후 조건의 차이 미확인'),
  '- 기존 보도와의 차이: '+clean(a.new_information),
  '- 취재 메모: '+clean(p.notes||'입력한 메모 없음'),
  '- 남은 확인: '+clean(a.missing),
  '- 취재 계획: '+clean(a.first_action),
  '- 반증 조건: '+clean(a.falsification),
  '', '근거 원문'
 ];
 const seen=new Set();for(const f of c.selected_evidence||[]){const s=c.research?.sources?.find(s=>s.source_id===f.source_id),u=safeUrl(s?.url);if(u&&!seen.has(u)){seen.add(u);rows.push((s.publisher||s.title||'원문')+' · '+u);}}
 return rows.join('\n');
}
function install(root){
 const doc=root.document;if(!doc)return;
 const read=()=>{try{const rows=JSON.parse(root.localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}};
 function paint(){
  const rows=read();for(const card of doc.querySelectorAll('.project-card[data-id]')){if(card.querySelector('.reporting-direction'))continue;const p=rows.find(p=>p.project_id===card.dataset.id);if(p)card.querySelector('.project-signal')?.insertAdjacentHTML('afterend',render(p));}
  const panel=doc.querySelector('#judgeRoot .judge-panel');
  if(panel&&!panel.querySelector('.reporting-direction')){const id=new URL(root.location.href).searchParams.get('project')||root.localStorage.getItem('pef_selected_project_v1'),p=rows.find(p=>p.project_id===id);if(p)panel.insertAdjacentHTML('beforeend',render(p));}
 }
 doc.addEventListener('click',async e=>{const button=e.target.closest('[data-daily-report]');if(!button)return;const p=read().find(p=>p.project_id===button.dataset.dailyReport),section=button.closest('.reporting-direction'),status=section.querySelector('.reporting-copy-status');
  try{const value=dailyReport(p||{});try{await root.navigator.clipboard.writeText(value);status.textContent='일보 초안을 복사했습니다.';}catch{section.querySelector('textarea')?.remove();const box=doc.createElement('textarea');box.readOnly=true;box.value=value;box.setAttribute('aria-label','복사할 일보 초안');section.append(box);box.focus();box.select();status.textContent='선택된 초안을 복사하세요.';}}catch(error){status.textContent=error.message;}
 });
 const parent=doc.querySelector('#projects')||doc.querySelector('#judgeRoot');if(parent)new root.MutationObserver(paint).observe(parent,{childList:true});paint();
}
return {render,dailyReport,install};
});
