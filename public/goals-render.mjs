import {goalDisplay,displayedGoals,goalChartValue,animateGoalChange} from './goals-presentation.mjs';
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
  const config=goalDisplay(s),goals=displayedGoals(s),entries=goals.map(g=>({g,p:goalSummary(s,g)}));
  const key=JSON.stringify([s.layout,config,s.widgets.goal,s.theme,entries]);
  if(wrapper._goalSummaryKey===key)return;
  wrapper._goalSummaryKey=key;
  const previous=wrapper._goalValues??new Map();wrapper._goalValues=new Map();
  const handle=wrapper.querySelector('.resize-handle');wrapper.replaceChildren();
  const root=el('div','goal-cards goal-cards-'+config.mode);wrapper.append(root);
  root.style.setProperty('--goal-count',String(Math.max(1,entries.length)));
  for(const {g,p} of entries){
    const card=el('div','featured-goal-card'),content=el('div','featured-goal-content');
    content.append(el('div','featured-goal-label',g.scope==='ongoing'?'ONGOING GOAL':'SESSION GOAL'),el('div','featured-goal-title',g.title),el('strong','featured-goal-value',p.value),el('div','featured-goal-detail',p.detail));
    const value=goalChartValue(g,p);wrapper._goalValues.set(g.id,value);
    if(config.chart!=='none'){
      if(value===null)content.append(el('div','goal-chart-unavailable',p.status==='stale'?'Chart unavailable · stale data':'Chart unavailable'));
      else{
        const chart=el('div','goal-chart goal-chart-'+config.chart),fill=el('div','goal-chart-fill');
        chart.setAttribute('role','img');chart.setAttribute('aria-label',Math.round(value*100)+'% of goal progress');
        chart.style.setProperty('--progress',String(value));chart.append(fill);content.append(chart);
        const prior=previous.get(g.id),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
        if(!wrapper._goalSuppressAnimation&&animateGoalChange(prior,value,config.animation,reduced)&&typeof fill.animate==='function'){
          // Animate only known value changes on a retained card. New/reconnected
          // cards render their actual value immediately, never from zero.
          if(config.chart==='bar')fill.animate([{transform:'scaleX('+prior+')'},{transform:'scaleX('+value+')'}],{duration:280,easing:'ease-out'});
          else fill.animate([{opacity:.65},{opacity:1}],{duration:280,easing:'ease-out'});
        }
      }
    }
    card.append(content);root.append(card);content.style.fontSize=(s.theme.font*s.widgets.goal.scale)+'px';
    requestAnimationFrame(()=>{
      if(!content.isConnected)return;
      const fit=Math.min(1,card.clientHeight/Math.max(1,content.scrollHeight),card.clientWidth/Math.max(1,content.scrollWidth));
      content.style.transform='scale('+fit+')';
    });
  }
  wrapper._goalSuppressAnimation=false;if(handle)wrapper.append(handle);
}
export function suppressGoalAnimation(canvas){const wrapper=canvas.querySelector('[data-widget="goal"]');if(wrapper){wrapper._goalValues=new Map();wrapper._goalSuppressAnimation=true;}}
export function tickGoal(canvas,s){const wrapper=canvas.querySelector('[data-widget="goal"]');if(wrapper)renderGoal(wrapper,s);}
