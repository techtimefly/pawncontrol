import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {appearanceSnapshot,BUILTIN_SCHEMES} from '../public/appearance.mjs';
import {layoutState} from '../public/layouts.mjs';

test('appearance HTTP: guarded two-client SSE, authorization, color-only undo and persistence', {timeout:20000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pawn-appearance-')),config={dataDir:dir,username:'appearance_test',password:'appearance-password-123456',token:'appearance-readonly-123456',poll:false,fetcher:async()=>new Response('{}',{headers:{'Cache-Control':'max-age=86400'}})};
 let app=createApp(config),base;const readers=[];
 const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};
 const post=(path,data,cookie,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...extra},body:JSON.stringify(data)});
 const login=async()=>{const r=await post('/api/login',{password:config.password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const connect=async cookie=>{const response=await fetch(base+'/api/events',{headers:{cookie},signal:AbortSignal.timeout(18000)}),reader=response.body.getReader();readers.push(reader);let buffer='';const decoder=new TextDecoder();return async(revision=0)=>{for(;;){const end=buffer.indexOf('\n\n');if(end>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const line=block.split('\n').find(l=>l.startsWith('data: '));if(line){const state=JSON.parse(line.slice(6));if(state.revision>=revision)return state;}continue;}const part=await reader.read();assert.equal(part.done,false);buffer+=decoder.decode(part.value,{stream:true});}};};
 try{
  await start();const c1=await login(),c2=await login(),stream1=await connect(c1),stream2=await connect(c2);let state=await stream1();assert.deepEqual(await stream2(),state);
  const guard=data=>({...data,expectedInstance:state.instance,expectedRevision:state.revision});
  const apply=(target='landscape',colors=BUILTIN_SCHEMES[0].colors)=>guard({type:'appearance',operation:'apply',target,colors,expected:appearanceSnapshot(state,target)});
  const act=async data=>{const r=await post('/api/action',data,c1);assert.equal(r.status,200,await r.clone().text());state=(await r.json()).state;return state;};
  const stale=apply(),initial=structuredClone(state);
  assert.equal((await post('/api/action',stale)).status,401);
  assert.equal((await post('/api/action?token='+config.token,stale)).status,401);
  assert.equal((await post('/api/action',stale,c1,{Origin:'https://elsewhere.example'})).status,403);
  await act(stale);assert.deepEqual(await stream1(state.revision),state);assert.deepEqual(await stream2(state.revision),state);
  for(const key of Object.keys(initial).filter(k=>!['appearance','revision'].includes(k)))assert.deepEqual(state[key],initial[key],key);
  assert.equal(layoutState(state).theme.accent,BUILTIN_SCHEMES[0].colors.accent);
  assert.equal(layoutState(state,'portrait').theme.accent,initial.theme.accent);
  assert.equal((await post('/api/action',stale,c2)).status,409);
  await act(guard({type:'appearance',operation:'restore',target:'landscape',palettes:{landscape:null},expected:appearanceSnapshot(state,'landscape')}));
  assert.equal(layoutState(state).theme.accent,initial.theme.accent);
  assert.equal((await post('/api/action',stale,c2)).status,409,'ABA must reject old preview');
  const missing=apply();delete missing.expectedRevision;assert.equal((await post('/api/action',missing,c1)).status,409);
  const malformed=apply();malformed.colors={...malformed.colors,text:'red'};assert.equal((await post('/api/action',malformed,c1)).status,400);
  await act(apply('both',BUILTIN_SCHEMES[1].colors));
  await act(guard({type:'appearance',operation:'save',id:'custom-one',name:'My stream',colors:BUILTIN_SCHEMES[1].colors,expectedSchemes:state.appearance.schemes}));
  await act({type:'save-preset',name:'Appearance'});const backup=await(await fetch(base+'/api/export',{headers:{cookie:c1}})).json();
  await act(apply('portrait',BUILTIN_SCHEMES[2].colors));
  const recent=structuredClone(state.appearance.recent);
  await act({type:'load-preset',name:'Appearance'});assert.deepEqual(state.appearance,{...backup.settings.appearance,recent});
  await act({type:'import',data:backup,expectedGoalRevision:state.goalTracker.revision,expectedRecapRevision:backup.recap.revision});assert.deepEqual(state.appearance,backup.settings.appearance);
  const old=apply();await Promise.all(readers.map(r=>r.cancel()));await app.close();app=createApp(config);await start();const cookie=await login();
  assert.equal((await post('/api/action',old,cookie)).status,409);const reopened=await(await fetch(base+'/api/state',{headers:{cookie}})).json();assert.deepEqual(reopened.appearance,backup.settings.appearance);
  for(const path of ['/appearance.mjs','/appearance-controls.mjs'])assert.equal((await fetch(base+path)).status,200);
 }finally{await Promise.allSettled(readers.map(r=>r.cancel()));await app.close();rmSync(dir,{recursive:true,force:true});}
});
