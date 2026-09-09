const fs=require('node:fs');
const path=require('node:path');
function main(root=path.resolve(__dirname,'..')){
 const p=path.join(root,'index.html'),before=fs.readFileSync(p,'utf8');
 const after=before.replace(/((?:src|href)="\/(?:news-reader(?:-core)?\.js|news-reader\.css|news-taxonomy\.js)[^"]*)"/g,(_,asset)=>asset.replace(/&foreign=[^&"]*/g,'')+'&foreign=20260909-ko2"');
 if(before!==after)fs.writeFileSync(p,after);
}
if(require.main===module)main();module.exports={main};
