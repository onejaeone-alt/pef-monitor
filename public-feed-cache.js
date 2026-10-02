/* Only public news and filing lists belong here; account records never use this cache. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.IBPublicFeedCache=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const STORE='ib_public_feeds_v1';
  const publicKey=k=>/^(?:news:(?:domestic|foreign):(?:1|3|7|14)|dart:(?:3|7|14))$/.test(k);
  function create({storage,now=Date.now,maxAge=15*60000,maxEntries=6,maxBytes=2*1024*1024}={}){
    if(storage===undefined){try{storage=globalThis.sessionStorage;}catch{storage=null;}}
    const cache=new Map(),pending=new Map(),versions=new Map();
    const usable=(key,value)=>publicKey(key)&&value&&Number.isFinite(value.at)&&now()-value.at>=0&&now()-value.at<=maxAge&&value.data?.ok===true&&Array.isArray(value.data.items);
    function trim(){
      for(const [key,value] of cache)if(!usable(key,value))cache.delete(key);
      while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
      while(cache.size&&JSON.stringify([...cache]).length*2>maxBytes)cache.delete(cache.keys().next().value);
    }
    try{
      const saved=JSON.parse(storage?.getItem(STORE)||'[]');
      if(Array.isArray(saved))for(const entry of saved)if(Array.isArray(entry)&&usable(entry[0],entry[1]))cache.set(entry[0],entry[1]);
      trim();
    }catch{}
    function get(key){
      const value=cache.get(key);
      if(!usable(key,value)){cache.delete(key);return null;}
      cache.delete(key);cache.set(key,value);
      return value.data;
    }
    function put(key,data){
      const value={at:now(),data};if(!usable(key,value))return;
      cache.delete(key);cache.set(key,value);trim();
      try{storage?.setItem(STORE,JSON.stringify([...cache]));}catch{}
    }
    function aborted(){const error=new Error('Public feed request cancelled');error.name='AbortError';return error;}
    function request(key,fetcher,{fresh=false,signal}={}){
      if(!publicKey(key))return Promise.reject(new Error('Only public feed lists may be cached'));
      if(signal?.aborted)return Promise.reject(aborted());
      const requestKey=key+(fresh?':fresh':':normal');
      // Ordinary readers may join an explicit refresh, but a refresh never joins an older normal request.
      let job=pending.get(requestKey)||(!fresh&&pending.get(key+':fresh'));
      if(!job){
        const controller=new AbortController(),version=(versions.get(key)||0)+1;versions.set(key,version);
        job={controller,users:0,settled:false};pending.set(requestKey,job);
        job.promise=Promise.resolve().then(()=>fetcher(controller.signal)).then(data=>{
          if(!controller.signal.aborted&&versions.get(key)===version)put(key,data);
          return data;
        }).finally(()=>{job.settled=true;if(pending.get(requestKey)===job)pending.delete(requestKey);});
      }
      job.users++;
      return new Promise((resolve,reject)=>{
        let done=false;
        const finish=(handler,value)=>{
          if(done)return;done=true;signal?.removeEventListener('abort',cancel);job.users--;
          if(!job.users&&!job.settled){job.controller.abort();for(const [id,active]of pending)if(active===job)pending.delete(id);}
          handler(value);
        };
        const cancel=()=>finish(reject,aborted());
        signal?.addEventListener('abort',cancel,{once:true});
        job.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
      });
    }
    return {get,request};
  }
  return {create};
});
