'use strict';
const crypto=require('node:crypto');
const key=s=>String(s||'').replace(/^\s*(?:\d+[.)]|[-－])\s*/,'').replace(/[\s·ㆍ.:：()[\]]/g,'');
const specs=[
 ['취득금액',/^취득금액(?:원|백만원|억원)?$/,'money'],['처분금액',/^처분금액(?:원|백만원|억원)?$/,'money'],
 ['거래금액',/^(?:매매|양수도|매각|거래)금액(?:원|백만원|억원)?$/,'money'],
 ['차입금액',/^차입금액(?:원|백만원|억원)?$/,'money'],['보증금액',/^채무보증금액(?:원|백만원|억원)?$/,'money'],
 ['자기자본 대비',/^자기자본대비(?:비율)?%?$/,'ownership'],['자산총액 대비',/^자산총액대비(?:비율)?%?$/,'ownership'],
 ['지분율',/^(?:소유|보유)?지분비율%?$|^지분율%?$/,'ownership'],
 ['취득 목적',/^취득목적$/,'purpose'],['처분 목적',/^처분목적$/,'purpose'],['자금 사용목적',/^자금(?:의)?사용목적$/,'purpose'],
 ['거래상대방',/^(?:거래|양수|양도|매매)상대방(?:회사명)?$/,'party'],
 ['배정대상자',/^(?:제3자)?배정대상자(?:명)?$/,'party'],['인수자',/^(?:인수인|인수자|매수인|매수자)(?:명)?$/,'party'],
 ['공개매수자',/^공개매수자(?:명|성명|명칭)?$/,'party'],['대상회사',/^(?:대상회사|발행회사)(?:명)?$/,'party'],
 ['업무집행사원',/^업무집행사원(?:명|명칭)?$/,'party'],['최대주주',/^최대주주(?:명|명칭)?$/,'party'],
 ['매각자산',/^(?:양도|처분|매각)(?:대상)?자산(?:명칭|내역)?$/,'terms'],
 ['양수도 대금',/^양수도대금(?:원|백만원|억원)?$/,'money'],
 ['주당 가액',/^1주당가액(?:원)?$/,'money'],['양수도 주식수',/^양수도주식수(?:주)?$/,'ownership'],
 ['예정 소유주식수',/^예정소유주식수(?:주)?$/,'ownership'],['예정 소유비율',/^예정소유비율%?$/,'ownership'],
 ['양도인',/^양도인$/,'party'],['양수인',/^양수인$/,'party'],['변경예정 최대주주',/^변경예정최대주주$/,'party'],
 ['계약 해소 종류',/^계약해소종류$/,'terms'],['계약 해소 사유',/^계약해소사유$/,'terms'],
 ['계약일',/^(?:양수도)?계약(?:체결일|일자)$/,'schedule'],['계약 해소일',/^양수도계약해소일$/,'schedule'],
 ['변경 예정일',/^변경예정일자$/,'schedule'],['변경일',/^변경일자$/,'schedule'],
 ['계약 목적물',/^계약의목적물$/,'terms'],['인수자금 중 자기자금',/^자기자금원$/,'money'],['인수자금 중 차입금',/^차입금원$/,'money'],
 ['차입처',/^차입처$/,'party'],['분할비율',/^분할비율$/,'terms'],['합병비율',/^합병비율$/,'terms'],
 ['분할기일',/^분할기일$/,'schedule'],['합병기일',/^합병기일$/,'schedule'],['주주총회 예정일',/^주주총회예정일자$/,'schedule'],
 ['사건명',/^사건의명칭$/,'terms'],['사건번호',/^사건번호$/,'terms'],['관할법원',/^관할법원$/,'terms'],
 ['신청인',/^신청인(?:회사와의관계)?$|^원고신청인$/,'party'],['신청사유',/^신청사유$/,'terms'],
 ['신청일',/^(?:제기)?신청일자$/,'schedule'],['보고사유',/^보고사유$/,'terms'],
];
function extractDealFields(tables,{rcept_no,entry,excluded=new Set()}={}){
 const out=[],seen=new Set();
 function add(spec,label,value,t,row){
  // Numeric columns must contain a scalar, never a neighboring column heading.
  if(['money','ownership'].includes(spec[2])&&!/^(?:주당\s*)?[+-]?[\d,]+(?:\.\d+)?\s*(?:억원|백만원|천원|원|%|주)?$/.test(value||''))return;
  if(!value||value.length>400||/^[-―]$|해당사항\s*없/.test(value)||value===label)return;
  if(/^(회사명|성명명칭|성명또는명칭|선정경위|선정사유|배정주식수|취득주식수|국적|대표자|자본금)$/.test(key(value)))return;
  const unit=label.match(/\(\s*(억원|백만원|천원|원|%|주)\s*\)/)?.[1]||null;
  const signature=spec[0]+'|'+value+'|'+unit;if(seen.has(signature))return;seen.add(signature);
  out.push({evidence_id:crypto.createHash('sha256').update(`${rcept_no}|deal|${t.number}|${row}|${signature}`).digest('hex').slice(0,20),label:spec[0],raw_label:label,value,unit,topic:spec[2],fact_status:'단서',verification:'원문 자동 추출 · 검수 전',source:{source_id:'dart:'+rcept_no,url:'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+rcept_no,entry,table:t.number,row,location:`${entry} · 표 ${t.number} · 행 ${row}`}});
 }
 for(const t of tables){if(excluded.has(t.number))continue;
  require('./dart-event-fields').extractEventRows(t,add);
  const profile=t.rows.some(r=>r.cells.some(c=>/법인의기본정보|최대주주.*대표이사.*지분정보/.test(key(c.value)))) || /^법인명$/.test(key(t.rows[0]?.cells[0]?.value));
  let companySection='';
  for(const r of t.rows){const cells=r.cells;
   for(let i=0;i<cells.length-1;i++){
    if(cells[i].nested||cells[i+1].nested)continue;
    const label=cells[i].value,spec=specs.find(s=>s[1].test(key(label)));
    if(profile&&spec&&['최대주주','지분율'].includes(spec[0]))continue;
    if(/분할후존속회사/.test(key(label)))companySection='분할 존속회사';
    else if(/분할설립회사/.test(key(label)))companySection='분할 신설회사';
    else if(/^\d+[.)]/.test(label)&&!/분할후존속회사|분할설립회사/.test(key(label)))companySection='';
    if(companySection&&key(label)==='회사명')add([companySection,null,'party'],label,cells[i+1].value,t,r.number);
    // Contract prose with explicit labels. Do not derive a price from unrelated digits.
    if(/양수도대금의지급일정및지급조건/.test(key(label))){
     const prose=cells[i+1].value;
     for(const m of prose.matchAll(/(납입총액)\s*[:：]\s*([\d,]+)\s*원/g))add(['납입 예정총액',null,'money'],m[1]+'(원)',m[2],t,r.number);
     for(const m of prose.matchAll(/납입일\s*[:：]\s*(20\d{2}년\s*\d{1,2}월\s*\d{1,2}일)/g))add(['납입 예정일',null,'schedule'],'납입일',m[1],t,r.number);
    }
    if(spec&&!specs.some(s=>s[1].test(key(cells[i+1].value))))add(spec,label,cells[i+1].value,t,r.number);
    if(/발행회사|양수대상회사|양도대상회사/.test(cells.slice(0,i).map(c=>c.value).join(' '))&&/^회사명$/.test(key(label)))add(['대상회사',null,'party'],label,cells[i+1].value,t,r.number);
    if(/^(성명명칭|성명또는명칭)$/.test(key(label))){const parent=cells.slice(0,i).map(c=>specs.find(s=>s[2]==='party'&&s[1].test(key(c.value)))).find(Boolean);if(parent)add(parent,label,cells[i+1].value,t,r.number);}
   }
   // Explicit allottee headers: values in subsequent rows keep the same source column.
   const col=cells.findIndex(c=>/^(제3자)?배정대상자(명)?$/.test(key(c.value)));
   if(col>=0&&cells.every(c=>c.rowspan===1&&c.span===1)&&cells.some(c=>/선정경위|선정사유/.test(c.value))){
    for(const next of t.rows.slice(r.number,r.number+20)){
     if(next.cells.length!==cells.length||next.cells.some(c=>c.nested||c.span!==1||c.rowspan!==1))break;
     add(['배정대상자',null,'party'],cells[col].value,next.cells[col].value,t,next.number);
    }
   }
  }
 }
 // Conflicting totals are not collapsed into one number. The detailed evidence retains each row.
 return out.slice(0,30);
}
module.exports={extractDealFields};
