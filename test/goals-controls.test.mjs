import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/model.mjs';
import {applyAction} from '../lib/state.mjs';
import {createGoalsControls} from '../public/goals-controls.mjs';
import {goalSummary} from '../public/goals-render.mjs';

test('Goals editor preserves draft through remote changes, rejects stale saves, then supports edit/manual/feature',async()=>{
  class Element{constructor(){this.value='';this.children=[];this.hidden=false;this.disabled=false;}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}focus(){}}
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const before=globalThis.document;globalThis.document={getElementById:get,createElement:()=>new Element()};
  let state=defaults(),last,interrupt=false;
  const send=async(path,a)=>{last=a;state=applyAction(state,a);if(interrupt){interrupt=false;throw new TypeError('Network interrupted');}return {state};};
  const submit=()=>get('goal-form').onsubmit({preventDefault(){}});
  try{
    const controls=createGoalsControls({getState:()=>state,api:send,accept(){},change(){},confirmChange:async()=>true});
    controls.render();get('goal-add').onclick();
    get('goal-kind').value='rating';get('goal-kind').onchange();assert.equal(Number(get('goal-target').value),state.goals[state.activeMode]);
    get('goal-mode').value='rapid';get('goal-mode').onchange();assert.equal(Number(get('goal-target').value),state.goals.rapid);
    get('goal-target').value='1800';controls.render();assert.equal(get('goal-target').value,'1800');
    get('goal-title').value='My counter';get('goal-kind').value='manual';get('goal-kind').onchange();get('goal-target').value='10';
    state=applyAction(state,{type:'goal',operation:'add',operationId:'other-client',expectedRevision:0,goal:{title:'Another goal',kind:'wins',target:2,scope:'session',baseline:'session-start'}});
    controls.render();assert.equal(get('goal-title').value,'My counter');await submit();assert.match(get('goals-status').textContent,/changed elsewhere/);assert.equal(get('goal-title').value,'My counter');
    await get('goal-reload').onclick();get('goal-title').value='Manual wins';get('goal-kind').value='manual';get('goal-kind').onchange();get('goal-target').value='10';await submit();assert.equal(state.goalTracker.items.length,2);
    let card=get('goals-list').children[1],actions=card.children.at(-1).children;
    await actions.find(b=>b.textContent==='+1').onclick();assert.equal(state.goalTracker.items[1].manualValue,1);
    card=get('goals-list').children[1];actions=card.children.at(-1).children;await actions.find(b=>b.textContent==='Undo counter').onclick();assert.equal(state.goalTracker.items[1].manualValue,0);
    card=get('goals-list').children[1];actions=card.children.at(-1).children;actions.find(b=>b.textContent==='Edit').onclick();get('goal-title').value='Renamed';await submit();assert.equal(state.goalTracker.items[1].title,'Renamed');assert.deepEqual(Object.keys(last.goal).sort(),['baseline','scope','target','title']);
    card=get('goals-list').children[1];actions=card.children.at(-1).children;await actions.find(b=>b.textContent==='Feature').onclick();assert.equal(state.goalTracker.featuredId,state.goalTracker.items[1].id);
    card=get('goals-list').children[1];actions=card.children.at(-1).children;interrupt=true;await actions.find(b=>b.textContent==='+1').onclick();const requestId=last.operationId;assert.equal(state.goalTracker.items[1].manualValue,1);assert.equal(get('goal-retry').hidden,false);
    await get('goal-retry').onclick();assert.equal(last.operationId,requestId);assert.equal(state.goalTracker.items[1].manualValue,1);assert.equal(get('goal-retry').hidden,true);
    state=applyAction(state,{type:'reset'});controls.render();card=get('goals-list').children[1];actions=card.children.at(-1).children;const unfeature=actions.find(b=>b.textContent==='Unfeature');assert.equal(unfeature.disabled,false);await unfeature.onclick();assert.equal(state.goalTracker.featuredId,null);
  }finally{globalThis.document=before;}
});

test('rating summaries distinguish unavailable, stale and regression without invented zero',()=>{
 let s=defaults();s=applyAction(s,{type:'goal',operation:'add',operationId:'rating',expectedRevision:0,goal:{title:'Milestone',kind:'rating',target:1500,mode:'blitz'}});const g=s.goalTracker.items[0];
 assert.match(goalSummary(s,g).value,/Unavailable/);s.api.stats={chess_blitz:{last:{rating:1100}}};g.startRating=1200;
 assert.match(goalSummary(s,g).detail,/stale/);assert.match(goalSummary(s,g).detail,/100 below start/);
});
