'use strict';
// Public, sourced investment context is background, never proof of a new deal's counterparty.
const {DRIVE_DOSSIERS,matchDossiersInText}=require('./drive-dossiers');
const normalize=s=>String(s||'').replace(/주식회사|유한회사|\(주\)|㈜|[^가-힣a-z0-9]/gi,'').toLowerCase();
const publicUrl=s=>/^https?:\/\//.test(String(s||''))&&!/drive\.google|docs\.google/.test(s);
const records=DRIVE_DOSSIERS.filter(x=>['company','fund'].includes(x.entity_type)).flatMap(x=>{
  const manager=(x.current_status||[]).find(s=>s.label==='운용사')?.text;
  const source=(x.sources||[]).find(s=>publicUrl(s.source_url));
  if(!manager||!source)return [];
  return [{names:[x.canonical_name,...(x.aliases||[])],company:x.canonical_name,investor:manager,
    role:x.entity_type==='fund'?'펀드 운용사':'기존 투자·사업 관계',url:source.source_url,as_of:x.basis_date||'',
    context:(x.current_status||[]).find(s=>s.label==='지분·통제')?.text||''}];
});
records.push(...['UCK파트너스','MBK파트너스'].map(investor=>({names:['오스템임플란트'],company:'오스템임플란트',investor,role:'인수 컨소시엄',as_of:'2026-09-16',url:'https://marketin.edaily.co.kr/News/Read?newsId=04480486645580776',context:'인수금융·자산 유동화 취재 연결'})));
function contextFor(item){
  const names=[item?.corp_name,item?.flr_nm].map(normalize).filter(Boolean);
  const relationships=records.filter(r=>r.names.some(n=>names.includes(normalize(n)))).map(({company,investor,role,url,as_of,context})=>({company,investor,role,url,as_of,context}));
  const entities=matchDossiersInText([item?.corp_name,item?.flr_nm].join(' '),8).filter(x=>['pef','vc','ac','lp'].includes(x.entity_type)).map(x=>({name:x.canonical_name,type:x.type_label}));
  return {relationships:relationships.slice(0,6),entities,relation_scope:'background_only'};
}
function partiesInFields(fields){
  return fields.filter(f=>f.topic==='party').flatMap(f=>{const matches=matchDossiersInText(f.value,6)
    .filter(x=>['pef','vc','ac','lp','fund'].includes(x.entity_type))
    .map(x=>({name:x.canonical_name,role:f.label,evidence_id:f.evidence_id,source:f.source}));
    if(!matches.length&&/투자합자회사|벤처투자조합|신기술(?:사업)?투자조합|기관전용사모|일반사모(?:부동산|특별자산|집합)?투자/.test(f.value))matches.push({name:f.value,role:f.label,evidence_id:f.evidence_id,source:f.source});
    return matches;});
}
module.exports={contextFor,partiesInFields};
