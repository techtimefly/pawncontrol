import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/model.mjs';
import {upgradeBonusSettings} from '../public/bonus-model.mjs';
import {starterTips,starterMessages,starterList,addMissingDefaults} from '../public/starter-templates.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
import {createStarterControls} from '../public/starter-controls.mjs';
import {createTips} from '../public/bonus-render.mjs';
import {createApp} from '../server.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('exact shipped templates, fresh copies, neutral new installs and untouched legacy content',()=>{
  assert.deepEqual(starterTips(),[
    {id:'threats',title:'Before you move',category:'Thinking',text:'Check your opponent’s checks, captures, and threats.',enabled:true},
    {id:'develop',title:'Bring your pieces into play',category:'Opening',text:'Develop your minor pieces, protect your king, and fight for the center.',enabled:true},
    {id:'endgame',title:'Activate your king',category:'Endgame',text:'As pieces leave the board, your king can become an active fighting piece.',enabled:true}
  ]);
  assert.deepEqual(starterMessages(),[
    {id:'follow',text:'Enjoying the games? Follow {channel} for more chess!',enabled:true},
    {id:'notify',text:'Follow and enable notifications for the next stream.',enabled:true},
    {id:'session',text:'Today: {wins}W · {losses}L · {draws}D',enabled:true},
    {id:'goal',text:'Blitz climb: {blitz_rating} / {blitz_goal}',enabled:true}
  ]);
  for(const [kind,key,field] of [['tips','tips','items'],['cta','ticker','messages']]){
    const s=defaults();assert.deepEqual(s[key][field],starterList(kind));s[key][field][0].text='Legacy custom';
    assert.notEqual(starterList(kind)[0].text,'Legacy custom');assert.deepEqual(upgradeBonusSettings(s)[key],s[key]);
    const copy=starterList(kind);copy[0].enabled=false;assert.equal(starterList(kind)[0].enabled,true);
  }
});
for(const [kind,key,field,limit] of [['tips','tips','items',100],['cta','ticker','messages',50]]){
  test(`${kind}: restore/add/undo preserve every other field; stale/repeated/invalid writes rejected`,()=>{
    const s=defaults();s.ticker.paused=true;s.tipsPlayback.paused=true;s.widgets.tips.visible=false;
    s[key][field]=[{...starterList(kind)[0],id:'custom',text:'Custom content',enabled:false}];s.session.corrections.win=7;s.presets.saved=settingsOf(defaults());
    const expected=structuredClone(s[key][field]),cmd={type:'starter-templates',kind,operation:'restore',expected};
    const next=applyAction(s,cmd);assert.deepEqual(next[key][field],starterList(kind));
    const restored=structuredClone(next);restored[key][field]=expected;assert.deepEqual(restored,s);
    assert.throws(()=>applyAction(next,cmd),/changed elsewhere/);
    assert.deepEqual(applyAction(next,{type:'starter-templates',kind,operation:'undo',expected:next[key][field],items:expected}),s);
    assert.throws(()=>applyAction(s,{...cmd,operation:'undo',items:[null]}));
    assert.throws(()=>applyAction(s,{...cmd,operation:'undo',items:Array.from({length:limit+1},(_,i)=>({...starterList(kind)[0],id:`x${i}`}))}));
    const full=structuredClone(s);full[key][field]=Array.from({length:limit},(_,i)=>({...starterList(kind)[0],id:`x${i}`,text:`Custom ${i}`}));
    assert.throws(()=>applyAction(full,{...cmd,operation:'add',expected:full[key][field]}));
    assert.deepEqual(s[key][field],expected);
  });
  test(`${kind}: add skips edited matching IDs and exact content regardless of enabled; idempotent and collision free`,()=>{
    const templates=starterList(kind),edited={...templates[0],text:'Edited',enabled:false},sameText={...templates[1],id:'other',enabled:false};
    const before=[edited,sameText],after=addMissingDefaults(kind,before);
    assert.deepEqual(after.slice(0,2),before);assert.equal(after.length,templates.length);assert.equal(new Set(after.map(x=>x.id)).size,after.length);
    assert.deepEqual(addMissingDefaults(kind,after),after);assert.notEqual(after[0],before[0]);
  });
}
test('invalid kind/operation/expected cannot bypass validation',()=>{
  for(const cmd of [{kind:'credits',operation:'restore'},{kind:'tips',operation:'bad'},{kind:'cta',operation:'restore'}])assert.throws(()=>applyAction(defaults(),{type:'starter-templates',...cmd}));
});

