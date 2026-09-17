(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.IBStoryTimeline=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=value=>clean(value).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');

function primaryEntity(clue){
  const entity=(clue?.entities||[]).map(clean).find(v=>v&&norm(v).length>=2);
  if(entity)return entity;
  return clean(clue?.headline).split(/\s*[·|｜:]\s*/)[0]||'해당 사안';
}
function eventLabel(value){
  const m=clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[2]}/${m[3]}`:'';
}
function clueText(clue){
  return clean([clue?.headline,clue?.article_pitch,clue?.story_mode,clue?.reason,clue?.one_line_signal,...(clue?.reported||[])].join(' '));
}
function timelineFor(clue){
  if(!clue?.article_pitch)return [];
  const mode=clean(clue.story_mode),entity=primaryEntity(clue),text=clueText(clue),date=eventLabel(clue.event_date);
  const bdc=/\bBDC\b|기업성장집합투자기구/i.test(text);
  if(mode==='사전 랩업'||mode==='당일 해설'){
    const phase=mode==='사전 랩업'?(date?`${date} 발표 당일`:'발표 당일'):'발표 직후';
    if(bdc)return [
      {phase,trigger:'공식 세부안 공개',pitch:'[가제] BDC 규제안, 기존안서 뭐가 바뀌었나…운용·투자·대출·상장 규정 비교'},
      {phase:'다음 기사',trigger:'등록·상품 출시 계획 확인',pitch:'[가제] 1호 BDC 누가 먼저 내나…운용사·증권사 출시 일정과 상품 경제성'}
    ];
    const title=clean(clue.headline)||entity;
    return [
      {phase,trigger:'공식 발표문 공개',pitch:`[가제] ${title}…기존안서 무엇이 달라졌나, 돈·규칙·시행일 비교`},
      {phase:'다음 기사',trigger:'시행·선정·거래 첫 사례',pitch:`[가제] ${title} 이후 첫 적용…실제 자금 이동과 시장 반응 점검`}
    ];
  }
  if(mode==='시나리오'){
    const rehab=/회생/.test(text),bankruptcy=/파산|청산/.test(text);
    const nextPitch=rehab?`[가제] ${entity} 회생 다음 단계…법원 결정·매각 공고 뒤 자산값과 채권 회수표`:bankruptcy?`[가제] ${entity} 파산 절차 본격화…자산별 매각값과 채권자별 회수액`:`[가제] ${entity} 위기 다음 단계…법원 결정·자산 처분 뒤 돈의 이동`;
    return [
      {phase:'다음 신호',trigger:'법원 결정·매각 공고·본입찰',pitch:nextPitch},
      {phase:'결과 기사',trigger:'매각·변제·청산 결과 확정',pitch:`[가제] ${entity}, 결국 누가 얼마 회수했나…주주·채권자·협력사 손익 결산`}
    ];
  }
  if(mode==='거래 후속')return [
    {phase:'다음 신호',trigger:'우협·실사·SPA·인수금융',pitch:`[가제] ${entity} 본계약까지 남은 건…실사·인수금융·승인 조건 점검`},
    {phase:'종결 후',trigger:'클로징·기업결합 승인',pitch:`[가제] ${entity} 거래 끝난 뒤…새 지배구조·차입 부담·기존 주주 회수 분석`}
  ];
  return [];
}
function enrichClue(clue){
  if(!clue||typeof clue!=='object')return clue;
  const timeline=timelineFor(clue);
  return timeline.length?{...clue,article_timeline:timeline}:clue;
}
function renderTimelineHtml(rows){
  if(!Array.isArray(rows)||!rows.length)return '';
  const items=rows.slice(0,2).map(row=>`<div class="story-timeline-row"><div class="story-timeline-when"><b>${esc(row.phase)}</b>${row.trigger?`<small>${esc(row.trigger)}</small>`:''}</div><p>${esc(row.pitch)}</p></div>`).join('');
  return `<div class="marketin-story-timeline" aria-label="다음 기사 흐름"><strong>다음 기사 흐름</strong>${items}</div>`;
}
function decorate(root){
  const doc=root?.document,map=root?.__storyTimelineMap;if(!doc||!map)return;
  for(const card of doc.querySelectorAll('.discovery-card')){
    if(card.querySelector('.marketin-story-timeline'))continue;
    const detail=card.querySelector('[data-detail]'),clue=detail&&map.get(detail.dataset.detail);
    if(!clue?.article_timeline?.length)continue;
    const brief=card.querySelector('.marketin-story-brief'),pitch=brief?.querySelector('.marketin-story-pitch');
    if(!brief||!pitch)continue;
    const label=pitch.querySelector(':scope > strong')||pitch.querySelector('strong');if(label&&label.textContent.trim()==='기사 제안')label.textContent='오늘 기사 제안';
    pitch.insertAdjacentHTML('afterend',renderTimelineHtml(clue.article_timeline));
  }
}
function install(root){
  const C=root?.IBDiscovery;if(!C||C.__storyTimelineInstalled)return false;
  const original=C.build;if(typeof original!=='function')return false;
  C.build=function(){
    const rows=(original.apply(C,arguments)||[]).map(enrichClue);
    root.__storyTimelineMap=new Map(rows.map(row=>[row.clue_id,row]));
    return rows;
  };
  C.storyTimeline=timelineFor;C.__storyTimelineInstalled=true;
  if(root.document&&typeof root.MutationObserver==='function'){
    const observer=new root.MutationObserver(()=>decorate(root));
    const target=root.document.querySelector('#discoveryCards')||root.document.body;
    if(target)observer.observe(target,{childList:true,subtree:true});
    decorate(root);
  }
  return true;
}

return {primaryEntity,eventLabel,timelineFor,enrichClue,renderTimelineHtml,install};
});
