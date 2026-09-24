'use strict';
// Explicit form structures only: retain the source row and distinguish before/after,
// planned purchases, subscriptions and actual purchases. Never infer cash paid.
const key=s=>String(s||'').replace(/[\s·ㆍ.:：()[\]]/g,'');
function extractEventRows(t,add){
 let ownerPhase='',holdingSection=false;
 for(let ri=0;ri<t.rows.length;ri++){
  const r=t.rows[ri],cs=r.cells,v=cs.map(c=>c.value),k=v.map(key);
  if(cs.some(c=>c.nested))continue;
  // KRX maximum-shareholder change: phase cells span several following rows.
  if(k.some(x=>/^1변경내용$/.test(x)))ownerPhase='';
  if(k.includes('최대주주등'))ownerPhase=k.includes('변경전')?'변경 전':k.includes('변경후')?'변경 후':'';
  if(ownerPhase){
   for(let i=0;i<cs.length-1;i++){
    const label=k[i]==='최대주주등'?'최대주주':/^소유주식수주?$/.test(k[i])?'보유주식수':/^소유비율%?$/.test(k[i])?'지분율':null;
    if(label)add([ownerPhase+' '+label,null,label==='최대주주'?'party':'ownership'],v[i],v[i+1],t,r.number);
   }
   if(/^\s*[2-9]\s*[.)]/.test(v[0]||''))ownerPhase='';
  }
  // DART large-shareholding summary: do not mix contract shares or voting rights.
  if(k.includes('보유주식등의수및보유비율'))holdingSection=true;
  else if(k.some(x=>/주요계약체결|의결권의수/.test(x)))holdingSection=false;
  if(holdingSection&&cs.length===3&&cs.every(c=>c.span===1)&&/^(직전|이번)보고서$/.test(k[0])){
   const phase=k[0].startsWith('직전')?'직전 보고':'이번 보고';
   add([phase+' 보유주식수',null,'ownership'],'보유주식등의 수(주)',v[1],t,r.number);
   add([phase+' 보유비율',null,'ownership'],'보유비율(%)',v[2],t,r.number);
  }
  // Tender offer horizontal table: only accept a single security per table.
  if(k[0]==='공개매수대상주식등'&&cs.every(c=>c.span===1&&c.rowspan===1)&&t.rows.length===ri+2){
   const next=t.rows[ri+1];if(next.cells.length!==cs.length||next.cells.some(c=>c.nested||c.span!==1||c.rowspan!==1))continue;
   const labels={예정수량:['공개매수 예정수량','ownership'],예정주식수:['공개매수 예정수량','ownership'],매수가격:['공개매수 가격','money'],응모주식수:['공개매수 응모수량','ownership'],매수주식수:['공개매수 매수수량','ownership']};
   for(let i=1;i<k.length;i++)if(labels[k[i]])add([labels[k[i]][0],null,labels[k[i]][1]],v[i],next.cells[i].value,t,next.number);
  }
 }
}
module.exports={extractEventRows};
