const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html','dart.html','motae.html','leads.html','projects.html','relations.html','judgment.html'];

function ensureCleanCss(html) {
  if (html.includes('/clean-ui.css')) return html;
  return html.replace('</head>', '<link rel="stylesheet" href="/clean-ui.css"></head>');
}

function ensureDossierAssets(html) {
  let next = html;
  if (!next.includes('/dossier-drawer.css')) next = next.replace('</head>', '<link rel="stylesheet" href="/dossier-drawer.css"></head>');
  if (!next.includes('/dossier-drawer.js')) next = next.replace('</body>', '<script src="/dossier-drawer.js"></script></body>');
  return next;
}

function normalizeNav(html, file) {
  let next = html;
  next = next.replace(/<a(?:\s+class="on")?\s+href="\/relations\.html">취재파일<\/a>/g, '');
  next = next.replace(/(<a[^>]*href="\/motae\.html"[^>]*>)(?:모태펀드|출자공고)(<\/a>)/g, '$1출자공고$2');
  next = next.replace(/(<a[^>]*href="\/leads\.html"[^>]*>)(?:AI 취재단서|AI 발견)(<\/a>)/g, '$1AI 발견$2');
  next = next.replace(/(<a[^>]*href="\/projects\.html"[^>]*>)(?:내 취재|진행중 취재)(<\/a>)/g, '$1진행중 취재$2');
  next = next.replace(/(<a[^>]*href="\/judgment\.html"[^>]*>)(?:기사판단기|기사화 판단)(<\/a>)/g, '$1기사화 판단$2');

  if (!next.includes('href="/leads.html"')) {
    const anchor = /(<a[^>]*href="\/motae\.html"[^>]*>출자공고<\/a>)/;
    next = next.replace(anchor, '$1<a href="/leads.html">AI 발견</a>');
  }
  if (!next.includes('href="/projects.html"')) {
    const anchor = /(<a[^>]*href="\/leads\.html"[^>]*>AI 발견<\/a>)/;
    next = next.replace(anchor, '$1<a href="/projects.html">진행중 취재</a>');
  }
  if (!next.includes('href="/judgment.html"')) {
    const anchor = /(<a[^>]*href="\/projects\.html"[^>]*>진행중 취재<\/a>)/;
    next = next.replace(anchor, '$1<a href="/judgment.html">기사화 판단</a>');
  }

  const href = file === 'index.html' ? '/' : file === 'dart.html' ? '/dart.html' : file === 'motae.html' ? '/motae.html' : file === 'leads.html' ? '/leads.html' : file === 'projects.html' ? '/projects.html' : file === 'judgment.html' ? '/judgment.html' : '';
  if (href) {
    next = next.replace(/<nav class="nav">([\s\S]*?)<\/nav>/, (all, inner) => {
      const cleaned = inner.replace(/\sclass="on"/g, '');
      const escaped = href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const marked = cleaned.replace(new RegExp(`<a([^>]*)href="${escaped}"`), `<a$1class="on" href="${href}"`);
      return '<nav class="nav">'+marked+'</nav>';
    });
  }
  return next;
}

function addGlobalDossierSearch(html) {
  let next = html;
  if (!next.includes('id="globalDossierSearch"')) {
    const box = '<div class="global-dossier-search"><div class="global-dossier-box"><span>⌕</span><input id="globalDossierSearch" type="search" autocomplete="off" placeholder="취재파일 검색 · 기업·GP·LP·펀드"></div><div class="global-dossier-results" id="globalDossierResults" hidden></div></div>';
    next = next.replace(/<div class="status"/, box + '<div class="status"');
  }
  if (!next.includes('id="global-dossier-search-script"')) {
    const script = `<script id="global-dossier-search-script">
(function(){
 const input=document.getElementById('globalDossierSearch'),box=document.getElementById('globalDossierResults');if(!input||!box)return;
 const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
 async function search(){const q=input.value.trim();if(!q){box.hidden=true;box.innerHTML='';return}box.hidden=false;box.innerHTML='<div class="global-dossier-empty">검색 중…</div>';try{const r=await fetch('/api/entity?action=search&q='+encodeURIComponent(q)+'&limit=8'),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'검색 실패');const rows=d.items||[];box.innerHTML=rows.length?rows.map(x=>'<button type="button" class="global-dossier-result" data-dossier-entity="'+esc(x.entity_key)+'"><b>'+esc(x.canonical_name)+'</b><span>'+esc(x.type_label||'취재대상')+'</span></button>').join(''):'<div class="global-dossier-empty">일치하는 취재파일이 없습니다.</div>'}catch(e){box.innerHTML='<div class="global-dossier-empty">'+esc(e.message||e)+'</div>'}}
 let timer;input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,220)});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});
 document.addEventListener('click',e=>{if(!e.target.closest('.global-dossier-search'))box.hidden=true;const hit=e.target.closest('.global-dossier-result');if(hit){setTimeout(()=>{box.hidden=true;input.value=''},0)}});
})();
</script>`;
    next = next.replace('</body>', script + '</body>');
  }
  return next;
}

function addClueFilters(html, file) {
  if (file !== 'leads.html' || html.includes('data-detector="gp_lp_shift"')) return html;
  const anchor = '<button class="chip" data-detector="formation_gap">결성 미확인</button><button class="chip" data-detector="cross_source">자료 연결</button>';
  const replacement = '<button class="chip" data-detector="formation_gap">결성 미확인</button><button class="chip" data-detector="gp_lp_shift">GP·LP 이동</button><button class="chip" data-detector="lp_rule_change">LP 기준 변화</button><button class="chip" data-detector="cross_source">자료 연결</button>';
  return html.includes(anchor) ? html.replace(anchor, replacement) : html;
}

