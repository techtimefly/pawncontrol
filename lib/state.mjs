import {validChannel} from '../public/identity.mjs';
import {upgradeLayouts,layoutDimensions} from '../public/layouts.mjs';
import {applyRecap,validateRecap} from './recap.mjs';
import {recapSessionKey} from '../public/recap-model.mjs';
import {starterList,addMissingDefaults} from '../public/starter-templates.mjs';
import {validateSocials} from '../public/socials-model.mjs';
import {validateIconRegistry,validateIconReferences} from './social-icons.mjs';
import { randomUUID } from 'node:crypto';
import { defaults, totals, newSession, rating, elapsed, MODES, FIELDS,WIDGET_IDS } from '../public/model.mjs';
import {upgradeBonusSettings,nextTipIndex} from '../public/bonus-model.mjs';
const fail = message => { throw new Error(message); };
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v,min,max) => Number.isFinite(v) && v >= min && v <= max;
const str = (v,max) => typeof v === 'string' && v.length <= max;
function validateGuides(g,layout) {
  const {width,height}=layoutDimensions(layout);
  if(!obj(g)||Object.keys(g).some(k=>!['safeArea','board','camera'].includes(k)))fail('Invalid layout guides');
  const a=g.safeArea;
  if(!obj(a)||typeof a.enabled!=='boolean'||Object.keys(a).some(k=>!['enabled','top','right','bottom','left'].includes(k))||!num(a.top,0,height)||!num(a.bottom,0,height)||!num(a.left,0,width)||!num(a.right,0,width)||a.top+a.bottom>=height||a.left+a.right>=width)fail('Invalid safe area');
  for(const key of ['board','camera']) {
    const r=g[key];
    if(!obj(r)||Object.keys(r).some(k=>!['enabled','x','y','w','h'].includes(k))||typeof r.enabled!=='boolean'||!num(r.x,0,width)||!num(r.y,0,height)||!num(r.w,1,width)||!num(r.h,1,height)||r.x+r.w>width||r.y+r.h>height)fail('Reservation must fit the canvas');
  }
}
function validatePortrait(p) {
  if(!obj(p)||Object.keys(p).some(k=>!['widgets','typography','layoutLocked','snap','guides'].includes(k))||typeof p.layoutLocked!=='boolean'||typeof p.snap!=='boolean')fail('Invalid portrait layout');
  if(!obj(p.widgets)||Object.keys(p.widgets).some(k=>!WIDGET_IDS.includes(k)))fail('Invalid portrait widgets');
  for(const id of WIDGET_IDS) {
    const w=p.widgets[id];
    if(!obj(w)||!num(w.x,0,1080)||!num(w.y,0,1920)||!num(w.w,150,1080)||!num(w.h,40,1920)||w.x+w.w>1080.1||w.y+w.h>1920.1||!num(w.scale,.5,2)||!Number.isInteger(w.z)||!num(w.z,0,50)||typeof w.visible!=='boolean'||typeof w.locked!=='boolean')fail('Portrait widget must fit the canvas');
  }
  const limits=[['font',18,60],['padding',10,60],['gap',4,40],['tickerFont',18,60],['tipsFont',18,60],['socialsFont',18,60],['creditsFont',20,90],['creditsHeading',24,120],['creditsBrandSize',30,180],['creditsGap',10,180]];
  if(!obj(p.typography)||Object.keys(p.typography).some(k=>!limits.some(([id])=>id===k))||limits.some(([k,min,max])=>!num(p.typography[k],min,max)))fail('Invalid portrait typography');
  validateGuides(p.guides,'portrait');
}
export function validateSettings(s) {
  validateSocials(s?.socials);
  if (!obj(s)) fail('Invalid settings');
  if (Object.keys(s).some(k=>!SETTING_KEYS.includes(k))) fail('Unknown setting');
  if(s.portrait!==undefined)validatePortrait(s.portrait);
  if(s.landscapeGuides!==undefined)validateGuides(s.landscapeGuides,'landscape');
  if (!/^[a-zA-Z0-9_-]{2,50}$/.test(s.username)) fail('Invalid Chess.com player');
  if (!validChannel(s.channel)) fail('Channel / creator name must be plain single-line text of at most 80 characters');
  if (!MODES.includes(s.activeMode)) fail('Invalid time control');
  if (typeof s.showAvatar !== 'boolean') fail('Invalid avatar setting');
  if (!Array.isArray(s.fields) || s.fields.length !== Object.keys(FIELDS).length || new Set(s.fields.map(f=>f.id)).size !== s.fields.length || s.fields.some(f=>!FIELDS[f.id] || typeof f.visible !== 'boolean')) fail('Invalid fields');
  for (const k of ['win','loss','draw']) if (typeof s.parts?.[k] !== 'boolean') fail('Invalid score visibility');
  for (const m of MODES) {
    if (!Number.isInteger(s.goals?.[m]) || !num(s.goals[m],1,10000)) fail('Goal must be 1–10000');
    if (s.overrides?.[m] !== null && (!Number.isInteger(s.overrides?.[m]) || !num(s.overrides[m],0,10000))) fail('Invalid rating override');
  }
  for (const k of ['accent','background','foreground','muted','streak']) if (!/^#[a-fA-F0-9]{6}$/.test(s.theme?.[k])) fail('Invalid color');
  for (const [k,min,max] of [['opacity',0,100],['radius',0,60],['font',18,60],['padding',10,60],['gap',4,40]]) if (!num(s.theme[k],min,max)) fail(`Invalid ${k}`);
  if (typeof s.layoutLocked !== 'boolean' || typeof s.snap !== 'boolean') fail('Invalid layout settings');
  for (const id of WIDGET_IDS) {
    const w = s.widgets?.[id];
    if (!obj(w) || !num(w.x,0,2560) || !num(w.y,0,1440) || !num(w.w,150,2560) || !num(w.h,40,1440) || w.x+w.w>2560.1 || w.y+w.h>1440.1 || !num(w.scale,0.5,2) || !Number.isInteger(w.z) || !num(w.z,0,50) || typeof w.visible !== 'boolean' || typeof w.locked !== 'boolean') fail('Widget must fit the canvas');
  }
  const t=s.ticker;
  if (!obj(t) || !['scroll','rotate'].includes(t.mode) || !num(t.interval,5,300) || !num(t.speed,20,300) || !num(t.gap,0,300) || !num(t.pause,0,30) || !num(t.font,18,60) || !num(t.opacity,0,100) || !['left','right'].includes(t.direction) || typeof t.paused !== 'boolean' || !str(t.separator,12)) fail('Invalid ticker settings');
  if (!Array.isArray(t.messages) || t.messages.length>50 || new Set(t.messages.map(m=>m.id)).size!==t.messages.length || t.messages.some(m=>!str(m.id,80) || !str(m.text,500) || typeof m.enabled!=='boolean')) fail('Invalid ticker messages');
  const c=s.credits,p=s.tips;
  if(!obj(c)||!str(c.brand,120)||!str(c.subtitle,200)||!str(c.final,200)||!['duration','speed'].includes(c.timing)||!num(c.duration,5,1800)||!num(c.speed,10,300)||!num(c.font,20,90)||!num(c.heading,24,120)||!num(c.brandSize,30,180)||!num(c.gap,10,180)||!num(c.opacity,0,100)||typeof c.loop!=='boolean')fail('Invalid credits settings');
  for(const k of ['background','accent','headingColor','detailColor'])if(!/^#[a-fA-F0-9]{6}$/.test(c[k]))fail('Invalid credits color');
  if(!Array.isArray(c.sections)||c.sections.length>30||new Set(c.sections.map(x=>x.id)).size!==c.sections.length)fail('Invalid credit sections');
  for(const section of c.sections){
    if(!str(section.id,80)||!str(section.title,120)||typeof section.enabled!=='boolean'||!Array.isArray(section.entries)||section.entries.length>60||new Set(section.entries.map(e=>e.id)).size!==section.entries.length)fail('Invalid credit section');
    for(const e of section.entries)if(!str(e.id,80)||!str(e.label,200)||!str(e.detail,400)||typeof e.enabled!=='boolean')fail('Invalid credit entry');
  }
  if(!obj(p)||!num(p.interval,5,300)||!num(p.font,18,60)||!['sequential','shuffle'].includes(p.order)||!Array.isArray(p.items)||p.items.length>100||new Set(p.items.map(x=>x.id)).size!==p.items.length)fail('Invalid tips settings');
  for(const tip of p.items)if(!str(tip.id,80)||!str(tip.title,120)||!str(tip.category,60)||!str(tip.text,600)||typeof tip.enabled!=='boolean')fail('Invalid chess tip');
  return s;
}
export const SETTING_KEYS = ['username','channel','activeMode','showAvatar','fields','parts','goals','overrides','theme','widgets','layoutLocked','snap','ticker','credits','tips','socials','portrait','landscapeGuides'];
export function settingsOf(state) { return Object.fromEntries(SETTING_KEYS.map(k=>[k,structuredClone(state[k])])); }
export function validateSession(s) {
  if (!obj(s) || !Array.isArray(s.results) || s.results.length>10000 || s.results.some(r=>!['win','loss','draw'].includes(r.result)||!str(r.id,80)||!num(r.at,0,1e15)) || new Set(s.results.map(r=>r.id)).size!==s.results.length) fail('Invalid results');
  for (const k of ['win','loss','draw']) if (!Number.isInteger(s.corrections?.[k]) || !num(s.corrections[k],-10000,10000)) fail('Invalid corrections');
  if (Object.values(totals(s)).some(v=>v<0 || v>10000) || !num(s.startedAt,0,1e15) || !num(s.elapsed,0,1e12) || (s.runningSince!==null && !num(s.runningSince,0,Date.now()+60000))) fail('Invalid session');
  if (!obj(s.baseline)) fail('Invalid baselines');
  for (const [k,v] of Object.entries(s.baseline)) if (!MODES.includes(k) || (v!==null && !num(v,0,10000))) fail('Invalid baseline');
}
export function applyAction(original, action) {
  const s=structuredClone(original), a=action;
  if (!obj(a)) fail('Invalid action');
  // Keep full-session snapshots compatible with existing saved undo history.
  const remember = (kind='session') => {
    const entry=kind==='score'?{kind,results:s.session.results,corrections:s.session.corrections}:
      kind==='timer'?{kind,elapsed:elapsed(s.session),running:s.session.runningSince!==null}:s.session;
    s.undo.push(structuredClone(entry));s.undo=s.undo.slice(-30);
  };
  if(a.type==='recap') {
    applyRecap(s,a);
    if(a.operation==='complete'&&a.reset){remember();s.session=newSession(Object.fromEntries(MODES.map(m=>[m,rating(s,m)])));}
  } else if(a.type==='starter-templates') {
    const key=a.kind==='tips'?'tips':a.kind==='cta'?'ticker':null;
    if(!key)fail('Invalid template list');
    const field=key==='tips'?'items':'messages',current=s[key][field];
    if(JSON.stringify(a.expected)!==JSON.stringify(current))fail('Content changed elsewhere; reload before applying');
    if(!['restore','add','undo'].includes(a.operation))fail('Invalid template operation');
    const list=a.operation==='restore'?starterList(a.kind):a.operation==='add'?addMissingDefaults(a.kind,current):a.items;
    const next={...s[key],[field]:list};validateSettings({...settingsOf(s),[key]:next});s[key]=structuredClone(next);
  } else if(a.type==='socials-edit') {
    if(JSON.stringify(a.expected)!==JSON.stringify(s.socials))fail('Socials changed elsewhere. Draft retained; reload before saving.');
    validateSocials(a.socials);s.socials=a.socials;
  } else if(a.type==='socials-playback') {
    if(!['pause','play','next','previous'].includes(a.command))fail('Invalid socials command');
    if(a.currentId!==undefined&&a.currentId!==null&&!str(a.currentId,80))fail('Invalid social identifier');
    s.socialsPlayback={seq:s.socialsPlayback.seq+1,command:a.command,currentId:a.currentId??null,paused:a.command==='pause'?true:a.command==='play'?false:s.socialsPlayback.paused};
  } else if (a.type==='ticker-messages') {
    if(JSON.stringify(a.expectedMessages)!==JSON.stringify(s.ticker.messages))fail('Messages changed elsewhere; reload before applying');
    const ticker={...s.ticker,messages:a.messages};validateSettings({...settingsOf(s),ticker});s.ticker=ticker;
  } else if (a.type==='tips-items') {
    if(JSON.stringify(a.expectedItems)!==JSON.stringify(s.tips.items))fail('Tips changed elsewhere; reload before applying');
    const tips={...s.tips,items:a.items};validateSettings({...settingsOf(s),tips});s.tips=tips;
  } else if (a.type==='settings') {
    if (!obj(a.settings) || Object.keys(a.settings).some(k=>!SETTING_KEYS.includes(k))) fail('Unknown setting');
    if(a.settings.socials&&JSON.stringify(a.settings.socials)!==JSON.stringify(s.socials)&&JSON.stringify(a.expectedSocials)!==JSON.stringify(s.socials))fail('Use the socials editor to avoid overwriting another edit');
    const merged={...settingsOf(s),...a.settings}; validateSettings(merged);
    const changed=merged.username!==s.username; Object.assign(s,merged);
    if (changed) { s.api=defaults().api; s.session.baseline={}; }
  } else if (a.type==='record') {
    if (!['win','loss','draw'].includes(a.result)) fail('Invalid result');
    if (s.session.results.length>=10000) fail('Start a new session');
    remember('score'); s.session.results.push({ id: randomUUID(), at: Date.now(), result: a.result });
  } else if (a.type==='decrement') {
    if (!['win','loss','draw'].includes(a.result)) fail('Invalid result');
    if (!totals(s.session)[a.result]) return s;
    remember('score');
    if (s.session.corrections[a.result]>0) s.session.corrections[a.result]--;
    else { const i=s.session.results.findLastIndex(r=>r.result===a.result); s.session.results.splice(i,1); }
  } else if (a.type==='totals') {
    remember('score');
    for (const k of ['win','loss','draw']) {
      if (!Number.isInteger(a.totals?.[k]) || !num(a.totals[k],0,10000)) fail('Invalid total');
      s.session.corrections[k]=a.totals[k]-s.session.results.filter(r=>r.result===k).length;
    }
  } else if (a.type==='edit-result' || a.type==='delete-result') {
    const i=s.session.results.findIndex(r=>r.id===a.id); if (i<0) fail('Result not found');
    remember('score');
    if (a.type==='delete-result') s.session.results.splice(i,1);
    else { if (!['win','loss','draw'].includes(a.result)) fail('Invalid result'); s.session.results[i].result=a.result; }
    // Preserve valid totals if a prior manual correction made a count smaller than ordered history.
    const t=totals(s.session); for (const k of ['win','loss','draw']) if (t[k]<0) s.session.corrections[k]-=t[k];
  } else if (a.type==='reset') {
    if(a.expectedSessionKey!==undefined&&a.expectedSessionKey!==recapSessionKey(s))fail('Session changed. Reload before resetting.');
    remember(); s.session=newSession(Object.fromEntries(MODES.map(m=>[m,rating(s,m)])));
  } else if (a.type==='undo') {
    if (s.undo.length) {
      const entry=s.undo.pop();
      if(entry.kind==='score'){s.session.results=entry.results;s.session.corrections=entry.corrections;}
      else if(entry.kind==='timer'){s.session.elapsed=entry.elapsed;s.session.runningSince=entry.running?Date.now():null;}
      else s.session=entry;
    }
  } else if (a.type==='timer') {
    const command=a.command || (s.session.runningSince!==null?'pause':'start');
    if(!['start','pause','restart','reset'].includes(command))fail('Invalid timer command');
    if(command==='start' && s.session.runningSince!==null)return s;
    if(command==='pause' && s.session.runningSince===null)return s;
    if(command==='reset' && s.session.runningSince===null && s.session.elapsed===0)return s;
    remember('timer');
    if(command==='restart'||command==='reset'){s.session.elapsed=0;s.session.runningSince=command==='restart'?Date.now():null;}
    else if(command==='pause'){s.session.elapsed+=Math.max(0,Date.now()-s.session.runningSince);s.session.runningSince=null;}
    else s.session.runningSince=Date.now();
  } else if (a.type==='save-preset') {
    if (!str(a.name,40) || !a.name.trim() || ['__proto__','constructor','prototype'].includes(a.name)) fail('Invalid preset name');
    if (Object.keys(s.presets).length>=20 && !Object.hasOwn(s.presets,a.name)) fail('Maximum 20 presets');
    s.presets[a.name]=settingsOf(s);
  } else if (a.type==='load-preset') {
    if (!Object.hasOwn(s.presets,a.name)) fail('Preset not found');
    // Identity and rating corrections are not changed by a layout preset.
    const p=upgradeLayouts(upgradeBonusSettings(s.presets[a.name])); Object.assign(s,{ fields:p.fields, showAvatar:p.showAvatar, parts:p.parts, theme:p.theme, widgets:p.widgets, layoutLocked:p.layoutLocked, snap:p.snap, ticker:p.ticker,credits:p.credits,tips:p.tips,socials:p.socials,portrait:p.portrait,landscapeGuides:p.landscapeGuides });
  } else if (a.type==='delete-preset') { delete s.presets[a.name]; }
  else if (a.type==='import') {
    if (a.data?.version!==1) fail('Unsupported backup version');
    if(a.data.recap!==undefined){if(a.expectedRecapRevision!==(s.recap?.revision??0))fail('Recap changed elsewhere. Reload before importing.');const importedRecap=structuredClone(validateRecap(a.data.recap));importedRecap.revision=Math.max(s.recap?.revision??0,importedRecap.revision)+1;s.recap=validateRecap(importedRecap);}
    const imported=upgradeLayouts(upgradeBonusSettings(a.data.settings));validateSettings(imported); validateSession(a.data.session); remember();
    Object.assign(s,imported); s.session=a.data.session; s.api=defaults().api;
    s.socialIcons=validateIconRegistry(a.data.socialIcons??{});
    s.presets={};
    for (const [name,p] of Object.entries(a.data.presets || {})) {
      if (!str(name,40)||['__proto__','constructor','prototype'].includes(name)||Object.keys(s.presets).length>=20) fail('Invalid presets');
      const upgraded=upgradeLayouts(upgradeBonusSettings(p));validateSettings(upgraded); s.presets[name]=upgraded;
    }
  } else if(a.type==='credits-playback') {
    if(!['play','pause','restart','stop'].includes(a.command))fail('Invalid credits command');
    s.creditsPlayback={seq:s.creditsPlayback.seq+1,command:a.command};
  } else if(a.type==='tips-playback') {
    const enabled=s.tips.items.filter(t=>t.enabled&&t.text.trim()),p=s.tipsPlayback;
    if(a.command==='pause')p.paused=true;
    else if(a.command==='play')p.paused=false;
    else if(['next','previous'].includes(a.command)){
      const current=enabled.findIndex(t=>t.id===a.currentId);p.index=nextTipIndex(current>=0?current:p.index,enabled.length,a.command==='previous'?-1:1,s.tips.order);
    }
    else fail('Invalid tips command');
    p.seq++;
  } else fail('Unknown action');
  validateIconReferences(s);
  validateSession(s.session);
  return s;
}
