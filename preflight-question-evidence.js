(function (root) {
  'use strict';
  // Progressive enhancement: only public research results are read; storage is never changed.
  const KEY='ib_public_preflight_runs_v1';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;};
  function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
  function dateLabel(value){if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isFinite(+d)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'';}
  function link(value,label){const href=safeUrl(value);if(!href)return el('span',label);const a=el('a',label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function getRun(panel){if(panel._run)return panel._run;const id=panel.querySelector('[data-pf-copy]')?.dataset.pfCopy;if(!id)return null;try{return JSON.parse(localStorage.getItem(KEY)||'{}')[id]||null;}catch(_){return null;}}
  function sourceLink(e,run){
    const s=(run.sources||[]).find(s=>s.source_id===e.source_id);if(!s)return el('span','출처 연결 없음');
    const row=el('div',null,'pfq-source');
    const page=(e.location||'').match(/PDF\s*(\d+)쪽/),u=safeUrl(s.url);
    const label=`${s.publisher||s.title||'원문'} · ${e.location||'위치 미확인'}`;
    let target=u;if(page&&u){const url=new URL(u);url.hash='page='+page[1];target=url.href;}
    row.append(link(target,label));
    const day=dateLabel(s.published_at);if(day)row.append(el('span',' · '+day));
    // The public board may have to be opened first to access its attachment. Reuse only a known board URL.
    if(u){const file=new URL(u),boardId=file.searchParams.get('boardDataNo');if(boardId){const parent=(run.sources||[]).find(p=>{try{const purl=new URL(p.url);return purl.origin===file.origin&&purl.searchParams.get('id')===boardId;}catch(_){return false;}});if(parent){row.append(el('span',' · '));row.append(link(parent.url,'공고 페이지'));}}}
    return row;
  }
  function renderPanel(panel){
    const run=getRun(panel);if(!run)return;
    const key=run.run_id+':questions-1';if(panel.dataset.pfqRendered===key)return;
    const cases=panel.querySelectorAll('.pf-case');if(cases.length!==(run.cases||[]).length)return;
    panel.dataset.pfqRendered=key;
    cases.forEach((section,i)=>{
      const c=run.cases[i],list=section.querySelector('.pf-questions');if(!list)return;
      if(c.question_evidence_version!==1){
        section.querySelector('.pf-counter')?.setAttribute('hidden','');
        const note=el('p','이전 방식으로 저장한 조사 결과입니다. 같은 펀드·계정인지 다시 검토하려면 AI 발견에서 ‘다시 조회’를 누르세요.','pfq-legacy');list.before(note);return;
      }
      const byId=new Map((c.evidence||[]).map(e=>[e.evidence_id,e]));
      list.replaceChildren();
      for(const q of c.questions||[]){
        const li=el('li',null,'pfq-item'),head=el('div',null,'pfq-head');head.append(el('b',q.target||'확인 대상'),el('span',q.status||'미확인','pfq-status'));li.append(head,el('p',q.question,'pfq-question'),el('p',q.found,'pfq-found'));
        const direct=(q.evidence_ids||[]).map(id=>byId.get(id)).filter(Boolean);
        const context=(q.context_evidence_ids||[]).map(id=>byId.get(id)).filter(Boolean);
        for(const [label,rows] of [['관련 근거',direct],['배경·대상 대조 자료',context]]){
          if(!rows.length)continue;const group=el('div',null,'pfq-links');group.append(el('b',label));
          for(const e of rows){const entry=el('div',null,'pfq-entry');entry.append(sourceLink(e,run));
            const excerpt=el('a','근거표에서 발췌 보기 · ['+(e.fact_status||'단서')+'] 검수 전','pfq-excerpt-link');excerpt.href='#pf-e-'+e.evidence_id;entry.append(excerpt,el('small',e.scope_note));group.append(entry);
          }li.append(group);
        }
        const need=el('div',null,'pfq-needed');need.append(el('b','아직 확인할 내용'),el('span',q.still_needed));li.append(need);list.append(li);
      }
      if((c.excluded_evidence||[]).length){
        const d=el('details',null,'pfq-excluded');d.append(el('summary',`다른 출자사업으로 분리한 자료 ${c.excluded_evidence.length}건`));
        for(const e of c.excluded_evidence){const row=el('div');row.append(sourceLink(e,run),el('p',e.exclusion_reason));d.append(row);}list.after(d);
      }
    });
    if((run.cases||[]).some(c=>c.question_evidence_version===1)){
      const bar=el('div',null,'pfq-copybar'),button=el('button','질문·근거 묶어서 복사'),status=el('span');button.type='button';status.setAttribute('role','status');
      button.addEventListener('click',async()=>{const text=brief(run);try{await navigator.clipboard.writeText(text);status.textContent='질문과 출처를 복사했습니다.';}catch(_){bar.querySelector('textarea')?.remove();const box=el('textarea');box.readOnly=true;box.value=text;box.setAttribute('aria-label','복사할 질문과 근거');bar.append(box);box.focus();box.select();status.textContent='선택된 내용을 복사하세요.';}});
      bar.append(button,status);panel.append(bar);
    }
  }
  function brief(run){
    const out=['취재 질문·공개자료 근거', '조사 시각: '+(run.finished_at||''),'발췌·연결은 검수 전입니다. 기사화 판단이 아닙니다.'];
    const sources=new Map((run.sources||[]).map(s=>[s.source_id,s]));
    for(const c of run.cases||[]){out.push('',c.title||'조사 대상');const evidence=new Map((c.evidence||[]).map(e=>[e.evidence_id,e]));
      if(c.question_evidence_version!==1){out.push('이전 조사 결과: 최신 방식으로 다시 조회가 필요합니다.');continue;}
      for(const q of c.questions||[]){out.push('',q.target+': '+q.question,q.status,q.found,'남은 확인: '+q.still_needed);
        // References only: do not repeat the same copyrighted excerpt under multiple questions.
        for(const [label,ids] of [['관련 근거',q.evidence_ids||[]],['배경·대상 대조',q.context_evidence_ids||[]]])for(const id of ids){const e=evidence.get(id),s=e&&sources.get(e.source_id);if(e&&s)out.push(`${label} — [${e.fact_status}] ${s.title} / ${e.location} / ${s.url}`,e.scope_note);}
      }
      for(const e of c.excluded_evidence||[]){const s=sources.get(e.source_id);out.push('별도 자료: '+(s?.title||''),e.exclusion_reason,s?.url||'');}
    }
    return out.filter(v=>v!=null).join('\n');
  }
  function render(){document.querySelectorAll('.pf-report').forEach(renderPanel);}
  root.IBQuestionEvidence={render,renderPanel,brief,dateLabel,safeUrl};
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}).observe(document.body,{childList:true,subtree:true});
  render();
})(window);