test('restoring removes the current custom tip safely while paused and hidden without playback commands',t=>{
  const previous={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame};t.after(()=>Object.assign(globalThis,previous));
  const element=()=>({classList:{add(){}},style:{},dataset:{},replaceChildren(){},textContent:''});
  globalThis.document={createElement:element};globalThis.requestAnimationFrame=()=>{};
  const s=defaults();s.tips.items=[{...starterTips()[0],id:'custom'}];s.tipsPlayback.paused=true;s.widgets.tips.visible=false;
  const root=element(),renderer=createTips(root);renderer.update(s.tips,s.tipsPlayback);assert.equal(root.dataset.tipId,'custom');
  const next=applyAction(s,{type:'starter-templates',kind:'tips',operation:'restore',expected:s.tips.items});renderer.update(next.tips,next.tipsPlayback);
  assert.equal(root.dataset.tipId,'threats');assert.deepEqual(next.tipsPlayback,s.tipsPlayback);assert.equal(next.widgets.tips.visible,false);
  const retained=applyAction(next,{type:'starter-templates',kind:'tips',operation:'add',expected:next.tips.items});renderer.update(retained.tips,retained.tipsPlayback);assert.equal(root.dataset.tipId,'threats');
});

test('real template handlers cancel, prevent double-dialog races, retain drafts, retry failures and reject SSE conflicts/undo',async t=>{
  const old={document:globalThis.document,window:globalThis.window};t.after(()=>Object.assign(globalThis,old));
  const elements=new Map(),events={};
  const element=()=>({children:[],disabled:false,textContent:'',append(...nodes){this.children.push(...nodes);},setAttribute(){}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const draft={value:'Unsaved visual text',isConnected:true,focus(){this.focused=true;}};
  globalThis.document={getElementById:get,createElement:element,activeElement:draft,addEventListener:(type,fn)=>events[type]=fn};globalThis.window={addEventListener(){}};
  let s=defaults(),resolve,dialogs=0,sends=0,fail=false,renders=0;
  s.tips.items=[{...starterTips()[0],id:'custom',text:'Custom'}];
  const controls=createStarterControls({getState:()=>s,confirmChange:message=>{dialogs++;assert.match(message,/Exact resulting list/);return new Promise(r=>resolve=r);},render:()=>renders++,action:async a=>{sends++;if(fail)return false;s=applyAction(s,a);controls.update();return true;}});
  const buttons=get('tips-starter-controls').children[0].children;
  const begin=async index=>{const p=buttons[index].onclick();await Promise.resolve();return {p};};
  const before=structuredClone(s);
  let pending=await begin(0);await buttons[0].onclick();assert.equal(dialogs,1);let prevented=false;events.change({target:{closest:()=>true},stopImmediatePropagation(){prevented=true;}});assert.ok(prevented);resolve(false);await pending.p;
  assert.deepEqual(s,before);assert.equal(draft.value,'Unsaved visual text');assert.equal(renders,0);assert.ok(draft.focused);
  pending=await begin(0);s.tips.items[0].text='SSE update';resolve(true);await pending.p;assert.equal(sends,0);
  fail=true;pending=await begin(0);resolve(true);await pending.p;assert.equal(draft.value,'Unsaved visual text');assert.equal(renders,0);
  fail=false;pending=await begin(0);resolve(true);await pending.p;assert.deepEqual(s.tips.items,starterTips());assert.equal(renders,1);
  pending=await begin(2);resolve(true);await pending.p;assert.equal(s.tips.items[0].text,'SSE update');
  pending=await begin(1);resolve(true);await pending.p;const count=s.tips.items.length;await buttons[1].onclick();assert.equal(s.tips.items.length,count);
  s.tips.items[0].text='Later';controls.update();assert.ok(buttons[2].disabled);await buttons[2].onclick();assert.equal(s.tips.items[0].text,'Later');
});

for(const authRequired of [false,true])test(`template HTTP operations preserve boundaries, auth=${authRequired}`,async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-starters-'));const app=createApp({dataDir:dir,authRequired,password:'test-password-123456789',token:'test-read-token-1234567890',username:'test_fixture',poll:false});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  const post=(data,headers={},suffix='')=>fetch(base+'/api/action'+suffix,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  try{
    let headers={};if(authRequired){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-password-123456789'})});headers.cookie=response.headers.get('set-cookie').split(';')[0];}
    const s=await (await fetch(base+'/api/state',{headers})).json();
    for(const [kind,key,field] of [['tips','tips','items'],['cta','ticker','messages']]){
      const cmd={type:'starter-templates',kind,operation:'undo',expected:s[key][field],items:[]};
      if(authRequired)assert.equal((await post(cmd,{},'?token=test-read-token-1234567890')).status,401);
      assert.equal((await post(cmd,{...headers,origin:'http://evil.example'})).status,403);
      assert.equal((await post(cmd,headers)).status,200);assert.equal((await post(cmd,headers)).status,400);
      assert.equal((await post({...cmd,operation:'restore',expected:[]},headers)).status,200);
    }
    for(const path of ['/starter-controls.mjs','/starter-templates.mjs'])assert.equal((await fetch(base+path)).status,200);
  }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
