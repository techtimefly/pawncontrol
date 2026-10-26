import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,clock,elapsed} from '../public/model.mjs';
import {upgradeLayouts,layoutState} from '../public/layouts.mjs';
import {applyAction,settingsOf,validateSettings} from '../lib/state.mjs';
import {sessionClockDefaults,sessionClockStatus,clockFontSize} from '../public/session-clock.mjs';

test('legacy settings and backups gain only hidden clock defaults; migration is idempotent',()=>{
  const state=defaults(),legacy=settingsOf(state);delete legacy.sessionClock;delete legacy.widgets.clock;delete legacy.portrait.widgets.clock;
  const upgraded=upgradeLayouts(legacy);validateSettings(upgraded);
  assert.equal(upgraded.widgets.clock.visible,false);assert.equal(upgraded.portrait.widgets.clock.visible,false);
  assert.deepEqual(upgraded.sessionClock,sessionClockDefaults());assert.deepEqual(upgradeLayouts(upgraded),upgraded);
  assert.deepEqual(upgraded.widgets.stats,legacy.widgets.stats);assert.deepEqual(upgraded.portrait.widgets.stats,legacy.portrait.widgets.stats);
  const imported=applyAction(state,{type:'import',data:{version:1,settings:legacy,session:state.session,presets:{Legacy:legacy}}});
  assert.deepEqual(imported.sessionClock,sessionClockDefaults());assert.equal(imported.presets.Legacy.widgets.clock.visible,false);
});

test('clock styles and geometry roundtrip through backup and preset independently',()=>{
  let state=defaults();state.sessionClock.portrait.font=100;state.sessionClock.landscape.showStatus=false;
  state.widgets.clock.visible=true;state.portrait.widgets.clock.x=300;
  state=applyAction(state,{type:'save-preset',name:'Clocks'});
  const imported=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(state),session:state.session,presets:state.presets}});
  assert.deepEqual(imported.sessionClock,state.sessionClock);assert.deepEqual(imported.portrait.widgets.clock,state.portrait.widgets.clock);
  imported.sessionClock.portrait.font=40;imported.widgets.clock.visible=false;
  const restored=applyAction(imported,{type:'load-preset',name:'Clocks'});
  assert.deepEqual(restored.sessionClock,state.sessionClock);assert.equal(restored.widgets.clock.visible,true);
});

test('both compositions read the same authoritative session across commands and unrelated settings',t=>{
  t.mock.timers.enable({apis:['Date'],now:100000});
  let s=defaults();assert.equal(sessionClockStatus(s.session),'Not started');
  s=applyAction(s,{type:'timer',command:'start'});t.mock.timers.tick(5200);
  for(const layout of ['landscape','portrait']){const view=layoutState(s,layout);assert.equal(view.session,s.session);assert.equal(clock(elapsed(view.session)),'00:00:05');assert.equal(sessionClockStatus(view.session),'Running');}
  s=applyAction(s,{type:'settings',settings:{sessionClock:{...s.sessionClock,portrait:{...s.sessionClock.portrait,color:'#ffffff'}}}});
  assert.equal(elapsed(s.session),5200);s=applyAction(s,{type:'timer',command:'pause'});t.mock.timers.tick(5000);
  assert.equal(elapsed(s.session),5200);assert.equal(sessionClockStatus(s.session),'Paused');
  s=applyAction(s,{type:'timer',command:'restart'});assert.equal(elapsed(s.session),0);assert.equal(sessionClockStatus(s.session),'Running');
  s=applyAction(s,{type:'timer',command:'reset'});assert.equal(sessionClockStatus(s.session),'Not started');
});

test('style edits isolate orientations, reject stale clients, and validate all fields atomically',()=>{
  const initial=defaults(),expected=structuredClone(initial.sessionClock);
  let state=applyAction(initial,{type:'session-clock-style',layout:'portrait',expected:expected.portrait,patch:{font:80}});
  state=applyAction(state,{type:'session-clock-style',layout:'landscape',expected:expected.landscape,patch:{showStatus:false}});
  assert.equal(state.sessionClock.portrait.font,80);assert.equal(state.sessionClock.landscape.showStatus,false);
  assert.throws(()=>applyAction(state,{type:'session-clock-style',layout:'portrait',expected:expected.portrait,patch:{font:60}}),/changed elsewhere/);
  for(const patch of [{font:NaN},{font:161},{family:'url(evil)'},{color:'red'},{background:'<script>'},{opacity:101},{showStatus:1},{extra:true}]) {
    assert.throws(()=>applyAction(initial,{type:'session-clock-style',layout:'portrait',expected:expected.portrait,patch}),/Invalid/);
  }
  assert.deepEqual(initial.sessionClock,expected);
});

test('clock text shrinks to narrow boxes and long elapsed durations',()=>{
  for(const text of ['00:00:00','277777:46:39'])for(const showStatus of [true,false]){
    const style={...sessionClockDefaults().portrait,showStatus},widget={w:150,h:40,scale:2};
    const size=clockFontSize(style,widget,text);
    assert.ok(size>0);assert.ok(size*text.length*.65<=widget.w-12);assert.ok(size*(showStatus?1.9:1.2)<=widget.h-8);
  }
});
