import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/model.mjs';
import {upgradeLayouts,layoutState} from '../public/layouts.mjs';
import {applyAction,settingsOf,validateSettings} from '../lib/state.mjs';
import {goalPresentationDefaults,validateGoalPresentation,displayedGoals,goalChartValue,animateGoalChange} from '../public/goals-presentation.mjs';
const fixture=()=>{const s=defaults();s.session.startedAt=1000;s.goalTracker.items=Array.from({length:7},(_,i)=>({id:String(i),title:'Goal '+i,archived:false}));s.goalTracker.featuredId='2';return s;};
test('legacy migration keeps featured choice, visibility and orientation settings',()=>{
 const s=fixture(),old=settingsOf(s);delete old.goalPresentation;const migrated=upgradeLayouts(old);validateSettings(migrated);assert.deepEqual(migrated.goalPresentation,goalPresentationDefaults());assert.deepEqual(upgradeLayouts(migrated),migrated);assert.equal(displayedGoals(s)[0].id,'2');assert.equal(s.widgets.goal.visible,false);
 s.goalPresentation.landscape.selectedIds=['1'];s.goalPresentation.portrait.selectedIds=['4'];assert.equal(displayedGoals(layoutState(s,'portrait'))[0].id,'4');assert.equal(displayedGoals(s)[0].id,'1');
});
test('selection is ordered bounded, supports explicit empty, skips archived and missing',()=>{
 const s=fixture(),p=s.goalPresentation.landscape;p.selectedIds=[];assert.deepEqual(displayedGoals(s),[]);p.selectedIds=['5','missing','2','1','0'];s.goalTracker.items[2].archived=true;p.mode='stacked';p.maxVisible=2;assert.deepEqual(displayedGoals(s).map(g=>g.id),['5','1']);p.mode='horizontal';assert.deepEqual(displayedGoals(s).map(g=>g.id),['5','1']);p.mode='single';assert.equal(displayedGoals(s)[0].id,'5');
});
test('rotation uses deterministic slots across updates, reconnects, visibility and changed selections',()=>{
 const s=fixture(),p=s.goalPresentation.landscape;p.mode='rotating';p.selectedIds=['0','1','2'];p.dwell=3;
 assert.equal(displayedGoals(s,1000)[0].id,'0');assert.equal(displayedGoals(s,4000)[0].id,'1');s.theme.font=40;assert.equal(displayedGoals(s,4500)[0].id,'1');assert.equal(displayedGoals(structuredClone(s),4500)[0].id,'1');assert.equal(displayedGoals(s,22000)[0].id,'1');s.goalTracker.items[1].archived=true;assert.equal(displayedGoals(s,22000)[0].id,'2');p.selectedIds=['2'];assert.equal(displayedGoals(s,99999999)[0].id,'2');
});
test('chart baselines, regressions, stale and absent data never fabricate progress',()=>{
 const g={kind:'rating'},p={current:1400,target:1600,startRating:1200,status:'current'};assert.equal(goalChartValue(g,p),.5);assert.equal(goalChartValue(g,{...p,current:1100}),0);assert.equal(goalChartValue(g,{...p,current:1700}),1);
 for(const q of [{...p,startRating:null},{...p,current:null},{...p,status:'stale'},{...p,status:'ended'},{...p,target:1200}])assert.equal(goalChartValue(g,q),null);
 assert.equal(goalChartValue({kind:'manual'},{current:3,target:6,status:'current'}),.5);assert.equal(animateGoalChange(.3,.5,true),true);for(const args of [[undefined,.5,true],[.5,.5,true],[.3,.5,false],[.3,.5,true,true],[null,.5,true]])assert.equal(animateGoalChange(...args),false);
});
test('presentation validation rejects malformed settings and accepts backup/preset roundtrips',()=>{
 for(const [key,value] of [['mode','evil'],['chart','line'],['maxVisible',5],['dwell',2],['dwell',3.5],['animation','yes'],['selectedIds',['a','a']],['selectedIds',[null]],['selectedIds',Array(21).fill('x')]]){const p=goalPresentationDefaults();p.landscape[key]=value;assert.throws(()=>validateGoalPresentation(p));}
 let s=defaults();s.goalPresentation.portrait.mode='horizontal';s.goalPresentation.portrait.chart='donut';s=applyAction(s,{type:'save-preset',name:'goals'});s.goalPresentation.portrait.chart='bar';s=applyAction(s,{type:'load-preset',name:'goals'});assert.equal(s.goalPresentation.portrait.chart,'donut');const next=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(s),session:s.session}});assert.deepEqual(next.goalPresentation,s.goalPresentation);
});
test('two-client presentation changes reject stale revision without losing other layout',()=>{
 const s=defaults(),p=structuredClone(s.goalPresentation);p.landscape.mode='rotating';const next=applyAction(s,{type:'settings',settings:{goalPresentation:p},expectedGoalRevision:0});const other=structuredClone(s.goalPresentation);other.portrait.mode='stacked';assert.throws(()=>applyAction(next,{type:'settings',settings:{goalPresentation:other},expectedGoalRevision:0}),/changed elsewhere/);assert.equal(next.goalPresentation.landscape.mode,'rotating');
});

