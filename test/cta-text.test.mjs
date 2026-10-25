import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parseMessages,serializeMessages} from '../public/cta-text.mjs';
import {defaults,tickerMessages,tickerEntries} from '../public/model.mjs';
import {applyAction} from '../lib/state.mjs';
import {createCtaTextControls} from '../public/cta-text-controls.mjs';
test('CTA structured round trip: exact Unicode, CRLF, tokens, colons, multiline, metadata and duplicate text',()=>{
  const items=[{id:'a',text:'  ♞: {channel}\r\n\n{wins} <b> {unknown}  ',enabled:false,extra:{kept:true}},{id:'b',text:'  ♞: {channel}\r\n\n{wins} <b> {unknown}  ',enabled:true}];
  for(const source of [serializeMessages(items),serializeMessages(items).replaceAll('\n','\r\n')]){
    const result=parseMessages(source,'structured',items);assert.deepEqual(result.errors,[]);assert.deepEqual(result.items,items);
  }
  assert.deepEqual(parseMessages(serializeMessages([...items].reverse()),'structured',items).items,[...items].reverse());
  assert.deepEqual(parseMessages('ID: a\nText: Edited','structured',items).items[0],{...items[0],text:'Edited'});
  const simple=parseMessages('  ♞: {channel}\r\n\r\n{wins}  ','simple');assert.deepEqual(simple.items.map(m=>m.text),['♞: {channel}','{wins}']);assert.ok(simple.items.every(m=>m.enabled));
});
test('CTA line validation, required text, duplicate fields/IDs, unknown fields, enabled and quoted strings',()=>{
  for(const [source,line] of [['Title: bad\nText: ok',1],['Text: ok\nEnabled: true',2],['Enabled: yes',1],['Text:  ',1],['Text: ok\nText: two',2],['ID: unknown\nText: ok',1],['Text: "bad',1],['Text: "\\n"',1]])assert.ok(parseMessages(source,'structured').errors.some(e=>e.line===line),source);
  const items=defaults().ticker.messages;
  assert.ok(parseMessages(serializeMessages([items[0],items[0]]),'structured',items).errors.some(e=>e.message==='Duplicate ID'));
  assert.ok(parseMessages(serializeMessages(items),'structured',items,'append').errors.length);
  assert.equal(parseMessages('','structured').items.length,0);
});
test('CTA server limits and append counts',()=>{
  assert.equal(parseMessages('Text: '+'x'.repeat(500),'structured').errors.length,0);
  assert.ok(parseMessages('Text: '+'x'.repeat(501),'structured').errors.length);
  assert.ok(parseMessages('ID: '+'x'.repeat(81)+'\nText: ok','structured').errors.some(e=>/80/.test(e.message)));
  assert.equal(parseMessages(Array(50).fill('ok').join('\n'),'simple').errors.length,0);
  assert.ok(parseMessages(Array(51).fill('ok').join('\n'),'simple').errors.length);
  assert.ok(parseMessages(Array(50).fill('ok').join('\n'),'simple',defaults().ticker.messages,'append').errors.length);
});
test('atomic CTA action preserves all settings and session, rejects stale/repeated and invalid saves, allows safe undo',()=>{
  const before=defaults(),messages=[...before.ticker.messages,...parseMessages('New','simple').items];
  const next=applyAction(before,{type:'ticker-messages',expectedMessages:before.ticker.messages,messages});
  assert.deepEqual({...next,ticker:before.ticker},before);
  assert.deepEqual({...next.ticker,messages:before.ticker.messages},before.ticker);
  assert.throws(()=>applyAction(next,{type:'ticker-messages',expectedMessages:before.ticker.messages,messages}),/changed elsewhere/);
  for(const invalid of [[{id:'x',text:'x'.repeat(501),enabled:true}],[{id:'x',text:'ok',enabled:'yes'}],Array(51).fill(messages[0]),[null]])assert.throws(()=>applyAction(before,{type:'ticker-messages',expectedMessages:before.ticker.messages,messages:invalid}));
  assert.deepEqual(applyAction(next,{type:'ticker-messages',expectedMessages:messages,messages:before.ticker.messages}),before);
});
test('tokens substitute without modifying sources; unknown tokens remain; unavailable and empty skip',()=>{
  const s=defaults();s.channel='Creator Name';s.ticker.messages=parseMessages('Text: ♞ {channel}: {wins} {unknown}\n\nText: {blitz_rating}\n\nText: disabled\nEnabled: no','structured').items;
  const source=serializeMessages(s.ticker.messages);
  assert.deepEqual(tickerMessages(s),[`♞ ${s.channel}: 0 {unknown}`]);s.overrides.blitz=0;
  assert.deepEqual(tickerEntries(s).map(m=>m.id),s.ticker.messages.slice(0,2).map(m=>m.id));assert.equal(tickerMessages(s)[1],'0');assert.equal(serializeMessages(s.ticker.messages),source);
});
// Exercise the real editor event handlers with a small DOM fixture, without a browser dependency.
test('CTA draft survives SSE; mode, close and navigation cancellation; confirmed simple starts empty',async t=>{
  const f=fixture(t);await f.click('toggle');const source=f.get('cta-text-source');source.value='Text: "A\\nB"';source.oninput();
  globalThis.confirm=()=>false;f.get('cta-text-format').value='simple';await f.get('cta-text-format').onchange();assert.equal(f.get('cta-text-format').value,'structured');
  assert.equal(await f.controls.canLeave(),false);await f.click('toggle');assert.equal(f.get('cta-text-editor').hidden,false);
  let prevented=false;f.events.beforeunload({preventDefault(){prevented=true;}});assert.ok(prevented);
  for(let i=0;i<100;i++)f.controls.update();assert.equal(source.value,'Text: "A\\nB"');
  f.state().ticker.messages[0].text='Remote edit';f.controls.update();f.click('preview');assert.ok(f.get('cta-text-apply').disabled);assert.equal(source.value,'Text: "A\\nB"');
  globalThis.confirm=()=>true;f.get('cta-text-format').value='simple';await f.get('cta-text-format').onchange();assert.equal(source.value,'');
});
test('CTA append, cancel replace, failed save retry, double clicks, safe undo and stale undo',async t=>{
  const f=fixture(t);await f.click('toggle');const original=structuredClone(f.state().ticker.messages),source=f.get('cta-text-source');
  source.value='Text: New';source.oninput();f.get('cta-text-operation').value='append';f.click('preview');
  f.fail();await f.click('apply');assert.equal(source.value,'Text: New');assert.deepEqual(f.state().ticker.messages,original);
  f.fail(false);await Promise.all([f.click('apply'),f.click('apply')]);assert.equal(f.state().ticker.messages.length,original.length+1);
  await f.click('undo');assert.deepEqual(f.state().ticker.messages,original);
  source.value='';source.oninput();f.get('cta-text-operation').value='replace';f.click('preview');globalThis.confirm=()=>false;await f.click('apply');assert.deepEqual(f.state().ticker.messages,original);
  globalThis.confirm=()=>true;await Promise.all([f.click('apply'),f.click('apply')]);assert.deepEqual(f.state().ticker.messages,[]);
  f.state().ticker.messages=[original[0]];f.controls.update();assert.ok(f.get('cta-text-undo').disabled);await f.click('undo');assert.deepEqual(f.state().ticker.messages,[original[0]]);
});
function fixture(t){
  const previous={document:globalThis.document,window:globalThis.window,confirm:globalThis.confirm};
  const element=()=>({hidden:false,disabled:false,value:'',textContent:'',children:[],append(x){this.children.push(x);},replaceChildren(){this.children=[];}});
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const events={};globalThis.document={getElementById:get,createElement:element};globalThis.window={addEventListener:(type,fn)=>events[type]=fn};globalThis.confirm=()=>true;
  t.after(()=>Object.assign(globalThis,previous));
  get('cta-text-editor').hidden=true;get('cta-text-format').value='structured';get('cta-text-operation').value='replace';
  let state=defaults(),fail=false;
  const controls=createCtaTextControls({getState:()=>state,confirmChange:async message=>globalThis.confirm(message),action:async a=>{if(fail)return false;try{state=applyAction(state,a);controls.update();return true;}catch{return false;}}});
  const click=id=>get(`cta-text-${id}`).onclick();
  return {get,events,controls,click,state:()=>state,fail:(value=true)=>fail=value};
}

