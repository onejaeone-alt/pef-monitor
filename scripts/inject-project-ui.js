const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function addLeadHandoff(html) {
  if (html.includes('data-project-id="${esc(x.clue_id)}"')) return html;
  let next = html;
  const button = '<button class="start-btn" data-package="package-${i}">취재 질문 보기 ▾</button>';
  if (!next.includes(button)) return next;
  next = next.replace(button, '<button class="project-send-btn" data-project-id="${esc(x.clue_id)}">내 취재로 보내기 →</button>' + button);
  if (!next.includes('id="project-send-style"')) {
    next = next.replace('</head>', '<style id="project-send-style">.project-send-btn{border:1px solid #172033;border-radius:8px;background:#fff;color:#172033;padding:7px 11px;font-size:9.5px;font-weight:900;cursor:pointer}.project-send-btn:hover{background:#f1f5f9}</style></head>');
  }
  if (!next.includes('id="project-handoff-script"')) {
    next = next.replace('</body>', `<script id="project-handoff-script">
const REPORTING_PROJECT_KEY='pef_my_reporting_projects_v1';
function readReportingProjects(){try{return JSON.parse(localStorage.getItem(REPORTING_PROJECT_KEY)||'[]')}catch(_){return []}}
function saveReportingProject(clue){
  const rows=readReportingProjects();const id='project-'+clue.clue_id;const now=new Date().toISOString();const old=rows.find(x=>x.project_id===id);
  if(old){old.updated_at=now;old.clue=clue}else{rows.unshift({project_id:id,clue_id:clue.clue_id,title:clue.headline||'취재 프로젝트',status:'진행중',created_at:now,updated_at:now,notes:'',judgment:null,judgment_history:[],clue})}
  localStorage.setItem(REPORTING_PROJECT_KEY,JSON.stringify(rows));location.href='/projects.html?project='+encodeURIComponent(id);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-project-id]');if(!b)return;const clue=(typeof DATA!=='undefined'?DATA:[]).find(x=>String(x.clue_id)===String(b.dataset.projectId));if(clue)saveReportingProject(clue)});
</script></body>`);
  }
  return next;
}

function addDossierSearchToMotae(html) {
  let next = html;
  if (!next.includes('/dossier-drawer.css')) next = next.replace('</head>', '<link rel="stylesheet" href="/dossier-drawer.css"></head>');
  if (!next.includes('id="dossierQuickSearch"')) {
    const box = '<section class="dossier-quick"><strong>취재파일 검색</strong><input id="dossierQuickSearch" type="search" autocomplete="off" placeholder="기업·PEF·VC·AC·LP·펀드 검색"><button class="btn" id="dossierQuickButton" type="button">검색</button><div class="dossier-quick-results" id="dossierQuickResults" hidden></div></section>';
    next = next.replace('<div class="page-head">', box + '<div class="page-head">');
    next = next.replace('</head>', '<style id="dossier-quick-style">.dossier-quick{display:grid;grid-template-columns:auto minmax(260px,520px) auto;gap:8px;align-items:center;background:#fff;border:1px solid #dbe3ee;border-radius:11px;padding:9px 11px;margin:0 0 12px}.dossier-quick strong{font-size:10px;white-space:nowrap}.dossier-quick input{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;font-size:10.5px}.dossier-quick-results{grid-column:2/4;display:flex;gap:5px;flex-wrap:wrap}.dossier-quick-results[hidden]{display:none}.dossier-result{border:1px solid #e2e8f0;background:#f8fafc;border-radius:99px;padding:5px 8px;font-size:9px;font-weight:800;color:#334155;cursor:pointer}.dossier-result:hover{border-color:#93c5fd;color:#1d4ed8}@media(max-width:720px){.dossier-quick{grid-template-columns:1fr}.dossier-quick-results{grid-column:1}}</style></head>');
  }
  if (!next.includes('/dossier-drawer.js')) next = next.replace('</body>', '<script src="/dossier-drawer.js"></script></body>');
  if (!next.includes('id="dossier-quick-script"')) {
    next = next.replace('</body>', `<script id="dossier-quick-script">
(function(){const input=document.getElementById('dossierQuickSearch'),button=document.getElementById('dossierQuickButton'),box=document.getElementById('dossierQuickResults');if(!input||!box)return;const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));async function search(){const q=input.value.trim();if(!q){box.hidden=true;box.innerHTML='';return}box.hidden=false;box.innerHTML='<span class="small muted">검색 중…</span>';try{const r=await fetch('/api/entity?action=search&q='+encodeURIComponent(q)+'&limit=10'),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'검색 실패');const rows=d.items||[];box.innerHTML=rows.length?rows.map(x=>'<button class="dossier-result" type="button" data-dossier-entity="'+esc(x.entity_key)+'">'+esc(x.canonical_name)+' · '+esc(x.type_label||'취재대상')+'</button>').join(''):'<span class="small muted">일치하는 취재파일이 없습니다.</span>'}catch(e){box.innerHTML='<span class="small muted">'+esc(e.message||e)+'</span>'}}button.addEventListener('click',search);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});let timer;input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,280)});})();
</script></body>`);
  }
  return next;
}

for (const [file, fn] of [['leads.html',addLeadHandoff],['motae.html',addDossierSearchToMotae]]) {
  const target=path.join(root,file);if(!fs.existsSync(target))continue;const original=fs.readFileSync(target,'utf8');const next=fn(original);if(next!==original)fs.writeFileSync(target,next,'utf8');
}
