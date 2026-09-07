const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'dart.html', 'motae.html', 'relations.html', 'judgment.html', 'leads.html'];

const WORKFLOW_STYLE = `
<style id="reporting-role-style">
.role-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:0 0 14px}.role-step{display:block;border:1px solid #e5e7eb;border-radius:11px;background:#fff;padding:9px 10px;text-decoration:none;color:#64748b;min-width:0}.role-step:hover{border-color:#aab6c5}.role-step.active{border-color:#172033;background:#172033;color:#fff}.role-step em{display:block;font-style:normal;font-size:8px;font-weight:900;letter-spacing:.04em;opacity:.68}.role-step b{display:block;margin-top:2px;font-size:11px;color:inherit}.role-step span{display:block;margin-top:3px;font-size:8.5px;line-height:1.4;color:inherit;opacity:.76}.role-boundary{border:1px solid #dbe4ee;background:#f8fbff;border-radius:10px;padding:9px 11px;margin-bottom:12px;font-size:9.5px;line-height:1.55;color:#536176}.role-boundary b{color:#172033}.role-boundary strong{color:#1d4ed8}@media(max-width:760px){.role-flow{grid-template-columns:1fr 1fr}}
</style>`;

function addClueNav(html) {
  if (html.includes('href="/leads.html"')) return html;
  const relationLink = /<a(\s+class="on")?\s+href="\/relations\.html">취재파일<\/a>/;
  const match = html.match(relationLink);
  if (!match) return html;
  return html.replace(match[0], `<a href="/leads.html">AI 취재단서</a>${match[0]}`);
}

function renameContributionNav(html) {
  return html.replace(/(<a[^>]*href="\/motae\.html"[^>]*>)모태펀드(<\/a>)/g, '$1출자공고$2');
}

function addClueFilters(html, file) {
  if (file !== 'leads.html' || html.includes('data-detector="gp_lp_shift"')) return html;
  const anchor = '<button class="chip" data-detector="formation_gap">결성 미확인</button><button class="chip" data-detector="cross_source">자료 연결</button>';
  if (!html.includes(anchor)) return html;
  const replacement = '<button class="chip" data-detector="formation_gap">결성 미확인</button><button class="chip" data-detector="gp_lp_shift">GP·LP 이동</button><button class="chip" data-detector="lp_rule_change">LP 기준 변화</button><button class="chip" data-detector="cross_source">자료 연결</button>';
  return html.replace(anchor, replacement);
}

function workflowHtml(file) {
  const active = file === 'leads.html' ? 'lead' : file === 'relations.html' ? 'file' : 'judge';
  const cls = key => key === active ? 'role-step active' : 'role-step';
  return `<div class="role-flow" aria-label="취재 흐름">
<a class="${cls('lead')}" href="/leads.html"><em>1 · 발견</em><b>AI 취재단서</b><span>무엇이 달라졌나?</span></a>
<a class="${cls('file')}" href="/relations.html"><em>2 · 축적</em><b>취재파일</b><span>지금까지 무엇을 아나?</span></a>
<a class="${cls('judge')}" href="/judgment.html"><em>3 · 결정</em><b>기사판단기</b><span>기사로 쓸 만큼 확인됐나?</span></a>
<a class="role-step" href="https://article-engine-wjy-onejess.vercel.app/" target="_blank" rel="noopener"><em>4 · 작성</em><b>기사 엔진 ↗</b><span>확인된 근거로 어떻게 쓸까?</span></a>
</div>`;
}

function addWorkflow(html, file) {
  if (!['leads.html', 'relations.html', 'judgment.html'].includes(file)) return html;
  let next = html;
  if (!next.includes('id="reporting-role-style"')) next = next.replace('</head>', `${WORKFLOW_STYLE}</head>`);
  if (!next.includes('class="role-flow"')) next = next.replace('<main class="page">', `<main class="page">${workflowHtml(file)}`);
  return next;
}