test('retained render avoids unrelated SSE rebuild and animates only known changes, never reconnect',async()=>{
 const {renderGoal,suppressGoalAnimation}=await import('../public/goals-render.mjs');
 const old={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,matchMedia:globalThis.matchMedia};let animations=0,reduced=false;
 class Element{constructor(){this.children=[];this.style={setProperty(){}};this.isConnected=false;}append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}querySelector(){return null;}setAttribute(){}animate(){animations++;}}
 globalThis.document={createElement:()=>new Element()};globalThis.requestAnimationFrame=()=>{};globalThis.matchMedia=()=>({matches:reduced});
 try{const s=defaults();s.goalTracker.items=[{id:'m',title:'A long goal',scope:'ongoing',kind:'manual',manualValue:1,target:10}];s.goalTracker.featuredId='m';s.goalPresentation.landscape.chart='bar';const wrapper=new Element();renderGoal(wrapper,s);assert.equal(animations,0);const root=wrapper.children[0];s.channel='Unrelated';renderGoal(wrapper,s);assert.equal(wrapper.children[0],root);s.goalTracker.items[0].manualValue=2;renderGoal(wrapper,s);assert.equal(animations,1);suppressGoalAnimation({querySelector:()=>wrapper});s.goalTracker.items[0].manualValue=5;renderGoal(wrapper,s);assert.equal(animations,1);reduced=true;s.goalTracker.items[0].manualValue=6;renderGoal(wrapper,s);assert.equal(animations,1);s.goalPresentation.landscape.animation=false;reduced=false;s.goalTracker.items[0].manualValue=7;renderGoal(wrapper,s);assert.equal(animations,1);
 }finally{Object.assign(globalThis,old);}
});

test('granular orientation updates merge simultaneous clients and reject same-orientation stale edits',()=>{
 const initial=defaults(),landscape={...initial.goalPresentation.landscape,mode:'horizontal'},portrait={...initial.goalPresentation.portrait,chart:'donut'};
 const a={type:'goal-presentation',layout:'landscape',expectedPresentation:initial.goalPresentation.landscape,presentation:landscape};let s=applyAction(initial,a);s=applyAction(s,{type:'goal-presentation',layout:'portrait',expectedPresentation:initial.goalPresentation.portrait,presentation:portrait});assert.deepEqual(s.goalPresentation,{landscape,portrait});assert.throws(()=>applyAction(s,{...a,presentation:{...landscape,chart:'bar'}}),/changed elsewhere/);assert.deepEqual(applyAction(s,a).goalPresentation,s.goalPresentation);
});
