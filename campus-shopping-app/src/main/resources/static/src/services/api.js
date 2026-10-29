const PREFIX='/api/v1';
let csrf=null;
let csrfPromise=null;
function fail(message,code,status){return Object.assign(new Error(message),{code,status});}
async function getCsrf(){
  if(csrfPromise)return csrfPromise;
  csrfPromise=(async()=>{
    const r=await fetch(PREFIX+'/auth/csrf',{credentials:'same-origin',cache:'no-store'});
    let j;try{j=await r.json();}catch{throw fail('安全令牌响应异常','RESPONSE',r.status);}
    if(!r.ok || j.code!=='0000')throw fail('无法获取安全令牌',j.code,r.status);
    csrf=j.data;
    return csrf;
  })();
  try{return await csrfPromise;}finally{csrfPromise=null;}
}
/** 校验业务code，不能把HTTP 200当成执行成功。 */
export async function api(path,{method='GET',body,signal,key,retry=true}={}){
  const headers={Accept:'application/json'};
  if(method!=='GET'){
    const token=csrf||await getCsrf();
    headers[token.headerName]=token.token;
  }
  if(body!==undefined)headers['Content-Type']='application/json';
  if(key)headers['Idempotency-Key']=key;
  let r;
  try{
    r=await fetch(PREFIX+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal,credentials:'same-origin',cache:'no-store'});
  }catch(err){
    if(err.name==='AbortError')throw err;
    throw fail('服务连接失败，请确认 Java 后端已启动','NETWORK',0);
  }
  let j;try{j=await r.json();}catch{throw fail('服务器响应格式异常','RESPONSE',r.status);}
  if(r.status===403 && j.code==='A0005' && retry){csrf=null;await getCsrf();return api(path,{method,body,signal,key,retry:false});}
  if(!r.ok || j.code!=='0000')throw fail(j.info||'请求失败',j.code||'HTTP',r.status);
  return j.data;
}
export const resetCsrf=()=>{csrf=null;csrfPromise=null;};
export const query = params=>'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=='')).toString();
export const idempotency=()=>crypto.randomUUID();
