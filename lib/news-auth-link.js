'use strict';
// A clicked email link completes the existing managed login with browser-bound PKCE.
// Never take an account owner, arbitrary redirect or session tokens from the caller.
const crypto = require('node:crypto');
const CALLBACK = '/auth/callback.html';
const HOSTS = new Set(['ainobi.news', 'www.ainobi.news', 'pef-monitor.vercel.app', 'pef-monitor-onejess.vercel.app', 'pef-monitor-git-main-onejess.vercel.app']);
function callbackURL(req) {
  const host = String(req.headers?.host || '').toLowerCase();
  if (!HOSTS.has(host)) throw new Error('Unsupported login origin');
  return 'https://' + host + CALLBACK;
}
function verifier(cfg, pendingCookie, callback) {
  if (!cfg.service || !pendingCookie) throw new Error('Missing PKCE context');
  return crypto.createHmac('sha256', cfg.service)
    .update('news-email-link-pkce-v1\0' + callback + '\0' + pendingCookie).digest('base64url');
}
function prepare(req, cfg, pendingCookie) {
  const callback = callbackURL(req);
  return {callback, code_challenge: crypto.createHash('sha256').update(verifier(cfg, pendingCookie, callback)).digest('base64url'), code_challenge_method:'s256'};
}
async function finish(req, res, ctx) {
  const {cfg, requestBody, allowedFields, cookieJar, COOKIE, unseal, now, remote, rateLimit, authenticatedUser, setSession, RequestError} = ctx;
  const body = requestBody(req); allowedFields(body, ['code']);
  if (typeof body.code !== 'string' || !/^[A-Za-z0-9_.-]{16,2048}$/.test(body.code)) throw new RequestError(400, '새 인증 메일의 로그인 링크를 열어 주세요.');
  const raw = cookieJar(req)[COOKIE.pending], pending = unseal(cfg, raw, now());
  if (!pending) throw new RequestError(401, '인증 메일을 요청한 브라우저에서 링크를 열어 주세요. 시간이 지났다면 사이트에서 새 인증 메일을 받아 주세요.');
  const callback = callbackURL(req);
  await rateLimit('email-verify', pending.email, 8, 900);
  const result = await remote('/auth/v1/token?grant_type=pkce', {method:'POST', body:{auth_code:body.code, code_verifier:verifier(cfg, raw, callback)}});
  if (result.status === 429 || result.status >= 500) throw new RequestError(503, '인증 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  if (!result.ok || !result.data?.access_token || !result.data?.refresh_token) throw new RequestError(401, '인증 링크가 만료됐거나 이미 사용됐습니다. 사이트에서 새 인증 메일을 받아 주세요.');
  const user = await remote('/auth/v1/user', {token:result.data.access_token});
  if (user.status === 429 || user.status >= 500) throw new RequestError(503, '로그인 상태를 확인하지 못했습니다. 새 인증 메일을 받아 다시 시도해 주세요.');
  if (!user.ok || !authenticatedUser(user.data) || user.data.email.toLowerCase() !== pending.email) throw new RequestError(401, '요청한 이메일의 소유권을 확인하지 못했습니다. 새 인증 메일을 받아 주세요.');
  setSession(res, result.data);
  return res.status(200).json({ok:true, user:{id:user.data.id, email:user.data.email}});
}
module.exports = {CALLBACK, HOSTS, callbackURL, verifier, prepare, finish};
