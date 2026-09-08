'use strict';
const fs=require('node:fs');
(async()=>{const marker='/tmp/ib-publisher-smoke-3';if(fs.existsSync(marker))return;fs.writeFileSync(marker,'run');const S=require('../lib/preflight-sources');
for(const q of ['젠엑시스 모태펀드 창업초기 운용사','젠엑시스 모태펀드']){
const url='https://platum.kr/wp-json/wp/v2/posts?'+new URLSearchParams({search:q,per_page:'8',_fields:'link,title'});
try{const r=await S.boundedFetch(url,{deadline:Date.now()+6000,maxBytes:150000});const data=JSON.parse(r.buffer.toString('utf8'));console.log('PUBLISHER_DIAGNOSTIC '+JSON.stringify({query:q,type:r.contentType,list:Array.isArray(data),items:Array.isArray(data)?data.map(p=>({link:p.link,title:p.title?.rendered})):null}));}catch(e){console.log('PUBLISHER_DIAGNOSTIC '+JSON.stringify({query:q,error:e.message}));}
}
})().catch(e=>console.log('PUBLISHER_DIAGNOSTIC '+JSON.stringify({error:e.message})));
