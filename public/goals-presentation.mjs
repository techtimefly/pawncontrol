export const GOAL_DISPLAY_MODES=['single','rotating','stacked','horizontal'];
export const goalDisplayDefaults=()=>({mode:'single',selectedIds:null,maxVisible:3,dwell:10,chart:'none',animation:true});
export const goalPresentationDefaults=()=>({landscape:goalDisplayDefaults(),portrait:goalDisplayDefaults()});
export function validateGoalPresentation(value){
  if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['landscape','portrait'].includes(k)))throw new Error('Invalid goal presentation');
  for(const layout of ['landscape','portrait']){
    const p=value[layout];
    if(!p||Object.keys(p).some(k=>!['mode','selectedIds','maxVisible','dwell','chart','animation'].includes(k))||!GOAL_DISPLAY_MODES.includes(p.mode)||!['none','bar','donut'].includes(p.chart)||typeof p.animation!=='boolean'||!Number.isInteger(p.maxVisible)||p.maxVisible<1||p.maxVisible>4||!Number.isInteger(p.dwell)||p.dwell<3||p.dwell>300||!(p.selectedIds===null||Array.isArray(p.selectedIds)&&p.selectedIds.length<=20&&new Set(p.selectedIds).size===p.selectedIds.length&&p.selectedIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=80)))throw new Error('Invalid goal presentation');
  }
  return value;
}
export function goalDisplay(state){return state.goalPresentation?.[state.layout==='portrait'?'portrait':'landscape']??goalDisplayDefaults();}
export function displayedGoals(state,now=Date.now()){
  const p=goalDisplay(state),items=state.goalTracker?.items??[],ids=p.selectedIds===null?[state.goalTracker?.featuredId]:p.selectedIds;
  const goals=ids.map(id=>items.find(g=>g.id===id&&!g.archived)).filter(Boolean);
  if(p.mode==='single')return goals.slice(0,1);
  // Wall-clock slots share an epoch across browser sources. Reconnects and hidden
  // tabs catch up without starting a second rotation or replaying missed cards.
  if(p.mode==='rotating')return goals.length?[goals[Math.floor(Math.max(0,now-(state.session?.startedAt??0))/(p.dwell*1000))%goals.length]]:[];
  return goals.slice(0,p.maxVisible);
}
export function goalChartValue(goal,progress){
  if(progress.status!=='current'||!Number.isFinite(progress.current)||!Number.isFinite(progress.target))return null;
  const baseline=goal.kind==='rating'?progress.startRating:0;
  if(!Number.isFinite(baseline)||progress.target<=baseline)return null;
  return Math.max(0,Math.min(1,(progress.current-baseline)/(progress.target-baseline)));
}
export function animateGoalChange(previous,next,enabled,reducedMotion=false){return enabled&&!reducedMotion&&Number.isFinite(previous)&&Number.isFinite(next)&&previous!==next;}
