const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function addLeadHandoff(html) {
  if (html.includes('data-project-id="${esc(x.clue_id)}"')) return html;
  let next = html;
  const re = /<button class="start-btn" data-package="package-\$\{i\}">(?:취재 질문 보기|취재 질문|취재 시작) ▾<\/button>/;
  const match = next.match(re);
  if (!match) return next;
  const questionButton = '<button class="start-btn" data-package="package-${i}">취재 질문 ▾</button>';
  next = next.replace(match[0], '<button class="project-send-btn" data-project-id="${esc(x.clue_id)}">진행중 취재로 보내기 →</button>' + questionButton);
  next = next.replace(/내 취재로 보내기 →/g,'진행중 취재로 보내기 →').replace(/취재 시작 ▾/g,'취재 질문 ▾').replace(/취재 패키지 접기 ▴/g,'질문 접기 ▴').replace(/취재 질문 보기 ▾/g,'취재 질문 ▾').replace(/취재 질문 접기 ▴/g,'질문 접기 ▴');
  if (!next.includes('id="project-send-style"')) {
    next = next.replace('</head>', '<style id="project-send-style">.project-send-btn{border:1px solid #172033;border-radius:8px;background:#fff;color:#172033;padding:7px 11px;font-size:9.5px;font-weight:900;cursor:pointer}.project-send-btn:hover{background:#f1f5f9}</style></head>');
  }
  if (!next.includes('id="project-handoff-script"')) {
    next = next.replace('</body>', `<script id="project-handoff-script">
const REPORTING_PROJECT_KEY='pef_my_reporting_projects_v1';
function readReportingProjects(){try{return JSON.parse(localStorage.getItem(REPORTING_PROJECT_KEY)||'[]')}catch(_){return []}}
function saveReportingProject(clue){const rows=readReportingProjects();const id='project-'+clue.clue_id;const now=new Date().toISOString();const old=rows.find(x=>x.project_id===id);if(old){old.updated_at=now;old.clue=clue}else{rows.unshift({project_id:id,clue_id:clue.clue_id,title:clue.headline||'취재 프로젝트',status:'진행중',created_at:now,updated_at:now,notes:'',judgment:null,judgment_history:[],clue})}localStorage.setItem(REPORTING_PROJECT_KEY,JSON.stringify(rows));location.href='/projects.html?project='+encodeURIComponent(id)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-project-id]');if(!b)return;const clue=(typeof DATA!=='undefined'?DATA:[]).find(x=>String(x.clue_id)===String(b.dataset.projectId));if(clue)saveReportingProject(clue)});
</script></body>`);
  }
  return next;
}

function removeOldDossierQuick(html) {
  return html
    .replace(/<section class="dossier-quick">[\s\S]*?<\/section>/g,'')
    .replace(/<style id="dossier-quick-style">[\s\S]*?<\/style>/g,'')
    .replace(/<script id="dossier-quick-script">[\s\S]*?<\/script>/g,'');
}

for (const file of ['leads.html','motae.html']) {
  const target=path.join(root,file);if(!fs.existsSync(target))continue;
  const original=fs.readFileSync(target,'utf8');
  let next=removeOldDossierQuick(original);
  if(file==='leads.html') next=addLeadHandoff(next);
  if(next!==original) fs.writeFileSync(target,next,'utf8');
}
