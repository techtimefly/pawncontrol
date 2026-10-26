import {goalDisplayDefaults,GOAL_DISPLAY_MODES} from './goals-presentation.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
export function renderGoalPresentation(host,state,save){
  if(!host||host.contains?.(document.activeElement))return;host.replaceChildren();
  for(const layout of ['landscape','portrait']){
    const config=state.goalPresentation?.[layout]??goalDisplayDefaults(),group=el('section');group.className='goal-presentation-controls';group.append(el('h4',layout==='portrait'?'Portrait presentation':'Landscape presentation'));
    const update=mutate=>{const next=structuredClone(config);mutate(next);return save(layout,config,next);};
    const field=(label,input)=>{const row=el('label',label+' ');row.append(input);group.append(row);};
    const select=(label,key,options)=>{const n=el('select');for(const value of options){const o=el('option',value);o.value=value;n.append(o);}n.value=config[key];n.onchange=()=>update(p=>p[key]=n.value);field(label,n);};
    select('Display','mode',GOAL_DISPLAY_MODES);select('Chart','chart',['none','bar','donut']);
    for(const [label,key,min,max] of [['Visible cards','maxVisible',1,4],['Rotation seconds','dwell',3,300]]){const n=el('input');Object.assign(n,{type:'number',min,max,value:config[key]});n.onchange=()=>{const value=Number(n.value);if(Number.isInteger(value)&&value>=min&&value<=max)update(p=>p[key]=value);else n.value=config[key];};field(label,n);}
    for(const [label,key,checked] of [['Animate value changes','animation',config.animation],['Use featured goal (legacy)','featured',config.selectedIds===null]]){const n=el('input');n.type='checkbox';n.checked=checked;n.onchange=()=>update(p=>{if(key==='featured')p.selectedIds=n.checked?null:[];else p.animation=n.checked;});field(label,n);}
    if(config.selectedIds!==null){
      const active=state.goalTracker.items.filter(g=>!g.archived),ordered=[...config.selectedIds.map(id=>active.find(g=>g.id===id)).filter(Boolean),...active.filter(g=>!config.selectedIds.includes(g.id))];
      for(const g of ordered){const row=el('div');row.className='goal-selection-row';const label=el('label'),input=el('input');input.type='checkbox';input.checked=config.selectedIds.includes(g.id);input.onchange=()=>update(p=>{p.selectedIds=p.selectedIds.filter(id=>id!==g.id);if(input.checked)p.selectedIds.push(g.id);});label.append(input,el('span',g.title));row.append(label);
        const index=config.selectedIds.indexOf(g.id);for(const [text,delta] of [['Earlier',-1],['Later',1]]){const button=el('button',text);button.type='button';button.disabled=index<0||index+delta<0||index+delta>=config.selectedIds.length;button.setAttribute?.('aria-label',text==='Earlier'?'Move goal earlier':'Move goal later');button.onclick=()=>update(p=>{const i=p.selectedIds.indexOf(g.id),j=i+delta;if(i>=0&&j>=0&&j<p.selectedIds.length)[p.selectedIds[i],p.selectedIds[j]]=[p.selectedIds[j],p.selectedIds[i]];});row.append(button);}group.append(row);}
    }
    group.append(el('p','An empty selection shows no cards. Archived or missing goals are skipped. Rotation follows session-start time and catches up after reconnect or returning to the tab. Reduced-motion preferences disable animation.'));host.append(group);
  }
}
