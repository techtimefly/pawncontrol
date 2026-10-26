import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimerControls} from '../public/timer-controls.mjs';
import {defaults,elapsed,totals} from '../public/model.mjs';
import {applyAction} from '../lib/state.mjs';

test('delayed timer undo restores captured elapsed with fresh anchor; score undo preserves it',t=>{
 t.mock.timers.enable({apis:['Date'],now:100000});
 let s=applyAction(defaults(),{type:'timer',command:'start'});
 t.mock.timers.tick(5000);s=applyAction(s,{type:'record',result:'win'});
 t.mock.timers.tick(5000);s=applyAction(s,{type:'timer',command:'pause'});
 t.mock.timers.tick(60000);s=applyAction(s,{type:'undo'});assert.equal(elapsed(s.session),10000);
 t.mock.timers.tick(5000);const anchor=s.session.runningSince;s=applyAction(s,{type:'undo'});
 assert.equal(elapsed(s.session),15000);assert.equal(s.session.runningSince,anchor);assert.equal(totals(s.session).win,0);
});
for(const running of [true,false])for(const command of ['reset','restart','pause','start'])test(`delayed undo ${command} from ${running?'running':'stopped'}`,t=>{
 t.mock.timers.enable({apis:['Date'],now:100000});
 let s=defaults();s.session.elapsed=5000;s.session.runningSince=running?Date.now():null;
 if((running&&command==='start')||(!running&&command==='pause'))return;
 const before=structuredClone(s.session);s=applyAction(s,{type:'timer',command});
 if(command==='reset'){assert.equal(elapsed(s.session),0);assert.equal(s.session.runningSince,null);}
 assert.deepEqual(s.session.results,before.results);
 t.mock.timers.tick(60000);s=applyAction(s,{type:'undo'});
 assert.equal(elapsed(s.session),5000);assert.equal(s.session.runningSince,running?Date.now():null);
 t.mock.timers.tick(1000);assert.equal(elapsed(s.session),running?6000:5000);
});
test('full session reset and legacy undo intentionally restore entire session',t=>{
 t.mock.timers.enable({apis:['Date'],now:100000});
 let s=applyAction(defaults(),{type:'timer',command:'start'});s=applyAction(s,{type:'record',result:'win'});
 const previous=structuredClone(s.session);s=applyAction(s,{type:'reset'});t.mock.timers.tick(5000);
 s=applyAction(s,{type:'undo'});assert.deepEqual(s.session,previous);assert.equal(elapsed(s.session),5000);
});
test('rapid clicks capture intent once, pending survives rerender, failure permits retry and confirmation cancels',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{setAttribute(){}});return elements.get(id);};
 let state=defaults(),resolve,reject,confirmed=true;const calls=[];
 const controls=createTimerControls({document:{getElementById:get},getState:()=>state,confirmChange:async()=>confirmed,
 action:a=>{calls.push(a);return new Promise((yes,no)=>{resolve=yes;reject=no;});}});
 const first=get('timer').onclick();await get('timer').onclick();assert.equal(calls.length,1);assert.deepEqual(calls[0],{type:'timer',command:'start'});
 state=applyAction(state,{type:'timer',command:'start'});controls.render();assert.equal(get('timer').disabled,true);resolve();await first;assert.equal(get('timer').disabled,false);
 const failed=get('timer').onclick();reject(Error('offline'));await assert.rejects(failed,/offline/);assert.equal(get('timer').disabled,false);
 const retry=get('timer').onclick();assert.equal(calls.at(-1).command,'pause');resolve();await retry;
 confirmed=false;await get('reset-timer').onclick();assert.equal(calls.length,3);assert.equal(get('reset-timer').disabled,false);
 confirmed=true;const resetting=get('reset-timer').onclick();await Promise.resolve();assert.equal(calls.at(-1).command,'reset');resolve();await resetting;
});
test('zero epoch anchor is running',()=>{const s=defaults().session;s.runningSince=0;assert.equal(elapsed(s,5000),5000);});
