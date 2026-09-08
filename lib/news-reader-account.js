'use strict';
// Managed authentication. API credentials are read from server settings, never source control.
const crypto = require('node:crypto');
const Core = require('../news-reader-core');
const COOKIE = { access:'__Host-news_access', refresh:'__Host-news_refresh', pending:'__Host-news_pending' };
const ACTIONS = new Set(['status','records','send-code','verify-code','logout']);
const CATEGORIES = new Set(['lp_selection','fund_formation','deal','investment_exit','credit','people','policy','review']);
class RequestError extends Error { constructor(status,message){super(message);this.status=status;} }
function configuration(env=process.env) {
 const url=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 return {url, service:env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'',
  public:env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'',
  enabled:env.NEWS_READER_AUTH_ENABLED!=='0'};
}
function responseHeaders(res){
 for(const [k,v] of Object.entries({'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}))res.setHeader(k,v);
 res.removeHeader?.('Access-Control-Allow-Origin');
}
function cookieJar(req){const out=Object.create(null);for(const part of String(req.headers?.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}return out;}
function cookie(res,name,value,seconds){
 if(!/^[A-Za-z0-9_.-]*$/.test(value)||value.length>3800)throw new Error('Invalid cookie');
 const existing=res.getHeader?.('Set-Cookie')||[];
 res.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:[existing]),`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor(seconds))}`]);
}
function clearSession(res){for(const name of Object.values(COOKIE))cookie(res,name,'',0);}
function setSession(res,data){
 if(!data?.access_token||!data?.refresh_token)throw new Error('Missing session');
 cookie(res,COOKIE.access,data.access_token,Math.min(3600,Math.max(60,Number(data.expires_in)||3600)));
 cookie(res,COOKIE.refresh,data.refresh_token,7*86400);cookie(res,COOKIE.pending,'',0);
}
function sameOrigin(req){try{const origin=new URL(String(req.headers?.origin||''));return origin.protocol==='https:'&&origin.host===String(req.headers?.host||'')&&req.headers?.['sec-fetch-site']!=='cross-site'&&req.headers?.['x-news-reader']==='1';}catch{return false;}}
function signingKey(cfg){return crypto.createHmac('sha256',cfg.service).update('news-reader-email-challenge-v1').digest();}
function seal(cfg,email,now=Date.now()){
 const text=Buffer.from(JSON.stringify({email,expires:now+15*60000,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');
 return text+'.'+crypto.createHmac('sha256',signingKey(cfg)).update(text).digest('base64url');
}
function unseal(cfg,value,now=Date.now()){
 try{const [text,sig,extra]=String(value||'').split('.');if(extra||!text||!sig)return null;const expected=crypto.createHmac('sha256',signingKey(cfg)).update(text).digest();const given=Buffer.from(sig,'base64url');if(given.length!==expected.length||!crypto.timingSafeEqual(given,expected))return null;const data=JSON.parse(Buffer.from(text,'base64url'));return data.expires>now&&typeof data.email==='string'?data:null;}catch{return null;}
}
function emailAddress(value){const text=String(value||'').trim().toLowerCase();if(text.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))throw new RequestError(400,'이메일 주소를 확인해 주세요.');return text;}
function verificationInput(cfg,email,input){
 const value=String(input||'').trim();
 if(/^\d{6,10}$/.test(value))return {email,token:value,type:'email'};
 try{const u=new URL(value);if(u.origin!==cfg.url||u.pathname!=='/auth/v1/verify'||u.username||u.password)throw 0;const hash=u.searchParams.get('token');const type=u.searchParams.get('type');if(!hash||!/^[A-Za-z0-9_-]{32,128}$/.test(hash)||!['magiclink','signup','email','invite'].includes(type))throw 0;return {token_hash:hash,type};}catch{throw new RequestError(400,'메일의 인증번호 또는 Supabase 로그인 링크를 입력해 주세요.');}
}
function requestBody(req){
 if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))throw new RequestError(415,'JSON 요청만 허용합니다.');
 try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>180000)throw 0;return body;}catch{throw new RequestError(400,'입력 내용을 확인해 주세요.');}
}
function allowedFields(body,fields){if(Object.keys(body).some(k=>!fields.includes(k)))throw new RequestError(400,'지원하지 않는 입력 항목입니다.');}
function digest(key){return crypto.createHash('sha256').update(key).digest('hex');}
function authenticatedUser(value){return value&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.id||'')&&value.email_confirmed_at&&value.email&&!value.is_anonymous&&value.role==='authenticated';}
function createHandler({fetcher=globalThis.fetch,env=process.env,now=Date.now}={}){
 const cfg=configuration(env);
 async function remote(path,{service=false,token,method='GET',body}={}){
  if(!cfg.url.startsWith('https://')||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url))throw new Error('Invalid auth host');
  // The verified user JWT sets the database role. Refuse personal requests without it.
  const personal=path.startsWith('/rest/v1/news_reader_records')||path.startsWith('/rest/v1/rpc/news_reader_patch')||path.startsWith('/rest/v1/rpc/news_reader_context');
  if(personal&&(!token||service||token===cfg.service||token===cfg.public))throw new Error('User-scoped credential required');
  const key=service?cfg.service:cfg.public;
  const headers={apikey:key,'Content-Type':'application/json'};
  if(token)headers.Authorization='Bearer '+token;else if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
  const r=await fetcher(cfg.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000),cache:'no-store'});
  let data=null;try{data=await r.json();}catch{}
  return {ok:r.ok,status:r.status,data};
 }
 async function ready(){if(!cfg.enabled||!cfg.url||!cfg.service||!cfg.public)return false;const r=await remote('/rest/v1/rpc/news_reader_ready',{method:'POST',body:{}});return r.ok&&r.data===true;}
 async function rateLimit(scope,value,max,seconds){
  const bucket=crypto.createHmac('sha256',signingKey(cfg)).update(scope+'|'+value).digest('hex');
  const r=await remote('/rest/v1/rpc/news_reader_allow',{service:true,method:'POST',body:{p_bucket:bucket,p_max:max,p_seconds:seconds}});
  if(!r.ok)throw new RequestError(503,'인증 요청을 점검하지 못했습니다. 다시 시도해 주세요.');
  if(r.data!==true)throw new RequestError(429,'인증 요청이 잦습니다. 잠시 뒤 다시 시도해 주세요.');
 }
 async function identity(req,res){
  const jar=cookieJar(req);let token=jar[COOKIE.access];let r=token?await remote('/auth/v1/user',{token}):null;
  if((!r||r.status===401||r.status===403)&&jar[COOKIE.refresh]){
   const renewed=await remote('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:jar[COOKIE.refresh]}});
   if(renewed.status>=500||renewed.status===429)throw new RequestError(503,'로그인 상태를 확인하지 못했습니다.');
   if(!renewed.ok){clearSession(res);return null;}
   token=renewed.data?.access_token;r=token?await remote('/auth/v1/user',{token}):null;
   if(r?.ok&&authenticatedUser(r.data))setSession(res,renewed.data);
  }
  if(!r)return null;if(r.status>=500||r.status===429)throw new RequestError(503,'로그인 상태를 확인하지 못했습니다.');
  if(!r.ok||!authenticatedUser(r.data)){clearSession(res);return null;}
  return {id:r.data.id,email:r.data.email,token};
 }
 async function handle(req,res){
  responseHeaders(res);const action=String(req.query?.reader||''),method=req.method||'GET';
  const fail=(code,message)=>res.status(code).json({ok:false,error:message});
  if(!ACTIONS.has(action))return fail(404,'지원하지 않는 계정 요청입니다.');
  if(!['GET','POST'].includes(method)||(action==='status'&&method!=='GET')||(['send-code','verify-code','logout'].includes(action)&&method!=='POST'))return fail(405,'허용되지 않은 요청입니다.');
  if(method==='POST'&&!sameOrigin(req))return fail(403,'사이트 안에서 다시 요청해 주세요.');
  try{
   if(action==='logout'){
    const token=cookieJar(req)[COOKIE.access];let revoked=false;
    try{if(token&&cfg.url&&cfg.public)revoked=(await remote('/auth/v1/logout?scope=local',{token,method:'POST'})).ok;}catch{}
    clearSession(res);return res.status(200).json({ok:true,server_revoked:revoked});
   }
   if(!await ready())return res.status(action==='status'?200:503).json({ok:action==='status',ready:false,user:null,error:'계정 저장소 설정을 확인해야 합니다.'});
   if(action==='send-code'){
    const body=requestBody(req);allowedFields(body,['email']);const email=emailAddress(body.email);
    const ip=String(req.headers?.['x-real-ip']||req.headers?.['x-forwarded-for']||'unknown').split(',')[0];
    await rateLimit('email-send',email,1,60);await rateLimit('ip-send',ip,5,600);
    const sent=await remote('/auth/v1/otp',{method:'POST',body:{email,create_user:true}});
    if(!sent.ok){const code=sent.data?.error_code||sent.data?.code;if(code==='email_address_not_authorized')return fail(503,'인증 메일 발송 설정이 필요합니다. 현재 기본 발송 서비스는 프로젝트 팀에 등록한 주소로만 보낼 수 있습니다.');return fail(sent.status===429?429:503,'인증 메일을 보내지 못했습니다. 재요청 간격 또는 메일 발송 설정을 확인해 주세요.');}
    cookie(res,COOKIE.pending,seal(cfg,email,now()),900);
    return res.status(200).json({ok:true,message:'메일의 인증번호를 입력하세요. 번호 없이 링크만 있으면 링크 주소를 복사해 붙여넣으세요.'});
   }
   if(action==='verify-code'){
    const body=requestBody(req);allowedFields(body,['email','code']);const email=emailAddress(body.email);
    const pending=unseal(cfg,cookieJar(req)[COOKIE.pending],now());if(!pending||pending.email!==email)return fail(401,'이 브라우저에서 인증 메일을 먼저 요청해 주세요.');
    await rateLimit('email-verify',email,8,900);
    const payload=verificationInput(cfg,email,body.code);
    const verified=await remote('/auth/v1/verify',{method:'POST',body:payload});
    if(!verified.ok||!verified.data?.access_token)return fail(401,'인증번호 또는 링크가 일치하지 않거나 만료됐습니다.');
    const user=await remote('/auth/v1/user',{token:verified.data.access_token});
    if(!user.ok||!authenticatedUser(user.data)||user.data.email.toLowerCase()!==email)return fail(401,'요청한 이메일의 소유권을 확인하지 못했습니다.');
    setSession(res,verified.data);return res.status(200).json({ok:true,user:{id:user.data.id,email:user.data.email}});
   }
   const user=await identity(req,res);
   if(action==='status')return res.status(200).json({ok:true,ready:true,user:user?{id:user.id,email:user.email}:null});
   if(!user)return fail(401,'로그인해야 개인 기록을 볼 수 있습니다.');
   if(req.headers?.['x-reader-user']!==user.id)return fail(409,'로그인 계정이 바뀌었습니다. 다시 로그인 상태를 확인해 주세요.');
   const context=await remote('/rest/v1/rpc/news_reader_context',{token:user.token,method:'POST',body:{}});
   if(!context.ok||context.data?.user_id!==user.id||context.data?.role!=='authenticated')throw new Error('User database context missing');
   if(method==='GET'){
    const offset=Number(req.query?.offset||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return fail(400,'조회 범위를 확인해 주세요.');
    const path='/rest/v1/news_reader_records?user_id=eq.'+encodeURIComponent(user.id)+'&select=kind,record_key,value,version&order=kind.asc,record_key.asc&limit=500&offset='+offset;
    const result=await remote(path,{token:user.token});if(!result.ok||!Array.isArray(result.data))throw new Error('Private read failed');
    return res.status(200).json({ok:true,records:result.data.filter(x=>x.value&&typeof x.value.key==='string').map(x=>({kind:x.kind,key:x.value.key,value:x.value.data,version:x.version})),next:result.data.length===500?offset+500:null});
   }
   const body=requestBody(req);allowedFields(body,['changes']);if(!Array.isArray(body.changes)||!body.changes.length||body.changes.length>100)return fail(400,'한 번에 1~100개 기록만 저장할 수 있습니다.');
   let changes;
   try{changes=body.changes.map(x=>{const clean=Core.validate(x);if(clean.kind==='override'&&clean.value&&!CATEGORIES.has(clean.value.category))throw 0;if(!Number.isSafeInteger(x.expected_version)||x.expected_version<0)throw 0;return {...clean,expected_version:x.expected_version};});}catch{return fail(400,'저장할 기록 형식을 확인해 주세요.');}
   if(new Set(changes.map(x=>x.kind+'|'+x.key)).size!==changes.length)return fail(400,'같은 기록이 요청에 중복됐습니다.');
   const result=await remote('/rest/v1/rpc/news_reader_patch',{token:user.token,method:'POST',body:{p_changes:changes.map(x=>({kind:x.kind,record_key:digest(x.key),value:{key:x.key,data:x.value},expected_version:x.expected_version}))}});
   if(!result.ok){if(result.data?.code==='40001')return fail(409,'다른 기기에서 기록이 바뀌었습니다. 최신 기록을 불러온 뒤 다시 시도해 주세요.');throw new Error('Private write failed');}
   if(!Array.isArray(result.data))throw new Error('Invalid save result');
   return res.status(200).json({ok:true,records:result.data.map(r=>{const x=changes.find(c=>c.kind===r.kind&&digest(c.key)===r.record_key);if(!x)throw new Error('Unexpected save result');return {kind:x.kind,key:x.key,value:x.value,version:r.version};})});
  }catch(error){return fail(error instanceof RequestError?error.status:503,error instanceof RequestError?error.message:'개인 저장소에 연결하지 못했습니다. 저장 완료로 처리하지 않았습니다.');}
 }
 return handle;
}
module.exports={handle:createHandler(),createHandler,configuration,sameOrigin,seal,unseal,verificationInput,authenticatedUser,digest,COOKIE};
