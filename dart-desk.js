(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.IBDartDesk=api;api.init();}
})(typeof window==='object'?window:globalThis,function(){
'use strict';

// DART is a daily-report material selector, not an automatic article-value judge.
// Source reading happens only after an explicit disclosure click.
const STORE='ib_dart_reviews_v1',PROJECTS='pef_my_reporting_projects_v1';
const REVIEW_VERSION='dart-review-1.5',DEFAULT_VIEW='raw',DEFAULT_FEED='priority';
const staleNotice='이전 분석 버전의 보관 결과입니다. 새로 읽기 전에는 원문과 직접 대조해주세요.';
const isCurrentReview=r=>Boolean(r?.ok&&r.version===REVIEW_VERSION);
const hasChanges=r=>Boolean(isCurrentReview(r)&&Array.isArray(r.changes)&&r.changes.length);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const receipt=n=>/^\d{14}$/.test(String(n||''));
const url=n=>receipt(n)?'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+n:'#';
const date=v=>/^\d{8}$/.test(String(v||''))?`${v.slice(0,4)}.${v.slice(4,6)}.${v.slice(6,8)}`:'일자 미확인';
const correction=x=>Boolean(x?.is_correction)||/^\s*(?:\[(?:기재정정|첨부정정|정정)\]|기재정정|첨부정정|정정)/.test(x?.report_nm||'');
const concern=x=>/철회|중단|취소|회생|부도|연체|횡령|배임|감사의견거절|감사의견부적정|강제집행|가압류/.test(x?.report_nm||'');
const compact=(v,n=72)=>{const s=String(v??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
function base(v){return String(v||'').replace(/^\s*(?:\[(?:기재정정|첨부정정|정정)\]|기재정정|첨부정정|정정)\s*/,'').replace(/\s+/g,' ').trim();}

function buildGroups(items){
  const m=new Map();
  for(const x of items||[]){
    if(!receipt(x?.rcept_no))continue;
    const k=[x.corp_code||x.corp_name,base(x.report_nm),x.flr_nm||x.rcept_no].join('|');
    if(!m.has(k))m.set(k,[]);
    if(!m.get(k).some(a=>a.rcept_no===x.rcept_no))m.get(k).push(x);
  }
  return [...m.values()].map(rows=>{rows.sort((a,b)=>b.rcept_no.localeCompare(a.rcept_no));return {latest:rows[0],items:rows};});
}

function familyKey(x){return x?.family_id||[x?.corp_code||x?.corp_name,base(x?.report_nm),x?.flr_nm||''].join('|');}
function familyStats(items){
  const out=new Map();
  for(const x of items||[]){
    const key=familyKey(x),old=out.get(key)||{count:0,corrections:0};
    old.count++;if(correction(x))old.corrections++;out.set(key,old);
  }
  return out;
}

function priorityReason(item){
  if(!item)return null;
  if(concern(item))return '위험·법적 변화';
  if(item.tier==='core')return item.tier_label||'핵심 변동';
  if(item.tier==='change')return item.tier_label||'정정·조건변경';
  if(correction(item)&&!['reference','other'].includes(item.group_id))return '정정·조건변경';
  return null;
}

function groupDisplay(item){
  const map={deal:'M&A·경영권',equity:'투자·회수',finance:'자금조달',risk:'크레딧·위험',fund:'PEF·펀드',governance:'계열·내부거래',reference:'정기보고',other:'기타'};
  return map[item?.group_id]||item?.group_label||'기타';
}

function axisTags(item,review){
  const text=[item?.report_nm,item?.event_id,item?.event_label,...((review?.changes||[]).map(d=>d.label)),...((review?.current_fields||[]).map(f=>f.label||f.raw_label))].join(' ');
  const tags=[];const add=t=>{if(!tags.includes(t))tags.push(t);};
  if(item?.group_id==='finance'||/금액|발행|차입|대여|보증|담보|채무|상환|취득가|처분가|매매대금|자금/.test(text))add('돈');
  if(item?.group_id==='deal'||item?.group_id==='equity'||/인수|매각|합병|분할|양수|양도|취득|처분|공개매수/.test(text))add('거래');
  if(/최대주주|경영권|의결권|보유목적|지분율|주주/.test(text)||item?.event_id==='control_change')add('지배력');
  if(item?.group_id==='risk'||/회생|부도|연체|횡령|배임|감사의견|차입만기|우발채무/.test(text))add('위험');
  if(/납입일|예정일|종료일|만기일|기간|일정|기한/.test(text))add('일정');
  if(/전환사채|신주인수권부사채|교환사채|유상증자|전환가|발행가/.test(text))add('희석');
  return tags.slice(0,3);
}

function rowDelta(item,review){
  if(isCurrentReview(review)&&Array.isArray(review.changes)&&review.changes.length){
    return {label:'달라진 것',state:'confirmed',text:review.changes.slice(0,2).map(d=>`${compact(d.label,24)} ${compact(d.before,38)} → ${compact(d.after,38)}`).join(' · ')};
  }
  if(correction(item))return {label:'달라진 것',state:'pending',text:'정정공시 · 변경값 확인 전'};
  if(isCurrentReview(review)&&Array.isArray(review.current_fields)&&review.current_fields.length){
    return {label:'이번 공시',state:'confirmed',text:review.current_fields.slice(0,2).map(f=>`${compact(f.label||f.raw_label,24)} ${compact(f.value,50)}`).join(' · ')};
  }
  return {label:'이번 공시',state:'pending',text:'원문 비교 전 · 내용 확인 필요'};
}

function nextCheckText(item){
  if(item?.next_check)return item.next_check;
  const fallback={deal:'거래상대방 · 거래금액 · 종결일',equity:'지분율 · 거래가 · 상대방 · 잔여지분',finance:'금액 · 상대방 · 만기 · 자금용도',risk:'채무액 · 채권자 · 만기 · 다음 일정',fund:'GP · LP · 약정액 · 결성일',governance:'출자 · 대여 · 보증 · 거래상대방',reference:'차입금 · 투자자산 · 우발채무'};
  return fallback[item?.group_id]||'상대방 · 금액 · 지분 · 일정';
}

function reportingCheck(item){
  if(item?.monitor_reason)return item.monitor_reason;
  const map={deal:'거래 종결 조건과 실제 지배력 이동 여부 확인',equity:'거래 상대방과 취득·처분 뒤 지분 구조 확인',finance:'실제 납입과 자금 사용처·상환 부담 확인',risk:'채권자·차입금과 영업 지속 영향 확인',fund:'GP·LP·약정액과 실제 결성 단계 확인',governance:'계열 내 자금·지분 이동의 실제 수혜자 확인',reference:'직전 보고 대비 차입·투자·우발채무 변화 확인'};
  return map[item?.group_id]||'공시 상대방·금액·지분·일정을 원문과 취재로 확인';
}

function filteredItems(items,{query='',group='ALL',onlyCorrections=false,feed='all'}={}){
  const q=String(query).trim().toLowerCase();
  return (items||[]).filter(x=>{
    if(!receipt(x?.rcept_no))return false;
    if(group!=='ALL'&&x.group_id!==group)return false;
    if(onlyCorrections&&!correction(x))return false;
    if(feed==='priority'&&!priorityReason(x))return false;
    if(feed==='corrections'&&!correction(x))return false;
    if(q&&![x.corp_name,x.flr_nm,x.report_nm,x.group_label,x.event_label].join(' ').toLowerCase().includes(q))return false;
    return true;
  }).sort((a,b)=>String(b.rcept_no).localeCompare(String(a.rcept_no)));
}

function mergeProject(rows,item,review){
  if(!Array.isArray(rows))throw Error('취재 목록 형식을 확인해야 합니다.');
  if(!receipt(item?.rcept_no)||review?.rcept_no!==item.rcept_no||!isCurrentReview(review))throw Error('해당 접수번호의 원문을 새로 읽은 뒤 담아주세요.');
  const pid='project-dart-'+item.rcept_no,now=new Date().toISOString(),out=rows.map(p=>({...p}));let p=out.find(p=>p.project_id===pid);
  if(!p){
    p={project_id:pid,clue_id:'dart-'+item.rcept_no,title:item.corp_name+' · '+base(item.report_nm),status:'추가확인',notes:'',judgment:null,judgment_history:[],created_at:now,
      clue:{clue_id:'dart-'+item.rcept_no,detector:'dart_manual_review',fact_status:'단서',headline:item.corp_name+' · '+base(item.report_nm),one_line_signal:'기자가 취재 대상으로 선택한 공시입니다.',previous_state:'',changed_fact:'',confirmed_facts:[],reported:[],unknowns:[],questions:[],hypothesis:'',falsification:'',next_action:'',sources:[{source_id:'dart:'+item.rcept_no,label:item.report_nm,url:url(item.rcept_no)}]}};
    out.unshift(p);
  }
  p.dart_review_receipts=[...new Set([...(Array.isArray(p.dart_review_receipts)?p.dart_review_receipts:[]),item.rcept_no])];p.updated_at=now;return {rows:out,id:pid};
}

function evidenceHtml(r){
  if(!r?.ok)return '<p class="dd-empty">원문을 읽지 못했습니다. DART 원문에서 확인해주세요.</p>';
  const changes=Array.isArray(r.changes)?r.changes:[],fields=Array.isArray(r.current_fields)?r.current_fields:[],warnings=Array.isArray(r.warnings)?r.warnings:[];
  const snapshot=r.read_at&&!Number.isNaN(Date.parse(r.read_at))?new Date(r.read_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'';
  let h=`${!isCurrentReview(r)?`<p class="dd-warning" role="status">${staleNotice}</p>`:''}<div class="dd-source-head"><b>원문 추출 상세</b><a href="${url(r.rcept_no)}" target="_blank" rel="noopener noreferrer">DART 원문 ↗</a></div><p class="dd-note">원문 자동 추출 · 검수 전${snapshot?' · '+esc(snapshot):''}</p>`;
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

function init(){
  if(typeof document==='undefined')return;
  const $=s=>document.querySelector(s);
  function read(k,def){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v===null?def:v;}catch(_){return def;}}
  function readReviews(){const v=read(STORE,{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
  function attachProjects(){
    const rows=read(PROJECTS,[]),reviews=readReviews();if(!Array.isArray(rows))return;
    const targets=[...document.querySelectorAll('.project-card')].map(el=>({el,p:rows.find(p=>p.project_id===el.dataset.id)}));
    const judge=$('#judgeRoot .judge-panel');if(judge){const pid=new URLSearchParams(location.search).get('project')||localStorage.getItem('pef_selected_project_v1');targets.push({el:judge,p:rows.find(p=>p.project_id===pid)});}
    for(const {el,p} of targets){if(!p?.dart_review_receipts?.length||el.querySelector('.dd-linked'))continue;const valid=p.dart_review_receipts.filter(n=>receipt(n)&&reviews[n]?.ok&&reviews[n].rcept_no===n);if(!valid.length)continue;const d=document.createElement('details');d.className='dd-linked dd-details';d.innerHTML='<summary>연결된 DART 공시 근거</summary>'+valid.map(n=>evidenceHtml(reviews[n])).join('');el.append(d);}
  }
  document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#dd-e-"]');if(!a)return;const target=document.getElementById(a.hash.slice(1));if(!target)return;event.preventDefault();for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;target.scrollIntoView({block:'center'});});
  if(!$('#dartDesk')){let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;attachProjects();});});observer.observe(document.body,{childList:true,subtree:true});attachProjects();return;}

  let items=[],reviews=readReviews(),days=3,query='',group='ALL',feed=DEFAULT_FEED,shown=60,sequence=0,controller;
  const open=new Set(),loading=new Set(),failed=new Map(),message=t=>{$('#deskMessage').textContent=t;};
  const validReview=n=>reviews[n]?.rcept_no===n&&isCurrentReview(reviews[n]);
  const getItem=n=>items.find(x=>x.rcept_no===n);

  function relatedItems(item){
    const key=item.corp_code||item.corp_name;
    return items.filter(x=>x.rcept_no!==item.rcept_no&&(x.corp_code||x.corp_name)===key).sort((a,b)=>b.rcept_no.localeCompare(a.rcept_no)).slice(0,3);
  }
  function factsHtml(item,r){
    if(!isCurrentReview(r))return '<p>원문 확인 전입니다.</p>';
    const rows=[];
    for(const d of r.changes||[])if(d.after)rows.push(`<li><b>${esc(d.label)}</b> ${esc(compact(d.after,90))}</li>`);
    for(const f of r.current_fields||[])if(f.value&&!rows.some(x=>x.includes(esc(f.label||f.raw_label))))rows.push(`<li><b>${esc(f.label||f.raw_label)}</b> ${esc(compact(f.value,90))}</li>`);
    return rows.length?'<ul>'+rows.slice(0,4).join('')+'</ul>':'<p>자동 추출에서 현재 조건을 확보하지 못했습니다. 원문 확인이 필요합니다.</p>';
  }
  function previousHtml(r){
    if(!isCurrentReview(r)||!(r.changes||[]).length)return '<p>이 공시만으로 이전 상태를 확인할 수 없습니다.</p>';
    return '<ul>'+r.changes.slice(0,4).map(d=>`<li><b>${esc(d.label)}</b> ${esc(compact(d.before,90))}</li>`).join('')+'</ul>';
  }
  function relatedHtml(item){
    const rows=relatedItems(item);if(!rows.length)return '<p>조회 기간 안에서 같은 회사의 다른 관련 공시가 없습니다.</p>';
    return '<ul>'+rows.map(x=>`<li><a href="${url(x.rcept_no)}" target="_blank" rel="noopener noreferrer">${esc(base(x.report_nm))}</a><small>${date(x.rcept_dt)}</small></li>`).join('')+'</ul>';
  }
  function familyBadge(item,stats){
    const s=stats.get(familyKey(item));if(!s||s.count<2)return '';
    return `<span class="dd-repeat">같은 공시 ${s.count}건${s.corrections?` · 정정 ${s.corrections}건`:''}</span>`;
  }
  function detail(item){
    const n=item.rcept_no,r=reviews[n],usable=r?.ok&&r.rcept_no===n;
    return `<tr class="dd-expanded" id="dart-detail-${n}"><td colspan="4"><section class="dd-review" tabindex="-1" aria-label="${esc(item.corp_name)} 공시 상세">${loading.has(n)?'<p class="dd-reading" role="status">공시 원문을 읽고 있습니다…</p>':''}${failed.has(n)?`<p class="dd-warning" role="alert">${esc(failed.get(n))}${usable?' 이전 보관 결과는 유지합니다.':''}</p>`:''}<div class="dd-briefing-grid"><article><b>이번에 확인된 사실</b>${factsHtml(item,usable?r:null)}</article><article><b>이전 상태</b>${previousHtml(usable?r:null)}</article><article><b>같이 볼 것</b>${relatedHtml(item)}</article><article class="dd-next"><b>일보에 넣으려면</b><p>${esc(reportingCheck(item))}</p><small>볼 항목 · ${esc(nextCheckText(item))}</small></article></div>${usable?`<details class="dd-evidence"><summary>원문 추출 상세 보기</summary>${evidenceHtml(r)}</details>`:'<p class="dd-note">내용 확인을 누르면 이 공시 한 건만 원문에서 읽습니다. 자동으로 기사화 판단하지 않습니다.</p>'}<div class="dd-review-actions"><a href="${url(n)}" target="_blank" rel="noopener noreferrer">DART 원문 ↗</a><button type="button" data-read="${n}" ${loading.has(n)?'disabled':''}>${usable?'새로 읽기':'원문 읽기'}</button>${validReview(n)?`<button type="button" data-copy="${n}">공시 근거 복사</button><button type="button" data-project="${n}">진행중 취재에 담기</button>`:''}</div></section></td></tr>`;
  }
  function render(){
    const all=filteredItems(items,{query,group,feed}),rows=all.slice(0,shown),stats=familyStats(items);
    $('#rawRows').innerHTML=rows.length?rows.map(x=>{const n=x.rcept_no,r=reviews[n],delta=rowDelta(x,r),tags=axisTags(x,r),reason=priorityReason(x);return `<tr data-receipt="${n}" class="${open.has(n)?'dd-open':''}"><td class="dd-when"><span>${date(x.rcept_dt)}</span><b>${esc(x.corp_name)}</b></td><td class="dd-disclosure"><div class="dd-pills"><span>${esc(groupDisplay(x))}</span>${correction(x)?'<span class="dd-correction">정정</span>':''}${reason?`<span class="dd-priority">${esc(reason)}</span>`:''}</div><a href="${url(n)}" target="_blank" rel="noopener noreferrer">${esc(base(x.report_nm))}</a></td><td class="dd-delta"><small>${esc(delta.label)}</small><strong class="${delta.state==='confirmed'?'is-confirmed':'is-pending'}">${esc(delta.text)}</strong>${familyBadge(x,stats)}</td><td class="dd-follow"><div class="dd-axis">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><small>${esc(nextCheckText(x))}</small><button type="button" data-toggle="${n}" aria-expanded="${open.has(n)}" aria-controls="dart-detail-${n}">${open.has(n)?'접기':'내용 확인'}</button></td></tr>${open.has(n)?detail(x):''}`;}).join(''):'<tr><td colspan="4" class="dd-no-rows">조건에 맞는 공시가 없습니다.</td></tr>';
    const total=filteredItems(items,{query,group,feed:'all'}).length,priority=filteredItems(items,{query,group,feed:'priority'}).length,corrections=filteredItems(items,{query,group,feed:'corrections'}).length;
    $('#rawCount').textContent=feed==='priority'?`먼저 확인 ${all.length}건 · 전체 ${total}건`:feed==='corrections'?`정정 ${all.length}건 · 전체 ${total}건`:`전체 ${all.length}건 · 먼저 확인 ${priority}건 · 정정 ${corrections}건`;
    $('#more').hidden=all.length<=shown;
    document.querySelectorAll('[data-feed]').forEach(b=>{const on=b.dataset.feed===feed;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
  }
  async function readReceipt(n){
    if(!receipt(n)||loading.has(n))return;loading.add(n);failed.delete(n);render();
    try{
      const response=await fetch('/api/dart-feed?action=review&rcept_no='+n,{cache:'no-store',signal:AbortSignal.timeout(25000)}),data=await response.json();
      if(!response.ok||!data.ok)throw Error(data.error||'원문을 읽지 못했습니다.');
      if(data.rcept_no!==n||!isCurrentReview(data))throw Error('접수번호나 분석 버전이 맞지 않습니다. 화면을 새로고침해주세요.');
      const saved=readReviews();reviews={...reviews,...saved,[n]:data};
      try{localStorage.setItem(STORE,JSON.stringify({...saved,[n]:data}));}catch(_){message('저장공간이 부족합니다. 공시 근거 복사로 보관해주세요. 기존 기록은 지우지 않았습니다.');}
    }catch(e){failed.set(n,e.name==='TimeoutError'?'원문 응답이 늦습니다. DART 원문을 열거나 다시 읽어주세요.':String(e.message||e));}
    finally{loading.delete(n);render();}
  }
  async function load(fresh=false){
    controller?.abort();controller=new AbortController();const token=++sequence;$('#refresh').disabled=true;$('#status').textContent='DART 조회 중';$('#rawRows').setAttribute('aria-busy','true');
    try{
      const response=await fetch(`/api/dart-feed?days=${days}&limit=700${fresh?'&fresh=1':''}&_=${Date.now()}`,{signal:controller.signal,cache:'no-store'}),data=await response.json();
      if(!response.ok||!data.ok)throw Error(data.error||'조회 실패');if(token!==sequence)return;
      const seen=new Set();items=(Array.isArray(data.items)?data.items:[]).filter(x=>receipt(x?.rcept_no)&&!seen.has(x.rcept_no)&&seen.add(x.rcept_no));shown=60;const c=data.coverage||{};
      $('#coverage').textContent=`${data.range?.bgn||''}~${data.range?.end||''} · 관련 공시 ${data.matched??items.length}건${c.complete===false?' · 일부 페이지 미수집':''}${c.display_limited?' · 표시 한도 적용':''}`;
      $('#coverage').classList.toggle('dd-warning',c.complete===false);$('#status').textContent=`${days}일 · ${items.length}건`;message(c.complete===false?'일부 DART 목록을 가져오지 못했습니다. 현재 표시된 범위만 확인하세요.':'');render();
    }catch(e){if(token!==sequence)return;message(e.name==='AbortError'?'조회가 중단됐습니다. 다시 새로고침해주세요.':String(e.message||e));if(!items.length)$('#rawRows').innerHTML='<tr><td colspan="4" class="dd-no-rows">DART 공시를 불러오지 못했습니다.</td></tr>';}
    finally{if(token===sequence){$('#refresh').disabled=false;$('#rawRows').setAttribute('aria-busy','false');}}
  }

  $('#refresh').addEventListener('click',()=>load(true));
  $('#search').addEventListener('input',e=>{query=e.target.value;shown=60;render();});
  $('#groups').addEventListener('change',e=>{group=e.target.value;shown=60;render();});
  document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.days)||3;document.querySelectorAll('[data-days]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});load(true);}));
  document.querySelectorAll('[data-feed]').forEach(b=>b.addEventListener('click',()=>{feed=b.dataset.feed;shown=60;render();}));
  $('#more').addEventListener('click',()=>{shown+=60;render();});
  $('#rawRows').addEventListener('click',async e=>{
    const toggle=e.target.closest('[data-toggle]');
    if(toggle){const n=toggle.dataset.toggle;if(open.has(n))open.delete(n);else{open.add(n);const item=getItem(n);if(item&&!validReview(n)&&!loading.has(n)){render();await readReceipt(n);return;}}render();return;}
    const readButton=e.target.closest('[data-read]');if(readButton){await readReceipt(readButton.dataset.read);return;}
    const copy=e.target.closest('[data-copy]');if(copy){const n=copy.dataset.copy,item=getItem(n),r=reviews[n];if(item&&validReview(n)){try{await navigator.clipboard.writeText(brief(item,r));message('공시 근거를 복사했습니다.');}catch(_){message('복사하지 못했습니다. 브라우저 권한을 확인해주세요.');}}return;}
    const project=e.target.closest('[data-project]');if(project){const n=project.dataset.project,item=getItem(n),r=reviews[n];if(!item||!validReview(n))return;try{const current=read(PROJECTS,[]),merged=mergeProject(current,item,r);localStorage.setItem(PROJECTS,JSON.stringify(merged.rows));localStorage.setItem('pef_selected_project_v1',merged.id);message('진행중 취재에 담았습니다. 기존 취재 메모와 판단은 유지됩니다.');}catch(err){message(String(err.message||err));}return;}
  });
  load();
}

return {REVIEW_VERSION,DEFAULT_VIEW,DEFAULT_FEED,isCurrentReview,hasChanges,buildGroups,filteredItems,mergeProject,evidenceHtml,brief,priorityReason,axisTags,rowDelta,nextCheckText,reportingCheck,familyStats,groupDisplay,init};
});
