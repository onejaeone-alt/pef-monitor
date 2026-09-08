'use strict';
// Preserve table geometry. Only an explicitly merged reason column is inherited.
function expandReasons(t){
 let reason=-1,count=0,shared=null,left=0;
 for(const row of t.rows){
  const names=row.cells.map(c=>c.value.replace(/[\s.:：()[\]]/g,''));
  const ri=names.findIndex(v=>/^(정정|변경)사유$/.test(v));
  if(ri>=0&&names.some(v=>/^(정정전|변경전)(내용)?$/.test(v))&&names.some(v=>/^(정정후|변경후)(내용)?$/.test(v))&&row.cells.every(c=>c.span===1&&c.rowspan===1&&!c.nested)){
   reason=ri;count=row.cells.length;shared=null;left=0;continue;
  }
  if(reason<0)continue;
  if(left>0){left--;if(row.cells.length===count-1){const cells=[...row.cells];cells.splice(reason,0,{...shared});row.cells=cells;}else{shared=null;left=0;continue;}}
  const c=row.cells[reason];
  if(row.cells.length===count&&c&&!c.nested&&c.span===1&&c.rowspan>1&&c.rowspan<=1000){shared={...c,rowspan:1,shared_reason_from:row.number};left=c.rowspan-1;row.cells=[...row.cells];row.cells[reason]={...shared};}
 }
 return t;
}
function parseTables(markup,text){
 const stack=[],found=[];
 for(const m of markup.matchAll(/<\/?TABLE(?=[\s>])[^>]*>/gi)){
  if(!/^<\//.test(m[0]))stack.push({start:m.index,at:m.index+m[0].length,children:[]});
  else if(stack.length){const t=stack.pop();t.end=m.index;t.close=m.index+m[0].length;found.push(t);if(stack.length)stack[stack.length-1].children.push([t.start,t.close]);}
 }
 return found.sort((a,b)=>a.start-b.start).map((t,ti)=>{
  let html='',cursor=t.at;for(const[start,end]of t.children){html+=markup.slice(cursor,start)+'<NESTED-TABLE/>';cursor=end;}html+=markup.slice(cursor,t.end);
  return expandReasons({number:ti+1,start:t.start,end:t.close,rows:[...html.matchAll(/<TR(?=[\s>])[^>]*>([\s\S]*?)<\/TR\s*>/gi)].map((m,ri)=>({number:ri+1,cells:[...m[1].matchAll(/<(TD|TH|TE|TU)(?=[\s>])([^>]*)>([\s\S]*?)<\/\1\s*>/gi)].map(c=>({value:text(c[3]),nested:c[3].includes('<NESTED-TABLE/>'),span:Math.max(1,Number(c[2].match(/COLSPAN\s*=\s*["']?(\d+)/i)?.[1]||1)),rowspan:Math.max(1,Number(c[2].match(/ROWSPAN\s*=\s*["']?(\d+)/i)?.[1]||1))}))}))});
 });
}
module.exports={parseTables,expandReasons};
