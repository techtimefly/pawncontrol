import {starterList,addMissingDefaults} from './starter-templates.mjs';

// One-step undo lives only in this page. Exact-list checks also run on the server.
export function createStarterControls({getState,action,confirmChange,settle=async()=>{},render=()=>{}}){
  let busy=false;
  const records=[];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const current=kind=>kind==='tips'?getState().tips.items:getState().ticker.messages;
  const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
  function buttons(){for(const r of records){r.restore.disabled=r.add.disabled=busy;r.undoButton.disabled=busy||!r.undo;}}
  for(const kind of ['tips','cta']){
    const host=document.getElementById(`${kind}-starter-controls`),label=kind==='tips'?'tips':'CTA messages';
    const r={kind,undo:null,restore:node('button',`Restore default ${label}`),add:node('button','Add missing defaults'),undoButton:node('button','Undo template change'),status:node('p','Starter templates shipped with this installed app version. Undo lasts only on this page.')};
    const row=node('div','');row.className='button-row';r.status.className='small-note';r.status.setAttribute('role','status');
    for(const b of [r.restore,r.add,r.undoButton]){b.type='button';b.className='secondary';b.onpointerdown=e=>e.preventDefault();row.append(b);}
    host.append(row,r.status);records.push(r);
    async function run(operation){
      if(busy)return;
      busy=true;buttons();const focus=document.activeElement;let applied=false;
      try{
        await settle();
        const before=structuredClone(current(kind));
        if(operation==='undo'&&(!r.undo||!same(before,r.undo.after))){r.undo=null;r.status.textContent='Undo unavailable: content changed elsewhere.';return;}
        const proposed=operation==='restore'?starterList(kind):operation==='add'?addMissingDefaults(kind,before):structuredClone(r.undo.before);
        if(same(before,proposed)){r.status.textContent='No changes needed.';return;}
        const details=proposed.map((item,i)=>`${i+1}. ${item.enabled?'Enabled':'Disabled'} | ${item.id}${kind==='tips'?` | ${item.title} | ${item.category}`:''}\n${item.text}`).join('\n\n');
        const warning=operation==='restore'?`Replace all ${before.length} saved ${label}, including custom content, with ${proposed.length} starter templates?`:operation==='add'?`Add ${proposed.length-before.length} missing defaults (${proposed.length} total)? Matching IDs or exact content are skipped, including edited or disabled entries.`:`Restore the previous ${proposed.length} ${label}?`;
        const approved=await confirmChange(`${warning}\n\nThese are starter templates shipped with this installed app version. Only this content list changes. Layout, appearance, timing, pause, visibility and session stay unchanged.\n\nConfirming discards any unsaved visual edits in this list. Advanced text drafts are retained; reload them explicitly before another save. Cancel keeps your draft. Undo is one step, page-local, and refuses newer list changes.\n\nExact resulting list (${proposed.length}):\n\n${details}`);
        if(!approved)return;
        if(!same(current(kind),before)){r.status.textContent='Content changed elsewhere. Nothing applied; drafts retained. Review again.';return;}
        const ok=await action({type:'starter-templates',kind,operation,expected:before,...(operation==='undo'?{items:proposed}:{})});
        if(!ok){r.status.textContent='Not applied. Drafts retained. Check connection and review again; newer content is never overwritten.';return;}
        applied=true;r.undo=operation==='undo'?null:{before,after:structuredClone(proposed)};
        r.status.textContent=operation==='undo'?'Previous content restored.':`Applied ${proposed.length} ${label}. One-step undo available until this list changes or the page closes.`;
      }catch{r.status.textContent='Interrupted. Drafts retained. Review current content before retrying.';}
      finally{busy=false;buttons();if(applied)render();else if(focus?.isConnected)focus.focus();}
    }
    r.restore.onclick=()=>run('restore');r.add.onclick=()=>run('add');r.undoButton.onclick=()=>run('undo');
  }
  // Opening a dialog blurs an active visual field: suppress its autosave until
  // the user chooses. Cancellation leaves the original DOM and value intact.
  document.addEventListener('change',e=>{if(busy&&e.target.closest('#message-list, #tips-items'))e.stopImmediatePropagation();},true);
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
  buttons();
  return {get busy(){return busy;},update(){for(const r of records)if(r.undo&&!same(current(r.kind),r.undo.after)){r.undo=null;r.status.textContent='Undo unavailable: this content list changed. Review current content before another template change.';}buttons();}};
}
