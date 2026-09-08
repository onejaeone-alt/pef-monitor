'use strict';
const { makeCatalog, VERSION } = require('./preflight-core');
const { runResearch } = require('./preflight-agent');
const CACHE_MS = 10 * 60000;
const cache = new Map(), pending = new Map(), clients = new Map();
function catalog() {
  const { buildCanonicalClues, SNAPSHOT_DATE } = require('./canonical-clues');
  return makeCatalog(buildCanonicalClues(), SNAPSHOT_DATE);
}
function allowedRequest(req) {
  if (req.method && req.method !== 'GET') return false;
  if (req.body && Object.keys(req.body).length) return false;
  const allowed = new Set(['mode','id','_']);
  if (Object.keys(req.query || {}).some(k => !allowed.has(k))) return false;
  const origin = req.headers?.origin;
  if (!origin) return true;
  try { const u = new URL(origin); return u.protocol === 'https:' && ['ainobi.news','www.ainobi.news','pef-monitor.vercel.app','pef-monitor-onejess.vercel.app'].includes(u.hostname); } catch (_) { return false; }
}
async function handlePreflight(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (!allowedRequest(req)) return res.status(400).json({ok:false,error:'공개 단서 ID만 전달할 수 있습니다. 취재 메모·임의 URL·본문은 받지 않습니다.'});
  const entries = catalog();
  if (req.query.mode === 'preflight-catalog') return res.status(200).json({ok:true,version:VERSION,items:entries.map(x=>({clue_id:x.clue_id,title:x.title,case_count:x.cases.length,source_urls:x.cases.flatMap(c=>c.references.map(r=>r.url))})),scope:'정본에 연결된 출자조건·결성 단서'});
  const id = String(req.query.id || '');
  if (!/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ok:false,error:'올바른 공개 단서 ID가 필요합니다.'});
  const parent = entries.find(e=>e.clue_id===id);
  if (!parent) return res.status(404).json({ok:false,error:'이번 버전은 정본에 연결된 출자조건·결성 단서부터 조사합니다.'});
  const old = cache.get(id);
  if (old && old.expires > Date.now()) return res.status(200).json({...old.result,cache_hit:true,cache_expires_at:new Date(old.expires).toISOString()});
  if (pending.has(id)) { try { return res.status(200).json({...await pending.get(id),shared_run:true}); } catch (_) { return res.status(502).json({ok:false,error:'공개자료 조사에 실패했습니다. 잠시 뒤 다시 눌러주세요.'}); } }
  const client = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const at=Date.now(), times=(clients.get(client)||[]).filter(t=>at-t<60000);
  if (times.length>=3 || pending.size>=2) { res.setHeader('Retry-After','30'); return res.status(429).json({ok:false,error:'다른 공개자료 조사 중입니다. 30초 뒤 다시 눌러주세요.'}); }
  clients.set(client,[...times,at]); while(clients.size>100)clients.delete(clients.keys().next().value);
  const promise=runResearch(parent).then(result=>{
    cache.set(id,{expires:Date.now()+CACHE_MS,result}); while(cache.size>20)cache.delete(cache.keys().next().value);return result;
  });
  pending.set(id,promise);
  try { return res.status(200).json(await promise); }
  catch (_) { return res.status(502).json({ok:false,error:'공개자료 조사 도중 오류가 났습니다. 원문과 취재 메모는 변경하지 않았습니다.'}); }
  finally { pending.delete(id); }
}
module.exports = { handlePreflight, allowedRequest };
