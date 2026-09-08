(function(){
  'use strict';
  if(window.location.pathname==='/auth/callback.html')return;
  let p;try{p=new URLSearchParams(window.location.search);}catch{return;}
  const hash=String(window.location.hash||'');
  const isReturn=p.has('code')||p.has('error_code')||/(?:^#|&)(?:access_token|refresh_token|error_code)=/.test(hash);
  if(!isReturn)return;
  const clean=new URLSearchParams();
  if(p.getAll('code').length===1&&/^[A-Za-z0-9_.-]{16,2048}$/.test(p.get('code')||''))clean.set('code',p.get('code'));
  else clean.set('error','new_email_required');
  if(p.has('error')||p.has('error_code')||/(?:^#|&)(?:access_token|refresh_token|error_code)=/.test(hash)){clean.delete('code');clean.set('error','new_email_required');}
  // Legacy implicit tokens are scrubbed and intentionally not accepted as a session.
  try{history.replaceState(null,'',window.location.pathname);}catch{return;}
  window.location.replace('/auth/callback.html?'+clean.toString());
})();
