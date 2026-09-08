'use strict';
const fs = require('node:fs'), path = require('node:path');
const VERSION = '20260908-email-link1';
function replace(text, before, after) {
  if (!text.includes(before)) throw new Error('Auth-link integration anchor missing: ' + before.slice(0,100));
  return text.replace(before, after);
}
function account(text) {
  if (text.includes('// NEWS_EMAIL_LINK_PKCE_V1')) return text;
  let s = replace(text, "const Core = require('../news-reader-core');", "const Core = require('../news-reader-core');\nconst Link = require('./news-auth-link'); // NEWS_EMAIL_LINK_PKCE_V1");
  s = s.replaceAll("['send-code','verify-code','logout']", "['send-code','verify-code','finish-link','logout']");
  s = replace(s, "const ACTIONS = new Set(['status','records','send-code','verify-code','logout']);", "const ACTIONS = new Set(['status','records','send-code','verify-code','finish-link','logout']);");
  s = replace(s, "   if(action==='send-code'){", "   if(action==='finish-link')return await Link.finish(req,res,{cfg,requestBody,allowedFields,cookieJar,COOKIE,unseal,now,remote,rateLimit,authenticatedUser,setSession,RequestError});\n   if(action==='send-code'){");
  s = replace(s, "const sent=await remote('/auth/v1/otp',{method:'POST',body:{email,create_user:true}});", "const pendingCookie=seal(cfg,email,now()),flow=Link.prepare(req,cfg,pendingCookie);\n    const sent=await remote('/auth/v1/otp?redirect_to='+encodeURIComponent(flow.callback),{method:'POST',body:{email,create_user:true,code_challenge:flow.code_challenge,code_challenge_method:flow.code_challenge_method}});");
  s = replace(s, "cookie(res,COOKIE.pending,seal(cfg,email,now()),900);", "cookie(res,COOKIE.pending,pendingCookie,900);");
  s = replace(s, "메일의 인증번호를 입력하세요. 번호 없이 링크만 있으면 링크 주소를 복사해 붙여넣으세요.", "인증 메일의 로그인 링크를 눌러 주세요. 메일을 요청한 브라우저에서 열면 로그인 후 뉴스로 돌아옵니다. 인증번호를 입력하는 방법도 그대로 사용할 수 있습니다.");
  return s;
}
function instructions(text) {
  return text.replaceAll('메일에 번호 없이 링크만 있으면 링크를 누르지 말고 링크 주소를 복사해 붙여넣으세요. 인증번호·링크를 다른 사람과 공유하지 마세요.', '메일의 로그인 링크를 누르세요. 메일을 요청한 브라우저에서 열어야 합니다. 인증번호가 있으면 직접 입력할 수도 있습니다. 인증번호·링크를 공유하지 마세요.')
    .replaceAll('번호 없이 링크만 오면 링크를 누르지 말고 주소를 복사해 붙여넣으세요. 인증번호와 링크는 다른 사람에게 보내지 마세요.', '메일의 로그인 링크를 누르세요. 메일을 요청한 브라우저에서 열어야 합니다. 인증번호가 있으면 직접 입력해도 됩니다. 인증번호와 링크는 공유하지 마세요.')
    .replaceAll('번호 없이 링크만 있으면 링크를 누르지 말고 링크 주소를 복사해 붙여넣으세요.', '메일의 로그인 링크를 누르세요. 메일을 요청한 브라우저에서 열어 주세요.');
}
function page(text) {
  // Handle known auth returns before any external resources run.
  if (!text.includes('/auth/return-guard.js?')) text = text.replace(/<head>/i, '<head><meta name="referrer" content="no-referrer"><script src="/auth/return-guard.js?v='+VERSION+'"></script>');
  return text.replace(/(<script\b[^>]*src=")(\/news-reader\.js|\/site-header\.js)([^\"]*)(")/g, (all,a,p,q,z) => q.includes('emailLink=')?all:a+p+q+(q.includes('?')?'&':'?')+'emailLink='+VERSION+z);
}
function config(value) {
  const next=JSON.parse(JSON.stringify(value));
  next.headers = (next.headers||[]).filter(x=>!['/auth/:path*'].includes(x.source));
  next.headers.push({source:'/auth/:path*',headers:[
    {key:'Cache-Control',value:'no-store, max-age=0'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Content-Security-Policy',value:"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}
  ]});
  return next;
}
function main(root=path.resolve(__dirname,'..')) {
  const targets=[['lib/news-reader-account.js',account],['news-reader.js',instructions],['site-header.js',instructions]];
  for (const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))) targets.push([file,page]);
  for(const[file,transform]of targets) {const p=path.join(root,file),before=fs.readFileSync(p,'utf8'),after=transform(before);if(before!==after)fs.writeFileSync(p,after);}
  const p=path.join(root,'vercel.json'),before=fs.readFileSync(p,'utf8'),after=JSON.stringify(config(JSON.parse(before)),null,2)+'\n';if(before!==after)fs.writeFileSync(p,after);
}
if(require.main===module)main();
module.exports={account,page,config,instructions,main};
