import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaults} from '../public/model.mjs';
import {layoutState,upgradeLayouts} from '../public/layouts.mjs';
import {applyAction,settingsOf,validateSettings} from '../lib/state.mjs';
import {Store} from '../lib/store.mjs';
import {appearanceOf,appearanceSnapshot,BUILTIN_SCHEMES,paletteFor,previewAppearance,validateAppearance} from '../public/appearance.mjs';
const midnight=BUILTIN_SCHEMES[1].colors,classic=BUILTIN_SCHEMES[0].colors;
const apply=(s,target='both',colors=midnight)=>applyAction(s,{type:'appearance',operation:'apply',target,colors,expected:appearanceSnapshot(s,target)});
const crud=(s,operation,extra)=>applyAction(s,{type:'appearance',operation,expectedSchemes:appearanceOf(s).schemes,...extra});

test('legacy migration preserves every saved color and all visible rendering until applying',()=>{
  const s=defaults();delete s.appearance;s.theme.background='#123456';s.credits.accent='#abcdef';s.sessionClock.portrait.color='#654321';
  const migrated=upgradeLayouts(s);assert.deepEqual(migrated.appearance.palettes,{landscape:null,portrait:null});
  assert.deepEqual(upgradeLayouts(migrated),migrated);
  for(const layout of ['landscape','portrait']){const before=layoutState(s,layout),after=layoutState(migrated,layout);assert.deepEqual(after.theme,before.theme);assert.deepEqual(after.credits,before.credits);assert.deepEqual(after.sessionClock,before.sessionClock);}
});

test('apply and undo are color-only and explicitly isolate orientations',()=>{
  const s=defaults();s.session.elapsed=1234;s.session.results=[{id:'one',result:'win',at:Date.now()}];
  const before=appearanceSnapshot(s,'portrait'),next=apply(s,'portrait');
  const withoutAppearance=structuredClone(next);delete withoutAppearance.appearance;const original=structuredClone(s);delete original.appearance;assert.deepEqual(withoutAppearance,original);
  assert.deepEqual(layoutState(next,'landscape').theme,s.theme);assert.equal(layoutState(next,'portrait').theme.accent,midnight.accent);
  assert.equal(layoutState(next,'portrait').theme.font,s.portrait.typography.font);
  assert.equal(layoutState(next,'portrait').sessionClock.portrait.color,midnight.text);
  assert.equal(layoutState(next,'portrait').credits.background,midnight.background);
  const undone=applyAction(next,{type:'appearance',operation:'restore',target:'portrait',palettes:before.palettes,expected:appearanceSnapshot(next,'portrait')});
  assert.deepEqual(undone.appearance.palettes,s.appearance.palettes);assert.deepEqual(undone.session,s.session);assert.deepEqual(layoutState(undone,'portrait').theme,layoutState(s,'portrait').theme);
  const both=apply(next);for(const l of ['landscape','portrait'])assert.deepEqual(paletteFor(both,l),midnight);
});

test('preview is isolated, repeat apply is safe, stale apply/undo and invalid restore reject atomically',()=>{
  const s=defaults(),snapshot=structuredClone(s),preview=previewAppearance(s,'both',midnight);assert.deepEqual(s,snapshot);assert.equal(preview.appearance.palettes.landscape.accent,midnight.accent);
  const next=apply(s);assert.deepEqual(apply(next).appearance,next.appearance);
  assert.throws(()=>applyAction(next,{type:'appearance',operation:'apply',target:'both',colors:classic,expected:appearanceSnapshot(s,'both')}),/changed elsewhere/);
  const changed=apply(next,'landscape',classic);assert.throws(()=>applyAction(changed,{type:'appearance',operation:'restore',target:'landscape',palettes:{landscape:null},expected:appearanceSnapshot(next,'landscape')}),/changed elsewhere/);
  assert.throws(()=>applyAction(next,{type:'appearance',operation:'restore',target:'portrait',palettes:{portrait:null,landscape:null},expected:appearanceSnapshot(next,'portrait')}),/Invalid color undo/);
  const other=apply(s,'portrait');assert.doesNotThrow(()=>applyAction(other,{type:'appearance',operation:'apply',target:'landscape',colors:classic,expected:appearanceSnapshot(s,'landscape')}));
});

test('custom clock and credits colors survive schemes, including explicit edits to default colors',()=>{
  let s=defaults();s.sessionClock.landscape.color='#123456';s.credits.accent='#abcdef';
  s=apply(s);assert.equal(layoutState(s).sessionClock.landscape.color,'#123456');assert.equal(layoutState(s).credits.accent,'#abcdef');
  s=applyAction(s,{type:'session-clock-style',layout:'portrait',expected:s.sessionClock.portrait,patch:{color:'#f2f4fa'}});
  s=apply(s);assert.equal(layoutState(s,'portrait').sessionClock.portrait.color,'#f2f4fa');
  let credits={...s.credits,headingColor:'#123456'};s=applyAction(s,{type:'settings',settings:{credits}});
  credits={...s.credits,headingColor:'#ffd700'};s=applyAction(s,{type:'settings',settings:{credits}});
  assert.equal(layoutState(apply(s)).credits.headingColor,'#ffd700');
});

