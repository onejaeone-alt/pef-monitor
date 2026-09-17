(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.MarketInStoryBrief=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const unique=rows=>[...new Set((rows||[]).map(clean).filter(Boolean))];
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const compact=(value,n=86)=>{const text=clean(value);return text.length>n?text.slice(0,n-1)+'…':text;};

function clueText(clue){
  return clean([
    clue?.detector,clue?.detector_label,clue?.headline,clue?.article_pitch,clue?.story_mode,clue?.why_today,clue?.one_line_signal,clue?.changed_fact,clue?.reason,clue?.next_action,
    ...(clue?.story_requirements||[]),...(clue?.comparison_targets||[]),...(clue?.questions||[]),...(clue?.unknowns||[]),...(clue?.entities||[]),...(clue?.extracted_facts||[]),...(clue?.reported||[])
  ].join(' '));
}
function primaryEntity(clue){
  const named=(clue?.entities||[]).map(clean).find(Boolean);
  if(named)return named;
  const head=clean(clue?.headline);
  return head.split(/\s*[·|｜:]\s*/)[0]||'해당 거래';
}
function kindFor(clue){
  const detector=clean(clue?.detector),text=clueText(clue);
  if(['market_pattern','formation_pattern','cross_source'].includes(detector))return '시장흐름';
  if(detector==='reporting_opportunity')return '선취재';
  if(/영입|선임|승진|퇴임|인사|대표.{0,6}교체|헤드|파트너.{0,6}영입|조직개편/.test(text))return '인사·펀드레이징';
  if(/출자사업|모태펀드|국민성장펀드|위탁운용사|GP\s*선정|LP\b|약정액|결성예정|결성총회|최종\s*클로징|펀드레이징/.test(text))return 'LP·GP';
  if(/규제|기준\s*(?:변경|완화|강화)|요건\s*(?:변경|완화|강화)|제도\s*(?:변경|개편)|정책\s*(?:변경|개편)|금융위|금감원/.test(text))return '정책·규칙';
  if(/회생|워크아웃|부도|연체|EOD|기한이익상실|회사채|전환사채|CB\b|교환사채|EB\b|인수금융|리파이낸싱|차입|담보|보증|PF\b|신용등급|상환/.test(text))return '크레딧';
  if(/처분|매각|회수|엑시트|세컨더리|컨티뉴에이션|잔여\s*지분|펀드\s*만기/.test(text))return '회수·매각';
  if(/인수|취득|양수|합병|분할|영업양수|공개매수|경영권|우선협상|우협|SPA/.test(text)||detector==='dart_deal')return 'M&A·거래';
  return '후속단독';
}

function template(kind,clue){
  const entity=primaryEntity(clue),signal=compact(clue?.one_line_signal||clue?.changed_fact||clue?.headline,70);
  const base={kind,angle:'',must_get:[],compare:[],calls:[],ready_when:''};
  if(kind==='M&A·거래')return {...base,
    angle:`${entity}의 거래 사실 자체보다 누가 얼마를 어떤 돈으로 사고, 거래 뒤 지배력이 어떻게 바뀌는지 확인해 ‘실제 인수 구조와 다음 단계’로 확장`,
    must_get:['거래금액·취득지분·거래 전후 지분율','매수자·매도자와 자금원(자기자금·인수금융·공동투자)','SPA·우협·클로징 일정과 선행조건'],
    compare:['같은 기업의 직전 지분·사업 구조','동일 매수자·PEF의 최근 유사 거래 2건'],
    calls:unique([entity,'거래 상대방','매각·인수 자문사 또는 대주단']),
    ready_when:'금액·상대방·자금원·거래 단계가 원문과 당사자 취재로 맞고, 왜 지금 거래하는지 한쪽 이상 설명이 붙으면 기사화 판단.'};
  if(kind==='회수·매각')return {...base,
    angle:`${entity}의 매각·처분 가격만 쓰지 말고 투자원가·누적 회수액·잔여 지분·펀드 만기를 붙여 실제 회수 성과와 매각 배경을 확인`,
    must_get:['최초 투자일·투자원가·추가 투자금','이번 처분가와 누적 배당·중간회수액','잔여 지분·펀드 만기·LP 회수 일정'],
    compare:['같은 펀드의 다른 회수 사례','직전 가치평가·리파이낸싱 또는 배당 시점'],
    calls:unique([entity,'매도자·운용사','LP 또는 거래 자문사']),
    ready_when:'투자원가와 누적 회수액을 구분해 확인하고 잔여 지분·펀드 시계를 붙일 수 있으면 회수 기사 판단.'};
  if(kind==='LP·GP')return {...base,
    angle:`${entity} 관련 공고·선정 한 건에서 끝내지 말고 지원사·경쟁률·반복 선정·실제 결성까지 비교해 정책자금이 어떤 GP로 이동하는지 확인`,
    must_get:['정책 출자액·출자 요청액·결성예정액·실제 약정액을 구분','지원→1차→최종 선정 GP와 경쟁률','민간 LP 확약·GP 커밋·최초 납입·최종 클로징'],
    compare:['같은 LP의 최근 2개년 동일 리그 선정 결과','선정 GP의 다른 정책 LP 반복 선정·결성 성적'],
    calls:unique([entity,'선정 GP 2곳 이상','LP 출자 담당자']),
    ready_when:'선정 단계와 금액 정의를 원문으로 확정하고 GP·LP 양쪽 확인이 붙으면 단건 또는 반복선정 흐름 기사 판단.'};
  if(kind==='정책·규칙')return {...base,
    angle:`${entity}의 새 기준 문구를 요약하는 데서 그치지 말고 이전 기준과 대조해 실제 자금 배분·선정 대상이 누구에게 유리하거나 불리해지는지 확인`,
    must_get:['변경 전·후 문구와 시행일·적용 대상','정책자금 규모와 실제 배분 방식','새 기준을 적용받는 GP·기업·투자자의 구체 사례'],
    compare:['직전 연도 동일 제도·출자사업 결과','변경 기준을 충족하지 못하거나 새로 충족하는 반대 사례'],
    calls:unique([entity,'정책 담당 부서','적용 대상 GP·LP 또는 업계 관계자']),
    ready_when:'전후 규칙과 실제 적용 사례를 각각 확인하고, 수혜·부담 주체를 양쪽 취재로 검증하면 정책 기사 판단.'};
  if(kind==='크레딧')return {...base,
    angle:`${entity}의 조달액이나 사건명보다 금리·만기·담보·옵션·상환재원을 붙여 누가 위험과 손실을 떠안는 구조인지 확인`,
    must_get:['조달액·금리/수익률·만기·전환/풋/콜 조건','담보·보증·우선순위와 채권자 구성','상환재원·차환 계획·다음 만기 또는 EOD 조건'],
    compare:['직전 조달 조건과 현재 시장금리·주가','동일 신용등급·업종의 최근 조달 2건'],
    calls:unique([entity,'주관사·대주단·채권자','신용평가사 또는 투자자']),
    ready_when:'계약 조건과 상환재원을 확인하고 투자자·채권자의 손익 변화가 계산 가능하면 크레딧 기사 판단.'};
  if(kind==='인사·펀드레이징')return {...base,
    angle:`${entity}의 인사 사실보다 새 역할이 어떤 펀드레이징·투자 전략과 연결되는지, 첫 담당 펀드·딜·LP 접촉을 확인`,
    must_get:['이전 직책과 새 역할·의사결정 권한','담당 펀드 목표액·현재 모집액·주요 LP','첫 담당 딜·포트폴리오와 기존 파트너 역할 변화'],
    compare:['최근 1년 유사한 한국계·아시아 펀드레이징 인사','같은 하우스의 직전 조직개편·펀드레이징 결과'],
    calls:unique([entity,'이동 전·후 하우스','주요 국내 LP 또는 동종 하우스']),
    ready_when:'역할·권한과 실제 펀드/LP 과제가 확인되고 유사 인사 2건 이상이 붙으면 인사 단독 또는 시장 인력경쟁 기사 판단.'};
  if(kind==='시장흐름')return {...base,
    angle:`${signal||entity+' 관련 변화'}를 한 사례로 단정하지 말고 독립된 유사 사례 3건 이상과 과거 기준치를 붙여 새로운 시장 관행인지 검증`,
    must_get:['유사 사례별 날짜·금액·당사자·거래 단계','직전 연도 또는 직전 사이클 기준치','같은 방향이 아닌 반대 사례 최소 1건'],
    compare:['동일 전략·산업의 최소 3개 거래','규모가 다른 GP·LP의 움직임'],
    calls:['서로 다른 운용사·LP 3곳 이상','거래 자문사·대주단','반대 사례 당사자'],
    ready_when:'서로 독립된 3개 이상 사례와 반대 사례를 확인해야 시장 흐름 기사로 판단. 한 건이면 단건 기사에 머문다.'};
  if(kind==='선취재')return {...base,
    angle:`${entity}의 발표를 받아쓰지 않도록 발표 전 기준 수치·기존 상태·쟁점을 준비하고, 발표 직후 달라진 조건과 이해관계자 반응을 확인`,
    must_get:['발표 전 기준 수치와 직전 공식 입장','당일 확인할 금액·시행일·선정/거래 조건','발표 직후 바로 전화할 당사자와 반대 이해관계자'],
    compare:['직전 발표·공고와 달라진 문구','예상과 실제 발표가 다른 항목'],
    calls:unique([entity,'발표 담당 부서','직접 영향을 받는 GP·LP·기업']),
    ready_when:'발표 전 기준과 발표 후 변경점을 대조하고 당사자 반응까지 확보하면 당일 후속 기사 판단.'};
  return {...base,
    angle:`${entity} 관련 기존 보도에서 빠진 가격·자금조달·계약 단계·당사자 확인 중 하나를 독자적으로 확인해 후속 단독 가능성을 점검`,
    must_get:['기존 보도가 확인한 사실과 아직 보도에 없는 항목을 분리','가격·금액·지분·일정 가운데 독자 확인 가능한 핵심 수치','거래 양측 또는 이해관계가 다른 두 곳의 확인'],
    compare:['최초 보도와 후속 보도의 달라진 사실','같은 기업·운용사의 직전 거래·펀드 사례'],
    calls:unique([entity,'거래·출자 담당자','상대방·자문사·LP 등 반대편 취재원']),
    ready_when:'기존 보도에 없던 핵심 사실 하나를 독자 확인하고 거래 양측의 확인 또는 반론을 붙이면 후속 기사 판단.'};
}

function storyBrief(clue){
  if(!clue||typeof clue!=='object')return null;
  const brief=template(kindFor(clue),clue);
  if(!clue.article_pitch)return brief;
  return {...brief,kind:clue.story_mode||brief.kind,pitch:clean(clue.article_pitch),why_today:clean(clue.why_today||clue.reason),must_get:(clue.story_requirements||[]).length?unique(clue.story_requirements):brief.must_get,compare:(clue.comparison_targets||[]).length?unique(clue.comparison_targets):brief.compare,calls:unique([...(clue.contacts||[]),...brief.calls])};
}
function enrichClue(clue){
  if(!clue||typeof clue!=='object')return clue;
  return {...clue,article_brief:storyBrief(clue)};
}
function renderBriefHtml(brief){
  if(!brief)return '';
  const list=(rows,limit=3)=>(rows||[]).slice(0,limit).map(row=>`<li>${esc(row)}</li>`).join('');
  const pitch=brief.pitch?`<div class="marketin-story-pitch"><strong>기사 제안</strong><p>${esc(brief.pitch)}</p>${brief.why_today?`<small><b>왜 오늘</b> ${esc(brief.why_today)}</small>`:''}</div>`:'';
  return `<section class="marketin-story-brief" aria-label="마켓인형 취재안"><div class="marketin-story-head"><b>마켓인형 취재안</b><span>${esc(brief.kind)}</span></div>${pitch}<p class="marketin-story-angle">${esc(brief.angle)}</p><div class="marketin-story-grid"><div><strong>반드시 확인</strong><ul>${list(brief.must_get)}</ul></div><div><strong>비교할 것</strong><ul>${list(brief.compare,2)}</ul></div><div><strong>전화 순서</strong><ul>${list(brief.calls,3)}</ul></div></div><p class="marketin-story-ready"><b>기사 성립선</b> ${esc(brief.ready_when)}</p></section>`;
}
function decorate(root){
  const doc=root?.document,map=root?.__marketinStoryBriefMap;if(!doc||!map)return;
  for(const card of doc.querySelectorAll('.discovery-card')){
    if(card.querySelector('.marketin-story-brief'))continue;
    const detail=card.querySelector('[data-detail]'),clue=detail&&map.get(detail.dataset.detail);if(!clue?.article_brief)continue;
    const anchor=card.querySelector('.discovery-reason')||card.querySelector('.discovery-fact');if(!anchor)continue;
    anchor.insertAdjacentHTML('afterend',renderBriefHtml(clue.article_brief));
  }
}
function install(root){
  const C=root?.IBDiscovery;if(!C||C.__marketinStoryBriefInstalled)return false;
  const original=C.build;if(typeof original!=='function')return false;
  C.build=function(){
    const rows=(original.apply(C,arguments)||[]).map(enrichClue);
    root.__marketinStoryBriefMap=new Map(rows.map(row=>[row.clue_id,row]));
    return rows;
  };
  C.storyBrief=storyBrief;C.__marketinStoryBriefInstalled=true;
  if(root.document&&typeof root.MutationObserver==='function'){
    const observer=new root.MutationObserver(()=>decorate(root));
    const target=root.document.querySelector('#discoveryCards')||root.document.body;
    if(target)observer.observe(target,{childList:true,subtree:true});
    decorate(root);
  }
  return true;
}

return {clueText,enrichClue,kindFor,primaryEntity,renderBriefHtml,storyBrief,install};
});
