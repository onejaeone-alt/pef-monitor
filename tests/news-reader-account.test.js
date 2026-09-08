const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../lib/news-reader-account');
const env={SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_SECRET_KEY:'test-server-secret',SUPABASE_PUBLISHABLE_KEY:'test-public-key'};
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const user={id,email:'a@example.invalid',role:'authenticated',email_confirmed_at:'2026-09-08T00:00:00Z',is_anonymous:false};
const headers={host:'ainobi.news',origin:'https://ainobi.news','x-news-reader':'1','content-type':'application/json','x-reader-user':id,cookie:A.COOKIE.access+'=access-a'};
function response(){return {headers:{},code:0,body:null,setHeader(k,v){this.headers[k.toLowerCase()]=v;},getHeader(k){return this.headers[k.toLowerCase()];},removeHeader(k){delete this.headers[k.toLowerCase()];},status(n){this.code=n;return this;},json(x){this.body=x;return this;}};}
function setup(overrides={}){
 const calls=[];const fetcher=async(url,opt)=>{calls.push({url,opt});const p=new URL(url).pathname;let status=200,data;
  if(p==='/rest/v1/rpc/news_reader_ready')data=overrides.ready??true;
  else if(p==='/rest/v1/rpc/news_reader_allow')data=overrides.rate??true;
  else if(p==='/auth/v1/user'){if(overrides.unauthorized||(!overrides.refresh&&opt.headers.Authorization!=='Bearer access-a')){status=401;data={};}else data=overrides.user||user;}
  else if(p==='/auth/v1/otp'){status=overrides.sendStatus||200;data=overrides.sendData||{};}
  else if(p==='/auth/v1/verify')data={access_token:'access-a',refresh_token:'refresh-a',expires_in:3600};
  else if(p==='/auth/v1/token')data={access_token:'renewed-a',refresh_token:'renewed-refresh-a',expires_in:3600};
  else if(p==='/auth/v1/logout')data={};
  else if(p==='/rest/v1/rpc/news_reader_context')data=overrides.context||{user_id:id,role:'authenticated'};
  else if(p==='/rest/v1/news_reader_records')data=overrides.records||[];
  else if(p==='/rest/v1/rpc/news_reader_patch'){if(overrides.conflict){status=409;data={code:'40001'};}else data=JSON.parse(opt.body).p_changes.map(x=>({kind:x.kind,record_key:x.record_key,version:x.expected_version+1}));}
  else throw Error('Unexpected URL '+p);
  if(overrides.network)throw Error('test network failed');
  return {ok:status>=200&&status<300,status,json:async()=>data};};
 const handler=A.createHandler({fetcher,env});
 return {calls,async run(action,method='GET',body,extra={}){const res=response();await handler({query:{reader:action,...extra.query},method,headers:{...headers,...extra.headers},body},res);return res;}};
}
const bookmark={kind:'bookmark',key:'https://example.invalid/article',value:{article:{title:'test'}},expected_version:0};
test('status validates identity without exposing tokens',async()=>{const s=setup(),r=await s.run('status');assert.equal(r.code,200);assert.equal(r.body.user.id,id);assert.ok(!JSON.stringify(r.body).includes('access-a'));});
test('every personal response is private no-store, without wildcard CORS',async()=>{const r=await setup().run('status');for(const h of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.match(r.headers[h],/no-store/);assert.equal(r.headers['access-control-allow-origin'],undefined);});
test('anonymous cannot fetch personal records',async()=>{const s=setup(),r=await s.run('records','GET',undefined,{headers:{cookie:''}});assert.equal(r.code,401);assert.ok(!s.calls.some(x=>x.url.includes('/news_reader_records?')));});
test('unverified email is rejected',async()=>{const r=await setup({user:{...user,email_confirmed_at:null}}).run('records');assert.equal(r.code,401);});
test('anonymous auth user is rejected',async()=>{const r=await setup({user:{...user,is_anonymous:true}}).run('records');assert.equal(r.code,401);});
test('invalid access cookie is not trusted',async()=>{const r=await setup({unauthorized:true}).run('records');assert.equal(r.code,401);});
test('cross-account browser header cannot select a different owner',async()=>{const s=setup(),r=await s.run('records','GET',null,{headers:{'x-reader-user':other}});assert.equal(r.code,409);assert.ok(!s.calls.some(x=>x.url.includes('/news_reader_records?')));});
test('record GET scopes owner and uses user JWT rather than service role',async()=>{const s=setup();await s.run('records');const c=s.calls.find(x=>x.url.includes('/news_reader_records?'));assert.match(c.url,new RegExp('user_id=eq.'+id));assert.equal(c.opt.headers.Authorization,'Bearer access-a');assert.equal(c.opt.headers.apikey,'test-public-key');});
test('caller-supplied owner ID is rejected',async()=>{const s=setup(),r=await s.run('records','POST',{changes:[bookmark],user_id:other});assert.equal(r.code,400);});
test('cross-origin POST rejected before network',async()=>{const s=setup(),r=await s.run('records','POST',{changes:[bookmark]},{headers:{origin:'https://attacker.invalid'}});assert.equal(r.code,403);assert.equal(s.calls.length,0);});
test('missing anti-CSRF header rejected',async()=>{const r=await setup().run('logout','POST',{}, {headers:{'x-news-reader':undefined}});assert.equal(r.code,403);});
test('state-changing GETs rejected',async()=>{for(const action of ['send-code','verify-code','logout'])assert.equal((await setup().run(action)).code,405);});
test('valid save is versioned, sanitized and owner-free RPC',async()=>{const s=setup(),r=await s.run('records','POST',{changes:[{...bookmark,value:{notes:'secret',article:{title:'test',phone:'private'}}}]});assert.equal(r.code,200);const c=s.calls.find(x=>x.url.endsWith('/news_reader_patch'));assert.equal(c.opt.headers.Authorization,'Bearer access-a');const json=JSON.parse(c.opt.body);assert.equal(json.p_changes[0].user_id,undefined);assert.equal(JSON.stringify(json).includes('secret'),false);assert.equal(r.body.records[0].version,1);});
test('version conflicts are not reported as successful saves',async()=>{const r=await setup({conflict:true}).run('records','POST',{changes:[bookmark]});assert.equal(r.code,409);assert.equal(r.body.ok,false);});
test('tombstone retains key for later version-safe restore',async()=>{const r=await setup().run('records','POST',{changes:[{...bookmark,value:null,expected_version:2}]});assert.equal(r.body.records[0].value,null);assert.equal(r.body.records[0].key,bookmark.key);assert.equal(r.body.records[0].version,3);});
test('unversioned, duplicated or invalid classification writes rejected',async()=>{const rows=[[{...bookmark,expected_version:undefined}],[bookmark,bookmark],[{...bookmark,kind:'override',value:{category:'made-up'}}]];for(const changes of rows)assert.equal((await setup().run('records','POST',{changes})).code,400);});
test('executable article URLs rejected',async()=>assert.equal((await setup().run('records','POST',{changes:[{...bookmark,key:'javascript:alert(1)'}]})).code,400));
test('challenge signature and expiry checked',()=>{const cfg=A.configuration(env),x=A.seal(cfg,user.email,1000);assert.equal(A.unseal(cfg,x,2000).email,user.email);assert.equal(A.unseal(cfg,x+'x',2000),null);assert.equal(A.unseal(cfg,x,1000000),null);});
test('no email request means no OTP login',async()=>assert.equal((await setup().run('verify-code','POST',{email:user.email,code:'123456'})).code,401));
test('code verification bound to requested email and browser',async()=>{const cfg=A.configuration(env);const r=await setup().run('verify-code','POST',{email:'b@example.invalid',code:'123456'},{headers:{cookie:A.COOKIE.pending+'='+A.seal(cfg,user.email)}});assert.equal(r.code,401);});
test('OTP success sets HttpOnly secure cookies but never returns tokens',async()=>{const cfg=A.configuration(env),r=await setup().run('verify-code','POST',{email:user.email,code:'123456'},{headers:{cookie:A.COOKIE.pending+'='+A.seal(cfg,user.email)}});assert.equal(r.code,200);const cookies=r.headers['set-cookie'];assert.ok(cookies.every(x=>x.includes('Secure; HttpOnly; SameSite=Strict')));assert.ok(!JSON.stringify(r.body).includes('access_token'));});
test('link verification allows only exact Supabase host, no link fetch',()=>{const cfg=A.configuration(env),hash='a'.repeat(64);assert.deepEqual(A.verificationInput(cfg,user.email,cfg.url+'/auth/v1/verify?token='+hash+'&type=magiclink'),{token_hash:hash,type:'magiclink'});assert.throws(()=>A.verificationInput(cfg,user.email,'https://evil.invalid/auth/v1/verify?token='+hash+'&type=magiclink'));});
test('email send uses short-lived bound cookie and shared rate limit',async()=>{const s=setup(),r=await s.run('send-code','POST',{email:user.email});assert.equal(r.code,200);assert.match(r.headers['set-cookie'][0],/__Host-news_pending=/);assert.equal(s.calls.filter(x=>x.url.endsWith('/news_reader_allow')).length,2);assert.ok(s.calls.every(x=>!x.url.includes(user.email)));});
test('mail service restriction is reported, never bypassed',async()=>{const r=await setup({sendStatus:400,sendData:{error_code:'email_address_not_authorized'}}).run('send-code','POST',{email:user.email});assert.equal(r.code,503);assert.match(r.body.error,/발송 설정/);assert.equal(r.headers['set-cookie'],undefined);});
test('shared rate limit failure blocks sending',async()=>{const s=setup({rate:false}),r=await s.run('send-code','POST',{email:user.email});assert.equal(r.code,429);assert.ok(!s.calls.some(x=>x.url.endsWith('/otp')));});
test('logout clears every account cookie',async()=>{const r=await setup().run('logout','POST',{});assert.equal(r.code,200);assert.equal(r.headers['set-cookie'].length,3);assert.ok(r.headers['set-cookie'].every(x=>x.includes('Max-Age=0')));});
test('network failures fail closed',async()=>{const r=await setup({network:true}).run('records');assert.equal(r.code,503);assert.equal(r.body.ok,false);});
test('unconfigured deployment never enables account storage',async()=>{const handler=A.createHandler({env:{},fetcher:()=>{throw Error('unexpected');}}),r=response();await handler({query:{reader:'status'},method:'GET',headers:{}},r);assert.equal(r.body.ready,false);assert.equal(r.body.user,null);});
test('elevated database context is rejected even after a valid user identity',async()=>{const s=setup({context:{user_id:id,role:'service_role'}}),r=await s.run('records');assert.equal(r.code,503);assert.ok(!s.calls.some(x=>x.url.includes('/news_reader_records?')));});
test('source has no embedded project API credentials',()=>{const s=require('node:fs').readFileSync(require.resolve('../lib/news-reader-account'),'utf8');assert.ok(!/sb_(?:publishable|secret)_[a-zA-Z0-9_-]{10,}/.test(s));});
