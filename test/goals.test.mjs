import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/model.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
import {goalProgress} from '../public/goals-model.mjs';
import {recapSessionKey} from '../public/recap-model.mjs';
let sequence=0;
const act=(s,operation,rest={})=>applyAction(s,{type:'goal',operation,expectedRevision:s.goalTracker.revision,operationId:`test-${++sequence}`,...rest});
const add=(s,kind,extra={})=>act(s,'add',{goal:{kind,title:`Goal ${kind}`,target:5,...extra}});
const record=(s,result)=>applyAction(s,{type:'record',result});
test('recorded-only counts, ID baselines, edit/delete and score undo preserve goal configuration',()=>{
  let s=record(defaults(),'win');s=add(s,'wins',{baseline:'from-now'});const id=s.goalTracker.items[0].id;
  s=record(s,'loss');s=record(s,'win');assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1);
  s=applyAction(s,{type:'totals',totals:{win:99,loss:0,draw:0}});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1);
  s=applyAction(s,{type:'edit-result',id:s.session.results[1].id,result:'win'});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,2);
  s=act(s,'edit',{id,goal:{title:'Edited',target:9}});s=applyAction(s,{type:'undo'});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1);assert.equal(s.goalTracker.items[0].title,'Edited');
  const baseline=s.session.results[0].id;s=applyAction(s,{type:'delete-result',id:baseline});s=applyAction(s,{type:'undo'});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1);
});
test('games from start include draws and count only recorded results',()=>{
  let s=record(record(defaults(),'win'),'draw');s=add(s,'games');assert.equal(goalProgress(s,s.goalTracker.items[0]).current,2);
  s=applyAction(s,{type:'totals',totals:{win:1,loss:10,draw:1}});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,2);
});
test('session resets end goals, snapshot progress and require explicit repeat; reset undo restores live progress',()=>{
  let s=add(defaults(),'games');s=record(s,'win');const id=s.goalTracker.items[0].id;
  s=applyAction(s,{type:'reset'});assert.equal(goalProgress(s,s.goalTracker.items[0]).status,'ended');assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1);
  s=applyAction(s,{type:'undo'});assert.equal(goalProgress(s,s.goalTracker.items[0]).status,'current');
  s=applyAction(s,{type:'reset'});s=act(s,'repeat',{id});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,0);
});
test('manual counter independent undo, optimistic concurrency, operation replay and tracking while hidden',()=>{
  let s=add(defaults(),'manual');const id=s.goalTracker.items[0].id;
  const a={type:'goal',operation:'manual',expectedRevision:s.goalTracker.revision,operationId:'replay',id,delta:1};
  s=applyAction(s,a);s=applyAction(s,a);assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1);
  assert.throws(()=>applyAction(s,{...a,operationId:'different'}),/changed elsewhere/);
  s=act(s,'manual',{id,delta:1});s=act(s,'undo',{id});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1);assert.equal(s.goalTracker.featuredId,null);
  s=act(s,'undo',{id});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,0);assert.throws(()=>act(s,'manual',{id,delta:-1}),/0-1000000/);
});
test('rating uses shared targets, valid start, honest regression, missing and stale data and survives reset',()=>{
  let s=defaults();s.api.stats={chess_blitz:{last:{rating:1300}}};s.api.statsSuccessAt=Date.now();s=add(s,'rating',{mode:'blitz',target:1500});
  assert.equal(s.goals.blitz,1500);assert.equal(s.goalTracker.items[0].startRating,1300);
  s.api.stats.chess_blitz.last.rating=1200;let p=goalProgress(s,s.goalTracker.items[0]);assert.equal(p.distance,300);assert.equal(p.startRating,1300);
  s=applyAction(s,{type:'reset'});assert.equal(goalProgress(s,s.goalTracker.items[0]).current,1200);
  s=applyAction(s,{type:'settings',expectedGoalRevision:s.goalTracker.revision,settings:{goals:{...s.goals,blitz:1600}}});assert.equal(goalProgress(s,s.goalTracker.items[0]).target,1600);
  s=act(s,'edit',{id:s.goalTracker.items[0].id,goal:{title:'Renamed'}});assert.equal(s.goals.blitz,1600);
  s.api.statsError='failed';assert.equal(goalProgress(s,s.goalTracker.items[0]).status,'stale');s.api.stats=null;assert.equal(goalProgress(s,s.goalTracker.items[0]).current,null);
  s.overrides.blitz=0;assert.equal(goalProgress(s,s.goalTracker.items[0]).current,0);
  s=applyAction(s,{type:'settings',settings:{username:'new_player'}});assert.equal(goalProgress(s,s.goalTracker.items[0]).status,'unavailable');
});
test('recap capture immutable across later edits, atomic reset and legacy backups',()=>{
  let s=record(add(defaults(),'games'),'win');
  s=applyAction(s,{type:'recap',operation:'save-draft',expectedRevision:0,expectedSessionKey:recapSessionKey(s),refreshStats:true,kind:'complete',text:'Summary'});
  s=applyAction(s,{type:'recap',operation:'complete',expectedRevision:1,expectedSessionKey:recapSessionKey(s),reset:true,text:'Summary'});
  const snapshot=structuredClone(s.recap.snapshots[0]);assert.equal(snapshot.stats.goals[0].current,1);
  s=act(s,'edit',{id:s.goalTracker.items[0].id,goal:{title:'Later',target:20}});assert.deepEqual(s.recap.snapshots[0],snapshot);
  const backup={version:1,settings:settingsOf(s),session:s.session,goalTracker:s.goalTracker,recap:s.recap};
  const restored=applyAction(defaults(),{type:'import',data:backup,expectedGoalRevision:0,expectedRecapRevision:0});assert.equal(restored.goalTracker.items.length,1);
  delete backup.goalTracker;const legacy=applyAction(s,{type:'import',data:backup,expectedGoalRevision:s.goalTracker.revision,expectedRecapRevision:s.recap.revision});assert.equal(legacy.goalTracker.items.length,0);
  assert.throws(()=>applyAction(s,{type:'import',data:backup,expectedGoalRevision:0,expectedRecapRevision:s.recap.revision}),/Goals changed elsewhere/);
});
test('limits, invalid fields, archived removal, feature uniqueness',()=>{
  let s=defaults();for(let i=0;i<20;i++)s=add(s,'manual');assert.throws(()=>add(s,'manual'),/Maximum 20/);
  const id=s.goalTracker.items[0].id;s=act(s,'feature',{id});s=act(s,'archive',{id});assert.equal(s.goalTracker.featuredId,null);s=act(s,'delete',{id});assert.equal(s.goalTracker.items.length,19);
  assert.throws(()=>add(s,'manual',{target:NaN}),/Invalid goal/);assert.throws(()=>add(s,'rating',{mode:'__proto__'}),/Invalid goal/);
});
