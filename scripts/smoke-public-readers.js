'use strict';
// Preview-only smoke check of a public publisher URL. Never log bodies or credentials.
const fs=require('node:fs');
(async()=>{const marker='/tmp/ib-publisher-smoke-bom';if(fs.existsSync(marker))return;fs.writeFileSync(marker,'run');const S=require('../lib/preflight-sources');const title='젠엑시스, 모태펀드 ‘창업초기 소형’ 운용사 선정…씨엔티테크와 공동 운용';const d=await S.readDocument({url:'https://news.google.com/rss/articles/CBMiSEFVX3lxTE1kVi1VOHI2QlJMZUd0aEJoaGJ3T2xJcjVQaWczR1R3ZUZ6ekZ0QVRUc3hrN0ZMRkRYeDQteWVBOE96elZYZEJKbQ?oc=5',title,source_name:'플래텀(Platum)'},Date.now()+18000);console.log('PUBLISHER_SMOKE '+JSON.stringify({ok:d.read_ok,url:d.url,error:d.read_error,characters:d.text?.length,attempts:d.attempts}));})().catch(e=>console.log('PUBLISHER_SMOKE '+JSON.stringify({error:e.name})));
