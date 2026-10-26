import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {defaults} from '../public/model.mjs';
import {settingsOf,validateSettings} from '../lib/state.mjs';
import {Store} from '../lib/store.mjs';

test('presentation integration: authenticated clients, isolated edits, SSE, backup, preset and restart', {timeout:20000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-presentation-http-'));
  const config={dataDir:dir,username:'presentation_test',password:'presentation-password-123456',token:'presentation-readonly-token-123456',poll:false,
    fetcher:async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json','Cache-Control':'max-age=86400'}})};
  let app=createApp(config),base;const readers=[];
  const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};
  const post=(path,data,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});
  const login=async()=>{const r=await post('/api/login',{password:config.password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  const act=async(cookie,data)=>{const r=await post('/api/action',data,cookie);assert.equal(r.status,200,await r.clone().text());return (await r.json()).state;};
  const connect=async()=>{
    const r=await fetch(base+'/api/events?token='+config.token,{signal:AbortSignal.timeout(18000)});assert.equal(r.status,200);
    const reader=r.body.getReader();readers.push(reader);let buffer='';const decoder=new TextDecoder();
    return {reader,async next(revision=0){for(;;){const end=buffer.indexOf('\n\n');if(end>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const line=block.split('\n').find(l=>l.startsWith('data: '));if(line){const s=JSON.parse(line.slice(6));if(s.revision>=revision)return s;}continue;}const part=await reader.read();assert.equal(part.done,false);buffer+=decoder.decode(part.value,{stream:true});}}};
  };
  try {
    await start();let c1=await login(),c2=await login();const landscape=await connect(),portrait=await connect();
    const initial=await landscape.next();assert.deepEqual(await portrait.next(),initial);
    for(const file of ['guide-editor.mjs','session-clock.mjs','goals-presentation.mjs','goals-presentation-controls.mjs']){
      const r=await fetch(base+'/'+file);assert.equal(r.status,200,file);assert.match(r.headers.get('content-type'),/javascript/);assert.ok((await r.text()).length>0);
    }
    const guide={type:'layout-guide',layout:'portrait',key:'board',expected:initial.portrait.guides.board,value:{...initial.portrait.guides.board,enabled:true,x:80,w:900,aspectLocked:true}};
    const clock={type:'session-clock-style',layout:'landscape',expected:initial.sessionClock.landscape,patch:{font:80,color:'#abcdef'}};
    const presentation={type:'goal-presentation',layout:'landscape',expectedPresentation:initial.goalPresentation.landscape,presentation:{...initial.goalPresentation.landscape,mode:'horizontal',chart:'bar',selectedIds:[]}};
    for(const command of [guide,clock,presentation])assert.equal((await post('/api/action?token='+config.token,command)).status,401);
    // Client 2's stale guide draft must not restore client 1's earlier widget positions.
    const edited=structuredClone(initial.portrait);edited.widgets.stats.x=90;edited.widgets.stats.w=900;
    let state=await act(c1,{type:'settings',settings:{portrait:edited}});
    state=await act(c2,guide);assert.deepEqual(state.portrait.widgets,edited.widgets);assert.deepEqual(state.widgets,initial.widgets);
    assert.equal((await post('/api/action',guide,c1)).status,400,'stale same-guide write rejected');
    state=await act(c1,clock);
    state=await act(c2,{type:'session-clock-style',layout:'portrait',expected:initial.sessionClock.portrait,patch:{font:44,showStatus:false}});
    assert.equal(state.sessionClock.landscape.font,80);assert.equal(state.sessionClock.portrait.font,44);
    assert.equal((await post('/api/action',clock,c2)).status,400,'stale same-clock-style write rejected');
    state=await act(c1,presentation);
    state=await act(c2,{type:'goal-presentation',layout:'portrait',expectedPresentation:initial.goalPresentation.portrait,presentation:{...initial.goalPresentation.portrait,mode:'stacked',chart:'donut',maxVisible:2}});
    assert.equal(state.goalPresentation.landscape.mode,'horizontal');assert.equal(state.goalPresentation.portrait.mode,'stacked');
    assert.equal((await post('/api/action',{...presentation,presentation:{...presentation.presentation,mode:'rotating'}},c2)).status,400,'stale same-presentation write rejected');
    assert.deepEqual(state.portrait.widgets,edited.widgets);assert.deepEqual(state.widgets,initial.widgets);
    state=await act(c1,{type:'record',result:'win'});
    state=await act(c2,{type:'timer',command:'restart'});
    const a=await landscape.next(state.revision),b=await portrait.next(state.revision);
    assert.deepEqual(a,b);assert.deepEqual(a.session,state.session);assert.equal(a.session.results.length,1);assert.notEqual(a.session.runningSince,null);
    state=await act(c1,{type:'timer',command:'pause'});
    state=await act(c1,{type:'save-preset',name:'Integrated presentation'});
    const saved=settingsOf(state),backup=await(await fetch(base+'/api/export',{headers:{cookie:c1}})).json();
    assert.deepEqual(backup.settings,saved);assert.deepEqual(backup.presets['Integrated presentation'],saved);
    state=await act(c2,{type:'session-clock-style',layout:'landscape',expected:state.sessionClock.landscape,patch:{font:32}});
    state=await act(c2,{type:'load-preset',name:'Integrated presentation'});
    assert.deepEqual(settingsOf(state),saved);assert.equal(state.session.results.length,1);
    state=await act(c1,{type:'import',data:backup,expectedGoalRevision:state.goalTracker.revision,expectedRecapRevision:backup.recap.revision});
    assert.deepEqual(settingsOf(state),saved);assert.deepEqual(state.session,backup.session);
    await landscape.reader.cancel();await portrait.reader.cancel();await app.close();app=createApp(config);await start();
    c1=await login();c2=await login();const reconnected=await connect(),reopened=await reconnected.next();
    assert.notEqual(reopened.instance,initial.instance);assert.deepEqual(settingsOf(reopened),saved);assert.deepEqual(reopened.session,backup.session);
    // Legacy backups and their presets add new defaults without altering old widgets.
    const legacy=structuredClone(backup);delete legacy.recap;delete legacy.goalTracker;
    for(const settings of [legacy.settings,...Object.values(legacy.presets)]){delete settings.sessionClock;delete settings.goalPresentation;delete settings.widgets.clock;delete settings.portrait.widgets.clock;}
    state=await act(c2,{type:'import',data:legacy,expectedGoalRevision:reopened.goalTracker.revision});
    for(const layout of ['landscape','portrait']){
      const current=layout==='portrait'?state.portrait:state,old=layout==='portrait'?legacy.settings.portrait:legacy.settings;
      assert.equal(current.widgets.clock.visible,false);for(const id of Object.keys(old.widgets))assert.deepEqual(current.widgets[id],old.widgets[id]);
      assert.equal(state.goalPresentation[layout].selectedIds,null);assert.equal(state.goalPresentation[layout].mode,'single');
    }
    assert.deepEqual(state.session,backup.session);assert.equal(state.goalTracker.items.length,0);
    await reconnected.reader.cancel();
  } finally {await Promise.allSettled(readers.map(r=>r.cancel()));await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('old on-disk state and presets gain hidden clock and presentation defaults idempotently',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-presentation-store-')),store=new Store(dir);
  try {
    const legacy=defaults();legacy.username='migration_test';legacy.widgets.stats.x=2010;legacy.portrait.widgets.stats.x=75;
    delete legacy.sessionClock;delete legacy.goalPresentation;delete legacy.widgets.clock;delete legacy.portrait.widgets.clock;
    legacy.presets={Legacy:settingsOf(legacy)};const before=structuredClone(legacy);store.set('state',legacy);
    const migrated=store.state();validateSettings(settingsOf(migrated));validateSettings(migrated.presets.Legacy);
    assert.equal(migrated.widgets.clock.visible,false);assert.equal(migrated.portrait.widgets.clock.visible,false);
    assert.deepEqual(migrated.widgets.stats,before.widgets.stats);assert.deepEqual(migrated.portrait.widgets.stats,before.portrait.widgets.stats);
    assert.deepEqual(migrated.session,before.session);store.set('state',migrated);assert.deepEqual(store.state(),migrated);
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});
