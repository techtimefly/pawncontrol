import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,WIDGET_IDS} from '../public/model.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
import {createVisibilityControls,WIDGET_LABELS,acceptServerState} from '../public/visibility-controls.mjs';
import {createCredits} from '../public/bonus-render.mjs';
import {widgetGeometryPatch} from '../public/layouts.mjs';

test('a gesture finishing after a live hide only applies changed geometry',()=>{
 for(const layout of ['landscape','portrait']){
  const initial=defaults(),original=structuredClone((layout==='portrait'?initial.portrait:initial).widgets.stats);
  const gesture={...original,x:original.x-10};
  let latest=applyAction(initial,{type:'widget-visibility',layout,id:'stats',expected:true,visible:false});
  const saved=(layout==='portrait'?latest.portrait:latest).widgets.stats;saved.locked=true;saved.z=5;saved.scale=1.2;
  Object.assign(saved,widgetGeometryPatch(original,gesture));
  assert.equal(saved.visible,false);assert.equal(saved.locked,true);assert.equal(saved.z,5);assert.equal(saved.scale,1.2);assert.equal(saved.x,original.x-10);
  assert.deepEqual(widgetGeometryPatch(original,gesture),{x:original.x-10});
 }
});

test('re-login retires previous server epoch; delayed responses cannot retire the new instance',()=>{
 const retired=new Set(),a={instance:'a',revision:20},b={instance:'b',revision:0};
 let state=acceptServerState(a,b,retired);assert.equal(state,b);
 state=acceptServerState(state,{...a,revision:21},retired);assert.equal(state,b);
 const latest={...b,revision:3};state=acceptServerState(state,latest,retired);assert.equal(state,latest);
 assert.equal(acceptServerState(state,{...b,revision:1},retired),latest);
});

test('main overlay credits do not autoplay and hidden speed-mode frames do not finish/reset playback',t=>{
 const frames=[];let now=0;
 class Node{constructor(){this.children=[];this.style={setProperty(){}};this.classList={add(){}};this.isConnected=true;this.clientHeight=100;this.clientWidth=100;this.scrollHeight=500;this.hidden=false;}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}}
 t.mock.method(globalThis.performance,'now',()=>now);
 const previousDoc=globalThis.document,previousFrame=globalThis.requestAnimationFrame;
 globalThis.document={createElement:()=>new Node()};globalThis.requestAnimationFrame=f=>frames.push(f);
 t.after(()=>{globalThis.document=previousDoc;globalThis.requestAnimationFrame=previousFrame;});
 const root=new Node(),player=createCredits(root,{autoplay:false}),settings={...defaults().credits,timing:'speed',speed:10,loop:false};
 const step=value=>{now=value;frames.shift()(now);};
 player.update(settings,{seq:0,command:'stop'});step(0);assert.equal(root.style.visibility,'hidden');
 player.update(settings,{seq:1,command:'play'});step(1000);const crawl=root.children[0],before=crawl.style.transform;
 root.clientWidth=0;root.clientHeight=0;crawl.scrollHeight=0;step(2000);assert.equal(crawl.hidden,false);assert.equal(crawl.style.transform,before);
 root.clientWidth=100;root.clientHeight=100;crawl.scrollHeight=500;step(3000);assert.equal(crawl.hidden,false);assert.notEqual(crawl.style.transform,before);
 player.update(settings,{seq:2,command:'pause'});step(4000);const paused=crawl.style.transform;
 root.clientHeight=0;step(9000);root.clientHeight=100;step(10000);assert.equal(crawl.style.transform,paused);
});

