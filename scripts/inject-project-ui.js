const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html','dart.html','motae.html','leads.html','projects.html','relations.html','judgment.html'];

function removeDossierNav(html) {
  return html.replace(/<a(?:\s+class="on")?\s+href="\/relations\.html">취재파일<\/a>/g, '');
}

function addProjectsNav(html, file) {
  if (html.includes('href="/projects.html"')) return html;
  const re = /(<a[^>]*href="\/leads\.html"[^>]*>AI 취재단서<\/a>)/;
  if (!re.test(html)) return html;
  const projectLink = file === 'projects.html'
    ? '<a class="on" href="/projects.html">내 취재</a>'
    : '<a href="/projects.html">내 취재</a>';
  return html.replace(re, `$1${projectLink}`);
}

function workflowHtml(file) {
  const active = file === 'leads.html' ? 'lead' : file === 'projects.html' ? 'project' : file === 'judgment.html' ? 'judge' : '';
  const cls = key => key === active ? 'role-step active' : 'role-step';
  return `<div class="role-flow" aria-label="취재 흐름">
<a class="${cls('lead')}" href="/leads.html"><em>1 · 발견</em><b>AI 취재단서</b><span>무엇이 달라졌나?</span></a>
<a class="${cls('project')}" href="/projects.html"><em>2 · 취재</em><b>내 취재</b><span>직접 확인하고 기록하기</span></a>
<a class="${cls('judge')}" href="/judgment.html"><em>3 · 결정</em><b>기사판단기</b><span>기사로 쓸 만큼 확인됐나?</span></a>
<a class="role-step" href="https://article-engine-wjy-onejess.vercel.app/" target="_blank" rel="noopener"><em>4 · 작성</em><b>기사 엔진 ↗</b><span>기사화 확정 뒤 작성</span></a>
</div>`;
}

function simplifyWorkflow(html, file) {
  if (!['leads.html','projects.html','judgment.html'].includes(file)) return html;
  let next = html;
  next = next.replace(/<div class="role-flow"[^>]*>[\s\S]*?<\/div>/, workflowHtml(file));
  const override = '<style id="four-step-workflow">.role-flow{grid-template-columns:repeat(4,minmax(0,1fr))!important}@media(max-width:760px){.role-flow{grid-template-columns:1fr 1fr!important}}</style>';
  if (!next.includes('id="four-step-workflow"')) next = next.replace('</head>', `${override}</head>`);
  return next;
}

function addLeadHandoff(html, file) {
  if (file !== 'leads.html' || html.includes('data-project-id="${esc(x.clue_id)}"')) return html;
  let next = html;
  const button = '<button class="start-btn" data-package="package-${i}">취재 질문 보기 ▾</button>';
  const replacement = '<button class="project-send-btn" data-project-id="${esc(x.clue_id)}">내 취재로 보내기 →</button>' + button;
  next = next.replace(button, replacement);
  if (!next.includes('id="project-send-style"')) {
    next = next.replace('</head>', '<style id="project-send-style">.project-send-btn{border:1px solid #172033;border-radius:8px;background:#fff;color:#172033;padding:7px 11px;font-size:9.5px;font-weight:900;cursor:pointer}.project-send-btn:hover{background:#f1f5f9}</style></head>');
  }
  if (!next.includes('id="project-handoff-script"')) {
    const script = `<script id="project-handoff-script">
const REPORTING_PROJECT_KEY='pef_my_reporting_projects_v1';
function readReportingProjects(){try{return JSON.parse(localStorage.getItem(REPORTING_PROJECT_KEY)||'[]')}catch(_){return []}}
function saveReportingProject(clue){
  const rows=readReportingProjects();
  const id='project-'+clue.clue_id;
  const now=new Date().toISOString();
  const old=rows.find(x=>x.project_id===id);
  if(old){old.updated_at=now;old.clue=clue}else{rows.unshift({project_id:id,clue_id:clue.clue_id,title:clue.headline||'취재 프로젝트',status:'진행중',created_at:now,updated_at:now,notes:'',judgment:null,judgment_history:[],clue})}
  localStorage.setItem(REPORTING_PROJECT_KEY,JSON.stringify(rows));
  location.href='/projects.html?project='+encodeURIComponent(id);
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-project-id]');
  if(!b)return;
  const clue=(typeof DATA!=='undefined'?DATA:[]).find(x=>String(x.clue_id)===String(b.dataset.projectId));
  if(!clue)return;
  saveReportingProject(clue);
});
</script>`;
    next = next.replace('</body>', `${script}</body>`);
  }
  return next;
}

