(function () {
  'use strict';
  if (window.__ibPreflightLoaded) return;
  window.__ibPreflightLoaded = true;
  const RUNS = 'ib_public_preflight_runs_v1', PROJECTS = 'pef_my_reporting_projects_v1';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = (key, fallback) => { try { const v=JSON.parse(localStorage.getItem(key)||'null'); return v===null?fallback:v; } catch (_) { return fallback; } };
  const safeHref = v => { try { const u=new URL(v); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'#'; } catch(_){return '#';} };
  const when = v => { try{return new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}catch(_){return String(v||'');} };
  const access = s => s.read_ok ? (s.truncated?'본문 일부 열람':'본문 열람') : ({headline_only:'제목만 확인',link_only:'링크만 확보',unread:'본문 열람 실패',attachment_unread:'첨부 열람 미지원',not_fetched:'자동 열람 범위 밖'})[s.access]||'미열람';
  const link = (s,label) => `<a href="${esc(safeHref(s.url))}" target="_blank" rel="noopener noreferrer">${esc(label||s.title||'원문')} ↗</a>`;
  let catalogPromise;
  function catalog() { if (!catalogPromise) catalogPromise=fetch('/api/context?mode=preflight-catalog',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'조사대상 목록을 읽지 못했습니다.');return d.items||[];}).catch(e=>{catalogPromise=null;throw e;}); return catalogPromise; }
  function clue(id) { return (typeof DATA !== 'undefined' ? DATA : []).find(c=>String(c.clue_id)===String(id)); }
  function latest(id) { return Object.values(read(RUNS,{})).filter(r=>r.display_clue_id===id||r.clue_id===id).sort((a,b)=>String(b.finished_at).localeCompare(String(a.finished_at)))[0]; }
  function saveRun(run,id) { const rows=read(RUNS,{}); rows[run.run_id]={...run,display_clue_id:id}; localStorage.setItem(RUNS,JSON.stringify(rows)); }
  function sourceList(run,rows) { return rows.length?`<ul class="pf-source-list">${rows.map(s=>`<li>${link(s)} <span>${esc(s.kind==='official'?'공식 원문':s.kind==='media'?'언론':'검색·링크')} · ${esc(access(s))}${s.published_at?' · '+esc(String(s.published_at).slice(0,10)):''}</span>${s.read_error?`<small>${esc(s.read_error)}</small>`:''}</li>`).join('')}</ul>`:'<p class="pf-muted">이번 조사에서 추가로 확보한 링크가 없습니다.</p>'; }
  function caseHtml(c,run) {
    const refs=new Map(run.sources.map(s=>[s.source_id,s]));
    const counter=c.counterevidence_ids.map(id=>c.evidence.find(e=>e.evidence_id===id)).filter(Boolean);
    const evidence=c.evidence.length?`<div class="pf-table-scroll"><table class="pf-evidence-table"><thead><tr><th>항목·상태</th><th>찾아온 원문 발췌</th><th>출처·위치</th></tr></thead><tbody>${c.evidence.map(e=>{const s=refs.get(e.source_id)||{};return `<tr id="pf-e-${esc(e.evidence_id)}"><td><b>${esc(e.topics.map(t=>t.label).join(' / '))}</b><span>[${esc(e.fact_status)}] 검수 전</span></td><td><q>${esc(e.quote)}</q><small>${esc(e.scope_note)}</small></td><td>${link(s)}<small>${esc(e.location)}${s.published_at?' · '+esc(String(s.published_at).slice(0,10)):''}</small></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="pf-empty">이 대상과 연결할 본문 발췌를 확보하지 못했습니다. 아래 검색·열람 내역을 확인하세요. 미결성이나 자료 부재를 뜻하지는 않습니다.</p>';
    return `<section class="pf-case"><h4>${esc(c.title)}</h4><p class="pf-revision">${esc(c.revision)}</p>${counter.length?`<div class="pf-counter"><b>가설을 다시 볼 근거</b>${counter.map(e=>`<p>${esc(e.topics.map(t=>t.label).join(' · '))} — <a href="#pf-e-${esc(e.evidence_id)}">근거 보기</a><br><small>${esc(e.scope_note)}</small></p>`).join('')}</div>`:''}<h5>항목별 확인 상태</h5><div class="pf-field-grid">${c.fields.map(f=>`<div><b>${esc(f.label)}</b><span>${esc(f.status)}</span>${f.evidence_ids.map((id,i)=>`<a href="#pf-e-${esc(id)}">근거 ${i+1}</a>`).join(' ')}</div>`).join('')}</div><h5>본문 근거표</h5>${evidence}${c.fund_candidates.length?`<details class="pf-details"><summary>같은 GP의 공개목록 등재 펀드 ${c.fund_candidates.length}개 · 해당 선정분과 연결 미확인</summary><ul>${c.fund_candidates.map(f=>`<li>${esc(f.association_name)} · ${esc(f.year)} · ${esc(f.field)}<small>${esc(f.match_status)}</small></li>`).join('')}</ul></details>`:''}<h5>이제 직접 확인할 질문</h5><ol class="pf-questions">${c.questions.map(q=>`<li><b>${esc(q.target)}</b> ${esc(q.question)}<small>${esc(q.reason)}</small></li>`).join('')}</ol></section>`;
  }
  function reportHtml(run,id,linked) {
    const searches=run.coverage.searches||[], bodies=run.coverage.body_read||0;
    return `<div class="pf-report-head"><div><h3>공개자료 사전조사</h3><p>${esc(when(run.finished_at))} · 정본 기준 ${esc(run.canonical_as_of)}${run.cache_hit?' · 최근 조사 결과':''}</p></div><span class="pf-state">${run.state==='partial'?'일부 자료 미확보':'조사 실행 완료'}</span></div><div class="pf-summary">본문 ${bodies}건 열람 · 발췌 ${run.coverage.evidence_count||0}건 · ${run.cases.length}개 대상별 조사</div><p class="pf-notice">발췌와 질문은 검수 전입니다. 이 결과만으로 미결성·지연·기사화를 확정하지 않습니다.</p>${run.cases.map(c=>caseHtml(c,run)).join('')}<details class="pf-details"><summary>검색·열람 내역과 관련 보도 (${run.sources.length}건)</summary>${sourceList(run,run.sources)}<div class="pf-search-log">${searches.map(l=>`<p><b>${esc(l.provider||'검색')}</b> · ${esc(l.status==='ok'?`${l.count}건 검색`:l.status==='not_configured'?'미연결':'검색 실패')}<br>${esc(l.query||'')}</p>`).join('')}</div><p>기존 공개자료 색인 ${run.coverage.index_rows}행 검토. 전체 시장을 빠짐없이 조사한 결과는 아닙니다.</p></details><details class="pf-details"><summary>조사 한계와 보존 원칙</summary><ul>${run.limitations.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>기존 정본과 취재 메모는 변경하지 않았습니다. 조사 결과는 현재 브라우저에 보관됩니다. 같은 단서의 서버 결과는 최대 10분간 재사용합니다.</p></details><div class="pf-actions">${!linked?`<button type="button" data-pf-refresh="${esc(id)}">다시 조회</button><button type="button" class="pf-link-project" data-pf-link="${esc(run.run_id)}" data-pf-clue="${esc(id)}">진행중 취재에 연결 →</button>`:''}<button type="button" data-pf-copy="${esc(run.run_id)}">조사 내용 복사</button><span class="pf-action-status" role="status" aria-live="polite"></span></div>`;
  }
  function show(card,run,id,linked) { let panel=card.querySelector('.pf-report');if(!panel){panel=document.createElement('section');panel.className='pf-report';card.append(panel);}panel.innerHTML=reportHtml(run,id,linked);panel.hidden=false;return panel; }
  function attach() {
    document.querySelectorAll('.clue-card').forEach(card=>{
      const sender=card.querySelector('[data-project-id]'), id=sender?.dataset.projectId, c=clue(id);
      if(!c||!['formation_gap','formation_pattern','lp_rule_change','kvic_plan_change'].includes(c.detector)||card.querySelector('[data-pf-start]'))return;
      const b=document.createElement('button');b.type='button';b.className='pf-start';b.dataset.pfStart=id;b.textContent='이 단서 더 조사하기';
      (card.querySelector('.clue-actions')||card).prepend(b);
      const old=latest(id);if(old){const panel=show(card,old,id,false);panel.hidden=true;b.textContent='사전조사 결과 보기';}
    });
    const rows=read(PROJECTS,[]);if(!Array.isArray(rows))return;
    document.querySelectorAll('.project-card').forEach(card=>{
      const p=rows.find(p=>p.project_id===card.dataset.id);attachLinked(card,p);
    });
    const root=document.querySelector('#judgeRoot .judge-panel');
    if(root){const id=new URLSearchParams(location.search).get('project')||localStorage.getItem('pef_selected_project_v1');attachLinked(root,rows.find(p=>p.project_id===id));}
  }
  function attachLinked(card,p) {
    if(!p?.public_research_run_ids?.length||card.querySelector('.pf-linked'))return;
    const runs=read(RUNS,{}), ids=p.public_research_run_ids.filter(id=>runs[id]);if(!ids.length)return;
    const d=document.createElement('details');d.className='pf-linked pf-details';
    d.innerHTML=`<summary>연결된 공개자료 사전조사 ${ids.length}회</summary><p class="pf-notice">사전조사 결과는 검수 전 근거입니다. 기사화 체크 항목이나 판단 결과를 자동으로 바꾸지 않습니다.</p>`;
    const last=runs[ids[ids.length-1]], box=document.createElement('section');box.className='pf-report';box.innerHTML=reportHtml(last,p.clue_id,true);d.append(box);card.append(d);
  }
  function toBrief(run) {
    const refs=new Map(run.sources.map(s=>[s.source_id,s]));
    const out=['공개자료 사전조사',when(run.finished_at),'정본 기준: '+run.canonical_as_of,'자동 추출 · 원문 검수 전'];
    run.cases.forEach(c=>{out.push('',c.title,c.revision);c.evidence.forEach(e=>{const s=refs.get(e.source_id)||{};out.push(`[${e.fact_status}] ${e.quote}`,`${e.location} / ${s.url||''}`,e.scope_note);});c.questions.forEach(q=>out.push(`${q.target}: ${q.question}`));});
    out.push('','조사 한계',...run.limitations);return out.join('\n');
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-pf-start],[data-pf-link],[data-pf-copy],[data-pf-refresh]');if(!b)return;
    event.preventDefault();event.stopPropagation();
    if(b.dataset.pfRefresh){const card=b.closest('.clue-card');card?.querySelector('.pf-report')?.remove();card?.querySelector('[data-pf-start]')?.click();return;}
    if(b.dataset.pfStart){
      const id=b.dataset.pfStart,card=b.closest('.clue-card'),previous=card.querySelector('.pf-report');
      if(previous&&previous.dataset.loading!=='true'){previous.hidden=!previous.hidden;b.textContent=previous.hidden?'사전조사 결과 보기':'사전조사 결과 접기';return;}
      b.disabled=true;card.querySelector('.pf-error')?.remove();const panel=document.createElement('section');panel.className='pf-report';panel.dataset.loading='true';panel.innerHTML='<p role="status" aria-live="polite">공개 원문·관련 보도·반대 근거를 조사하고 있습니다. 최대 1분 정도 걸릴 수 있습니다.</p>';card.append(panel);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),58000);
      try{
        const entries=await catalog(),c=clue(id);
        let target=entries.find(x=>x.clue_id===id);
        if(!target){const refs=new Set((c.sources||[]).map(s=>s.url));target=entries.filter(x=>x.source_urls.some(u=>refs.has(u))).sort((a,b)=>b.case_count-a.case_count)[0];}
        if(!target)throw new Error('현재는 정본과 연결된 출자조건·결성 단서부터 지원합니다.');
        const r=await fetch('/api/context?mode=preflight&id='+encodeURIComponent(target.clue_id),{cache:'no-store',signal:controller.signal}),run=await r.json();
        if(!r.ok||!run.ok)throw new Error(run.error||'공개자료 조사 실패');
        try{saveRun(run,id);}catch(_){run.limitations.push('브라우저 저장공간 부족으로 이번 결과를 보관하지 못했습니다. 조사 내용 복사로 보존하세요.');}
        panel.removeAttribute('data-loading');panel.innerHTML=reportHtml(run,id,false);panel._run=run;b.textContent='사전조사 결과 접기';
      }catch(e){panel.remove();const error=document.createElement('p');error.className='pf-error';error.setAttribute('role','alert');error.textContent=e.name==='AbortError'?'조사 응답이 늦어졌습니다. 잠시 후 다시 눌러주세요.':e.message;card.querySelector('.pf-error')?.remove();card.append(error);}
      finally{clearTimeout(timer);b.disabled=false;}
    }else if(b.dataset.pfLink){
      const run=read(RUNS,{})[b.dataset.pfLink]||b.closest('.pf-report')?._run,id=b.dataset.pfClue,c=clue(id);if(!run||!c)return;
      try{saveRun(run,id);const rows=read(PROJECTS,[]);if(!Array.isArray(rows))throw new Error('저장된 취재 목록 형식을 확인해야 합니다.');const pid='project-'+id;let p=rows.find(p=>p.project_id===pid);
        if(!p){p={project_id:pid,clue_id:id,title:c.headline,status:'진행중',notes:'',clue:c,created_at:new Date().toISOString(),judgment:null,judgment_history:[]};rows.unshift(p);}
        p.public_research_run_ids=Array.isArray(p.public_research_run_ids)?p.public_research_run_ids:[];
        if(!p.public_research_run_ids.includes(run.run_id))p.public_research_run_ids.push(run.run_id);p.updated_at=new Date().toISOString();
        localStorage.setItem(PROJECTS,JSON.stringify(rows));location.href='/projects.html?project='+encodeURIComponent(pid);
      }catch(e){b.parentElement.querySelector('.pf-action-status').textContent='저장하지 못했습니다. 기존 메모는 그대로입니다. '+e.message;}
    }else if(b.dataset.pfCopy){
      const run=read(RUNS,{})[b.dataset.pfCopy]||b.closest('.pf-report')?._run;if(!run)return;
      try{await navigator.clipboard.writeText(toBrief(run));b.parentElement.querySelector('.pf-action-status').textContent='공개자료 조사 내용을 복사했습니다.';}catch(_){const t=document.createElement('textarea');t.className='pf-copy-fallback';t.value=toBrief(run);t.readOnly=true;b.parentElement.append(t);t.focus();t.select();}
    }
  });
  let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;attach();});});
  const root=document.querySelector('#cards')||document.querySelector('#projects')||document.querySelector('#judgeRoot');if(root)observer.observe(root,{childList:true,subtree:true});attach();
})();
