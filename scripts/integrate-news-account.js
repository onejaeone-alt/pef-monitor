'use strict';
const fs=require('node:fs'),path=require('node:path');
function replace(text,from,to){if(!text.includes(from))throw Error('Account integration anchor missing: '+from.slice(0,90));return text.replace(from,to);}
function api(text){if(text.includes('NEWS_ACCOUNT_ROUTE_V1'))return text;return replace(text,'module.exports = async (req, res) => {',`module.exports = async (req, res) => {
  // NEWS_ACCOUNT_ROUTE_V1: personal routes must run BEFORE public CORS/cache/GET-only logic.
  if (req.query && Object.prototype.hasOwnProperty.call(req.query,'reader')) return require('../lib/news-reader-account').handle(req,res);`);}
function page(text){if(text.includes('news-reader-account-client.js'))return text;
 let n=replace(text,'<script src="/news-reader.js?v=20260908-r1"></script>','<script src="/news-reader-account-client.js?v=20260908-account1"></script><script src="/news-reader.js?v=20260908-r1&account=1"></script>');
 return n.replace('data-news-version="20260908-personal-reader"','data-news-version="20260908-account-reader"');
}
function reader(text){
 if(text.includes('NEWS_ACCOUNT_UI_V1'))return text;
 let n=replace(text,"const C=window.NewsReaderCore,T=window.NewsTaxonomy,$=s=>document.querySelector(s);if(!C||!T)return;","const C=window.NewsReaderCore,T=window.NewsTaxonomy,A=window.NewsReaderAccount,$=s=>document.querySelector(s);if(!C||!T||!A)return; // NEWS_ACCOUNT_UI_V1");
 n=replace(n,"mode:'guest'","mode:'checking'");
 const start=n.indexOf('async function write('),end=n.indexOf('function readChanges',start);
 if(start<0||end<0)throw Error('Missing reader write');
 n=n.slice(0,start)+`async function write(changes,{remember=true}={}){
 if(S.saving){notify('앞선 저장이 끝난 뒤 다시 눌러 주세요.');return false;}
 if(!['account','guest'].includes(S.mode)){accountDialog();return false;}
 const operationEpoch=epoch;S.saving=true;
 const reverse=changes.map(c=>({kind:c.kind,key:c.key,value:S.records[c.kind]?.[c.key]||null}));
 try{for(let i=0;i<changes.length;i+=100){await Accounts.save(changes.slice(i,i+100));if(epoch!==operationEpoch)return false;}
 if(remember){undo=reverse;$('#readerUndo').hidden=false;}render();if(S.mode==='account')broadcastAccount();return true;
 }catch(error){notify(error.message||'저장 결과를 확인하지 못했습니다.');return false;}
 finally{S.saving=false;}
}
`+n.slice(end);
 const as=n.indexOf('function accountDialog()'),ae=n.indexOf('function watchDialog',as);
 if(as<0||ae<0)throw Error('Missing account dialog');
 n=n.slice(0,as)+`const Accounts=A.create({core:C,onChange(next){
 const changed=S.mode!==next.mode||S.user?.id!==next.user?.id;
 if(changed){epoch++;undo=null;S.selected=null;$('#readerUndo').hidden=true;}
 if(S.user&&S.user.id!==next.user?.id){if(dialog.open)dialog.close();S.query='';S.category='ALL';S.actor='ALL';$('#search').value='';}
 S.mode=next.mode;S.user=next.user;S.records=next.records;S.authReady=next.ready;render();
}});
let accountBusy=false;
function accountDialog(){
 const content=[],count=Accounts.guestCount();
 if(S.mode==='account'){
  content.push(el('p',{text:S.user.email+' 계정으로 로그인했습니다. 읽음·보관·추적은 다른 이용자와 공유하지 않습니다.'}),btn('다른 기기의 기록 불러오기',{id:'accountSync',class:'nd-button'}),btn('로그아웃',{id:'accountLogout',class:'nd-button'}));
  if(count)content.push(el('p',{text:'이 브라우저에 남은 기록 '+count+'개는 아직 자동으로 옮기지 않았습니다.'}),el('label',{},el('input',{type:'checkbox',id:'accountImportConsent'}),' 이 브라우저의 기록이 내 기록임을 확인했습니다.'),btn('브라우저 기록 가져오기',{id:'accountBringLocal',class:'nd-button'}));
 }else{
  content.push(el('p',{text:'이메일을 인증하면 읽음·보관·추적 기록을 계정에 저장합니다. 다른 기기에서도 같은 계정으로 볼 수 있습니다.'}),el('label',{for:'accountEmail',text:'이메일'}),el('input',{id:'accountEmail',type:'email',autocomplete:'email',maxlength:254,placeholder:'이메일 주소'}),btn('인증 메일 받기',{id:'accountSend',class:'nd-button'}),el('label',{for:'accountCode',text:'인증번호 또는 로그인 링크'}),el('input',{id:'accountCode',type:'password',autocomplete:'one-time-code',maxlength:4096,placeholder:'메일의 인증번호 또는 링크 붙여넣기'}),btn('인증하고 로그인',{id:'accountVerify',class:'nd-button'}),el('p',{class:'reader-fine',text:'메일에 번호 없이 링크만 있으면 링크를 누르지 말고 링크 주소를 복사해 붙여넣으세요. 인증번호·링크를 다른 사람과 공유하지 마세요.'}));
  content.push(btn('로그인 상태 다시 확인',{id:'accountSync',class:'nd-button'}),btn('로그인 없이 브라우저 기록 보기',{id:'accountGuest',class:'nd-button'}));
 }
 content.push(el('p',{id:'readerAuthMessage',role:'status',class:'reader-fine'}),el('p',{class:'reader-fine',text:'계정 저장은 뉴스 기록에만 적용합니다. 진행중 취재의 메모와 기존 브라우저 기록은 자동으로 옮기거나 보호하지 않습니다. 공용 기기에서는 로그아웃해 주세요.'}));
 openDialog(S.mode==='account'?'내 뉴스 계정':'뉴스 계정 로그인',content);
}
async function accountAction(b){
 if(!/^account(Sync|Logout|BringLocal|Send|Verify|Guest)$/.test(b.id))return false;
 if(accountBusy||S.saving){notify('앞선 요청을 처리 중입니다.');return true;}accountBusy=true;b.disabled=true;
 const message=$('#readerAuthMessage');
 try{
  if(b.id==='accountSend'){const email=$('#accountEmail').value;const result=await Accounts.sendCode(email);if(message)message.textContent=result.message;}
  else if(b.id==='accountVerify'){const email=$('#accountEmail').value,code=$('#accountCode').value;$('#accountCode').value='';await Accounts.verifyCode(email,code);dialog.close();notify('로그인했습니다. 기존 브라우저 기록은 자동으로 가져오지 않았습니다.');broadcastAccount();}
  else if(b.id==='accountLogout'){await Accounts.logout();dialog.close();notify('로그아웃했습니다. 계정 기록을 화면에서 비웠습니다.');broadcastAccount();}
  else if(b.id==='accountGuest'){await Accounts.useGuest();dialog.close();notify('브라우저 저장을 선택했습니다. 같은 브라우저 프로필을 공유하면 기록이 보입니다.');broadcastAccount();}
  else if(b.id==='accountSync'){await Accounts.sync();accountDialog();}
  else if(b.id==='accountBringLocal'){if(!$('#accountImportConsent')?.checked)throw Error('내 브라우저 기록인지 먼저 확인해 주세요.');const n=await Accounts.importGuest();accountDialog();$('#readerAuthMessage').textContent=n+'개를 가져왔습니다. 기존 브라우저 기록은 지우지 않았습니다.';broadcastAccount();}
 }catch(error){if(message?.isConnected)message.textContent=error.message;else notify(error.message);}
 finally{accountBusy=false;if(b.isConnected)b.disabled=false;}return true;
}
let accountChannel=null;try{if(window.BroadcastChannel)accountChannel=new BroadcastChannel('ib-news-account-events');}catch{}
function broadcastAccount(){accountChannel?.postMessage({changed:true});}
let accountRecheckTimer;
function recheckAccount(){clearTimeout(accountRecheckTimer);if(document.hidden)return;if(Accounts.state().busy||S.saving){accountRecheckTimer=setTimeout(recheckAccount,80);return;}Accounts.sync().catch(e=>notify(e.message));}
if(accountChannel)accountChannel.onmessage=()=>{Accounts.invalidate();recheckAccount();};
window.addEventListener('pageshow',e=>{if(e.persisted)recheckAccount();});
window.addEventListener('pagehide',()=>{if(S.mode==='account')Accounts.invalidate();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.mode!=='guest')recheckAccount();});
`+n.slice(ae);
 n=replace(n,"if(b.hasAttribute('data-close-dialog'))dialog.close();","if(await accountAction(b))return;\n if(b.hasAttribute('data-close-dialog'))dialog.close();");
 n=replace(n,"try{localStorage.setItem(STORE,JSON.stringify(S.records));}catch{}","if(S.mode==='guest'){try{localStorage.setItem(STORE,JSON.stringify(S.records));}catch{}}");
 n=replace(n,"if(old&&/^(기존 보관 기사|이전에 보관한 기사)/", "if(S.mode==='guest'&&old&&/^(기존 보관 기사|이전에 보관한 기사)/");
 n=replace(n,"S.mode==='checking'?'저장 범위 확인 중':'이 브라우저 저장'", "S.mode==='checking'?'로그인 확인 중':S.mode==='guest'?'이 브라우저 저장':'로그인'");
 n=replace(n,"'뉴스 개인 기록은 로그인한 계정에 저장합니다. 기존 브라우저 기록·취재 메모는 자동으로 옮기지 않습니다.':'읽음·보관·추적은 현재 브라우저에만 저장합니다. 같은 브라우저 프로필을 공유하면 기록을 서로 볼 수 있습니다. 계정 보호는 아직 적용되지 않습니다.'", "'뉴스 개인 기록은 로그인한 계정에 저장합니다. 기존 브라우저 기록·취재 메모는 자동으로 옮기지 않습니다.':S.mode==='guest'?'브라우저 저장을 사용 중입니다. 같은 브라우저 프로필을 공유하면 기록을 서로 볼 수 있습니다.':'읽음·보관·추적 기록은 로그인 후 사용할 수 있습니다. 기존 브라우저 기록은 로그인 메뉴에서 별도로 선택하세요.'");
 n=replace(n,"S.records=readGuest();render();load();", "render();load();Accounts.sync().catch(e=>notify(e.message));");
 n=replace(n,"dialog.showModal();","if(!dialog.open)dialog.showModal();");
 n=replace(n,"S.records=readGuest();render();","Accounts.refreshGuest();");
 return n;
}
function main(root=path.resolve(__dirname,'..')){for(const[name,transform]of [['index.html',page],['api/news.js',api],['news-reader.js',reader]]){const file=path.join(root,name),before=fs.readFileSync(file,'utf8'),after=transform(before);if(before!==after)fs.writeFileSync(file,after);}}
if(require.main===module)main();module.exports={api,page,reader,main};
