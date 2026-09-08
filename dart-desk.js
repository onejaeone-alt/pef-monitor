(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.IBDartDesk=api;api.init();}})(typeof window==='object'?window:globalThis,function(){
'use strict';
// One list, explicit source reading. Never turn title templates into reporting findings.
const STORE='ib_dart_reviews_v1',PROJECTS='pef_my_reporting_projects_v1';
const REVIEW_VERSION='dart-review-1.5',DEFAULT_VIEW='raw';
const isCurrentReview=r=>Boolean(r?.ok&&r.version===REVIEW_VERSION);
const hasChanges=r=>Boolean(isCurrentReview(r)&&r.changes?.length);
const staleNotice='이전 분석 버전의 보관 결과입니다. 새로 읽기 전에는 원문과 직접 대조해주세요.';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const receipt=n=>/^\d{14}$/.test(String(n||''));
const url=n=>receipt(n)?'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+n:'#';
const date=v=>/^\d{8}$/.test(String(v||''))?`${v.slice(0,4)}.${v.slice(4,6)}.${v.slice(6,8)}`:'일자 미확인';
const correction=x=>/^\s*(?:\[(?:기재정정|첨부정정|정정)\]|기재정정|첨부정정|정정)/.test(x.report_nm||'');
const concern=x=>/철회|중단|취소|회생|부도|연체|횡령|배임|감사의견거절|감사의견부적정/.test(x.report_nm||'');
function base(v){return String(v||'').replace(/^\s*(?:\[(?:기재정정|첨부정정|정정)\]|기재정정|첨부정정|정정)\s*/,'').replace(/\s+/g,' ').trim();}
// Retained for the API's search-family metadata, not used to merge the visible list.
function buildGroups(items){const m=new Map();for(const x of items||[]){if(!receipt(x.rcept_no))continue;const k=[x.corp_code||x.corp_name,base(x.report_nm),x.flr_nm||x.rcept_no].join('|');if(!m.has(k))m.set(k,[]);if(!m.get(k).some(a=>a.rcept_no===x.rcept_no))m.get(k).push(x);}return [...m.values()].map(rows=>{rows.sort((a,b)=>b.rcept_no.localeCompare(a.rcept_no));return {latest:rows[0],items:rows};});}
function mergeProject(rows,item,review){
  if(!Array.isArray(rows))throw Error('취재 목록 형식을 확인해야 합니다.');
  if(!receipt(item?.rcept_no)||review?.rcept_no!==item.rcept_no||!isCurrentReview(review))throw Error('해당 접수번호의 원문을 새로 읽은 뒤 담아주세요.');
  const pid='project-dart-'+item.rcept_no,now=new Date().toISOString(),out=rows.map(p=>({...p}));let p=out.find(p=>p.project_id===pid);
  if(!p){p={project_id:pid,clue_id:'dart-'+item.rcept_no,title:item.corp_name+' · '+base(item.report_nm),status:'추가확인',notes:'',judgment:null,judgment_history:[],created_at:now,
    clue:{clue_id:'dart-'+item.rcept_no,detector:'dart_manual_review',fact_status:'단서',headline:item.corp_name+' · '+base(item.report_nm),one_line_signal:'기자가 취재 대상으로 선택한 공시입니다.',previous_state:'',changed_fact:'',confirmed_facts:[],reported:[],unknowns:[],questions:[],hypothesis:'',falsification:'',next_action:'',sources:[{source_id:'dart:'+item.rcept_no,label:item.report_nm,url:url(item.rcept_no)}]}};out.unshift(p);}
  p.dart_review_receipts=[...new Set([...(Array.isArray(p.dart_review_receipts)?p.dart_review_receipts:[]),item.rcept_no])];p.updated_at=now;return {rows:out,id:pid};
}
function evidenceHtml(r){
  if(!r?.ok)return '<p class="dd-empty">원문을 읽지 못했습니다. DART 원문에서 확인해주세요.</p>';
  const changes=Array.isArray(r.changes)?r.changes:[],fields=Array.isArray(r.current_fields)?r.current_fields:[],warnings=Array.isArray(r.warnings)?r.warnings:[];
  const snapshot=r.read_at&&!Number.isNaN(Date.parse(r.read_at))?new Date(r.read_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'';
  let h=`${!isCurrentReview(r)?`<p class="dd-warning" role="status">${staleNotice}</p>`:''}<div class="dd-source-head"><b>공시에서 읽은 내용</b><a href="${url(r.rcept_no)}" target="_blank" rel="noopener noreferrer">DART 원문 ↗</a></div><p class="dd-note">원문 자동 추출 · 검수 전${snapshot?' · '+esc(snapshot):''}</p>`;
  if(changes.length)h+='<div class="dd-changes">'+changes.map(d=>`<article class="dd-change" id="dd-e-${esc(d.evidence_id)}"><b>${esc(d.label)}</b><div class="dd-before-after"><div><small>정정 전</small><span>${esc(d.before)}</span></div><span class="dd-arrow" aria-hidden="true">→</span><div><small>정정 후</small><strong>${esc(d.after)}</strong></div></div>${typeof d.day_delta==='number'&&Number.isFinite(d.day_delta)&&d.day_delta!==0?`<p class="dd-days">기재된 날짜 기준 ${Math.abs(d.day_delta)}일 ${d.day_delta>0?'뒤로':'앞으로'} 변경</p>`:''}${d.reason?`<p><small>공시에 적힌 정정 사유</small> ${esc(d.reason)}</p>`:''}<small class="dd-location">${esc(d.source?.location||'원문 위치 미확보')}${Number.isInteger(d.reason_source_row)&&d.reason_source_row!==d.source?.row?' · 정정 사유: 행 '+d.reason_source_row:''}</small></article>`).join('')+'</div>';
  else h+='<p class="dd-note">비교 가능한 변경값을 추출하지 못했습니다. 변경이 없다는 뜻은 아닙니다.</p>';
  if(fields.length)h+=`<details class="dd-details"><summary>공시에 기재된 조건 ${fields.length}개</summary><dl class="dd-fields">${fields.map(f=>`<div id="dd-e-${esc(f.evidence_id)}"><dt>${esc(f.raw_label||f.label)}</dt><dd>${esc(f.value)}<small>${esc(f.source?.location||'원문 위치 미확보')}</small></dd></div>`).join('')}</dl></details>`;
  if(warnings.length)h+=`<details class="dd-details"><summary>읽지 못했거나 대조가 필요한 부분 ${warnings.length}개</summary><p>${warnings.map(esc).join('<br>')}</p></details>`;
  return h;
}
function brief(item,r){
  return [!isCurrentReview(r)?staleNotice:'',item.corp_name+' · '+item.report_nm,url(item.rcept_no),'DART 원문 자동 추출 · 검수 전',r?.read_at?'추출 시각: '+r.read_at:'',
    ...(r?.changes||[]).map(d=>`${d.label}: ${d.before} → ${d.after}\n공시의 정정 사유: ${d.reason||'정정표에서 별도 사유 미확보'}\n${d.source?.location||'원문 위치 미확보'}`),
    ...(r?.current_fields||[]).map(f=>`${f.label||f.raw_label}: ${f.value}\n${f.source?.location||'원문 위치 미확보'}`),...(r?.warnings||[])
  ].filter(Boolean).join('\n\n');
}
function filteredItems(items,{query='',group='ALL',onlyCorrections=false}={}){
  const q=String(query).trim().toLowerCase();
  return (items||[]).filter(x=>receipt(x.rcept_no)&&(group==='ALL'||x.group_id===group)&&(!onlyCorrections||correction(x))&&(!q||[x.corp_name,x.flr_nm,x.report_nm].join(' ').toLowerCase().includes(q))).sort((a,b)=>b.rcept_no.localeCompare(a.rcept_no));
}
function init(){if(typeof document==='undefined')return;const $=s=>document.querySelector(s);
  function read(k,def){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v===null?def:v;}catch(_){return def;}}
  function readReviews(){const v=read(STORE,{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
  function attachProjects(){const rows=read(PROJECTS,[]),reviews=readReviews();if(!Array.isArray(rows))return;
    const targets=[...document.querySelectorAll('.project-card')].map(el=>({el,p:rows.find(p=>p.project_id===el.dataset.id)}));const judge=$('#judgeRoot .judge-panel');if(judge){const pid=new URLSearchParams(location.search).get('project')||localStorage.getItem('pef_selected_project_v1');targets.push({el:judge,p:rows.find(p=>p.project_id===pid)});}
    for(const {el,p} of targets){if(!p?.dart_review_receipts?.length||el.querySelector('.dd-linked'))continue;const valid=p.dart_review_receipts.filter(n=>receipt(n)&&reviews[n]?.ok&&reviews[n].rcept_no===n);if(!valid.length)continue;const d=document.createElement('details');d.className='dd-linked dd-details';d.innerHTML='<summary>연결된 DART 공시 근거</summary>'+valid.map(n=>evidenceHtml(reviews[n])).join('');el.append(d);}
  }
  document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#dd-e-"]');if(!a)return;const target=document.getElementById(a.hash.slice(1));if(!target)return;event.preventDefault();for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;target.scrollIntoView({block:'center'});});
  if(!$('#dartDesk')){let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;attachProjects();});});observer.observe(document.body,{childList:true,subtree:true});attachProjects();return;}
  let items=[],reviews=readReviews(),days=3,query='',group='ALL',onlyCorrections=false,shown=80,sequence=0,controller;
  const open=new Set(),loading=new Set(),failed=new Map(),message=t=>{$('#deskMessage').textContent=t;};
  const validReview=n=>reviews[n]?.rcept_no===n&&isCurrentReview(reviews[n]);
  function detail(x){const n=x.rcept_no,r=reviews[n],usable=r?.ok&&r.rcept_no===n;
    return `<tr class="dd-expanded" id="dart-detail-${n}"><td colspan="6"><section class="dd-review" tabindex="-1" aria-label="${esc(x.corp_name)} 공시 상세">${loading.has(n)?'<p role="status">공시 원문을 읽는 중입니다…</p>':usable?evidenceHtml(r):'<p class="dd-empty">원문을 자동으로 읽지 못했습니다. DART 원문을 열어 확인하거나 다시 읽어주세요.</p>'}${failed.has(n)?`<p class="dd-warning" role="alert">${esc(failed.get(n))}${usable?' 이전 보관 결과는 유지합니다.':''}</p>`:''}<div class="dd-review-actions"><a href="${url(n)}" target="_blank" rel="noopener noreferrer">DART 원문 ↗</a><button type="button" data-read="${n}" ${loading.has(n)?'disabled':''}>새로 읽기</button>${validReview(n)?`<button type="button" data-copy="${n}">공시 근거 복사</button><button type="button" data-project="${n}">진행중 취재에 담기</button>`:''}</div></section></td></tr>`;
  }
  function render(){const all=filteredItems(items,{query,group,onlyCorrections}),rows=all.slice(0,shown);
    $('#rawRows').innerHTML=rows.length?rows.map(x=>{const n=x.rcept_no;return `<tr data-receipt="${n}"><td>${date(x.rcept_dt)}</td><td class="dd-corp">${esc(x.corp_name)}</td><td><a href="${url(n)}" target="_blank" rel="noopener noreferrer">${esc(x.report_nm)}</a></td><td>${esc(x.group_label||'기타')}</td><td>${esc(x.flr_nm||'미확인')}</td><td><button type="button" data-toggle="${n}" aria-expanded="${open.has(n)}" aria-controls="dart-detail-${n}" aria-label="${esc(x.corp_name)} 공시 내용 ${open.has(n)?'접기':'확인'}">${open.has(n)?'접기':'내용 확인'}</button></td></tr>${open.has(n)?detail(x):''}`;}).join(''):'<tr><td colspan="6">조건에 맞는 공시가 없습니다.</td></tr>';
    $('#rawCount').textContent=`${all.length}건 · 최신순${all.length>shown?' · '+shown+'건 표시':''}`;$('#more').hidden=all.length<=shown;
  }
  async function readReceipt(n){if(!receipt(n)||loading.has(n))return;loading.add(n);failed.delete(n);render();
    try{const response=await fetch('/api/dart-feed?action=review&rcept_no='+n,{cache:'no-store',signal:AbortSignal.timeout(25000)}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'원문을 읽지 못했습니다.');if(data.rcept_no!==n||!isCurrentReview(data))throw Error('접수번호나 분석 버전이 맞지 않습니다. 화면을 새로고침해주세요.');
      // Merge against the latest store so other tabs' public reviews are not lost.
      const saved=readReviews();reviews={...reviews,...saved,[n]:data};try{localStorage.setItem(STORE,JSON.stringify({...saved,[n]:data}));}catch(_){message('저장공간이 부족합니다. 공시 근거 복사로 보관해주세요. 기존 기록은 지우지 않았습니다.');}
    }catch(e){failed.set(n,e.name==='TimeoutError'?'원문 응답이 늦습니다. DART 원문을 열거나 다시 읽어주세요.':String(e.message||e));}finally{loading.delete(n);render();}
  }
  async function load(fresh=false){controller?.abort();controller=new AbortController();const token=++sequence;$('#refresh').disabled=true;$('#status').textContent='DART 조회 중';$('#rawRows').setAttribute('aria-busy','true');
    try{const response=await fetch(`/api/dart-feed?days=${days}&limit=700${fresh?'&fresh=1':''}&_=${Date.now()}`,{signal:controller.signal,cache:'no-store'}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'조회 실패');if(token!==sequence)return;
      const seen=new Set();items=(Array.isArray(data.items)?data.items:[]).filter(x=>receipt(x?.rcept_no)&&!seen.has(x.rcept_no)&&seen.add(x.rcept_no));shown=80;const c=data.coverage||{};
      $('#coverage').textContent=`${data.range?.bgn||''}~${data.range?.end||''} · 관련 공시 ${data.matched??items.length}건${c.complete===false?' · 일부 페이지 미수집':''}${c.display_limited?' · 표시 한도 적용':''}`;$('#coverage').classList.toggle('dd-warning',c.complete===false);$('#status').textContent=`${days}일 · ${items.length}건`;message('');render();
    }catch(e){if(token!==sequence||e.name==='AbortError')return;message('조회 실패: '+String(e.message||e)+(items.length?' 이전 목록은 유지합니다.':''));$('#status').textContent='조회 실패';}
    finally{if(token===sequence){$('#refresh').disabled=false;$('#rawRows').setAttribute('aria-busy','false');}}
  }
  $('#refresh').onclick=()=>load(true);$('#more').onclick=()=>{shown+=80;render();};$('#search').oninput=e=>{query=e.target.value;shown=80;render();};$('#groups').onchange=e=>{group=e.target.value;shown=80;render();};$('#onlyCorrections').onchange=e=>{onlyCorrections=e.target.checked;shown=80;render();};
  document.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b||!b.closest('#dartDesk'))return;
    if(b.dataset.days){const d=Number(b.dataset.days);if(![1,3,7,14].includes(d))return;days=d;document.querySelectorAll('[data-days]').forEach(el=>{el.classList.toggle('on',el===b);el.setAttribute('aria-pressed',String(el===b));});load(true);return;}
    if(b.dataset.toggle){const n=b.dataset.toggle;if(open.has(n))open.delete(n);else open.add(n);render();if(open.has(n)&&!validReview(n))await readReceipt(n);return;}
    if(b.dataset.read){open.add(b.dataset.read);await readReceipt(b.dataset.read);return;}
    const n=b.dataset.project||b.dataset.copy,x=items.find(x=>x.rcept_no===n);if(!x||!validReview(n))return;
    if(b.dataset.project){try{const result=mergeProject(read(PROJECTS,[]),x,reviews[n]);localStorage.setItem(PROJECTS,JSON.stringify(result.rows));location.href='/projects.html?project='+encodeURIComponent(result.id);}catch(e){message('저장하지 못했습니다: '+e.message);}return;}
    const content=brief(x,reviews[n]);try{await navigator.clipboard.writeText(content);message('공시 내용과 원문 위치를 복사했습니다.');}catch(_){const t=document.createElement('textarea');t.className='dd-copy';t.value=content;t.readOnly=true;b.parentElement.append(t);t.focus();t.select();}
  });
  load();
}
return {DEFAULT_VIEW,REVIEW_VERSION,isCurrentReview,hasChanges,buildGroups,mergeProject,correction,concern,base,evidenceHtml,brief,filteredItems,init};
});
