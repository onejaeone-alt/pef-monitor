'use strict';

// Process-local only: bounds retained source data and concurrent refreshes, not a
// durable snapshot or a cache shared between serverless instances.
function createSourceCache({ ttlMs=60000, maxStaleMs=30*60000, retryMs=15000,
  maxEntries=384, maxBytes=16*1024*1024, maxValueBytes=1024*1024,
  maxInflight=64, now=Date.now }={}) {
  const entries=new Map(), pending=new Map();
  let bytes=0, generation=0;
  const iso=time=>new Date(time).toISOString();
  function remove(key) { const entry=entries.get(key); if(entry){bytes-=entry.bytes;entries.delete(key);} }
  function prune() { const time=now(); for(const [key,entry] of entries) if(time-entry.fetchedAt>=maxStaleMs) remove(key); }
  function touch(key,entry) { entries.delete(key); entries.set(key,entry); }
  function result(entry,{fromCache=false,failed=false,error,attemptedAt=entry.attemptedAt}={}) {
    return {value:entry.value,fetched_at:iso(entry.fetchedAt),attempted_at:iso(attemptedAt),
      from_cache:fromCache,stale:failed,failed,...(error?{error}: {})};
  }
  function recover(key,error,attemptedAt,version) {
    const entry=entries.get(key), message=String(error?.message||error).slice(0,240);
    if(!entry || now()-entry.fetchedAt>=maxStaleMs) { if(entry)remove(key); throw error; }
    // An older normal fetch must not replace metadata from a newer explicit refresh.
    if(version>=entry.generation) {
      entry.attemptedAt=attemptedAt; entry.failed=true; entry.error=message; entry.generation=version;
      touch(key,entry);
    }
    return result(entry,{fromCache:true,failed:true,error:message,attemptedAt});
  }
  async function get(key,loader,{fresh=false}={}) {
    prune();
    const entry=entries.get(key), time=now();
    if(!fresh && entry) {
      if(entry.failed && time-entry.attemptedAt<retryMs) {
        touch(key,entry); return result(entry,{fromCache:true,failed:true,error:entry.error});
      }
      if(!entry.failed && time-entry.fetchedAt<ttlMs) {touch(key,entry);return result(entry,{fromCache:true});}
    }
    const liveKey='refresh:'+key, normalKey='normal:'+key;
    const shared=pending.get(liveKey)||(!fresh&&pending.get(normalKey));
    if(shared)return shared;
    const version=++generation;
    if(pending.size>=maxInflight) return recover(key,new Error('NEWS_SOURCE_BUSY'),time,version);
    const pendingKey=fresh?liveKey:normalKey;
    const job=Promise.resolve().then(loader).then(value=>{
      const fetchedAt=now(), valueBytes=Buffer.byteLength(JSON.stringify(value),'utf8');
      const next={value,fetchedAt,attemptedAt:time,failed:false,bytes:valueBytes,generation:version};
      if(valueBytes<=maxValueBytes && valueBytes<=maxBytes && maxEntries>0 && version>=(entries.get(key)?.generation||0)) {
        remove(key); entries.set(key,next); bytes+=valueBytes;
        while(entries.size>maxEntries || bytes>maxBytes) remove(entries.keys().next().value);
      }
      return result(next);
    }).catch(error=>recover(key,error,time,version)).finally(()=>{if(pending.get(pendingKey)===job)pending.delete(pendingKey);});
    pending.set(pendingKey,job);
    return job;
  }
  return {get,stats(){prune();return {entries:entries.size,bytes,inflight:pending.size};}};
}

module.exports={createSourceCache};
