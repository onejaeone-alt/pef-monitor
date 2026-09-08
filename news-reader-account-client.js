/* Account state is memory-only. Authentication credentials stay in HttpOnly cookies. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NewsReaderAccount=factory();})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const STORE='ib-news-reader-v2',LEGACY='ib-news-desk-v1';
function create({core:C,fetcher=globalThis.fetch,storage,onChange=()=>{}}){
 if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
 let mode='checking',user=null,ready=false,records=C.empty(),versions=Object.create(null),generation=0,busy=false;
 const entryKey=(kind,key)=>kind+'|'+key;
 const state=()=>({mode,user,ready,records,busy});
 const emit=()=>onChange(state());
 function reset(next='checking'){generation++;mode=next;user=null;records=C.empty();versions=Object.create(null);emit();}
 async function request(action,{method='GET',body,owner=user?.id,offset}={}){
  const headers={'X-News-Reader':'1'};if(owner)headers['X-Reader-User']=owner;if(body)headers['Content-Type']='application/json';
  const params=new URLSearchParams({reader:action});if(offset!==undefined)params.set('offset',String(offset));
  const response=await fetcher('/api/news?'+params,{method,headers,credentials:'same-origin',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});
  let data;try{data=await response.json();}catch{data={};}
  if(!response.ok||!data.ok){const e=new Error(data.error||'개인 저장소에 연결하지 못했습니다.');e.status=response.status;throw e;}
  return data;
 }
 function guest(){
  let next=C.empty();const raw=storage.getItem(STORE);
  if(!raw)return C.legacy(JSON.parse(storage.getItem(LEGACY)||'{}'));
  const parsed=JSON.parse(raw);
  for(const kind of C.KINDS)for(const [key,value]of Object.entries(parsed[kind]||{}))next=C.apply(next,[{kind,key,value}]);
  return next;
 }
 async function sync(){
  if(busy)return state();reset();const current=generation;
  try{
   const status=await request('status');if(current!==generation)return state();ready=!!status.ready;
   if(!ready||!status.user){mode=ready?'signedout':'unavailable';emit();return state();}
   const owner=status.user;let next=C.empty(),nextVersions=Object.create(null),offset=0;
   do{const page=await request('records',{owner:owner.id,offset});if(current!==generation)return state();
    if(!Array.isArray(page.records))throw new Error('개인 기록 형식이 올바르지 않습니다.');
    for(const item of page.records){next=C.apply(next,[item]);nextVersions[entryKey(item.kind,item.key)]=item.version;}
    if(page.next!==null&&(!Number.isSafeInteger(page.next)||page.next<=offset||page.next>100000))throw new Error('개인 기록 조회 범위를 확인하지 못했습니다.');
    offset=page.next;
   }while(offset!==null);
   if(current===generation){records=next;versions=nextVersions;user=owner;mode='account';emit();}
  }catch(error){if(current===generation)reset('blocked');throw error;}
  return state();
 }
 async function save(changes){
  if(busy)throw new Error('앞선 저장이 끝난 뒤 다시 눌러 주세요.');
  if(!['account','guest'].includes(mode))throw new Error('로그인하거나 브라우저 저장을 먼저 선택해 주세요.');
  if(!Array.isArray(changes)||changes.length<1||changes.length>100)throw new Error('저장할 기록 수를 확인해 주세요.');
  if(mode==='guest')records=guest();
  const current=generation,clean=changes.map(C.validate),next=C.apply(records,clean);busy=true;emit();
  try{
   if(mode==='guest'){storage.setItem(STORE,JSON.stringify(next));if(current===generation){records=next;emit();}return true;}
   const result=await request('records',{method:'POST',body:{changes:clean.map(x=>({...x,expected_version:versions[entryKey(x.kind,x.key)]||0}))}});
   if(current!==generation)throw new Error('계정 상태가 바뀌었습니다. 최신 기록을 확인해 주세요.');
   if(!Array.isArray(result.records)||result.records.length!==clean.length)throw new Error('저장 결과를 확인하지 못했습니다.');
   for(const item of result.records){records=C.apply(records,[item]);versions[entryKey(item.kind,item.key)]=item.version;}
   emit();return true;
  }catch(error){if(mode==='account'&&current===generation)reset('blocked');throw error;}
  finally{busy=false;emit();}
 }
 async function sendCode(email){if(busy)throw new Error('저장 중에는 계정을 바꿀 수 없습니다.');return request('send-code',{method:'POST',body:{email}});}
 async function verifyCode(email,code){if(busy)throw new Error('저장 중에는 계정을 바꿀 수 없습니다.');reset();try{await request('verify-code',{method:'POST',body:{email,code}});return await sync();}catch(e){reset('signedout');throw e;}}
 async function logout(){if(busy)throw new Error('저장이 끝난 뒤 로그아웃해 주세요.');reset();try{await request('logout',{method:'POST',body:{}});reset('signedout');}catch(e){reset('blocked');throw e;}return state();}
 async function useGuest(){await logout();records=guest();mode='guest';emit();return state();}
 function guestCount(){try{const x=guest();return C.KINDS.reduce((n,k)=>n+Object.keys(x[k]).length,0);}catch{return null;}}
 async function importGuest(){
  if(mode!=='account')throw new Error('로그인 후 가져올 수 있습니다.');
  const old=guest(),changes=[];
  for(const kind of C.KINDS)for(const [key,value]of Object.entries(old[kind]))if(!Object.hasOwn(versions,entryKey(kind,key)))changes.push({kind,key,value});
  let imported=0;for(let i=0;i<changes.length;i+=50){await save(changes.slice(i,i+50));imported+=changes.slice(i,i+50).length;}
  return imported;
 }
 function refreshGuest(){if(mode==='guest'){records=guest();emit();}}
 function invalidate(){reset('checking');}
 return {state,sync,save,sendCode,verifyCode,logout,useGuest,guestCount,importGuest,refreshGuest,invalidate};
}
return {create};
});