function clarifyLeadRole(html, file) {
  if (file !== 'leads.html') return html;
  let next = html;
  next = next.replace('공시·출자·GP·펀드·뉴스를 이전 상태와 비교해 기자가 확인할 변화를 먼저 찾습니다.', '발견함입니다. 공시·출자·GP·펀드·뉴스를 이전 상태와 비교해 달라진 점과 확인할 질문만 찾습니다. 기사화 여부는 여기서 판단하지 않습니다.');
  next = next.replace('기사 점수·자동 기사등급은 쓰지 않습니다. 공식 원문으로 확인된 사실, 보도, 단서와 추론을 분리하고 모든 자동 발견은 기본적으로 <b>추가취재</b> 상태에서 시작합니다.', '<strong>여기의 임무는 발견뿐입니다.</strong> 공식 원문·보도·단서를 구분하고 “무엇을 더 확인해야 하는가”까지 제시합니다. <b>기사화 / 추가취재 / 보류 / 폐기</b> 결정은 기사판단기에서만 합니다.');
  next = next.replace('<span>추가취재</span><strong id="sFollowup">—</strong>', '<span>검토 대기</span><strong id="sFollowup">—</strong>');
  next = next.replace('<span class="judgment"><b>현재 판단</b> · ${esc(x.judgment||\'추가취재\')} — ${esc(x.judgment_reason||\'\')}</span>', '<span class="judgment"><b>단서 단계</b> · 기사판단 전 — 무엇을 확인할지 정리한 상태</span>');
  next = next.replace('취재 시작 ▾', '취재 질문 보기 ▾');
  next = next.replace("b.textContent=el.hidden?'취재 시작 ▾':'취재 패키지 접기 ▴'", "b.textContent=el.hidden?'취재 질문 보기 ▾':'취재 질문 접기 ▴'");
  next = next.replace("$('#sFollowup').textContent=DATA.filter(x=>x.judgment==='추가취재').length", "$('#sFollowup').textContent=DATA.length");
  next = next.replace('AI 취재단서는 기사 초안이 아닙니다. 자동 발견 → 원문 대조 → 취재원 확인 → 가설 반증을 거쳐야 기사 판단으로 넘어갑니다.', 'AI 취재단서는 발견함입니다. 단서를 고르고 사실을 확인한 뒤 기사판단기로 넘깁니다. 여기서는 기사화 결정을 내리지 않습니다.');
  if (!next.includes('AI 취재단서에서는 <strong>발견')) {
    next = next.replace('<div class="policy-note">', '<div class="role-boundary"><b>경계</b> · AI 취재단서에서는 <strong>발견·비교·질문 설계</strong>까지만 합니다. 기업의 누적 정보는 취재파일, 기사 여부 결정은 기사판단기의 역할입니다.</div><div class="policy-note">');
  }
  return next;
}

function clarifyDossierRole(html, file) {
  if (file !== 'relations.html') return html;
  let next = html;
  next = next.replace('뉴스·공시·모태펀드를 따로 모으고, 기사 판단은 나중에 함께 합니다.', '취재파일은 기업·운용사·펀드·거래의 누적 사실과 관계를 보관하는 참고 화면입니다.');
  next = next.replace('기업과 운용사의 기본 정보, 투자 분야, 펀드와 주요 관계를 한꺼번에 확인합니다.', '누적 취재 사전입니다. 기업·운용사·펀드·거래의 기본정보, 확인된 관계와 사건 연표를 모아 봅니다. 새 단서를 발굴하거나 기사화 여부를 판단하지 않습니다.');
  next = next.replace('기업이나 운용사 이름, 확인하려는 이슈를 입력하세요.', '기업·운용사·LP·펀드 이름을 찾아 누적 취재파일을 엽니다.');
  next = next.replace('<span>관계 단서</span>', '<span>관계 기록</span>');
  next = next.replace('최근 14일 안에 새 이슈가 확인된 대상만 표시합니다.', '최근 움직임이 있었던 대상의 누적 취재파일로 바로 이동합니다. 이 영역 자체가 새 단서를 판정하는 것은 아닙니다.');
  next = next.replace('공식자료에서 확인한 사실과 기존 추적표 기록을 구분합니다. 공식 원문을 찾지 못한 과거 기록은 ‘원문 재확인 필요’로 표시합니다.', '<b>취재파일은 저장·조회 전용입니다.</b> 공식자료에서 확인한 누적 사실과 기존 추적표 기록을 구분합니다. 새 변화 탐지는 AI 취재단서에서, 기사화 결정은 기사판단기에서 합니다.');
  if (!next.includes('취재파일에서는 <strong>누적 사실')) {
    next = next.replace('<section class="panel dossier-search-panel">', '<div class="role-boundary"><b>경계</b> · 취재파일에서는 <strong>누적 사실·관계·연표</strong>만 봅니다. “오늘 무엇이 달라졌나”는 AI 취재단서, “기사로 쓸 수 있나”는 기사판단기에서 봅니다.</div><section class="panel dossier-search-panel">');
  }
  return next;
}

