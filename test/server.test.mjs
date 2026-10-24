import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
test('authenticated actions persist; overlay is read-only; SSE delivers results',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-test-'));const config={dataDir:dir,password:'test-password-123456789',token:'read-only-token-1234567890',username:'test_player',poll:false};
  let app=createApp(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base=`http://127.0.0.1:${app.server.address().port}`;
  const post=(path,data,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});
  try {
    assert.equal((await fetch(base+'/api/state')).status,401);
    const logo=await fetch(base+'/pawn-logo.svg');
    assert.equal(logo.status,200);
    assert.equal(logo.headers.get('content-type'),'image/svg+xml');
    assert.match(await logo.text(),/<svg[^>]+viewBox="0 0 64 64"/);
    for(const path of ['/control','/dock','/overlay','/credits']) {
      const page=await fetch(base+path);assert.equal(page.status,200);
      assert.match(await page.text(),/<link rel="icon" type="image\/svg\+xml" href="\/pawn-logo.svg">/);
    }
    for(const path of ['/dock','/dock/','/dock/score','/dock/cta']) {
      const response=await fetch(base+path);assert.equal(response.status,200);assert.match(await response.text(),/Control password/);
    }
    const credits=await fetch(base+'/credits');assert.equal(credits.status,200);assert.match(await credits.text(),/credits.mjs/);
    for(const path of ['/viewport.mjs','/bonus-model.mjs','/bonus-render.mjs','/bonus-controls.mjs','/credits.mjs','/credits-source.mjs','/tips-text.mjs','/tips-text-controls.mjs','/cta-text.mjs','/cta-text-controls.mjs']){const response=await fetch(base+path);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);}
    assert.equal((await post('/api/login',{password:'bad'})).status,401);
    const login=await post('/api/login',{password:config.password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
    const view=await fetch(base+`/api/state?token=${config.token}`);assert.equal(view.status,200);const data=await view.json();assert.equal(data.token,undefined);assert.equal(data.undo,undefined);
    assert.equal((await post(`/api/action?token=${config.token}`,{type:'record',result:'win'})).status,401);
    assert.equal((await post(`/api/action?token=${config.token}`,{type:'credits-playback',command:'restart'})).status,401);
    assert.equal((await post(`/api/action?token=${config.token}`,{type:'tips-items',expectedItems:data.tips.items,items:[]})).status,401);
    assert.equal((await post('/api/action?token='+config.token,{type:'ticker-messages',expectedMessages:data.ticker.messages,messages:[]})).status,401);
    assert.equal((await post('/api/action',{type:'ticker-messages',expectedMessages:data.ticker.messages,messages:data.ticker.messages},cookie)).status,200);
    assert.equal((await post('/api/action',{type:'ticker-messages',expectedMessages:[],messages:[]},cookie)).status,400);
    assert.equal((await post('/api/action',{type:'ticker-messages',expectedMessages:data.ticker.messages,messages:[{id:'x',text:'x'.repeat(501),enabled:true}]},cookie)).status,400);
    const tipsWrite=await post('/api/action',{type:'tips-items',expectedItems:data.tips.items,items:data.tips.items},cookie);assert.equal(tipsWrite.status,200);
    assert.equal((await post('/api/action',{type:'tips-items',expectedItems:[],items:[]},cookie)).status,400);
    const cross=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',cookie,origin:'http://evil.example'},body:'{}'});assert.equal(cross.status,403);
    const stream=await fetch(base+`/api/events?token=${config.token}`), reader=stream.body.getReader(), decoder=new TextDecoder();
    assert.match(decoder.decode((await reader.read()).value),/event: state/);
    assert.equal((await post('/api/action',{type:'record',result:'win'},cookie)).status,200);
    const event=decoder.decode((await reader.read()).value);assert.match(event,/"result":"win"/);await reader.cancel();
    const restart=await post('/api/action',{type:'timer',command:'restart'},cookie);assert.equal(restart.status,200);
    const restartedTimer=(await restart.json()).state.session;assert.equal(restartedTimer.elapsed,0);assert.notEqual(restartedTimer.runningSince,null);assert.equal(restartedTimer.results.length,1);
    assert.equal((await post('/api/action',{type:'settings',settings:{theme:{}}},cookie)).status,400);
    const backup=await fetch(base+'/api/export',{headers:{cookie}});assert.equal((await backup.json()).session.results.length,1);
    await app.close();app=createApp({...config,username:'different_env_player'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
    const restarted=await(await fetch(base+`/api/state?token=${config.token}`)).json();
    assert.equal(restarted.session.results.length,1);assert.equal(restarted.username,'test_player');
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});
