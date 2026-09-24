(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DiscoveryFollowup=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const roundup=/맥짚기|특징주|목표주가|투자의견|들썩|급등주|상승주|종목.{0,6}(?:추천|전망)|개인정보.{0,12}유출|해킹/;
function family(title){
 if(/공개매수/.test(title))return 'tender';
 if(/인수금융/.test(title))return 'acquisition_finance';
 if(/경영권|인수|매각|주식.{0,5}(?:양수도|매매)|기업결합/.test(title))return 'deal';
 if(/펀드|출자|위탁운용|조합/.test(title))return 'fund';
 if(/차환|회사채|신용등급|재무약정/.test(title))return 'credit';
 return '';
}
function related(seed,title){
 if(roundup.test(title))return false;
 const f=family(seed),other=family(title);
 if(!f)return true;
 if(f==='tender')return /공개매수|주식.{0,5}(?:양수도|매매)|계약.{0,5}해제|주주총회|임시주총|주주제안/.test(title);
 if(f==='acquisition_finance')return /인수금융|차입|대출|자금조달|인수|매각/.test(title);
 return f===other||f==='deal'&&['tender','acquisition_finance'].includes(other);
}
function subject(title,fallback=''){
 return title.match(/[,，]\s*([가-힣A-Za-z0-9·]+)\s+인수/)?.[1]||title.match(/^([가-힣A-Za-z0-9·]+)[,，]?\s*공개매수/)?.[1]||clean(fallback);
}
// These are explicit verification plans, not generated findings or article pitches.
// Every plan starts from a narrow, attributed headline signal or a cited DART change.
function plan(x){
 const title=clean(x.one_line_signal||x.headline),name=subject(title,x.research_topic||(x.entities||[])[0]);
 if(x.lane==='background'||x.article_brief?.angles?.length||roundup.test(title))return null;
 const source=(x.sources||[]).find(s=>norm(s.title)===norm(title))||(x.sources||[])[0];
 if(!source||!/^https?:\/\//.test(source.url||''))return null;
 if(x.detector==='dart_deal'){
  const changes=(x.evidence||[]).filter(f=>f.before!==undefined&&f.after!==undefined&&f.before!==f.after&&f.evidence_id&&f.source?.source_id);
  if(!changes.length)return null;
  const f=changes[0];
  return {kind:'disclosure_change',headline:x.headline,reason:`공시 정정표에서 ${f.label}의 변경 전후 값을 추출했습니다. 거래 조건에 미치는 영향은 원문 검수가 필요합니다.`,question:`${f.label} 변경과 함께 납입·종결 조건도 바뀌었나?`,checks:[{document:'정정 공시와 직전 공시',fields:`${f.label}: ${f.before} → ${f.after}. 정정 사유와 같은 표의 납입·종결 조건을 함께 대조`}],promotion:'변경 값과 정정 사유를 원문에서 확인하고, 기존 보도가 설명하지 않은 거래 조건의 차이가 있을 때 발제로 검토합니다.',source,provisional:'공시 자동 추출 · 원문 검수 전'};
 }
 if(x.detector!=='news_followup'||!name||name.length<2)return null;
 if(/공개매수/.test(title)&&/실패|무산|미달|불발/.test(title)&&!/의무공개매수/.test(title)){
  const terminated=/계약.{0,8}해제|해제/.test(title);
  return {kind:'tender_failure',headline:`${name} 공개매수, 성사 조건과 실제 응모 결과 대조`,reason:terminated?'공개매수 실패와 주식매매계약 해제가 함께 보도됐습니다. 최소 매수 조건과 실제 응모 결과를 대조하면 계약 해제로 이어진 조건을 확인할 수 있습니다.':'공개매수 무산이 보도됐습니다. 최소 매수 조건과 실제 응모 결과를 대조해 무산 사유를 확인할 필요가 있습니다.',question:`${name} 공개매수의 최소 매수수량과 실제 응모수량은 얼마나 차이 났으며, 조건 미충족 시 매수 여부는 어떻게 정했나?`,checks:[{document:'공개매수신고서·정정신고서',fields:'최소 매수수량, 매수가격, 조건 미충족 시 매수 여부와 조건 변경 이력'},{document:'공개매수결과보고서',fields:'응모수량·실제 매수수량을 신고서의 성사 조건과 대조'},...(terminated?[{document:'주식매매계약 해제 공시',fields:'해제 사유와 공개매수 선행조건을 대조'}]:[])],promotion:'원문에서 수량과 계약 조건을 확인한 뒤 기보도와 대조합니다. 기존 기사에 같은 설명이 있으면 새 발제로 올리지 않습니다.',source,provisional:'보도 제목에서 정한 확인 과제 · 본문 대조 전'};
 }
 if(/인수금융/.test(title)&&/지원|확약|주선/.test(title)){
  return {kind:'acquisition_finance',headline:`${name} 인수금융, 지원 발표와 실제 조달 조건 확인`,reason:'인수금융 지원이 보도됐지만 지원 의사와 대출 확약은 구분해서 확인해야 합니다. 인수대금 중 차입 비중과 종결 전 충족할 조건이 기사 검토 대상입니다.',question:`${name} 관련 인수금융은 지원 검토·확약·실행 중 어느 단계이며, 공개된 조달액과 인수대금은 어떻게 대응하나?`,checks:[{document:'인수 발표·주식취득 공시',fields:'인수 주체, 대상 지분, 인수대금과 지급 일정'},{document:'차입·담보 공시와 금융기관 발표',fields:'차주, 조달액, 확약·실행 여부, 담보와 선행조건. 비공개 조건은 미확인으로 유지'}],promotion:'같은 거래의 인수대금과 조달 조건을 확인하고 기존 보도에 없는 차입 구조나 조건을 설명할 수 있을 때 발제로 검토합니다.',source,provisional:'보도 제목에서 정한 확인 과제 · 본문 대조 전'};
 }
 return null;
}
return {family,related,subject,plan,roundup};
});
