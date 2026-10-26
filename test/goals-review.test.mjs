import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/model.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
import {goalProgress} from '../public/goals-model.mjs';
import {recapSessionKey} from '../public/recap-model.mjs';
let seq=0;
const act=(s,operation,extra={})=>applyAction(s,{type:'goal',operation,operationId:`review-${++seq}`,expectedRevision:s.goalTracker.revision,...extra});
const add=(s,kind,extra={})=>act(s,'add',{goal:{title:'Review goal',kind,target:5,scope:kind==='rating'?'ongoing':'session',baseline:'session-start',...extra}});
const progress=s=>goalProgress(s,s.goalTracker.items[0]);
test('review: from-now excluded result IDs survive corrections, history changes and score undo',()=>{
 let s=applyAction(defaults(),{type:'record',result:'loss'});const old=s.session.results[0].id;
 s=add(s,'wins',{baseline:'from-now'});s=applyAction(s,{type:'edit-result',id:old,result:'win'});assert.equal(progress(s).current,0);
 s=applyAction(s,{type:'totals',totals:{win:80,loss:0,draw:0}});assert.equal(progress(s).current,0);
 s=applyAction(s,{type:'record',result:'win'});assert.equal(progress(s).current,1);
 s=act(s,'edit',{id:s.goalTracker.items[0].id,goal:{title:'Edited after score'}});
 s=applyAction(s,{type:'undo'});assert.equal(progress(s).current,0);assert.equal(s.goalTracker.items[0].title,'Edited after score');
 s=applyAction(s,{type:'delete-result',id:old});assert.equal(progress(s).current,0);
 s=applyAction(s,{type:'undo'});assert.equal(progress(s).current,0);
});
test('review: title-only rating edit cannot overwrite the shared target changed through settings',()=>{
 let s=add(defaults(),'rating',{mode:'blitz',target:1600});
 s=applyAction(s,{type:'settings',expectedGoalRevision:s.goalTracker.revision,settings:{goals:{...s.goals,blitz:1800}}});
 s=act(s,'edit',{id:s.goalTracker.items[0].id,goal:{title:'Renamed'}});
 assert.equal(s.goals.blitz,1800);assert.equal(progress(s).target,1800);
 assert.throws(()=>applyAction(s,{type:'settings',settings:{goals:{...s.goals,blitz:1700}}}),/changed elsewhere/);
 assert.throws(()=>applyAction(s,{type:'settings',expectedGoalRevision:0,settings:{goals:{...s.goals,blitz:1700}}}),/changed elsewhere/);
});
test('review: atomic recap reset freezes outcomes and ongoing manual goals survive resets',()=>{
 let s=add(defaults(),'manual',{scope:'ongoing'});const id=s.goalTracker.items[0].id;
 s=act(s,'manual',{id,delta:1});
 const recap=(operation,extra)=>applyAction(s,{type:'recap',operation,expectedRevision:s.recap?.revision??0,expectedSessionKey:recapSessionKey(s),...extra});
 s=recap('save-draft',{kind:'complete',text:'Finished',refreshStats:true});
 s=recap('complete',{text:'Finished',reset:true});const frozen=structuredClone(s.recap.snapshots[0]);
 assert.equal(progress(s).current,1);assert.equal(frozen.stats.goals[0].current,1);
 s=act(s,'manual',{id,delta:1});s=act(s,'edit',{id,goal:{title:'Changed',target:99}});
 assert.deepEqual(s.recap.snapshots[0],frozen);s=applyAction(s,{type:'undo'});assert.deepEqual(s.recap.snapshots[0],frozen);assert.equal(progress(s).current,2);
});
test('review: goal writes reject stale clients and duplicate operation retries cannot double-count',()=>{
 let s=add(defaults(),'manual');const before=s.goalTracker.revision,id=s.goalTracker.items[0].id;
 const action={type:'goal',operation:'manual',id,delta:1,expectedRevision:before,operationId:'one-unique-increment'};
 s=applyAction(s,action);s=applyAction(s,action);assert.equal(progress(s).current,1);
 assert.throws(()=>applyAction(s,{...action,operationId:'new-stale-request'}),/changed elsewhere/);
});
test('review: malformed goal import leaves source untouched and legacy import drops incompatible tracking',()=>{
 let s=add(defaults(),'manual');const original=structuredClone(s);
 const backup={version:1,settings:settingsOf(s),session:s.session,goalTracker:{...s.goalTracker,items:[{...s.goalTracker.items[0],manualValue:-1}]}};
 assert.throws(()=>applyAction(s,{type:'import',expectedGoalRevision:s.goalTracker.revision,data:backup}),/Invalid goal/);assert.deepEqual(s,original);
 delete backup.goalTracker;assert.throws(()=>applyAction(s,{type:'import',data:backup}),/changed elsewhere/);
 s=applyAction(s,{type:'import',expectedGoalRevision:s.goalTracker.revision,data:backup});assert.deepEqual(s.goalTracker.items,[]);
});
