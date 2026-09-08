(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IBDartTopics=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
// Read-only editorial lenses. No article score, fact promotion or new source collection.
const VERSION='dart-topics-1',REVIEW_VERSION='dart-review-1.5';
const TOPICS=[
 {id:'control',label:'경영권·주주',question:'누가 지분·의결권을 확보하나?',compare:'직전 지분보고 · 주식양수도 계약 · 주주구성',limit:'지분보고가 곧 경영권 인수는 아닙니다. 보유 목적과 의결권을 확인해야 합니다.'},
 {id:'deal',label:'인수·매각',question:'누가 무엇을 사고팔며, 거래대금은 실제로 오갔나?',compare:'최초 취득·처분 결정 · 계약 조건 · 거래 종결 자료',limit:'취득·처분 결정은 거래 종결이나 투자금 회수와 다릅니다.'},
 {id:'funding',label:'자금조달·희석',question:'누가 어떤 조건으로 돈을 넣고, 기존 주주 지분은 얼마나 희석되나?',compare:'발행 조건 · 배정 대상 · 예정 조달총액 · 실제 납입',limit:'발행가·발행 주식 수·조달총액·실제 납입액을 구분해야 합니다.'},
 {id:'execution',label:'일정·이행',question:'예정 일정과 실제 납입·거래 종결은 어디까지 달라졌나?',compare:'최초 일정 · 변경 사유 · 납입·종결 결과',limit:'일정 변경이나 정정 횟수만으로 자금난·거래 무산을 단정하지 않습니다.'},
 {id:'debt',label:'상환·담보·위험',question:'누가 갚고 보증하며, 부담이 어디로 넘어가나?',compare:'차입 만기 · 상환재원 · 담보·보증 대상 · 현금흐름',limit:'상환·보증 공시만으로 유동성 위기를 단정하지 않습니다.'},
 {id:'fund',label:'펀드·출자',question:'어느 펀드에 누가 출자하고, 운용 조건은 어떻게 바뀌나?',compare:'정식 펀드명 · GP·LP · 약정·납입 · 존속기간',limit:'출자 예정·약정·납입·결성은 서로 다른 단계입니다.'},
 {id:'capital',label:'주주환원·자본정책',question:'누구에게 현금을 돌려주고, 주식 수와 권리는 어떻게 바뀌나?',compare:'배당·자사주·감자 조건 · 현금 유출 · 수혜 주주',limit:'무상감자나 주식 수 조정을 현금 환원으로 해석하지 않습니다.'},
 {id:'reference',label:'참고·미분류',question:'다른 취재에 대조할 자료인가, 별도 사건이 있는가?',compare:'직전 보고서 · 재무제표 · 감사의견 · 해당 주석',limit:'정기보고서나 미분류 공시를 자동으로 기사 후보로 취급하지 않습니다.'},
];
const get=id=>TOPICS.find(t=>t.id===id)||TOPICS.at(-1);
const clean=x=>String(x??'').replace(/\s+/g,' ').trim();
const compact=x=>clean(x).replace(/\s+/g,'');
function usable(item,r){return Boolean(r?.ok&&r.version===REVIEW_VERSION&&/^\d{14}$/.test(item?.rcept_no||'')&&r.rcept_no===item.rcept_no);}
function records(item,r){if(!usable(item,r))return[];return [...(Array.isArray(r.changes)?r.changes:[]),...(Array.isArray(r.current_fields)?r.current_fields:[])].filter(e=>e&&e.evidence_id&&e.source?.source_id===`dart:${item.rcept_no}`);}
function recordTopics(e,title){const label=compact(e.label||e.raw_label),out=[];
 if(/최대주주|경영권|보유목적|보유수량|의결권|대량보유/.test(label))out.push('control');
 if(/취득|처분|양수|양도|합병|분할/.test(label)&&!/자기주식|자기사채/.test(label))out.push('deal');
 if(/발행가|기준주가|전환가|행사가|배정대상|신주의종류와수|신주발행|증자방식|권면총액|자금조달/.test(label))out.push('funding');
 if(/납입일|예정일|종결일|지급일|일정|청구기간|기한/.test(label)&&Object.hasOwn(e,'before')&&Object.hasOwn(e,'after'))out.push('execution');
 if(/채무|차입|상환|담보|보증|만기일|이자율|금리|연체|계속기업|자본잠식/.test(label))out.push('debt');
 if(/출자|약정|결성|존속기간|운용인력|운용사|조합|펀드/.test(label))out.push('fund');
 if(/배당|자기주식|감자|소각/.test(label)&&!/사채/.test(label))out.push('capital');
 // A financing issuance's share count is dilution evidence, not proof of control transfer.
 if(/지분|비율|주식수|주식총수/.test(label)&&!out.length)out.push(/유상증자|사채발행|신주|전환/.test(title)?'funding':'control');
 if(!out.length&&e.topic==='purpose')out.push('funding');
 return [...new Set(out)];
}
function classify(item={},review){
 const title=compact(item.report_nm),hits=new Map();
 function add(id,basis,e){if(!hits.has(id))hits.set(id,{id,label:get(id).label,basis:[],evidence_ids:[]});const h=hits.get(id);if(!h.basis.includes(basis))h.basis.push(basis);if(e&&!h.evidence_ids.includes(e.evidence_id))h.evidence_ids.push(e.evidence_id);}
 if(/최대주주|경영권|주식양수도|공개매수|주식등의대량보유|임원ㆍ주요주주|임원·주요주주|임원[ㆍ·]?주요주주|의결권|경영참여/.test(title))add('control','title');
 if(/타법인.*(?:취득|처분)|주식(?:및출자증권)?(?:양수|양도)|영업양수|영업양도|회사합병|회사분할|합병등종료|분할합병|합병결정|영업양수도|주식교환|주식이전|자산(?:양수|양도)|유형자산.*(?:취득|처분)|주식양수도/.test(title))add('deal','title');
 const retiring=/(?:사채|채권).*(?:상환|소각|취득)/.test(title)&&!/발행결정/.test(title);
 if(/유상증자|증권발행|(?:전환사채|교환사채|신주인수권부사채|사채)(?:권)?발행|전환가액|전환청구권|신주인수권행사|유상증자결과/.test(title)&&!retiring)add('funding','title');
 const routineTrust=/자기주식.*신탁계약.*해지/.test(title);
 if(/납입일변경|일정변경|기한연장|철회|중단|불성립|미발행|거래종결|발행(?:결과|실적)|합병등종료보고서/.test(title)||(!routineTrust&&/계약.*(?:해제|해지)|취소/.test(title)))add('execution','title');
 if(retiring||/차입|대여|대출|채무보증|담보제공|회생|워크아웃|부도|연체|횡령|배임|가압류|강제집행|자본잠식|계속기업|감사의견.*(?:거절|부적정|한정)/.test(title))add('debt','title');
 if(/(?:펀드|투자조합|사모투자|집합투자기구|사모집합투자).*(?:결성|설립|해산|출자|약정|청산|존속|운용)|출자(?:결정|약정|납입|이행)|조합.*(?:출자|약정|결성|해산|청산|존속)/.test(title)||item.group_id==='fund')add('fund','title');
 if(/배당|자기주식|감자|무상증자|주식분할|주식병합/.test(title))add('capital','title');
 for(const e of records(item,review))for(const id of recordTopics(e,title))add(id,'body',e);
 if(!hits.size)add('reference','title');
 return [...hits.values()].map(h=>({...h,basis_label:h.basis.includes('body')?'원문 항목 기준 · 검수 전':'공시명 기준 · 내용 확인 필요'}));
}
function storyContext(item={},review,selected='all'){
 const topics=classify(item,review),topic=topics.find(t=>t.id===selected)||topics[0],meta=get(topic.id),all=records(item,review);
 const evidence=all.filter(e=>topic.evidence_ids.includes(e.evidence_id));
 const changes=evidence.filter(e=>Object.hasOwn(e,'before')&&Object.hasOwn(e,'after'));
 let question=meta.question,why=meta.limit;
 if(topic.id==='funding'){
  const price=changes.find(e=>/발행가|전환가|기준주가/.test(e.label)),shares=changes.find(e=>/신주의종류와수|주식수|주식총수/.test(compact(e.label)));
  if(price&&shares){why='가격과 발행 주식 수가 함께 바뀐 단서입니다. 조달총액 변화와 기존 주주의 희석 부담을 나눠 확인합니다.';question='발행가격과 신주 수를 함께 조정한 이유는 무엇인가? 예정 조달총액·배정 대상·실제 납입 여부를 각각 확인해달라.';}
  else if(price){why='주당 가격 변화와 조달총액 변화는 다릅니다. 발행·전환할 주식 수와 함께 봅니다.';question='주당 가격의 산정 기준일과 변경 사유는 무엇인가? 발행·전환 주식 수와 예정 조달총액에도 영향이 있는가?';}
 }else if(topic.id==='execution'){
  const schedule=changes.find(e=>typeof e.day_delta==='number'&&Number.isFinite(e.day_delta)&&e.day_delta!==0);
  if(schedule){const direction=schedule.day_delta>0?'뒤로':'앞으로';why=`${clean(schedule.label)}이 기재된 날짜 기준 ${Math.abs(schedule.day_delta)}일 ${direction} 바뀐 단서입니다. 실제 이행은 별도로 확인합니다.`;question=`${clean(schedule.label)}을 ${direction} 바꾼 이유는 무엇인가? 예정일 조정인지 실제 이행일 반영인지, 관련 납입·거래 종결은 끝났는지 확인해달라.`;}
  else if(/철회|중단|해제|불성립|미발행/.test(item.report_nm||'')){why='제목에 철회·중단 또는 미성립이 표시된 공시입니다. 해제 조건과 남은 의무는 본문을 읽어야 알 수 있습니다.';question='어느 계약이나 발행이 중단됐는가? 공식 사유와 계약금·위약금·재추진 여부를 확인해달라.';}
 }
 return {topic,topics,why,question,compare:meta.compare,limit:meta.limit,evidence_ids:evidence.map(e=>e.evidence_id),basis:topic.basis_label,resolved:false};
}
function countTopics(items=[],reviews={}){const counts=Object.fromEntries(TOPICS.map(t=>[t.id,0]));for(const item of items)for(const t of classify(item,reviews?.[item.rcept_no]))counts[t.id]++;return counts;}
return {VERSION,TOPICS,get,usable,records,classify,storyContext,countTopics};
});
