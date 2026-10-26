import {goalSummary} from './goals-render.mjs';
import {createMessageId} from './model.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const kinds={wins:'Session wins',games:'Games played',rating:'Rating milestone',manual:'Manual counter'};
export function createGoalsControls({getState,api,accept,change,confirmChange}) {
  const $=id=>document.getElementById(id);
  let busy=false,editing=null,draftRevision=null,summaryKey='',uncertain=null;
  const status=t=>$('goals-status').textContent=t;
  const button=(text,fn,disabled=false)=>{const b=el('button','secondary',text);b.type='button';b.disabled=busy||disabled;b.onclick=fn;return b;};
  async function command(operation,extra={},revision=getState().goalTracker.revision){
    if(busy)return false;
    const fingerprint=JSON.stringify([operation,extra]);
    if(uncertain&&uncertain.fingerprint!==fingerprint){status('The previous goal request has an uncertain outcome. Use Retry last request before making another change.');return false;}
    const request=uncertain?.request??{type:'goal',operation,operationId:createMessageId(),expectedRevision:revision,...extra};
    busy=true;render();
    try{const r=await api('/api/action',request);uncertain=null;$('goal-retry').hidden=true;accept(r.state,true);status('Goal saved.');return true;}
    catch(e){if(e instanceof TypeError||e instanceof SyntaxError){uncertain={fingerprint,request};$('goal-retry').hidden=false;status('Connection interrupted; the outcome is uncertain. Retry last request safely with the same operation ID.');}else{uncertain=null;$('goal-retry').hidden=true;status(`${e.message} Your draft is retained. Reload the editor to use current saved values.`);}return false;}
    finally{busy=false;render();}
  }
  function types(){
    const kind=$('goal-kind').value;
    $('goal-mode-label').hidden=kind!=='rating';$('goal-baseline-label').hidden=!['wins','games'].includes(kind);
    $('goal-scope').disabled=kind!=='manual';
    if(kind!=='manual')$('goal-scope').value=kind==='rating'?'ongoing':'session';
    $('goal-kind').disabled=!!editing;
    $('goal-mode').disabled=!!editing;
    $('goal-target').max=kind==='rating'?'10000':'1000000';
  }
  function open(g=null){
    editing=g?.id??null;draftRevision=getState().goalTracker.revision;
    $('goal-editor-title').textContent=g?'Edit goal':'Add a goal';
    $('goal-title').value=g?.title??'';$('goal-kind').value=g?.kind??'wins';$('goal-target').value=g?(g.kind==='rating'?getState().goals[g.mode]:g.target):5;
    $('goal-scope').value=g?.scope??'session';$('goal-mode').value=g?.mode??getState().activeMode;$('goal-baseline').value=g?.baseline??'session-start';
    $('goal-form').hidden=false;types();$('goal-title').focus();
  }
  function useRatingTarget(){if(!editing&&$('goal-kind').value==='rating')$('goal-target').value=getState().goals[$('goal-mode').value];}
  $('goal-kind').onchange=()=>{types();useRatingTarget();};
  $('goal-mode').onchange=useRatingTarget;
  $('goal-retry').onclick=async()=>{if(uncertain){const {operation,operationId,type,expectedRevision,...extra}=uncertain.request;if(await command(operation,extra,expectedRevision)&&['add','edit'].includes(operation)){$('goal-form').hidden=true;editing=null;}}};
  $('goal-add').onclick=()=>open();
  $('goal-cancel').onclick=()=>{$('goal-form').hidden=true;editing=null;status('Editor closed.');};
  $('goal-reload').onclick=async()=>{if(await confirmChange('Discard the current goal draft and reload saved values?'))open(getState().goalTracker.items.find(g=>g.id===editing));};
  $('goal-form').onsubmit=async e=>{
    e.preventDefault();if(busy)return;
    const kind=$('goal-kind').value,goal={title:$('goal-title').value.trim(),kind,target:Number($('goal-target').value),scope:$('goal-scope').value,mode:kind==='rating'?$('goal-mode').value:null,baseline:$('goal-baseline').value};
    if(editing){const old=getState().goalTracker.items.find(g=>g.id===editing);if(old&&(goal.scope!==old.scope||goal.baseline!==old.baseline)&&!await confirmChange('Changing scope or count baseline restarts progress for this goal. Continue?'))return;}
    const config=editing?{title:goal.title,target:goal.target,scope:goal.scope,baseline:goal.baseline}:goal;
    if(await command(editing?'edit':'add',{...(editing?{id:editing}:{}),goal:config},draftRevision)){$('goal-form').hidden=true;editing=null;}
  };
  for(const [id,portrait] of [['goal-visible-landscape',false],['goal-visible-portrait',true]])$(id).onchange=()=>{const checked=$(id).checked;void change(s=>{(portrait?s.portrait:s).widgets.goal.visible=checked;});};
  function render(){
    const s=getState();if(!s?.goalTracker)return;
    summaryKey=JSON.stringify(s.goalTracker.items.map(g=>goalSummary(s,g)));
    $('goals-corrections-note').hidden=!Object.values(s.session.corrections).some(v=>v!==0);
    $('goal-visible-landscape').checked=s.widgets.goal.visible;$('goal-visible-portrait').checked=s.portrait.widgets.goal.visible;
    $('goal-save').disabled=busy;$('goal-add').disabled=busy||s.goalTracker.items.length>=20;
    $('goal-limit').textContent=`${s.goalTracker.items.length} / 20 stored goals`;
    const active=$('goals-list'),archived=$('goals-archived');active.replaceChildren();archived.replaceChildren();
    if(!s.goalTracker.items.some(g=>!g.archived))active.append(el('p','small-note','No active goals. Add a goal to start tracking.'));
    for(const g of s.goalTracker.items){
      const p=goalSummary(s,g),card=el('article','goal-editor-card'),row=el('div','panel-heading');
      row.append(el('h3','',g.title),el('span','small-note',g.id===s.goalTracker.featuredId?'FEATURED':kinds[g.kind]));
      card.append(row,el('strong','goal-progress-value',p.value),el('p','small-note',p.detail),el('p','small-note',`${g.scope==='session'?'One session':'Ongoing'}${['wins','games'].includes(g.kind)?` · ${g.baseline==='from-now'?'from creation / repeat':'from session start'}`:''}`));
      const actions=el('div','button-row');
      if(!g.archived){
        actions.append(button(g.id===s.goalTracker.featuredId?'Unfeature':'Feature',()=>command('feature',{id:g.id===s.goalTracker.featuredId?null:g.id}),p.status==='ended'&&g.id!==s.goalTracker.featuredId),button('Edit',()=>open(g)));
        if(g.kind==='manual')actions.append(button('−1',()=>command('manual',{id:g.id,delta:-1}),p.status==='ended'||p.current<=0),button('+1',()=>command('manual',{id:g.id,delta:1}),p.status==='ended'||p.current>=1000000),button('Undo counter',()=>command('undo',{id:g.id}),p.status==='ended'||!g.manualUndo?.length));
        if(p.status==='ended')actions.append(button('Repeat in this session',async()=>{if(await confirmChange('Repeat this goal in the current session? Manual progress starts at zero; recorded goals use their selected baseline.'))await command('repeat',{id:g.id});}));
        actions.append(button('Archive',async()=>{if(await confirmChange('Archive this goal? Saved recap outcomes stay unchanged.'))await command('archive',{id:g.id});}));
      } else actions.append(button('Remove permanently',async()=>{if(await confirmChange('Permanently remove this archived goal to free a storage slot? Saved recap outcomes stay unchanged.'))await command('delete',{id:g.id});}));
      card.append(actions);(g.archived?archived:active).append(card);
    }
  }
  return {render,tick(){const s=getState();if(s?.goalTracker&&summaryKey!==JSON.stringify(s.goalTracker.items.map(g=>goalSummary(s,g))))render();},clear(){editing=null;draftRevision=null;uncertain=null;$('goal-form').hidden=true;$('goal-retry').hidden=true;},get busy(){return busy;}};
}
