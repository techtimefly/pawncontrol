import {randomUUID} from 'node:crypto';
import {goalDefaults,goalProgress,goalSessionId,goalRating,MAX_GOALS,GOAL_KINDS} from '../public/goals-model.mjs';
const fail=m=>{throw Error(m);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const integer=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k));
const configKeys=['title','kind','scope','target','mode','baseline'];
export function validateGoalOutcomes(outcomes) {
  if(!Array.isArray(outcomes)||outcomes.length>MAX_GOALS)fail('Invalid goal outcomes');
  for(const g of outcomes) {
    if(!keys(g,['id','title','kind','scope','baseline','current','target','distance','complete','status','startRating','mode'])||!text(g.id,80)||!text(g.title,120)||!GOAL_KINDS.includes(g.kind)||!['session','ongoing'].includes(g.scope)||!['session-start','from-now'].includes(g.baseline)||!integer(g.target,1000000)||g.target<1||(g.current!==null&&!integer(g.current,1000000))||g.distance!==(g.current===null?null:g.target-g.current)||typeof g.complete!=='boolean'||g.complete!==(g.current!==null&&g.current>=g.target)||!['current','stale','unavailable','ended'].includes(g.status)||(g.startRating!==null&&!integer(g.startRating,10000))||(g.mode!==null&&!['blitz','rapid','bullet'].includes(g.mode)))fail('Invalid goal outcome');
  }
}
export function validateGoals(t) {
  if(!keys(t,['version','revision','items','featuredId','recentOperations'])||t.version!==1||!integer(t.revision,Number.MAX_SAFE_INTEGER)||!Array.isArray(t.items)||t.items.length>MAX_GOALS||!Array.isArray(t.recentOperations)||t.recentOperations.length>100||t.recentOperations.some(x=>!text(x,100)||!x)||new Set(t.items.map(g=>g.id)).size!==t.items.length)fail('Invalid goals');
  for(const g of t.items) {
    if(!keys(g,[...configKeys,'id','sessionId','excludedIds','manualValue','manualUndo','archived','startRating','startedAt','username','sessionOutcome'])||!text(g.id,80)||!g.id||!text(g.title,120)||!g.title.trim()||/[\r\n\x00-\x1f]/.test(g.title)||!GOAL_KINDS.includes(g.kind)||!['session','ongoing'].includes(g.scope)||(['wins','games'].includes(g.kind)&&g.scope!=='session')||(g.kind==='rating'&&g.scope!=='ongoing')||!integer(g.target,g.kind==='rating'?10000:1000000)||g.target<1||!['session-start','from-now'].includes(g.baseline)||!text(g.sessionId,100)||!Array.isArray(g.excludedIds)||g.excludedIds.length>10000||g.excludedIds.some(id=>!text(id,80))||new Set(g.excludedIds).size!==g.excludedIds.length||!integer(g.manualValue,1000000)||!Array.isArray(g.manualUndo)||g.manualUndo.length>30||g.manualUndo.some(v=>!integer(v,1000000))||typeof g.archived!=='boolean'||(g.startRating!==null&&!integer(g.startRating,10000))||!Number.isFinite(g.startedAt)||g.startedAt<0||g.startedAt>1e15||!text(g.username,50)||(g.kind==='rating'?!['blitz','rapid','bullet'].includes(g.mode):g.mode!==null))fail('Invalid goal');
    if(g.sessionOutcome!==null)validateGoalOutcomes([{id:g.id,title:g.title,kind:g.kind,scope:g.scope,baseline:g.baseline,...g.sessionOutcome}]);
  }
  if(t.featuredId!==null&&!t.items.some(g=>g.id===t.featuredId&&!g.archived))fail('Invalid featured goal');
  return t;
}
function restart(state,g) {
  g.sessionId=goalSessionId(state);g.excludedIds=g.baseline==='from-now'?state.session.results.map(r=>r.id):[];
  g.manualValue=0;g.manualUndo=[];g.sessionOutcome=null;g.startedAt=Date.now();g.username=state.username;
  const r=g.kind==='rating'?goalRating(state,g.mode):null;g.startRating=r?.status==='current'?r.current:null;
}
export function captureSessionGoals(state) {
  for(const g of state.goalTracker?.items??[])if(g.scope==='session'&&g.sessionId===goalSessionId(state))g.sessionOutcome=goalProgress(state,g);
}
export function applyGoal(state,a) {
  const t=state.goalTracker??goalDefaults();
  if(!text(a.operationId,100)||!a.operationId)fail('Goal operation identifier required');
  if(t.recentOperations.includes(a.operationId))return;
  if(a.expectedRevision!==t.revision)fail('Goals changed elsewhere. Reload before saving.');
  if(a.operation==='add') {
    if(t.items.length>=MAX_GOALS)fail('Maximum 20 stored goals. Remove an archived goal first.');
    if(!keys(a.goal,configKeys))fail('Invalid goal configuration');
    const c=a.goal,g={id:randomUUID(),title:c.title,kind:c.kind,scope:c.scope??(c.kind==='rating'?'ongoing':'session'),target:c.target,mode:c.kind==='rating'?c.mode:null,baseline:c.baseline??'session-start',archived:false};
    restart(state,g);t.items.push(g);
    if(g.kind==='rating')state.goals[g.mode]=g.target;
  } else if(a.operation==='feature') {
    if(a.id!==null&&!t.items.some(g=>g.id===a.id&&!g.archived))fail('Goal not found');t.featuredId=a.id;
  } else {
    const g=t.items.find(g=>g.id===a.id);if(!g)fail('Goal not found');
    if(a.operation==='archive'){g.archived=true;if(t.featuredId===g.id)t.featuredId=null;}
    else if(a.operation==='delete'){if(!g.archived)fail('Archive goal before removing');t.items=t.items.filter(x=>x.id!==g.id);}
    else if(a.operation==='edit') {
      if(!keys(a.goal,['title','target','scope','baseline']))fail('Invalid goal edit');
      const reset=(a.goal.scope!==undefined&&a.goal.scope!==g.scope)||(a.goal.baseline!==undefined&&a.goal.baseline!==g.baseline);
      Object.assign(g,a.goal);if(reset)restart(state,g);if(g.kind==='rating'&&Object.hasOwn(a.goal,'target'))state.goals[g.mode]=g.target;
    } else if(a.operation==='repeat') {
      if(g.scope!=='session')fail('Only session goals can repeat');g.archived=false;restart(state,g);
    } else if(['manual','undo'].includes(a.operation)) {
      if(g.kind!=='manual'||g.archived||(g.scope==='session'&&g.sessionId!==goalSessionId(state)))fail('Manual goal is not active');
      if(a.operation==='undo'){if(g.manualUndo.length)g.manualValue=g.manualUndo.pop();}
      else {if(![-1,1].includes(a.delta))fail('Invalid manual increment');if(!integer(g.manualValue+a.delta,1000000))fail('Manual count must be 0-1000000');g.manualUndo.push(g.manualValue);g.manualUndo=g.manualUndo.slice(-30);g.manualValue+=a.delta;}
    } else fail('Unknown goal operation');
  }
  t.revision++;t.recentOperations.push(a.operationId);t.recentOperations=t.recentOperations.slice(-100);validateGoals(t);state.goalTracker=t;
}
