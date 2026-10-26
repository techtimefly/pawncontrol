import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {WIDGET_IDS} from '../public/model.mjs';
test('authenticated visibility: two clients, stale/ABA/restart guards, SSE, backup and presets', {timeout:20000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pawn-visibility-')),config={dataDir:dir,username:'visibility_test',password:'visibility-password-123456',token:'visibility-readonly-123456',poll:false,fetcher:async()=>new Response('{}',{headers:{'Cache-Control':'max-age=86400'}})};
 let app=createApp(config),base;const readers=[];
 const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};
 const post=(path,data,cookie,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...extra},body:JSON.stringify(data)});
 const login=async()=>{const r=await post('/api/login',{password:config.password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const connect=async cookie=>{const response=await fetch(base+'/api/events',{headers:{cookie},signal:AbortSignal.timeout(18000)}),reader=response.body.getReader();readers.push(reader);let buffer='';const decoder=new TextDecoder();return async(revision=0)=>{for(;;){const end=buffer.indexOf('\n\n');if(end>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const line=block.split('\n').find(l=>l.startsWith('data: '));if(line){const state=JSON.parse(line.slice(6));if(state.revision>=revision)return state;}continue;}const part=await reader.read();assert.equal(part.done,false);buffer+=decoder.decode(part.value,{stream:true});}};};
 try{
  await start();const c1=await login(),c2=await login(),stream1=await connect(c1),stream2=await connect(c2);let state=await stream1();assert.deepEqual(await stream2(),state);
  const command=(layout,id)=>({type:'widget-visibility',layout,id,expected:(layout==='portrait'?state.portrait:state).widgets[id].visible,visible:!(layout==='portrait'?state.portrait:state).widgets[id].visible,expectedInstance:state.instance,expectedRevision:state.revision});
  const stale=command('landscape','stats');
  assert.equal((await post('/api/action',stale)).status,401);assert.equal((await post('/api/action?token='+config.token,stale)).status,401);
  assert.equal((await post('/api/action',stale,c1,{Origin:'https://elsewhere.example'})).status,403);
  for(const layout of ['landscape','portrait'])for(const id of WIDGET_IDS){const previous=state,r=await post('/api/action',command(layout,id),c1);assert.equal(r.status,200,await r.clone().text());state=(await r.json()).state;assert.deepEqual(await stream1(state.revision),state);assert.deepEqual(await stream2(state.revision),state);assert.deepEqual(state.session,previous.session);assert.deepEqual(state.creditsPlayback,previous.creditsPlayback);}
  assert.equal((await post('/api/action',stale,c2)).status,409);
  // Return to the original boolean: old intent must still fail (ABA).
  let r=await post('/api/action',command('landscape','stats'),c2);state=(await r.json()).state;assert.equal(state.widgets.stats.visible,stale.expected);assert.equal((await post('/api/action',stale,c1)).status,409);
  const act=async data=>{const r=await post('/api/action',data,c1);assert.equal(r.status,200,await r.clone().text());state=(await r.json()).state;};
  await act({type:'save-preset',name:'Visibility'});const backup=await(await fetch(base+'/api/export',{headers:{cookie:c1}})).json();
  await act(command('portrait','clock'));await act({type:'load-preset',name:'Visibility'});assert.deepEqual(state.portrait,backup.settings.portrait);
  await act({type:'import',data:backup,expectedGoalRevision:state.goalTracker.revision,expectedRecapRevision:backup.recap.revision});assert.deepEqual(state.widgets,backup.settings.widgets);
  const old=command('portrait','clock');await Promise.all(readers.map(r=>r.cancel()));await app.close();app=createApp(config);await start();const cookie=await login();
  assert.equal((await post('/api/action',old,cookie)).status,409);const next=await connect(cookie),reopened=await next();assert.deepEqual(reopened.widgets,backup.settings.widgets);assert.notEqual(reopened.instance,old.expectedInstance);
  assert.equal((await fetch(base+'/visibility-controls.mjs')).status,200);
 }finally{await Promise.allSettled(readers.map(r=>r.cancel()));await app.close();rmSync(dir,{recursive:true,force:true});}
});
