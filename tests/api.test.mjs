import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionHandler,createProgressHandler } from '../server/api.mjs';
import { emptyState,writeValue,getValue } from '../public/state.js';
const code='a-long-random-household-code';const now=()=>1800000000000;
function request(path,{method='GET',data,cookie,origin}={}){return new Request('https://fieldnotes.test/api/'+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{}),...(origin?{origin}:{})},...(data?{body:JSON.stringify(data)}:{})});}
async function sessionCookie(){const response=await createSessionHandler({getCode:()=>code,now})(request('session',{method:'POST',data:{code}}));assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
function storeMock(){let data=null,etag=0,failOnce=false;return {
  get:async()=>structuredClone(data),
  getWithMetadata:async()=>data?{data:structuredClone(data),etag:String(etag)}:null,
  setJSON:async(key,next,options)=>{if(failOnce){failOnce=false;etag++;return {modified:false};}if((options.onlyIfNew&&data)||(options.onlyIfMatch&&String(etag)!==options.onlyIfMatch))return {modified:false};data=structuredClone(next);etag++;return {modified:true,etag:String(etag)};},
  failNext:()=>failOnce=true
};}
test('shared progress refuses access without a valid session',async()=>{
  const handler=createProgressHandler({getCode:()=>code,getStore:()=>{throw new Error('Must not touch storage');},now});
  assert.equal((await handler(request('progress'))).status,401);
  assert.equal((await createSessionHandler({getCode:()=>code,now})(request('session',{method:'POST',data:{code:'wrong'}}))).status,401);
});
test('login sets an HttpOnly cookie and rejects cross-origin requests',async()=>{
  const handler=createSessionHandler({getCode:()=>code,now});const login=await handler(request('session',{method:'POST',data:{code}}));
  assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await handler(request('session',{method:'POST',data:{code},origin:'https://other.test'}))).status,403);
  assert.equal((await createSessionHandler({getCode:()=>undefined})(request('session',{method:'POST',data:{code}}))).status,503);
});
test('concurrent device edits survive atomic retries and unchanged writes',async()=>{
  const store=storeMock(),cookie=await sessionCookie(),handler=createProgressHandler({getCode:()=>code,getStore:()=>store,now});
  const a=emptyState(),b=emptyState();writeValue(a,'m1:week:0',true,now()-2);writeValue(b,'m1:review:action','Next step',now()-1);
  assert.equal((await handler(request('progress',{method:'PUT',data:a,cookie}))).status,200);
  store.failNext();const result=await handler(request('progress',{method:'PUT',data:b,cookie}));assert.equal(result.status,200);
  const state=(await result.json()).state;assert.equal(getValue(state,'m1:week:0'),true);assert.equal(getValue(state,'m1:review:action'),'Next step');
  assert.equal((await handler(request('progress',{method:'PUT',data:state,cookie}))).status,200);
});
test('malformed data, future timestamps and expired sessions are rejected',async()=>{
  const cookie=await sessionCookie(),store=storeMock(),handler=createProgressHandler({getCode:()=>code,getStore:()=>store,now});
  assert.equal((await handler(request('progress',{method:'PUT',data:{schemaVersion:9},cookie}))).status,400);
  const future=emptyState();writeValue(future,'m1:week:0',true,now()+999999);assert.equal((await handler(request('progress',{method:'PUT',data:future,cookie}))).status,400);
  const expired=createProgressHandler({getCode:()=>code,getStore:()=>store,now:()=>now()+13*60*60*1000});assert.equal((await expired(request('progress',{cookie}))).status,401);
});
