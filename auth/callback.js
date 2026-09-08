(function(){
  'use strict';
  let params;
  try{params=new URLSearchParams(window.location.search);}catch{params=new URLSearchParams();}
  let code=params.get('code');
  const failed=params.has('error')||params.has('error_code')||/^#.*(?:error|access_token|refresh_token)=/.test(window.location.hash);
  const duplicate=params.getAll('code').length!==1;
  // Erase the authorization code before any network operation. Never persist tokens or code.
  let cleared=false;try{history.replaceState(null,'','/auth/callback.html');cleared=true;}catch{}
  async function start(){
    const title=document.getElementById('authTitle'),message=document.getElementById('authMessage');
    const failure=text=>{title.textContent='로그인을 마치지 못했습니다.';message.textContent=text;};
    if(!cleared){code=null;failure('주소창의 인증 정보를 정리하지 못했습니다. 뉴스 홈에서 새 인증 메일을 요청해 주세요.');return;}
    if(failed||duplicate||typeof code!=='string'||!/^[A-Za-z0-9_.-]{16,2048}$/.test(code)){code=null;failure('인증 링크가 만료됐거나 이전 방식으로 발급된 링크입니다. 뉴스 홈에서 새 인증 메일을 받아 주세요.');return;}
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),35000);
    try{
      const body=JSON.stringify({code});code=null;params=null;
      const r=await fetch('/api/news?reader=finish-link',{method:'POST',credentials:'same-origin',cache:'no-store',signal:ctrl.signal,headers:{'Content-Type':'application/json','X-News-Reader':'1'},body});
      let data;try{data=await r.json();}catch{data={};}
      if(!r.ok||!data.ok||!data.user?.id)throw new Error(data.error||'로그인 상태를 확인하지 못했습니다. 새 인증 메일을 받아 다시 시도해 주세요.');
      title.textContent='로그인했습니다.';message.textContent='뉴스 페이지로 이동합니다.';
      try{const channel=new BroadcastChannel('ib-news-account-events');channel.postMessage({changed:true});channel.close();}catch{}
      window.location.replace('/');
    }catch(e){failure(e.name==='AbortError'?'인증 서버 응답이 늦습니다. 뉴스 홈에서 로그인 상태를 먼저 확인해 주세요.':e.message||'로그인을 확인하지 못했습니다.');}
    finally{clearTimeout(timeout);code=null;params=null;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