function addDossierSearchToMotae(html, file) {
  if (file !== 'motae.html' || html.includes('id="dossierQuickSearch"')) return html;
  let next = html;
  next = next.replace('function dossierHref(name){return `/relations.html?name=${encodeURIComponent(name)}`}', 'function dossierHref(name){return `#dossier=${encodeURIComponent(name)}`}');
  if (!next.includes('/dossier-drawer.css')) next = next.replace('</head>', '<link rel="stylesheet" href="/dossier-drawer.css"><style id="dossier-quick-style">.dossier-quick{display:grid;grid-template-columns:auto minmax(260px,520px) auto;gap:8px;align-items:center;background:#fff;border:1px solid #dbe3ee;border-radius:11px;padding:9px 11px;margin:0 0 12px}.dossier-quick strong{font-size:10px;white-space:nowrap}.dossier-quick input{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;font-size:10.5px}.dossier-quick-results{grid-column:2/4;display:flex;gap:5px;flex-wrap:wrap}.dossier-quick-results[hidden]{display:none}.dossier-result{border:1px solid #e2e8f0;background:#f8fafc;border-radius:99px;padding:5px 8px;font-size:9px;font-weight:800;color:#334155;cursor:pointer}.dossier-result:hover{border-color:#93c5fd;color:#1d4ed8}@media(max-width:720px){.dossier-quick{grid-template-columns:1fr}.dossier-quick-results{grid-column:1}}</style></head>');
  const box = '<section class="dossier-quick"><strong>취재파일 검색</strong><input id="dossierQuickSearch" type="search" autocomplete="off" placeholder="기업·PEF·VC·AC·LP·펀드 검색"><button class="btn" id="dossierQuickButton" type="button">검색</button><div class="dossier-quick-results" id="dossierQuickResults" hidden></div></section>';
  next = next.replace('<div class="page-head">', box + '<div class="page-head">');
  if (!next.includes('/dossier-drawer.js')) next = next.replace('</body>', '<script src="/dossier-drawer.js"></script></body>');
  const script = `<script id="dossier-quick-script">
(function(){
 const input=document.getElementById('dossierQuickSearch'),button=document.getElementById('dossierQuickButton'),box=document.getElementById('dossierQuickResults');
 if(!input||!box)return;
 const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
 async function find(q,show=true){
   if(!q){if(show){box.hidden=true;box.innerHTML=''}return []}
   if(show){box.hidden=false;box.innerHTML='<span class="small muted">검색 중…</span>'}
   try{const r=await fetch('/api/entity?action=search&q='+encodeURIComponent(q)+'&limit=10'),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'검색 실패');const rows=d.items||[];if(show)box.innerHTML=rows.length?rows.map(x=>'<button class="dossier-result" type="button" data-dossier-entity="'+esc(x.entity_key)+'">'+esc(x.canonical_name)+' · '+esc(x.type_label||'취재대상')+'</button>').join(''):'<span class="small muted">일치하는 취재파일이 없습니다.</span>';return rows}catch(e){if(show)box.innerHTML='<span class="small muted">'+esc(e.message||e)+'</span>';return []}
 }
 async function search(){return find(input.value.trim(),true)}
 button.addEventListener('click',search);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});let timer;input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,280)});
 document.addEventListener('click',async e=>{const a=e.target.closest('a[href^="#dossier="]');if(!a)return;e.preventDefault();const name=decodeURIComponent((a.getAttribute('href')||'').replace('#dossier=',''));const rows=await find(name,false);if(rows[0]?.entity_key&&window.DossierDrawer)window.DossierDrawer.open(rows[0].entity_key)});
})();
</script>`;
  next = next.replace('</body>', `${script}</body>`);
  return next;
}

for (const file of pages) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  const original = fs.readFileSync(target, 'utf8');
  let next = removeDossierNav(original);
  next = addProjectsNav(next, file);
  next = simplifyWorkflow(next, file);
  next = addLeadHandoff(next, file);
  next = addDossierSearchToMotae(next, file);
  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
