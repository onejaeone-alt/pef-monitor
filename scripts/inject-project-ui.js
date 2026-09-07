const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html','dart.html','motae.html','leads.html','projects.html','relations.html','judgment.html'];

function addProjectsNav(html, file) {
  if (html.includes('href="/projects.html"')) return html;
  const re = /(<a[^>]*href="\/leads\.html"[^>]*>AI 취재단서<\/a>)/;
  if (!re.test(html)) return html;
  const projectLink = file === 'projects.html'
    ? '<a class="on" href="/projects.html">내 취재</a>'
    : '<a href="/projects.html">내 취재</a>';
  return html.replace(re, `$1${projectLink}`);
}

function upgradeWorkflow(html, file) {
  if (!['leads.html','relations.html','judgment.html'].includes(file)) return html;
  let next = html;
  next = next.replace('grid-template-columns:repeat(4,minmax(0,1fr))', 'grid-template-columns:repeat(5,minmax(0,1fr))');
  if (!next.includes('<b>내 취재</b>')) {
    const leadStep = /(<a class="role-step(?: active)?" href="\/leads\.html"><em>1 · 발견<\/em><b>AI 취재단서<\/b><span>무엇이 달라졌나\?<\/span><\/a>)/;
    next = next.replace(leadStep, '$1\n<a class="role-step" href="/projects.html"><em>2 · 취재</em><b>내 취재</b><span>직접 확인하고 기록하기</span></a>');
  }
  next = next.replace('<em>2 · 축적</em><b>취재파일</b>', '<em>3 · 맥락</em><b>취재파일</b>');
  next = next.replace('<em>3 · 결정</em><b>기사판단기</b>', '<em>4 · 결정</em><b>기사판단기</b>');
  next = next.replace('<em>4 · 작성</em><b>기사 엔진 ↗</b>', '<em>5 · 작성</em><b>기사 엔진 ↗</b>');
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
  if(old){old.updated_at=now;old.clue=clue}else{rows.unshift({project_id:id,clue_id:clue.clue_id,title:clue.headline||'취재 프로젝트',status:'진행중',created_at:now,updated_at:now,notes:'',clue})}
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

function addJudgmentHandoff(html, file) {
  if (file !== 'judgment.html' || html.includes('id="selected-project-panel"')) return html;
  let next = html;
  const panel = '<section id="selected-project-panel" class="writer-box" style="display:none;margin-bottom:14px"><h3>선택한 취재 프로젝트</h3><div id="selected-project-body"></div></section>';
  next = next.replace('<section class="writer-box"><h3>판단에 들어오는 것</h3>', panel + '<section class="writer-box"><h3>판단에 들어오는 것</h3>');
  const script = `<script id="judgment-project-script">
(function(){
 const id=new URLSearchParams(location.search).get('project')||localStorage.getItem('pef_selected_project_v1');
 if(!id)return;
 let rows=[];try{rows=JSON.parse(localStorage.getItem('pef_my_reporting_projects_v1')||'[]')}catch(_){}
 const p=rows.find(x=>x.project_id===id);if(!p)return;
 const c=p.clue||{};const panel=document.getElementById('selected-project-panel'),body=document.getElementById('selected-project-body');
 panel.style.display='block';
 body.innerHTML='<p style="font-weight:850;margin:0 0 8px">'+(p.title||'취재 프로젝트')+'</p><p style="font-size:11px;line-height:1.6;color:#64748b;margin:0"><b>한 줄 신호</b> · '+(c.one_line_signal||'—')+'<br><b>취재 메모</b> · '+(p.notes||'아직 없음')+'</p>';
})();
</script>`;
  next = next.replace('</body>', script + '</body>');
  return next;
}

for (const file of pages) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  const original = fs.readFileSync(target, 'utf8');
  let next = addProjectsNav(original, file);
  next = upgradeWorkflow(next, file);
  next = addLeadHandoff(next, file);
  next = addJudgmentHandoff(next, file);
  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
