import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
test('private recaps persist across restart, export/import and score reset; overlay cannot read or mutate',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-recap-'));
  const config={dataDir:dir,password:'recap-test-password-1234',token:'recap-overlay-token-1234',username:'recap_test',poll:false};
  let app=createApp(config),base,cookie;
  const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};
  const post=(path,data,auth=cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{cookie:auth}:{})},body:JSON.stringify(data)});
  const login=async()=>{const r=await post('/api/login',{password:config.password},null);cookie=r.headers.get('set-cookie').split(';')[0];};
  const get=async()=>{const r=await fetch(base+'/api/recap',{headers:{cookie}});assert.equal(r.status,200);return r.json();};
  const edit=async(operation,extra={})=>{const data=await get();const r=await post('/api/action',{type:'recap',operation,expectedRevision:data.recap.revision,expectedSessionKey:data.sessionKey,...extra});assert.equal(r.status,200,await r.clone().text());return r.json();};
  try {
    await start();
    assert.equal((await fetch(base+'/api/recap')).status,401);
    assert.equal((await fetch(base+'/api/recap?token='+config.token)).status,401);
    assert.equal((await post('/api/action?token='+config.token,{type:'recap',operation:'save-draft'},null)).status,401);
    await login();
    await post('/api/action',{type:'record',result:'win'});
    await edit('save-preferences',{templates:{live:'custom {wins}',complete:'done {games}'},streamLink:'https://example.com/live',hashtags:'#mytag'});
    await edit('save-draft',{kind:'live',text:'Private manual edit',refreshStats:true});
    const saved=await get();
    const publicState=await(await fetch(base+'/api/state?token='+config.token)).json();assert.equal(publicState.recap,undefined);
    const stream=await fetch(base+'/api/events?token='+config.token),reader=stream.body.getReader();
    assert.doesNotMatch(new TextDecoder().decode((await reader.read()).value),/Private manual edit|mytag|"recap"/);await reader.cancel();
    await app.close();app=createApp(config);await start();await login();
    assert.deepEqual((await get()).recap,saved.recap);
    const completed=await edit('complete',{text:'Private completed recap',reset:true});
    assert.equal(completed.stats.games,0);assert.equal(completed.recap.snapshots[0].stats.games,1);
    const snapshot=structuredClone(completed.recap.snapshots[0]);
    const exported=await(await fetch(base+'/api/export',{headers:{cookie}})).json();assert.deepEqual(exported.recap.snapshots[0],snapshot);
    await edit('save-draft',{kind:'live',text:'next session',refreshStats:true});
    await post('/api/action',{type:'reset'});
    assert.deepEqual((await get()).recap.snapshots[0],snapshot);
    await app.close();app=createApp(config);await start();await login();
    assert.deepEqual((await get()).recap.snapshots[0],snapshot);
    assert.equal((await get()).recap.draft.text,'next session');
    const malformed=structuredClone(exported);malformed.recap.snapshots[0].stats.wins=-1;
    assert.equal((await post('/api/action',{type:'import',expectedRecapRevision:(await get()).recap.revision,data:malformed})).status,400);
    assert.deepEqual((await get()).recap.snapshots[0],snapshot);
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});