test('CTA help documents exactly the supported variables and their live substitution',()=>{
  const html=readFileSync(new URL('../public/control.html',import.meta.url),'utf8');
  const documented=[...html.matchAll(/data-cta-token="([a-z_]+)"/g)].map(m=>m[1]);
  const expected=['channel','username','wins','losses','draws','streak',...['blitz','rapid','bullet'].flatMap(mode=>[mode+'_rating',mode+'_goal'])];
  assert.deepEqual([...documented].sort(),expected.sort());
  const state=defaults();state.overrides={blitz:1234,rapid:1456,bullet:1678};
  for(const token of documented){
    state.ticker.messages=[{id:'example',text:'Value: {'+token+'}',enabled:true}];
    assert.equal(tickerMessages(state).length,1);assert.ok(!tickerMessages(state)[0].includes('{'+token+'}'),token);
  }
  state.overrides.blitz=null;state.ticker.messages=[{id:'example',text:'Missing {blitz_rating}',enabled:true}];assert.deepEqual(tickerMessages(state),[]);
  state.ticker.messages=[{id:'example',text:'Literal {unknown}',enabled:true}];assert.deepEqual(tickerMessages(state),['Literal {unknown}']);
  for(const heading of ['Simple list','Structured blocks','Append or replace','Limits','Multiline text','Preview'])assert.ok(html.includes('<h4>'+heading+'</h4>'));
});
