(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.IBStoryTimeline=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=value=>clean(value).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const dedupeSources=rows=>[...new Map((rows||[]).filter(s=>s?.url).map(s=>[s.url,s])).values()];

function eventTopic(clue){
  const text=clean([clue?.headline,clue?.one_line_signal,clue?.reason,clue?.story_mode].join(' '));
  const rules=[
    [/\bBDC\b|기업성장집합투자기구/i,'BDC'],
    [/국민성장펀드/,'국민성장펀드'],
    [/생산적\s*금융/,'생산적 금융'],
    [/의무공개매수/,'의무공개매수'],
    [/인수금융/,'인수금융'],
    [/모태펀드/,'모태펀드'],
    [/세컨더리/,'세컨더리'],
    [/프로젝트파이낸싱|\bPF\b/i,'PF'],
    [/벤처투자|벤처캐피탈/,'벤처투자'],
    [/기관전용\s*사모|사모펀드\s*(?:제도|규제|개편)/,'사모펀드 제도'],
    [/합병가액/,'합병가액'],
    [/출자사업/,'출자사업']
  ];
  return rules.find(([re])=>re.test(text))?.[1]||'';
}
function eventLabel(value){
  const m=clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[2]}/${m[3]}`:'';
}
function timingCandidates(rows,input,C,now=Date.now()){
  if(!C||typeof C.calendarClues!=='function')return rows||[];
  const out=[...(rows||[])];
  const scheduled=C.calendarClues(input?.calendar||[],now).filter(x=>x.article_pitch&&x.event_date).map(x=>{
    const topic=eventTopic(x);if(!topic)return null;
    return {...x,clue_id:'timing-'+x.clue_id,detector:'reporting_opportunity',detector_label:'발표 전 랩업',fact_status:'단서',article_pitch:undefined,article_brief:null,research_topic:topic,reason:`${x.event_date} 예정 발표입니다. 관련 원문과 기존 마켓인 보도를 읽어 기존 보도보다 더 나아갈 기사 방향이 있을 때만 제안합니다.`,sources:dedupeSources((x.sources||[]).map(s=>({...s,title:x.headline,date:s.date||x.event_date})))};
  }).filter(Boolean);
  for(const candidate of scheduled){
    const index=out.findIndex(x=>norm(x.research_topic)===norm(candidate.research_topic));
    if(index>=0){
      const existing=out[index];
      out[index]={...existing,event_date:candidate.event_date,story_mode:candidate.story_mode,timing_source:candidate.sources[0]||null,sources:dedupeSources([...(candidate.sources||[]),...(existing.sources||[])])};
    }else out.push(candidate);
  }
  return out;
}
function primaryTopic(clue){
  const topic=clean(clue?.research_topic);if(topic)return topic;
  const entity=(clue?.entities||[]).map(clean).find(Boolean);if(entity)return entity;
  return clean(clue?.headline).split(/\s*[·|｜:]\s*/)[0]||'해당 이슈';
}
function evidenceText(clue,result){
  const a=result?.analysis||{};return clean([primaryTopic(clue),clue?.headline,a.summary?.text,a.why_now?.text,...(a.facts||[]).map(f=>f.text),...(a.angles||[]).map(x=>x.headline+' '+x.reason+' '+x.new_information)].join(' '));
}
function timelineFor(clue,result){
  const a=result?.analysis;if(result?.status!=='ready'||!a?.angles?.length)return [];
  const topic=primaryTopic(clue),text=evidenceText(clue,result),date=eventLabel(clue?.event_date),bdc=/\bBDC\b|기업성장집합투자기구/i.test(text);
  if(clue?.event_date&&clue?.story_mode){
    const phase=clue.story_mode==='당일 해설'?'발표 직후':date?`${date} 발표 당일`:'발표 당일';
    if(bdc)return [
      {phase,trigger:'공식 세부안 공개',pitch:'[가제] BDC 규제안, 기존안서 뭐가 바뀌었나…운용·투자·대출·상장 규정 비교'},
      {phase:'다음 기사',trigger:'등록·상품 출시 계획 확인',pitch:'[가제] 1호 BDC 누가 먼저 내나…운용사·증권사 출시 일정과 상품 경제성'}
    ];
    return [
      {phase,trigger:'공식 발표문 공개',pitch:`[가제] ${topic} 발표…기존 상태에서 무엇이 달라졌나, 돈·규칙·시행일 비교`},
      {phase:'다음 기사',trigger:'시행·선정·거래 첫 사례',pitch:`[가제] ${topic} 시행 뒤 첫 적용…실제 자금 이동과 시장 반응 점검`}
    ];
  }
  if(/회생|파산|청산|재매각|자산처분|폐점|DIP|워크아웃|회생채권/.test(text)){
    const next=/파산|청산/.test(text)?`[가제] ${topic} 파산 절차 본격화…자산별 매각값과 채권자별 회수액`:`[가제] ${topic} 회생 다음 단계…법원 결정·매각 공고 뒤 자산값과 채권 회수`;
    return [
      {phase:'다음 신호',trigger:'법원 결정·매각 공고·본입찰',pitch:next},
      {phase:'결과 기사',trigger:'매각·변제·청산 결과 확정',pitch:`[가제] ${topic}, 결국 누가 얼마 회수했나…주주·채권자·협력사 손익 결산`}
    ];
  }
  if(/공개매수|경영권|우선협상|우협|본계약|SPA|실사|인수금융|기업결합|매각|인수/.test(text))return [
    {phase:'다음 신호',trigger:'우협·실사·SPA·인수금융',pitch:`[가제] ${topic} 거래, 본계약까지 남은 건…가격·인수금융·승인 조건`},
    {phase:'종결 후',trigger:'클로징·기업결합 승인',pitch:`[가제] ${topic} 거래 끝난 뒤…새 지배구조·차입 부담·기존 주주 회수 분석`}
  ];
  if(/출자|모태펀드|위탁운용|\bGP\b|\bLP\b|펀드레이징|결성|약정/.test(text))return [
    {phase:'다음 신호',trigger:'최종 선정·LP 확약·결성',pitch:`[가제] ${topic} 선정 다음은…민간 LP 확약·실제 약정액·결성 속도`},
    {phase:'결성 후',trigger:'최종 클로징·첫 투자',pitch:`[가제] ${topic} 출자 이후…정책자금이 실제 투자로 이어진 경로 점검`}
  ];
  if(/차환|신용등급|회사채|재무약정|기한이익|EOD|\bPF\b/.test(text))return [
    {phase:'다음 신호',trigger:'수요예측·차환·다음 만기',pitch:`[가제] ${topic} 다음 조달 고비…차환 금리·만기·담보 조건`},
    {phase:'조달 후',trigger:'신규 조달·상환 완료',pitch:`[가제] ${topic} 자금조달 이후…이자부담과 상환재원 어떻게 달라졌나`}
  ];
  return [];
}
function renderTimelineHtml(rows){
  if(!Array.isArray(rows)||!rows.length)return '';
  const items=rows.slice(0,2).map(row=>`<div class="story-timeline-row"><div class="story-timeline-when"><b>${esc(row.phase)}</b>${row.trigger?`<small>${esc(row.trigger)}</small>`:''}</div><p>${esc(row.pitch)}</p></div>`).join('');
  return `<div class="marketin-story-timeline" aria-label="다음 기사 흐름"><strong>다음 기사 흐름 · 조건부</strong>${items}</div>`;
}
function install(root){
  const C=root?.IBDiscovery,B=root?.MarketInStoryBrief;if(!C||!B||B.__storyTimelineInstalled)return false;
  const originalBuild=C.build,originalAttach=B.attach,originalRender=B.renderBriefHtml,originalShortlist=B.shortlist;
  if(typeof originalBuild!=='function'||typeof originalAttach!=='function'||typeof originalRender!=='function')return false;
  C.build=function(input,...rest){return timingCandidates(originalBuild.call(C,input,...rest),input,C);};
  B.attach=function(clue,result){
    const attached=originalAttach.call(B,clue,result);if(!attached)return attached;
    const timeline=timelineFor(attached,result);if(!timeline.length)return attached;
    return {...attached,article_timeline:timeline,research:{...(attached.research||result),story_timeline:timeline}};
  };
  B.renderBriefHtml=function(result,...args){
    let html=originalRender.call(B,result,...args),timeline=result?.story_timeline;if(!timeline?.length||!html.includes('</section>'))return html;
    html=html.replace(/후속 기사 방향 · 검증 전/g,'오늘 기사 방향 · 검증 전');
    return html.replace('</section>',renderTimelineHtml(timeline)+'</section>');
  };
  if(typeof originalShortlist==='function')B.shortlist=function(rows,limit=6){
    const base=originalShortlist.call(B,rows,rows.length),timing=base.filter(x=>x.event_date&&x.story_mode),rest=base.filter(x=>!timing.includes(x));return [...timing,...rest].slice(0,limit);
  };
  B.storyTimeline=timelineFor;B.__storyTimelineInstalled=true;return true;
}

return {eventTopic,eventLabel,timingCandidates,primaryTopic,timelineFor,renderTimelineHtml,install};
});
