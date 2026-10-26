import {validateGoalOutcomes} from './goals.mjs';
import {randomUUID} from 'node:crypto';
import {recapDefaults,recapStats,recapSessionKey} from '../public/recap-model.mjs';
const fail=message=>{throw Error(message);};
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const str=(v,max)=>typeof v==='string'&&v.length<=max;
const integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
const timestamp=v=>Number.isFinite(v)&&v>=0&&v<=1e15;
const keys=(value,allowed)=>obj(value)&&Object.keys(value).every(k=>allowed.includes(k));
function validateStats(s) {
  if(s.goals!==undefined)validateGoalOutcomes(s.goals);
  if(!keys(s,['username','wins','losses','draws','games','winRate','bestStreak','rating','mode','startedAt','hasCorrections','duration','goals'])||!str(s.username,50)||!['blitz','rapid','bullet'].includes(s.mode)||!timestamp(s.startedAt)||typeof s.hasCorrections!=='boolean'||(s.duration!==undefined&&!timestamp(s.duration)))fail('Invalid recap statistics');
  for(const key of ['wins','losses','draws','bestStreak'])if(!integer(s[key],10000))fail('Invalid recap statistics');
  if(s.games!==s.wins+s.losses+s.draws||s.winRate!==(s.games?Math.round(s.wins/s.games*100):null)||(s.rating!==null&&!integer(s.rating,10000)))fail('Invalid recap statistics');
}
function validateEntry(entry,draft=false) {
  if(!keys(entry,['kind','text','stats','capturedAt',...(draft?['sourceKey']:['id','completedAt','updatedAt'])])||!['live','complete'].includes(entry.kind)||!str(entry.text,10000)||!timestamp(entry.capturedAt))fail('Invalid recap entry');
  validateStats(entry.stats);
  if(draft){if(!str(entry.sourceKey,2000000))fail('Invalid recap source');}
  else if(!str(entry.id,80)||!entry.id||!timestamp(entry.completedAt)||!timestamp(entry.updatedAt))fail('Invalid saved recap');
}
export function validateRecap(r) {
  if(!keys(r,['version','revision','templates','streamLink','hashtags','draft','snapshots'])||r.version!==1||!Number.isSafeInteger(r.revision)||r.revision<0||!keys(r.templates,['live','complete'])||!str(r.templates.live,10000)||!str(r.templates.complete,10000)||!str(r.streamLink,2000)||!str(r.hashtags,1000)||!Array.isArray(r.snapshots)||r.snapshots.length>100)fail('Invalid recap data');
  if(r.draft!==null)validateEntry(r.draft,true);
  for(const snapshot of r.snapshots)validateEntry(snapshot);
  if(new Set(r.snapshots.map(x=>x.id)).size!==r.snapshots.length)fail('Duplicate recap identifier');
  return r;
}
export function applyRecap(state,a) {
  const r=state.recap??recapDefaults();
  if(a.expectedRevision!==r.revision)fail('Recap changed elsewhere. Draft retained; reload before saving.');
  if(['save-draft','complete'].includes(a.operation)&&a.expectedSessionKey!==recapSessionKey(state))fail('Session changed. Refresh statistics before saving.');
  const now=Date.now();
  if(a.operation==='save-preferences') {
    r.templates=structuredClone(a.templates);r.streamLink=a.streamLink;r.hashtags=a.hashtags;
  } else if(a.operation==='save-draft') {
    if(typeof a.refreshStats!=='boolean')fail('Choose whether to refresh statistics');
    const captured=!r.draft||a.refreshStats?{stats:recapStats(state,now),capturedAt:now,sourceKey:recapSessionKey(state)}:r.draft;
    r.draft={kind:a.kind,text:a.text,stats:captured.stats,capturedAt:captured.capturedAt,sourceKey:captured.sourceKey};
  } else if(a.operation==='complete') {
    if(!r.draft||r.draft.sourceKey!==recapSessionKey(state))fail('Refresh draft statistics before completing');
    if(typeof a.reset!=='boolean')fail('Choose whether to reset the session');
    if(r.snapshots.length>=100)fail('Saved recap limit reached (100). Export a backup and remove an old recap first.');
    const {sourceKey,...entry}=r.draft;
    r.snapshots.unshift({...entry,text:a.text,id:randomUUID(),completedAt:now,updatedAt:now});r.draft=null;
  } else if(a.operation==='revise'||a.operation==='delete') {
    const i=r.snapshots.findIndex(x=>x.id===a.id);if(i<0)fail('Saved recap not found');
    if(a.operation==='delete')r.snapshots.splice(i,1);
    else {r.snapshots[i].text=a.text;r.snapshots[i].updatedAt=now;}
  } else fail('Unknown recap operation');
  r.revision++;validateRecap(r);state.recap=r;
}
