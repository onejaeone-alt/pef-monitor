'use strict';
// Keep parent table structure; never splice a child table into a parent cell.
function parseTables(markup,text){
  const stack=[],found=[];
  for(const m of markup.matchAll(/<\/?TABLE(?=[\s>])[^>]*>/gi)){
    if(!/^<\//.test(m[0]))stack.push({start:m.index,at:m.index+m[0].length,children:[]});
    else if(stack.length){const t=stack.pop();t.end=m.index;t.close=m.index+m[0].length;found.push(t);if(stack.length)stack[stack.length-1].children.push([t.start,t.close]);}
  }
  return found.sort((a,b)=>a.start-b.start).map((t,ti)=>{
    let html='',cursor=t.at;for(const [start,end] of t.children){html+=markup.slice(cursor,start)+'<NESTED-TABLE/>';cursor=end;}html+=markup.slice(cursor,t.end);
    return {number:ti+1,start:t.start,end:t.close,rows:[...html.matchAll(/<TR(?=[\s>])[^>]*>([\s\S]*?)<\/TR\s*>/gi)].map((m,ri)=>({number:ri+1,cells:[...m[1].matchAll(/<(TD|TH|TE|TU)(?=[\s>])([^>]*)>([\s\S]*?)<\/\1\s*>/gi)].map(c=>({value:text(c[3]),nested:c[3].includes('<NESTED-TABLE/>'),span:Math.max(1,Number(c[2].match(/COLSPAN\s*=\s*["']?(\d+)/i)?.[1]||1)),rowspan:Math.max(1,Number(c[2].match(/ROWSPAN\s*=\s*["']?(\d+)/i)?.[1]||1))}))}))};
  });
}
module.exports={parseTables};
