import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
test('goals auth, two clients, replay, assets, restart, backup and legacy import',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-goals-'));
  const config={dataDir:dir,password:'goals-test-password-1234',token:'goals-overlay-token-1234',username:'goals_test',poll:false};
  let app=createApp(config),base;
  const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};
  const post=(path,data,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});
  const login=async()=>{const r=await post('/api/login',{password:config.password});return r.headers.get('set-cookie').split(';')[0];};
  const read=async cookie=>(await fetch(base+'/api/state',{headers:{cookie}})).json();
  try {
    await start();let c1=await login(),c2=await login();
    const a={type:'goal',operation:'add',expectedRevision:0,operationId:'create',goal:{title:'Manual',kind:'manual',target:10}};
    assert.equal((await post('/api/action?token='+config.token,a)).status,401);
    assert.equal((await post('/api/action',a,c1)).status,200);
    assert.equal((await post('/api/action',{...a,operationId:'second'},c2)).status,400);
    assert.equal((await post('/api/action',a,c1)).status,200);
    let state=await read(c1);assert.equal(state.goalTracker.items.length,1);
    const id=state.goalTracker.items[0].id;
    assert.equal((await post('/api/action',{type:'goal',operation:'manual',id,delta:1,operationId:'plus',expectedRevision:1},c2)).status,200);
    for(const file of ['goals-model.mjs','goals-controls.mjs','goals-render.mjs'])assert.equal((await fetch(base+'/'+file)).status,200);
    state=await read(c1);const saved=structuredClone(state.goalTracker);
    const backup=await(await fetch(base+'/api/export',{headers:{cookie:c1}})).json();assert.deepEqual(backup.goalTracker,saved);
    await app.close();app=createApp(config);await start();c1=await login();assert.deepEqual((await read(c1)).goalTracker,saved);
    assert.equal((await post('/api/action',{type:'import',data:backup,expectedRecapRevision:0,expectedGoalRevision:saved.revision},c1)).status,200);
    assert.equal((await read(c1)).goalTracker.items[0].manualValue,1);
    delete backup.goalTracker;assert.equal((await post('/api/action',{type:'import',data:backup,expectedGoalRevision:(await read(c1)).goalTracker.revision,expectedRecapRevision:1},c1)).status,200);assert.equal((await read(c1)).goalTracker.items.length,0);
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});