function removeLegacyWorkflow(html) {
  return html
    .replace(/<style id="reporting-role-style">[\s\S]*?<\/style>/g, '')
    .replace(/<style id="four-step-workflow">[\s\S]*?<\/style>/g, '')
    .replace(/<div class="role-flow"[^>]*>[\s\S]*?<\/div>/g, '')
    .replace(/<div class="role-boundary">[\s\S]*?<\/div>/g, '');
}

function workflowMini(file) {
  if (!['leads.html','projects.html','judgment.html'].includes(file)) return '';
  const active = file === 'leads.html' ? 'lead' : file === 'projects.html' ? 'project' : 'judge';
  const link = (key, href, label) => `<a class="${key===active?'on':''}" href="${href}">${label}</a>`;
  return `<div class="workflow-mini" aria-label="취재 흐름">${link('lead','/leads.html','AI 발견')}<span class="arrow">→</span>${link('project','/projects.html','진행중 취재')}<span class="arrow">→</span>${link('judge','/judgment.html','기사화 판단')}<span class="arrow">→</span><a href="https://article-engine-wjy-onejess.vercel.app/" target="_blank" rel="noopener">기사 작성 ↗</a></div>`;
}

function addWorkflowMini(html, file) {
  if (!['leads.html','projects.html','judgment.html'].includes(file) || html.includes('class="workflow-mini"')) return html;
  return html.replace('<main class="page">', `<main class="page">${workflowMini(file)}`);
}

function simplifyLead(html, file) {
  if (file !== 'leads.html') return html;
  let next = html;
  next = next.replace(/<div class="policy-note">[\s\S]*?<\/div>/g, '');
  next = next.replace(/<h2>AI 취재단서<\/h2>/g, '<h2>AI 발견</h2>');
  next = next.replace('발견함입니다. 공시·출자·GP·펀드·뉴스를 이전 상태와 비교해 달라진 점과 확인할 질문만 찾습니다. 기사화 여부는 여기서 판단하지 않습니다.', 'AI가 공시·출자·뉴스의 변화를 자동으로 찾는 곳입니다. 아직 취재 전 후보입니다.');
  next = next.replace('이전 상태와 비교해 달라진 점만 보여줍니다. 취재할 건은 ‘내 취재’로 보냅니다.', 'AI가 공시·출자·뉴스의 변화를 자동으로 찾는 곳입니다. 아직 취재 전 후보입니다.');
  next = next.replace('공시·출자·GP·펀드·뉴스를 이전 상태와 비교해 기자가 확인할 변화를 먼저 찾습니다.', 'AI가 공시·출자·뉴스의 변화를 자동으로 찾는 곳입니다. 아직 취재 전 후보입니다.');
  next = next.replace(/내 취재로 보내기 →/g,'진행중 취재로 보내기 →');
  next = next.replace("$('#status').textContent=`단서 ${DATA.length}건 · 점수화 없음`", "$('#status').textContent=`단서 ${DATA.length}건`");
  return next;
}

function clarifyProject(html, file) {
  if (file !== 'projects.html') return html;
  let next = html;
  next = next.replace(/<h2>내 취재<\/h2>/g, '<h2>진행중 취재</h2>');
  next = next.replace('통화·원문 확인 결과를 적고, 판단할 만큼 모이면 기사판단기로 넘깁니다.', '내가 실제로 취재하기로 고른 건만 모읍니다. 전화·원문 확인·메모를 여기서 쌓습니다.');
  next = next.replace('AI 취재단서에서 <b>내 취재로 보내기</b>를 누른 건만 들어옵니다. 통화 결과와 확인 내용을 적고 기사판단기로 넘깁니다.', '내가 실제로 취재하기로 고른 건만 모읍니다. 전화·원문 확인·메모를 여기서 쌓습니다.');
  next = next.replace(/기사판단기로 보내기 →/g,'기사화 판단으로 보내기 →');
  next = next.replace(/기사판단 다시 보기 →/g,'기사화 판단 다시 보기 →');
  next = next.replace(/AI 취재단서/g,'AI 발견');
  next = next.replace(/내 취재에서 빼기/g,'진행중 취재에서 빼기');
  next = next.replace(/'내 취재 '/g,"'진행중 취재 '");
  return next;
}

function clarifyJudgment(html, file) {
  if (file !== 'judgment.html') return html;
  let next = html;
  next = next.replace(/<h2>기사판단기<\/h2>/g, '<h2>기사화 판단</h2>');
  next = next.replace('선택한 취재 한 건의 근거를 점검하고 기사화·추가취재·보류·폐기 중 하나로 결정합니다.', '취재가 진행된 건만 검토합니다. 기사화·추가취재·보류·폐기 중 하나를 결정합니다.');
  next = next.replace('내 취재에서 넘긴 한 건을 놓고 <b>기사화 / 추가취재 / 보류 / 폐기</b>를 실제로 결정하고 기록합니다.', '취재가 진행된 건만 검토합니다. 기사화·추가취재·보류·폐기 중 하나를 결정합니다.');
  next = next.replace(/내 취재에서/g,'진행중 취재에서');
  return next;
}

for (const file of pages) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  const original = fs.readFileSync(target, 'utf8');
  let next = original;
  next = removeLegacyWorkflow(next);
  next = normalizeNav(next, file);
  next = addClueFilters(next, file);
  next = simplifyLead(next, file);
  next = clarifyProject(next, file);
  next = clarifyJudgment(next, file);
  next = addWorkflowMini(next, file);
  next = ensureCleanCss(next);
  next = ensureDossierAssets(next);
  next = addGlobalDossierSearch(next);
  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