test('schemes save, duplicate built-in/custom, rename and delete without affecting applied colors',()=>{
  let s=defaults();s=crud(s,'save',{id:'my-colors',name:'My colors',colors:classic});
  s=crud(s,'duplicate',{id:'copy',sourceId:'my-colors',name:'Copy'});s=crud(s,'duplicate',{id:'builtin-copy',sourceId:'midnight',name:'Night copy'});
  s=crud(s,'rename',{id:'copy',name:'Renamed'});assert.equal(s.appearance.schemes[1].name,'Renamed');
  const applied=apply(s);s=crud(applied,'delete',{id:'my-colors'});assert.deepEqual(s.appearance.palettes,applied.appearance.palettes);assert.equal(s.appearance.schemes.length,2);
  assert.throws(()=>crud(s,'delete',{id:'midnight'}),/not found/);
  assert.throws(()=>applyAction(s,{type:'appearance',operation:'rename',id:'copy',name:'Oops',expectedSchemes:[]}),/changed elsewhere/);
});

test('explicit credits color edits preserve a deliberate default color and reject stale or invalid edits',()=>{
  let s=apply(defaults());assert.equal(layoutState(s).credits.headingColor,midnight.text);
  const before=structuredClone(s);
  s=applyAction(s,{type:'credits-color',key:'headingColor',value:'#ffd700',expected:'#ffd700'});
  assert.equal(layoutState(s).credits.headingColor,'#ffd700');
  assert.equal(layoutState(apply(s,'both',classic)).credits.headingColor,'#ffd700');
  assert.deepEqual(s.credits,before.credits);assert.deepEqual(s.session,before.session);
  assert.throws(()=>applyAction(s,{type:'credits-color',key:'headingColor',value:'#123456',expected:'#ffffff'}),/changed elsewhere/);
  for(const [key,value] of [['font','#123456'],['headingColor','red'],['__proto__','#123456']])assert.throws(()=>applyAction(s,{type:'credits-color',key,value,expected:s.credits[key]}),/Invalid credits color/);
});

test('invalid palettes, limits, metadata and settings bypasses are rejected',()=>{
  const s=defaults();for(const colors of [null,{}, {...midnight,accent:'red'}, {...midnight,surface:'url(x)'},{...midnight,font:30}])assert.throws(()=>apply(s,'both',colors),/palette/);
  assert.throws(()=>apply(s,'sideways'),/Choose/);
  for(const name of ['', ' ', 'x'.repeat(41),'a\nb'])assert.throws(()=>crud(s,'save',{id:'id',name,colors:classic}),/name/);
  assert.throws(()=>crud(s,'save',{id:'__proto__',name:'Bad',colors:classic}),/identifier/);
  const invalid=structuredClone(s.appearance);invalid.palettes.landscape=midnight;invalid.overrides.clock.landscape=['font'];assert.throws(()=>validateAppearance(invalid),/overrides/);
  assert.doesNotThrow(()=>applyAction(s,{type:'settings',settings:{appearance:s.appearance}}));
  assert.throws(()=>applyAction(s,{type:'settings',settings:{appearance:{...s.appearance,recent:['#123456']}}}),/appearance editor/);
  for(let n=0;n<30;n++)s.appearance.schemes.push({id:`color-${n}`,name:`Color ${n}`,colors:classic});
  assert.throws(()=>crud(s,'save',{id:'overflow',name:'Overflow',colors:classic}),/saved schemes/);
  assert.doesNotThrow(()=>validateSettings(settingsOf(s)));
});

test('settings persist through SQLite restart, presets and backups; legacy backups gain defaults',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-appearance-'));let store;
  try{
    let s=crud(apply(defaults(),'portrait'),'save',{id:'saved',name:'Saved',colors:classic});store=new Store(dir);store.set('state',s);store.close();store=new Store(dir);assert.deepEqual(store.state().appearance,s.appearance);
    s=applyAction(s,{type:'save-preset',name:'Colors'});const altered=apply(s,'both',classic),restored=applyAction(altered,{type:'load-preset',name:'Colors'});assert.deepEqual(restored.appearance.palettes,s.appearance.palettes);assert.deepEqual(restored.appearance.recent,altered.appearance.recent);
    const data={version:1,settings:settingsOf(s),session:s.session,presets:s.presets};const imported=applyAction(defaults(),{type:'import',data});assert.deepEqual(imported.appearance,s.appearance);
    delete data.settings.appearance;delete data.presets.Colors.appearance;const legacy=applyAction(defaults(),{type:'import',data});assert.deepEqual(legacy.appearance.palettes,{landscape:null,portrait:null});assert.deepEqual(legacy.theme,s.theme);
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('loading old or legacy composition presets keeps the current reusable scheme library',()=>{
  let s=applyAction(defaults(),{type:'save-preset',name:'Legacy'});delete s.presets.Legacy.appearance;
  s=applyAction(s,{type:'save-preset',name:'Before saved scheme'});
  s=crud(apply(s),'save',{id:'keep-me',name:'Keep me',colors:classic});
  for(const name of ['Legacy','Before saved scheme']){
    const restored=applyAction(s,{type:'load-preset',name});assert.deepEqual(restored.appearance.schemes,s.appearance.schemes);assert.deepEqual(restored.appearance.recent,s.appearance.recent);assert.deepEqual(restored.appearance.palettes,{landscape:null,portrait:null});
  }
});
