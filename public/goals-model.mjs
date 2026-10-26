export const MAX_GOALS=20;
export const GOAL_KINDS=['wins','games','manual','rating'];
export const goalDefaults=()=>({version:1,revision:0,items:[],featuredId:null,recentOperations:[]});
export const goalSessionId=state=>state.session.id??`legacy-${state.session.startedAt}`;
export function goalRating(state,mode,now=Date.now()) {
  const override=state.overrides?.[mode];
  if(Number.isInteger(override)&&override>=0&&override<=10000)return {current:override,status:'current'};
  const value=state.api?.stats?.[`chess_${mode}`]?.last?.rating;
  if(!Number.isInteger(value)||value<0||value>10000)return {current:null,status:'unavailable'};
  return {current:value,status:state.api.statsError||!state.api.statsSuccessAt||now-state.api.statsSuccessAt>15*60*1000?'stale':'current'};
}
export function goalProgress(state,goal,now=Date.now()) {
  let current=null,status='current';
  const target=goal.kind==='rating'?state.goals[goal.mode]:goal.target;
  if(goal.scope==='session'&&goal.sessionId!==goalSessionId(state))return {...(goal.sessionOutcome??{current:null,target,distance:null,complete:false}),status:'ended',startRating:goal.startRating,mode:goal.mode};
  if(goal.kind==='rating') {
    ({current,status}=goal.username===state.username?goalRating(state,goal.mode,now):{current:null,status:'unavailable'});
  } else if(goal.kind==='manual')current=goal.manualValue;
  else {
    const excluded=new Set(goal.excludedIds);
    current=state.session.results.filter(r=>!excluded.has(r.id)&&(goal.kind==='games'||r.result==='win')).length;
  }
  return {current,target,distance:current===null?null:target-current,complete:current!==null&&current>=target,status,startRating:goal.startRating,mode:goal.mode};
}
export function goalOutcomes(state,now=Date.now()) {
  return (state.goalTracker?.items??[]).filter(g=>g.scope==='ongoing'||g.sessionId===goalSessionId(state)).map(g=>({id:g.id,title:g.title,kind:g.kind,scope:g.scope,baseline:g.baseline,...goalProgress(state,g,now)}));
}