function clarifyJudgmentRole(html, file) {
  if (file !== 'judgment.html') return html;
  let next = html;
  next = next.replace('무료 원자료를 수집하고, 기사 판단은 여러 출처를 합친 뒤에만 합니다.', '기사판단기는 취재가 진행된 건만 놓고 기사화 여부를 결정하는 마지막 게이트입니다.');
  next = next.replace('DART 한 건이나 뉴스 한 건만 보고 기사 후보를 만들지 않습니다.', '선택한 취재단서에 취재파일·공식 원문·직접취재 결과를 합쳐 기사화 / 추가취재 / 보류 / 폐기만 결정합니다. 새 단서를 찾거나 기사를 쓰는 화면이 아닙니다.');
  const oldBox = '<section class="writer-box"><h3>준비 중</h3><p>기사판단기는 나중에 연결합니다. 자동으로 유료 AI를 돌리는 방식이 아니라, 먼저 코드와 DB가 같은 기업·GP·펀드·거래의 자료를 묶고 충분한 근거가 생긴 건만 판단 대상으로 올리는 구조로 만들 예정입니다.</p><div class="future-flow"><div><b>1. 무료 수집</b><span>뉴스·DART·KVIC·공식자료를 계속 저장</span></div><div><b>2. 코드로 묶기</b><span>이름·날짜·사건유형·관계로 같은 건을 연결</span></div><div><b>3. 판단 대기열</b><span>서로 다른 출처가 겹치는 사건만 후보로 표시</span></div><div><b>4. ChatGPT 판단</b><span>원기자가 고른 건만 취재패키지로 ChatGPT에 전달</span></div></div><button class="btn pink" disabled style="margin-top:15px">기사판단기 · 준비 중</button></section>';
  const newBox = '<div class="role-boundary"><b>경계</b> · 기사판단기에서는 <strong>기사로 성립하는지</strong>만 결정합니다. 원문 수집은 뉴스·DART·출자공고, 변화 발견은 AI 취재단서, 누적 맥락 조회는 취재파일, 문장 작성은 기사 엔진의 역할입니다.</div><section class="writer-box"><h3>판단에 들어오는 것</h3><p><b>선택한 취재단서 + 취재파일 + 공식 원문 + 직접취재 결과</b>를 한 묶음으로 봅니다. “재미있어 보인다”가 아니라 핵심 주장에 필요한 사실과 반증이 얼마나 채워졌는지 확인합니다.</p><div class="future-flow"><div><b>기사화</b><span>새 사실과 의미가 확인됐고 핵심 주장에 근거가 있음</span></div><div><b>추가취재</b><span>쟁점은 있으나 수치·비교·당사자 확인·반증이 부족함</span></div><div><b>보류</b><span>다음 사건이나 일정이 발생해야 판단 가능함</span></div><div><b>폐기</b><span>새 사실이 없거나 가설이 깨졌거나 이미 충분히 알려짐</span></div></div><div class="future-flow"><div><b>판단 질문 1</b><span>핵심 주장을 한 문장으로 쓸 수 있나</span></div><div><b>판단 질문 2</b><span>그 주장을 뒷받침하는 확인 근거가 있나</span></div><div><b>판단 질문 3</b><span>반대 사례·당사자 반론을 견딜 수 있나</span></div><div><b>판단 질문 4</b><span>부족한 확인사항이 기사 결론을 바꿀 수 있나</span></div></div><button class="btn pink" disabled style="margin-top:15px">선택 단서 판단 연결 · 다음 단계</button></section>';
  if (next.includes(oldBox)) next = next.replace(oldBox, newBox);
  next = next.replace('현재 자동 기사 후보·자동 AI 호출은 없습니다. 비용이 발생하는 판단 기능도 켜지 않습니다.', '기사판단기는 기사 초안을 만들지 않습니다. 기사화로 확정된 건만 기사 엔진으로 넘기는 구조로 연결합니다.');
  return next;
}

for (const file of pages) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  const original = fs.readFileSync(target, 'utf8');
  let next = addClueNav(original);
  next = renameContributionNav(next);
  next = addClueFilters(next, file);
  next = addWorkflow(next, file);
  next = clarifyLeadRole(next, file);
  next = clarifyDossierRole(next, file);
  next = clarifyJudgmentRole(next, file);
  if (next !== original) fs.writeFileSync(target, next, 'utf8');
}
