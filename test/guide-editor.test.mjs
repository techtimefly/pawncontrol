import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reservationGeometry,bindGuideEditor} from '../public/guide-editor.mjs';
import {defaults} from '../public/model.mjs';
import {applyAction,settingsOf,validateSettings} from '../lib/state.mjs';

test('reservation movement uses logical coordinates, snap and canvas boundaries in both orientations',()=>{
  for(const layout of ['portrait','landscape']){
    const original={enabled:true,x:60,y:60,w:360,h:160};
    assert.deepEqual(reservationGeometry(original,13,27,{layout,snap:true}),{...original,x:80,y:80});
    assert.equal(reservationGeometry(original,-10000,-10000,{layout}).x,0);
    const next=reservationGeometry(original,10000,10000,{layout});
    assert.equal(next.x+next.w,layout==='portrait'?1080:2560);
    assert.equal(next.y+next.h,layout==='portrait'?1920:1440);
  }
});

test('resize stays in bounds, keeps enabled state and respects optional aspect lock',()=>{
  for(const layout of ['portrait','landscape'])for(const aspectLocked of [false,true]){
    const original={enabled:true,aspectLocked,x:60,y:60,w:360,h:160};
    for(const [dx,dy] of [[10000,10000],[-10000,-10000],[20,80]]){
      const next=reservationGeometry(original,dx,dy,{layout,resize:true,snap:true});
      assert.ok(next.w>=1&&next.h>=1);
      assert.ok(next.x+next.w<=(layout==='portrait'?1080:2560));
      assert.ok(next.y+next.h<=(layout==='portrait'?1920:1440));
      if(aspectLocked)assert.ok(Math.abs(next.w/next.h-360/160)<1e-10);
    }
  }
});

test('guide writes merge against current settings without touching widgets or the other orientation; stale same-guide edit rejects',()=>{
  const initial=defaults(),expected=initial.portrait.guides.board;
  let state=applyAction(initial,{type:'settings',settings:{portrait:{...initial.portrait,widgets:{...initial.portrait.widgets,stats:{...initial.portrait.widgets.stats,w:900}}}}});
  const command={type:'layout-guide',layout:'portrait',key:'board',expected,value:{...expected,enabled:true,aspectLocked:true,x:80,w:900}};
  state=applyAction(state,command);
  assert.equal(state.portrait.widgets.stats.w,900);
  assert.deepEqual(state.landscapeGuides,initial.landscapeGuides);
  assert.throws(()=>applyAction(state,command),/changed elsewhere/);
  const camera=initial.landscapeGuides.camera;
  state=applyAction(state,{type:'layout-guide',layout:'landscape',key:'camera',expected:camera,value:{...camera,x:1400}});
  assert.deepEqual(state.portrait.guides.board,command.value);
  validateSettings(settingsOf(state));
  for(const value of [{...expected,aspectLocked:'yes'},{...expected,w:Infinity},{...expected,w:1081},{...expected,bogus:1}])assert.throws(()=>applyAction(initial,{...command,value}));
  const preset=applyAction(state,{type:'save-preset',name:'Guides'});
  assert.deepEqual(applyAction(preset,{type:'load-preset',name:'Guides'}).portrait.guides,state.portrait.guides);
  const imported=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(state),session:state.session}});
  assert.deepEqual(imported.portrait.guides,state.portrait.guides);
});

class Target {
  constructor(){this.listeners=new Map();this.style={};this.dataset={reservation:'camera'};this.capture=null;}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  fire(name,props={}){for(const fn of [...this.listeners.get(name)||[]])fn({target:this,pointerId:1,button:0,clientX:0,clientY:0,preventDefault(){},stopPropagation(){},...props});}
  closest(selector){return selector==='[data-reservation]'?this:null;}
  getBoundingClientRect(){return {width:270};}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
}

test('pointer transactions use scaled deltas, freeze orientation, cancel without writes, and clean up after repeated starts',()=>{
  const host=new Target(),node=new Target(),saved=[],busy=[];
  let layout='portrait',renders=0;
  const original={enabled:true,x:60,y:60,w:360,h:160};
  const editor=bindGuideEditor(host,{getContext:()=>({layout,guides:{camera:original},locked:false,snap:false}),setDragging:v=>busy.push(v),save:(...args)=>saved.push(args),render:()=>renders++});
  host.fire('pointerdown',{target:node,clientX:100,clientY:100});
  node.fire('pointermove',{clientX:110,clientY:120});
  assert.equal(node.style.left,'100px');assert.equal(node.style.top,'140px');
  layout='landscape';node.fire('pointerup',{clientX:110,clientY:120});
  assert.equal(saved[0][0],'portrait');assert.equal(saved[0][3].x,100);
  for(let i=0;i<5;i++){
    host.fire('pointerdown',{target:node});node.fire('pointermove',{clientX:200});
    if(i%2)editor.cancel();else node.fire('pointercancel');
    assert.equal(node.capture,null);assert.equal(node.listeners.get('pointermove').size,0);
  }
  assert.equal(saved.length,1);assert.equal(renders,5);assert.equal(busy.at(-1),false);
  host.fire('pointerdown',{target:node});node.fire('lostpointercapture');assert.equal(saved.length,1);
});

test('guides exist only in the editor and never in broadcast renderers',()=>{
  for(const file of ['overlay.html','overlay.mjs','render.mjs'])assert.doesNotMatch(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),/composition-guide|data-reservation|layout-guides/);
});
