import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {layoutState} from '../public/layouts.mjs';
import {recapSessionKey} from '../public/recap-model.mjs';

test('simultaneous authenticated outputs share live data, persist both compositions and reconnect', {timeout:15000}, async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-layout-http-'));
  const config={dataDir:dir,password:'layout-test-password-123456',token:'layout-read-token-123456789',username:'layout_player',poll:false,
    fetcher:async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json','Cache-Control':'max-age=86400'}})};
  let app=createApp(config),base,cookie;
  const readers=[];
  const listen=async()=>{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;};
  const post=(path,data,authenticated=true)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated&&cookie?{cookie}:{})},body:JSON.stringify(data)});
  const action=async data=>{const response=await post('/api/action',data);assert.equal(response.status,200,await response.clone().text());return (await response.json()).state;};
  const connect=async layout=>{
    const response=await fetch(`${base}/api/events?token=${config.token}&layout=${layout}`,{signal:AbortSignal.timeout(12000)});
    assert.equal(response.status,200);
    const reader=response.body.getReader();readers.push(reader);const decoder=new TextDecoder();let buffer='';
    return {reader,async next(predicate=()=>true){
      for(;;){
        const end=buffer.indexOf('\n\n');
        if(end>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split('\n').find(line=>line.startsWith('data: '));if(data){const state=JSON.parse(data.slice(6));if(predicate(state))return state;}continue;}
        const result=await reader.read();assert.equal(result.done,false,'SSE closed before the expected state');buffer+=decoder.decode(result.value,{stream:true});
      }
    }};
  };
  try {
    await listen();
    const login=await post('/api/login',{password:config.password},false);assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
    for(const layout of ['landscape','portrait'])for(const path of ['overlay','credits']){
      const page=await fetch(`${base}/${path}?layout=${layout}&token=${config.token}`);
      assert.equal(page.status,200);assert.match(await page.text(),new RegExp(`${path}\\.mjs`));
    }
    for(const path of ['/layouts.mjs','/recap-model.mjs','/recap-controls.mjs']){const module=await fetch(base+path);assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);}
    assert.equal((await fetch(base+'/api/events?layout=portrait')).status,401);
    const landscape=await connect('landscape'),portrait=await connect('portrait');
    const initial=await landscape.next();assert.deepEqual(await portrait.next(),initial);
    const edited=structuredClone(initial.portrait);edited.widgets.stats.x=90;edited.widgets.stats.w=900;edited.widgets.tips.visible=true;edited.typography.font=36;
    assert.equal((await post(`/api/action?token=${config.token}&layout=portrait`,{type:'settings',settings:{portrait:edited}},false)).status,401);
    await action({type:'settings',settings:{portrait:edited}});
    const a=await landscape.next(),b=await portrait.next();assert.equal(a.revision,b.revision);
    assert.deepEqual(a.widgets,initial.widgets);assert.deepEqual(b.portrait,edited);
    assert.equal(layoutState(a,'landscape').widgets.stats.x,initial.widgets.stats.x);
    assert.equal(layoutState(b,'portrait').widgets.stats.x,90);
    const recorded=await action({type:'record',result:'win'});
    const scoredA=await landscape.next(s=>s.revision>=recorded.revision),scoredB=await portrait.next(s=>s.revision>=recorded.revision);assert.deepEqual(scoredA.session,scoredB.session);assert.equal(scoredB.session.results[0].result,'win');
    const widgets=structuredClone(scoredA.widgets);widgets.scoreboard.visible=true;widgets.ticker.y=1300;
    const positioned=await action({type:'settings',settings:{widgets}});
    assert.deepEqual((await landscape.next(s=>s.revision>=positioned.revision)).portrait,edited);assert.deepEqual((await portrait.next(s=>s.revision>=positioned.revision)).widgets,widgets);
    const composed=await action({type:'save-preset',name:'Dual output'});
    const withDraft=await action({type:'recap',operation:'save-draft',expectedRevision:0,expectedSessionKey:recapSessionKey(composed),kind:'live',text:'Private recap alongside both layouts',refreshStats:true});
    assert.equal(withDraft.recap,undefined);
    assert.equal((await fetch(`${base}/api/recap?token=${config.token}`)).status,401);
    const exported=await fetch(base+'/api/export',{headers:{cookie}});assert.equal(exported.status,200);const backup=await exported.json();
    assert.deepEqual(backup.settings.portrait,edited);assert.deepEqual(backup.settings.widgets,widgets);
    assert.equal(backup.recap.draft.text,'Private recap alongside both layouts');
    const changed=structuredClone(edited);changed.widgets.tips.visible=false;
    await action({type:'settings',settings:{portrait:changed}});
    const restored=await action({type:'import',data:backup,expectedRecapRevision:backup.recap.revision});assert.deepEqual(restored.portrait,edited);assert.deepEqual(restored.widgets,widgets);
    await landscape.reader.cancel();await portrait.reader.cancel();
    await app.close();app=createApp(config);await listen();
    const reconnected=await connect('portrait'),saved=await reconnected.next();
    assert.notEqual(saved.instance,initial.instance);assert.deepEqual(saved.portrait,edited);assert.deepEqual(saved.widgets,widgets);
    assert.equal(saved.session.results[0].result,'win');assert.equal(saved.revision,0);
    assert.equal(saved.recap,undefined);
    const relogin=await post('/api/login',{password:config.password},false);cookie=relogin.headers.get('set-cookie').split(';')[0];
    const privateRecap=await(await fetch(base+'/api/recap',{headers:{cookie}})).json();
    assert.equal(privateRecap.recap.draft.text,backup.recap.draft.text);
    assert.equal((await post(`/api/action?token=${config.token}`,{type:'record',result:'loss'},false)).status,401);
  } finally {
    await Promise.allSettled(readers.map(reader=>reader.cancel()));await app.close();rmSync(dir,{recursive:true,force:true});
  }
});
