import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaults,totals,tickerEntries} from '../public/model.mjs';
import {layoutDimensions,layoutState,portraitDefaults,upgradeLayouts} from '../public/layouts.mjs';
import {applyAction,settingsOf,validateSettings} from '../lib/state.mjs';
import {Store} from '../lib/store.mjs';

test('explicit compositions share broadcast data and retain independent geometry and typography',()=>{
  let state=defaults();
  state=applyAction(state,{type:'record',result:'win'});
  state=applyAction(state,{type:'settings',settings:{portrait:{...state.portrait,widgets:{...state.portrait.widgets,stats:{...state.portrait.widgets.stats,x:80,w:900}},typography:{...state.portrait.typography,font:40}}}});
  const landscape=layoutState(state,'landscape'),portrait=layoutState(state,'portrait');
  assert.deepEqual(layoutDimensions('landscape'),{width:2560,height:1440});
  assert.deepEqual(layoutDimensions('portrait'),{width:1080,height:1920});
  assert.equal(portrait.layout,'portrait');assert.equal(landscape.layout,'landscape');
  assert.equal(landscape.widgets.stats.x,2070);assert.equal(portrait.widgets.stats.x,80);
  assert.equal(landscape.theme.font,26);assert.equal(portrait.theme.font,40);
  assert.equal(landscape.session,portrait.session);assert.equal(totals(portrait.session).win,1);
  assert.equal(landscape.credits.sections,portrait.credits.sections);
  assert.equal(landscape.socials.items,portrait.socials.items);
  assert.deepEqual(tickerEntries(portrait),tickerEntries(landscape));
  assert.equal(state.theme.font,26);
});

test('portrait preset is in bounds and does not overwrite legacy landscape compositions',()=>{
  const state=defaults(),legacy=settingsOf(state);delete legacy.portrait;delete legacy.landscapeGuides;
  legacy.widgets.stats.x=2000;legacy.theme.font=42;
  const upgraded=upgradeLayouts(legacy);validateSettings(upgraded);
  assert.deepEqual(upgraded.widgets,legacy.widgets);assert.deepEqual(upgraded.theme,legacy.theme);
  assert.deepEqual(upgraded.portrait,portraitDefaults());
  assert.equal(upgraded.portrait.widgets.credits.h,1920);
  assert.equal(upgraded.portrait.guides.board.enabled,false);
  assert.equal(upgraded.portrait.guides.camera.enabled,false);
  assert.equal(upgraded.portrait.guides.safeArea.enabled,false);
  assert.deepEqual(upgradeLayouts(upgraded),upgraded);
});

test('both layouts and guides persist through store reload, presets and backup import',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-layouts-')),store=new Store(dir);
  try {
    let state=defaults();state.portrait.widgets.tips.visible=true;
    state.portrait.guides.safeArea.enabled=true;state.portrait.guides.safeArea.bottom=160;
    state.landscapeGuides.camera.enabled=true;
    state=applyAction(state,{type:'save-preset',name:'Dual'});
    store.set('state',state);const reloaded=store.state();assert.deepEqual(reloaded.portrait,state.portrait);
    const restored=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(state),presets:state.presets,session:state.session}});
    assert.deepEqual(restored.portrait,state.portrait);assert.deepEqual(restored.landscapeGuides,state.landscapeGuides);
    restored.portrait.widgets.tips.visible=false;
    assert.equal(applyAction(restored,{type:'load-preset',name:'Dual'}).portrait.widgets.tips.visible,true);
    const legacy=settingsOf(state);delete legacy.portrait;delete legacy.landscapeGuides;
    store.set('state',{...legacy,session:state.session,presets:{Old:legacy}});
    const migrated=store.state();assert.deepEqual(migrated.widgets,state.widgets);
    assert.deepEqual(migrated.portrait,portraitDefaults());assert.deepEqual(migrated.presets.Old.portrait,portraitDefaults());
    const oldBackup=applyAction(defaults(),{type:'import',data:{version:1,settings:legacy,session:state.session,presets:{Old:legacy}}});
    assert.deepEqual(oldBackup.widgets,legacy.widgets);assert.deepEqual(oldBackup.portrait,portraitDefaults());
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});

test('portrait validation rejects off-canvas geometry, unsafe guides and invalid typography atomically',()=>{
  const state=defaults(),before=structuredClone(state);
  for(const mutate of [
    p=>p.widgets.stats.x=1080,p=>p.widgets.credits.h=1921,p=>p.widgets.stats.scale=0,
    p=>p.typography.font=NaN,p=>p.typography.socialsFont=100,
    p=>p.guides.safeArea.bottom=1900,p=>p.guides.board.w=1081,p=>p.guides.camera.enabled='yes',
    p=>p.selected='portrait'
  ]) {
    const portrait=portraitDefaults();mutate(portrait);
    assert.throws(()=>applyAction(state,{type:'settings',settings:{portrait}}));
  }
  assert.deepEqual(state,before);
  assert.throws(()=>applyAction(state,{type:'settings',settings:{landscapeGuides:{}}}));
});

test('interleaved composition edits and shared playback preserve the other composition',()=>{
  const initial=defaults();
  const portrait=structuredClone(initial.portrait);portrait.widgets.scoreboard.visible=false;portrait.widgets.stats.w=900;
  const widgets=structuredClone(initial.widgets);widgets.ticker.y=1300;widgets.stats.visible=false;
  let state=applyAction(initial,{type:'settings',settings:{portrait}});
  state=applyAction(state,{type:'record',result:'win'});
  state=applyAction(state,{type:'settings',settings:{widgets}});
  state=applyAction(state,{type:'credits-playback',command:'restart'});
  assert.deepEqual(state.portrait,portrait);assert.deepEqual(state.widgets,widgets);
  assert.equal(totals(layoutState(state,'portrait').session).win,1);
  assert.equal(layoutState(state,'portrait').creditsPlayback.seq,layoutState(state,'landscape').creditsPlayback.seq);
  const reset=applyAction(state,{type:'settings',settings:{portrait:portraitDefaults()}});
  assert.deepEqual(reset.widgets,widgets);assert.deepEqual(reset.session,state.session);
  assert.deepEqual(reset.ticker,state.ticker);assert.deepEqual(reset.credits,state.credits);
});
