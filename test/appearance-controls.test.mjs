import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppearanceControls} from '../public/appearance-controls.mjs';
import {BUILTIN_SCHEMES,appearanceOf,paletteFor,contrastText} from '../public/appearance.mjs';
import {defaults} from '../public/model.mjs';
import {applyAction} from '../lib/state.mjs';

test('badge contrast uses luminance for black, white, saturated and middle colors',()=>{
  for(const color of ['#ffffff','#00ffff','#ffff00','#808080'])assert.equal(contrastText(color),'#000000');
  for(const color of ['#000000','#0000ff','#444444'])assert.equal(contrastText(color),'#ffffff');
  assert.throws(()=>contrastText('invalid'));
});

function setup(t) {
  const original=globalThis.document,elements=new Map();
  class Element {
    constructor(){this.children=[];this.dataset={};this.style={};this.value='';this.disabled=false;}
    set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
    append(...children){this.children.push(...children);}prepend(...children){this.children.unshift(...children);}
    replaceChildren(...children){this.children=children;}setAttribute(key,value){this[key]=value;}
    setCustomValidity(message){this.validationMessage=message;}reportValidity(){return !this.validationMessage;}
    focus(){globalThis.document.activeElement=this;}querySelectorAll(){return [];}
  }
  const get=id=>{if(!elements.has(id)){const element=new Element();element.id=id;}return elements.get(id);};
  globalThis.document={getElementById:get,createElement:()=>new Element(),activeElement:null};
  t.after(()=>{globalThis.document=original;});
  let state={...defaults(),instance:'test-instance',revision:1},calls=[],release=null,reject=false;
  const controls=createAppearanceControls({getState:()=>state,action:async command=>{calls.push(command);if(release)await new Promise(resolve=>{release=resolve;});if(reject||command.expectedInstance!==state.instance||command.expectedRevision!==state.revision)return false;state={...applyAction(state,command),revision:state.revision+1};controls.render();return true;},askName:async()=> 'Saved palette',confirmDelete:async()=>true});
  controls.render();
  function choose(index=1){get('appearance-scheme').value=BUILTIN_SCHEMES[index].id;get('appearance-scheme').onchange({target:get('appearance-scheme')});get('appearance-preview-scheme').onclick();}
  return {get,controls,choose,calls,state:()=>state,setState:value=>{state=value;},delay(){release=true;},release(){const resolve=release;release=null;resolve();},reject(){reject=true;}};
}

test('preview, cancel and leaving Appearance never save; target is explicit',t=>{
  const x=setup(t),before=structuredClone(x.state());x.choose();assert.equal(x.calls.length,0);
  x.get('appearance-cancel').onclick();assert.deepEqual(x.state(),before);
  x.choose();x.controls.leave();x.controls.render();assert.equal(x.get('appearance-apply').disabled,true);
  x.choose();x.get('appearance-target').value='portrait';x.get('appearance-target').onchange({target:x.get('appearance-target')});
  assert.equal(x.get('appearance-apply').disabled,true);assert.equal(x.calls.length,0);
});

test('Apply coalesces repeated clicks, preserves noncolor settings and offers guarded Undo',async t=>{
  const x=setup(t),before=structuredClone(x.state());x.choose();x.delay();
  const first=x.get('appearance-apply').onclick();await x.get('appearance-apply').onclick();assert.equal(x.calls.length,1);assert.equal(x.controls.busy,true);x.release();await first;
  assert.deepEqual(paletteFor(x.state(),'landscape'),BUILTIN_SCHEMES[1].colors);
  assert.equal(appearanceOf(x.state()).palettes.portrait,null);assert.deepEqual(x.state().widgets,before.widgets);assert.deepEqual(x.state().session,before.session);
  assert.equal(x.get('appearance-undo').disabled,false);await x.get('appearance-undo').onclick();assert.equal(appearanceOf(x.state()).palettes.landscape,null);
  assert.deepEqual(x.state().theme,before.theme);assert.deepEqual(x.state().session,before.session);
});

test('invalid hex survives blur and blocks Apply until corrected or canceled',async t=>{
  const x=setup(t);x.choose();const hex=x.get('appearance-accent-hex');hex.focus();hex.value='#bad';hex.oninput();x.get('appearance-apply').focus();await x.get('appearance-apply').onclick();
  assert.equal(x.calls.length,0);assert.equal(hex.value,'#bad');assert.match(x.get('appearance-status').textContent,/valid six-digit/);
  x.get('appearance-cancel').onclick();assert.notEqual(hex.value,'#bad');
});

test('an invalid-only edit can be canceled before a palette draft exists',t=>{
  const x=setup(t),hex=x.get('appearance-accent-hex');hex.focus();hex.value='bad';hex.oninput();assert.equal(x.get('appearance-cancel').disabled,false);
  x.get('appearance-cancel').focus();x.get('appearance-cancel').onclick();assert.equal(x.get('appearance-cancel').disabled,true);assert.notEqual(hex.value,'bad');assert.equal(x.calls.length,0);
});

test('stale preview is rejected and retained; new appearance invalidates Undo',async t=>{
  const x=setup(t);x.choose();x.setState({...x.state(),revision:2});await x.get('appearance-apply').onclick();assert.equal(appearanceOf(x.state()).palettes.landscape,null);assert.match(x.get('appearance-status').textContent,/Not applied/);
  x.get('appearance-cancel').onclick();x.choose();await x.get('appearance-apply').onclick();assert.equal(x.get('appearance-undo').disabled,false);
  const next=structuredClone(x.state());next.appearance.palettes.landscape.accent='#123456';x.setState(next);x.controls.render();assert.equal(x.get('appearance-undo').disabled,true);
});

test('palette and recent swatches move keyboard focus to edited hex field',async t=>{
  const x=setup(t);x.choose();const group=x.get('appearance-colors').children[0],swatch=group.children[2].children[1];swatch.focus();swatch.onclick();assert.equal(document.activeElement,x.get('appearance-background-hex'));
  await x.get('appearance-apply').onclick();x.get('appearance-recent-role').value='accent';x.get('appearance-recent-role').onchange({target:x.get('appearance-recent-role')});
  const recent=x.get('appearance-recent').children[0].children[0];recent.focus();recent.onclick();assert.equal(document.activeElement,x.get('appearance-accent-hex'));assert.equal(x.calls.length,1);
});