test('all real widgets change only their saved orientation visibility, preserving content, playback, geometry and session',()=>{
  const initial=applyAction(applyAction(defaults(),{type:'timer',command:'start'}),{type:'record',result:'win'});
  assert.deepEqual(Object.keys(WIDGET_LABELS).sort(),[...WIDGET_IDS].sort());
  for(const layout of ['landscape','portrait'])for(const id of WIDGET_IDS){
    const expected=(layout==='portrait'?initial.portrait:initial).widgets[id].visible;
    const changed=applyAction(initial,{type:'widget-visibility',layout,id,expected,visible:!expected});
    const wanted=structuredClone(initial);(layout==='portrait'?wanted.portrait:wanted).widgets[id].visible=!expected;
    assert.deepEqual(changed,wanted,`${layout}/${id}`);
    assert.throws(()=>applyAction(changed,{type:'widget-visibility',layout,id,expected,visible:expected}),/changed elsewhere/);
    const preset=applyAction(changed,{type:'save-preset',name:'Visibility'});
    assert.deepEqual(preset.presets.Visibility,settingsOf(changed));
  }
  for(const patch of [{id:'board'},{id:'camera'},{layout:'square'},{visible:1},{expected:undefined}])assert.throws(()=>applyAction(initial,{type:'widget-visibility',id:'stats',layout:'landscape',visible:false,expected:true,...patch}),/Invalid/);
});

test('a stale layout edit cannot restore visibility and scoped visibility never replaces geometry',()=>{
  const before=defaults(),widgets=structuredClone(before.widgets);widgets.stats.x=2000;
  const changed=applyAction(before,{type:'widget-visibility',layout:'landscape',id:'stats',expected:true,visible:false});
  assert.throws(()=>applyAction(changed,{type:'settings',expectedLayout:{widgets:before.widgets},settings:{widgets}}),/Layout changed/);
  const moved=applyAction(before,{type:'settings',expectedLayout:{widgets:before.widgets},settings:{widgets}});
  const hidden=applyAction(moved,{type:'widget-visibility',layout:'landscape',id:'stats',expected:true,visible:false});assert.equal(hidden.widgets.stats.x,2000);
  const portrait=structuredClone(before.portrait);portrait.widgets.stats.x=80;portrait.widgets.stats.w=900;
  const portraitChanged=applyAction(before,{type:'widget-visibility',layout:'portrait',id:'stats',expected:true,visible:false});
  assert.throws(()=>applyAction(portraitChanged,{type:'settings',expectedLayout:{portrait:before.portrait},settings:{portrait}}),/Layout changed/);
});

test('shared pending controls block rapid clicks, follow live values, recover latest state after failure and retry',async()=>{
  let state={...defaults(),instance:'one',revision:1},resolve,reject,calls=0;
  const status={textContent:''},nodes=[];
  const make=()=>{const n={type:'button',isConnected:true,setAttribute(k,v){this[k]=v;}};nodes.push(n);return n;};
  const controls=createVisibilityControls({getState:()=>state,storage:{},document:{querySelectorAll:()=>[status]},accept:s=>{if(s.revision>=state.revision)state=s;},api:async(path,command)=>{
    if(path==='/api/state')return state;
    calls++;return new Promise((yes,no)=>{resolve=()=>{state={...applyAction(state,command),revision:state.revision+1};yes({state});};reject=no;});
  }});
  const a=controls.bind(make(),'landscape','stats'),b=controls.bind(make(),'landscape','stats');
  const first=a.onclick();await b.onclick();assert.equal(calls,1);assert.equal(a['aria-disabled'],'true');assert.equal(b['aria-busy'],'true');assert.equal(a['aria-pressed'],'true');
  resolve();await first;assert.equal(a['aria-pressed'],'false');assert.equal(b['aria-disabled'],'false');
  const second=a.onclick();state={...state,revision:10};state.widgets.stats.visible=true;controls.render();reject(Error('lost response'));await second;
  assert.equal(a['aria-pressed'],'true');assert.equal(a['aria-disabled'],'false');assert.match(status.textContent,/Current server values restored/);
  const retry=b.onclick();resolve();await retry;assert.equal(calls,3);assert.equal(a['aria-pressed'],'false');
});
