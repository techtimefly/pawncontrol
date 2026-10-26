import test from 'node:test';
import assert from 'node:assert/strict';
import {copyRecap,recapCharacterCount,createRecapControls} from '../public/recap-controls.mjs';
import {defaults} from '../public/model.mjs';
import {applyAction} from '../lib/state.mjs';
import {recapDefaults,recapStats,recapSessionKey} from '../public/recap-model.mjs';

test('copy reports success only after resolved write; rejected/unavailable clipboard selects fallback',async()=>{
  let selected=0,focused=0,written;
  const textarea={value:'manual message',focus(){focused++;},select(){selected++;}};
  assert.equal(await copyRecap(textarea,{async writeText(value){written=value;}}),true);
  assert.equal(written,textarea.value);assert.equal(selected,0);
  assert.equal(await copyRecap(textarea,{async writeText(){throw Error('denied');}}),false);
  assert.equal(await copyRecap(textarea,{}),false);
  assert.equal(selected,2);assert.equal(focused,2);
  assert.equal(recapCharacterCount('Chess ♟ 😀'),9);
});

test('recap controls preserve manual text through refresh, failures, rerenders and frozen recap selection',async()=>{
  class Element {
    constructor(){this.value='';this.children=[];this.textContent='';this.hidden=false;this.disabled=false;}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    focus(){} select(){}
  }
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  globalThis.document={getElementById:get,createElement:()=>new Element()};globalThis.window={addEventListener(){}};
  let state=defaults();state.recap=recapDefaults();let reject=false;
  const response=()=>({recap:structuredClone(state.recap),stats:recapStats(state),sessionKey:recapSessionKey(state),state});
  const api=async(path,action)=>{if(path==='/api/action'){if(reject)throw Error('Changed elsewhere');state=applyAction(state,action);}return response();};
  try{
    const controls=createRecapControls({api,accept(){},confirmChange:async()=>true,resetSession:async()=>true});
    controls.render();await new Promise(resolve=>setImmediate(resolve));
    get('recap-text').value='My custom wording';get('recap-text').oninput();
    controls.render();assert.equal(get('recap-text').value,'My custom wording');
    state=applyAction(state,{type:'record',result:'win'});
    await get('recap-refresh').onclick();
    assert.equal(get('recap-text').value,'My custom wording');assert.equal(state.recap.draft.text,'My custom wording');assert.equal(state.recap.draft.stats.wins,1);
    reject=true;get('recap-text').value='Retain on failed save';get('recap-text').oninput();await get('recap-save').onclick();
    assert.equal(get('recap-text').value,'Retain on failed save');assert.match(get('recap-status').textContent,/edits are retained/);reject=false;
    await get('recap-complete').onclick();assert.equal(state.recap.snapshots[0].text,'Retain on failed save');
    await get('recap-open-draft').onclick();get('recap-text').value='Second recap';get('recap-text').oninput();await get('recap-refresh').onclick();await get('recap-complete').onclick();
    const newest=state.recap.snapshots[0].id,older=state.recap.snapshots[1].id;
    get('recap-text').value='Revised second';get('recap-text').oninput();await get('recap-revise').onclick();
    assert.equal(state.recap.snapshots.find(s=>s.id===newest).text,'Revised second');assert.equal(state.recap.snapshots.find(s=>s.id===older).text,'Retain on failed save');
    const frozen=structuredClone(state.recap.snapshots[0].stats);state=applyAction(state,{type:'record',result:'loss'});controls.render();
    assert.deepEqual(state.recap.snapshots[0].stats,frozen);assert.equal(get('recap-text').value,'Revised second');
  }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

test('first template application pins authoritative duration before text generation',async t=>{
 t.mock.timers.enable({apis:['Date'],now:100000});
 class Element{constructor(){this.value='';this.children=[];}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}focus(){}select(){}}
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={getElementById:get,createElement:()=>new Element()};globalThis.window={addEventListener(){}};
 let state=applyAction(defaults(),{type:'timer',command:'start'});state.recap=recapDefaults();
 const api=async(path,a)=>{if(a)state=applyAction(state,a);return {recap:structuredClone(state.recap),stats:recapStats(state),sessionKey:recapSessionKey(state),state};};
 try{
 const controls=createRecapControls({api,accept(){},confirmChange:async()=>true,resetSession:async()=>true});controls.render();await new Promise(r=>setImmediate(r));
 get('recap-live-template').value='Elapsed {duration}';t.mock.timers.tick(5000);await get('recap-apply-template').onclick();
 assert.equal(get('recap-text').value,'Elapsed 00:00:05');assert.equal(state.recap.draft.stats.duration,5000);
 t.mock.timers.tick(10000);await get('recap-complete').onclick();assert.equal(state.recap.snapshots[0].stats.duration,5000);assert.equal(state.recap.snapshots[0].text,'Elapsed 00:00:05');
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
