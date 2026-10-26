import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaults,tickerMessages} from '../public/model.mjs';
import {channelText,channelLabel,validChannel} from '../public/identity.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
import {Store} from '../lib/store.mjs';
import {recapStats,renderRecapTemplate} from '../public/recap-model.mjs';
import {layoutState} from '../public/layouts.mjs';
import {createApp} from '../server.mjs';

const names=['','   ','jamespawn','A','Jane Doe • 棋 ♞','<img src=x onerror=alert(1)>','N'.repeat(80)];
test('creator names are bounded single-line display text, with consistent blank fallbacks',()=>{
 assert.equal(defaults().channel,'');
 for(const name of names){
  assert.equal(validChannel(name),true);
  assert.equal(channelText(name),name.trim()||'this channel');
  assert.equal(channelLabel(name),name.trim().toUpperCase()||'LIVE');
 }
 for(const name of [null,undefined,{},42,'N'.repeat(81),'a\nb','a\tb','a\0b','a\u0085b','a\u2028b']){
  assert.equal(validChannel(name),false);
  assert.throws(()=>applyAction(defaults(),{type:'settings',settings:{channel:name}}),/Channel \/ creator name/);
 }
 assert.equal(validChannel('♞'.repeat(80)),true);
 assert.equal(validChannel('😀'.repeat(40)),true);
 assert.equal(validChannel('😀'.repeat(41)),false);
});

test('names survive backups, presets, persistence and resets without affecting Chess.com identity or recap links',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pawn-identity-'));
 try{
  for(const channel of names){
   let state=defaults();state.username='chess_player';state.api.stats={chess_blitz:{last:{rating:1234}}};state.session.baseline.blitz=1200;
   state.credits.brand='JAMES PAWN';state.credits.subtitle='My saved production';
   state=applyAction(state,{type:'settings',settings:{channel}});
   assert.equal(state.api.stats.chess_blitz.last.rating,1234);assert.equal(state.session.baseline.blitz,1200);
   state.ticker.messages=[{id:'follow',text:'Follow {channel} for more chess! {username}',enabled:true}];
   for(const layout of ['landscape','portrait'])assert.equal(tickerMessages(layoutState(state,layout))[0],`Follow ${channelText(channel)} for more chess! chess_player`);
   assert.equal(renderRecapTemplate('{username} {stream_link}',recapStats(state),{streamLink:'https://example.com/live'}),'chess_player https://example.com/live');
   state=applyAction(state,{type:'save-preset',name:'Saved'});
   const backup={version:1,settings:settingsOf(state),session:state.session,presets:state.presets};
   state=applyAction(defaults(),{type:'import',data:JSON.parse(JSON.stringify(backup))});
   assert.equal(state.channel,channel);assert.equal(state.presets.Saved.channel,channel);
   state=applyAction(state,{type:'settings',settings:{channel:'Current creator'}});
   state=applyAction(state,{type:'load-preset',name:'Saved'});assert.equal(state.channel,'Current creator');
   state=applyAction(state,{type:'settings',settings:{channel}});
   state=applyAction(state,{type:'reset'});assert.equal(state.channel,channel);
   for(const kind of ['cta','tips']){state=applyAction(state,{type:'starter-templates',kind,operation:'restore',expected:kind==='cta'?state.ticker.messages:state.tips.items});assert.equal(state.channel,channel);}
   let store=new Store(dir);store.set('state',state);store.close();
   store=new Store(dir);const loaded=store.state('ignored_player');assert.equal(loaded.channel,channel);assert.equal(loaded.credits.brand,'JAMES PAWN');assert.equal(loaded.credits.subtitle,'My saved production');store.close();
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('authenticated settings and backups accept blank names; invalid names fail without mutation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pawn-identity-http-'));
 const config={dataDir:dir,username:'chess_player',password:'identity-test-password',token:'identity-test-overlay-token',poll:false};
 let app=createApp(config),base;
 const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};
 const post=(path,data,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});
 try{
  await start();
  assert.equal((await fetch(base+'/identity.mjs')).status,200);
  assert.equal((await post('/api/action',{type:'settings',settings:{channel:''}})).status,401);
  let login=await post('/api/login',{password:config.password});let cookie=login.headers.get('set-cookie').split(';')[0];
  for(const channel of names){
   assert.equal((await post('/api/action',{type:'settings',settings:{channel}},cookie)).status,200);
   const backup=await (await fetch(base+'/api/export',{headers:{cookie}})).json();
   assert.equal(backup.settings.channel,channel);
   const imported=await post('/api/action',{type:'import',data:backup,expectedRecapRevision:backup.recap.revision,expectedGoalRevision:backup.goalTracker.revision},cookie);
   assert.equal(imported.status,200,await imported.text());
  }
  assert.equal((await post('/api/action',{type:'settings',settings:{channel:''}},cookie)).status,200);
  assert.equal((await post('/api/action',{type:'settings',settings:{channel:'x'.repeat(81)}},cookie)).status,400);
  assert.equal(app.getState().channel,'');
  await app.close();app=createApp(config);await start();
  assert.equal(app.getState().channel,'');
  assert.equal((await fetch(base+'/api/state')).status,401);
  assert.equal((await fetch(base+'/api/state?token='+config.token)).status,200);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
