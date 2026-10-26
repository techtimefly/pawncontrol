import {goalProgress} from './goals-model.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
export function goalSummary(s,g) {
  const p=goalProgress(s,g);
  const number=p.current===null||p.current===undefined?'Unavailable':String(p.current);
  const value=`${number} / ${p.target}`;
  let detail=g.kind==='rating'?`${g.mode} rating · ${p.distance===null||p.distance===undefined?'distance unavailable':p.distance>0?`${p.distance} to target`:'target reached'}`:
    `${g.kind==='manual'?'Manual counter':'Recorded '+(g.kind==='wins'?'wins':'games')} · ${p.complete?'target reached':`${p.distance} remaining`}`;
  if(g.kind==='rating')detail+=` · start ${p.startRating??'unavailable'}`;
  if(g.kind==='rating'&&p.current!==null&&p.startRating!==null&&p.current<p.startRating)detail+=` · ${p.startRating-p.current} below start`;
  if(p.status!=='current')detail+=` · ${p.status==='ended'?'session ended':p.status==='stale'?'stale data (last known)':'data unavailable'}`;
  return {...p,value,detail};
}
export function renderGoal(wrapper,s) {
  const handle=wrapper.querySelector('.resize-handle');
  wrapper.replaceChildren();
  const g=s.goalTracker?.items.find(g=>g.id===s.goalTracker.featuredId&&!g.archived);
  if(!g){wrapper._goalSummaryKey='';if(handle)wrapper.append(handle);return;}
  const p=goalSummary(s,g),w=s.widgets.goal;
  wrapper._goalSummaryKey=JSON.stringify([g.id,g.title,g.scope,p]);
  const card=el('div','featured-goal-card'),content=el('div','featured-goal-content');
  content.append(el('div','featured-goal-label',g.scope==='ongoing'?'ONGOING GOAL':'SESSION GOAL'),el('div','featured-goal-title',g.title),el('strong','featured-goal-value',p.value),el('div','featured-goal-detail',p.detail));
  card.append(content);wrapper.append(card);if(handle)wrapper.append(handle);
  content.style.fontSize=`${s.theme.font*w.scale}px`;
  requestAnimationFrame(()=>{
    if(!content.isConnected)return;
    const fit=Math.min(1,card.clientHeight/Math.max(1,content.scrollHeight),card.clientWidth/Math.max(1,content.scrollWidth));
    content.style.transform=`scale(${fit})`;
    if(fit<1)content.style.width=`${100/fit}%`;
  });
}
export function tickGoal(canvas,s){
  const wrapper=canvas.querySelector('[data-widget="goal"]');if(!wrapper)return;
  const g=s.goalTracker?.items.find(g=>g.id===s.goalTracker.featuredId&&!g.archived);
  const key=g?JSON.stringify([g.id,g.title,g.scope,goalSummary(s,g)]):'';
  if(key!==wrapper._goalSummaryKey)renderGoal(wrapper,s);
}
