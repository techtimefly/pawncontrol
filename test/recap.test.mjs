import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,totals} from '../public/model.mjs';
import {recapDefaults,recapStats,recapSessionKey,renderRecapTemplate} from '../public/recap-model.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
import {validateRecap} from '../lib/recap.mjs';
const action=(s,operation,extra={})=>applyAction(s,{type:'recap',operation,expectedRevision:s.recap?.revision??0,expectedSessionKey:recapSessionKey(s),...extra});
test('recap uses actual totals, all games denominator, ordered best streak and available rating',()=>{
  let s=defaults();assert.equal(recapStats(s).winRate,null);assert.equal(recapStats(s).rating,null);
  for(const result of ['win','win','loss','win','draw'])s=applyAction(s,{type:'record',result});
  assert.equal(recapStats(s).bestStreak,2);assert.equal(recapStats(s).winRate,60);
  s=applyAction(s,{type:'totals',totals:{win:8,loss:5,draw:0}});s.overrides.blitz=0;
  assert.equal(recapStats(s).winRate,62);assert.equal(recapStats(s).bestStreak,2);assert.equal(recapStats(s).hasCorrections,true);
  assert.equal(recapStats(s).rating,0);
});
test('templates interpolate once, preserve unknown variables and missing data honestly',()=>{
  const stats=recapStats(defaults());
  assert.equal(renderRecapTemplate('{win_rate}|{rating}|{time_control}|{unknown}|{stream_link}|{hashtags}',stats,{streamLink:'{wins}',hashtags:'#chess'}),'N/A|unavailable|Blitz|{unknown}|{wins}|#chess');
});
test('manual draft text persists while explicit refresh changes captured stats',()=>{
  let s=action(defaults(),'save-draft',{kind:'live',text:'My edited draft',refreshStats:false});
  s=applyAction(s,{type:'record',result:'win'});
  s=action(s,'save-draft',{kind:'live',text:'Still mine',refreshStats:false});
  assert.equal(s.recap.draft.stats.games,0);
  assert.throws(()=>action(s,'complete',{text:'Still mine',reset:true}),/Refresh draft/);
  s=action(s,'save-draft',{kind:'live',text:'Still mine',refreshStats:true});
  assert.equal(s.recap.draft.stats.games,1);assert.equal(s.recap.draft.text,'Still mine');
});
test('complete and reset are atomic, frozen snapshot survives undo/reset and revisions',()=>{
  let s=applyAction(defaults(),{type:'record',result:'win'});
  s=action(s,'save-draft',{kind:'complete',text:'Finished',refreshStats:true});
  const before=structuredClone(s);
  assert.throws(()=>action(s,'complete',{text:'x'.repeat(10001),reset:true}),/Invalid recap/);
  assert.deepEqual(s,before);
  s=action(s,'complete',{text:'Finished',reset:true});
  const snapshot=structuredClone(s.recap.snapshots[0]);assert.equal(snapshot.stats.wins,1);assert.equal(s.recap.draft,null);assert.equal(totals(s.session).win,0);
  s=applyAction(s,{type:'undo'});assert.equal(totals(s.session).win,1);assert.deepEqual(s.recap.snapshots[0],snapshot);
  s=applyAction(s,{type:'reset'});s=action(s,'revise',{id:snapshot.id,text:'Edited after posting'});
  assert.deepEqual(s.recap.snapshots[0].stats,snapshot.stats);assert.equal(s.recap.snapshots[0].text,'Edited after posting');
});
test('concurrent recap/session changes are rejected without mutation, timer does not stale scores',()=>{
  let s=defaults();const key=recapSessionKey(s);
  s=action(s,'save-preferences',{templates:recapDefaults().templates,streamLink:'https://example.com',hashtags:'#chess'});
  assert.throws(()=>applyAction(s,{type:'recap',operation:'delete',id:'x',expectedRevision:0}),/changed elsewhere/);
  s=applyAction(s,{type:'timer',command:'start'});assert.equal(recapSessionKey(s),key);
  s=applyAction(s,{type:'record',result:'win'});
  assert.throws(()=>applyAction(s,{type:'reset',expectedSessionKey:key}),/Session changed/);
  assert.throws(()=>applyAction(s,{type:'recap',operation:'save-draft',expectedRevision:1,expectedSessionKey:key,kind:'live',text:'stale',refreshStats:true}),/Session changed/);
});
test('recap backup validation rejects malformed data and legacy backups preserve history',()=>{
  let s=action(defaults(),'save-draft',{kind:'complete',text:'Saved',refreshStats:true});s=action(s,'complete',{text:'Saved',reset:false});
  const backup={version:1,settings:settingsOf(s),session:s.session,recap:s.recap};
  assert.throws(()=>applyAction(s,{type:'import',expectedRecapRevision:0,data:backup}),/changed elsewhere/);
  assert.throws(()=>applyAction(s,{type:'import',expectedRecapRevision:s.recap.revision,data:{...backup,recap:{...s.recap,revision:Number.MAX_SAFE_INTEGER}}}),/Invalid recap/);
  const restored=applyAction(defaults(),{type:'import',expectedRecapRevision:0,data:backup});assert.deepEqual(restored.recap.snapshots,s.recap.snapshots);
  assert.ok(restored.recap.revision>s.recap.revision);
  delete backup.recap;const legacy=applyAction(s,{type:'import',data:backup});assert.deepEqual(legacy.recap,s.recap);
  assert.throws(()=>validateRecap({...s.recap,snapshots:[{...s.recap.snapshots[0],stats:{...s.recap.snapshots[0].stats,games:999}}]}),/statistics/);
  assert.throws(()=>validateRecap({...s.recap,streamLink:'x'.repeat(2001)}),/Invalid recap/);
  for(const invalid of [{...s.recap,unknown:'x'},{...s.recap,templates:{...s.recap.templates,unknown:'x'}},{...s.recap,snapshots:[{...s.recap.snapshots[0],unknown:'x'}]}])assert.throws(()=>validateRecap(invalid),/Invalid recap/);
  assert.throws(()=>validateRecap({...s.recap,snapshots:[{...s.recap.snapshots[0],stats:{...s.recap.snapshots[0].stats,unknown:'x'}}]}),/statistics/);
});

