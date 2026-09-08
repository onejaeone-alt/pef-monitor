const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const L=require('../lib/news-auth-link'),I=require('../scripts/integrate-auth-link');
const cfg={service:'fixture-secret-only'},req={headers:{host:'ainobi.news'},body:{code:'f'.repeat(32)}};
const user={id:'11111111-1111-4111-8111-111111111111',email:'person@example.invalid',email_confirmed_at:'2026-09-08',role:'authenticated'};
class RequestError extends Error{constructor(status,message){super(message);this.status=status;}}
function setup({pending={email:user.email},who=user,exchangeStatus=200,userStatus=200,rate=true}={}){
 const calls=[],cookies=[];const res={status(n){this.code=n;return this;},json(x){this.body=x;return this;}};
 const ctx={cfg,COOKIE:{pending:'pending'},cookieJar:()=>({pending:'signed-cookie'}),unseal:()=>pending,now:Date.now,
 requestBody:r=>r.body,allowedFields:(b,fields)=>{if(Object.keys(b).some(x=>!fields.includes(x)))throw new RequestError(400,'fields');},
 rateLimit:async(...args)=>{calls.push({rate:args});if(!rate)throw new RequestError(429,'rate');},
 remote:async(path,options)=>{calls.push({path,options});const token=path.includes('grant_type=pkce');const status=token?exchangeStatus:userStatus;
 return {ok:status<300,status,data:token?{access_token:'fixture-access',refresh_token:'fixture-refresh'}:who};},
 authenticatedUser:u=>!!u.email_confirmed_at&&u.role==='authenticated'&&!u.is_anonymous,
 setSession:(r,d)=>cookies.push(d),RequestError};
 return {calls,cookies,res,run:(r=req)=>L.finish(r,res,ctx)};
}
test('explicit production callback has no localhost fallback',()=>assert.equal(L.callbackURL(req),'https://ainobi.news/auth/callback.html'));
test('known aliases preserve original cookie origin',()=>assert.equal(L.callbackURL({headers:{host:'www.ainobi.news'}}),'https://www.ainobi.news/auth/callback.html'));
test('reject unknown host and host-header redirect injection',()=>{for(const host of ['localhost:3000','attacker.invalid','ainobi.news@evil.invalid','ainobi.news/else','ainobi.news:80'])assert.throws(()=>L.callbackURL({headers:{host}}));});
test('PKCE uses 43-char random-context-dependent verifier and SHA256',()=>{const a=L.prepare(req,cfg,'signed-cookie');const v=L.verifier(cfg,'signed-cookie',a.callback);assert.equal(v.length,43);assert.equal(a.code_challenge,crypto.createHash('sha256').update(v).digest('base64url'));assert.equal(a.code_challenge_method,'s256');assert.notEqual(L.prepare(req,cfg,'other-cookie').code_challenge,a.code_challenge);assert.ok(!JSON.stringify(a).includes(v));});
test('verifier is bound to origin and server secret',()=>{const a=L.prepare(req,cfg,'same');assert.notEqual(L.prepare({headers:{host:'www.ainobi.news'}},cfg,'same').code_challenge,a.code_challenge);assert.notEqual(L.prepare(req,{service:'other-secret'},'same').code_challenge,a.code_challenge);});
test('link verifies PKCE, then managed user before cookie write',async()=>{const s=setup();await s.run();assert.equal(s.res.code,200);assert.equal(s.cookies.length,1);assert.equal(s.calls[1].path,'/auth/v1/token?grant_type=pkce');assert.equal(s.calls[1].options.body.auth_code,req.body.code);assert.equal(s.calls[2].path,'/auth/v1/user');assert.equal(s.calls[2].options.token,'fixture-access');assert.ok(!JSON.stringify(s.res.body).includes('fixture-access'));});
test('missing or expired requesting browser cannot exchange',async()=>{const s=setup({pending:null});await assert.rejects(s.run(),e=>e.status===401);assert.equal(s.calls.length,0);assert.equal(s.cookies.length,0);});
test('different email cannot obtain session',async()=>{const s=setup({who:{...user,email:'different@example.invalid'}});await assert.rejects(s.run(),e=>e.status===401);assert.equal(s.cookies.length,0);});
test('unverified email and anonymous account cannot obtain session',async()=>{for(const who of [{...user,email_confirmed_at:null},{...user,is_anonymous:true},{...user,role:'service_role'}]){const s=setup({who});await assert.rejects(s.run(),e=>e.status===401);assert.equal(s.cookies.length,0);}});
test('expired authorization code returns error without setting session',async()=>{const s=setup({exchangeStatus:400});await assert.rejects(s.run(),e=>e.status===401);assert.equal(s.cookies.length,0);assert.ok(!s.calls.some(c=>c.path==='/auth/v1/user'));});
test('unavailable auth server is never a successful login',async()=>{for(const status of [429,500]){const s=setup({exchangeStatus:status});await assert.rejects(s.run(),e=>e.status===503);assert.equal(s.cookies.length,0);}});
test('identity server failure sets no cookies',async()=>{const s=setup({userStatus:503});await assert.rejects(s.run(),e=>e.status===503);assert.equal(s.cookies.length,0);});
test('rate limits apply before exchanging',async()=>{const s=setup({rate:false});await assert.rejects(s.run(),e=>e.status===429);assert.ok(!s.calls.some(c=>c.path));});
test('arbitrary session tokens and redirects cannot be submitted',async()=>{for(const body of [{...req.body,access_token:'input'},{...req.body,user_id:user.id},{...req.body,redirect_to:'https://evil.invalid'}])await assert.rejects(setup().run({...req,body}),e=>e.status===400);});
test('malformed auth codes never reach upstream',async()=>{for(const code of ['',null,'x'.repeat(3000),'<script>bad</script>']){const s=setup();await assert.rejects(s.run({...req,body:{code}}),e=>e.status===400);assert.equal(s.calls.length,0);}});
test('entrypoint executes before external page resources; no duplicate injection',()=>{const html='<html><head><title>T</title><link href="https://fonts.example.invalid"></head><body><script src="/news-reader.js?v=old"></script></body></html>';const x=I.page(html);assert.equal(I.page(x),x);assert.ok(x.indexOf('return-guard')<x.indexOf('fonts.example'));assert.match(x,/emailLink=/);});
test('callback has no external assets, inputs or private-cache storage',()=>{const html=fs.readFileSync('auth/callback.html','utf8'),js=fs.readFileSync('auth/callback.js','utf8');assert.doesNotMatch(html,/(?:src|href)="https?:/);assert.doesNotMatch(js,/localStorage|sessionStorage|console\./);assert.ok(js.indexOf('history.replaceState')<js.indexOf('fetch('));assert.match(html,/no-referrer/);});
test('callback security headers preserve existing routes and schedules',()=>{const c={functions:{'api/news.js':{maxDuration:60}},rewrites:[{source:'/x',destination:'/y'}],crons:[{path:'/api/public',schedule:'0 0 * * *'}]};const x=I.config(c);assert.deepEqual(x.functions,c.functions);assert.deepEqual(x.rewrites,c.rewrites);assert.deepEqual(x.crons,c.crons);assert.deepEqual(I.config(x),x);assert.match(JSON.stringify(x.headers),/no-store/);});
test('updated instructions support clicks and do not ask for sharing credentials',()=>{const old='번호 없이 링크만 오면 링크를 누르지 말고 주소를 복사해 붙여넣으세요. 인증번호와 링크는 다른 사람에게 보내지 마세요.';const s=I.instructions(old);assert.match(s,/로그인 링크를 누르세요/);assert.doesNotMatch(s,/누르지 말고/);});
test('all new scripts parse',()=>{for(const p of ['auth/callback.js','auth/return-guard.js','lib/news-auth-link.js','scripts/integrate-auth-link.js'])assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(p,'utf8')));});
