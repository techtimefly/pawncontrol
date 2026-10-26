import {WIDGET_IDS} from './model.mjs';
export const WIDGET_LABELS={stats:'Stats',scoreboard:'Scoreboard',ticker:'CTA ticker',tips:'Chess tips',credits:'Credits (main overlay)',socials:'Socials',goal:'Goals',clock:'Session Clock'};
const widget=(state,layout,id)=>(layout==='portrait'?state.portrait:state).widgets[id];
export function acceptServerState(current,next,retired){
  if(!next||retired.has(next.instance)||(next.instance===current?.instance&&next.revision<current?.revision))return current;
  if(current?.instance&&next.instance!==current.instance)retired.add(current.instance);
  return next;
}

// All surfaces share pending state and the confirmed server value. Never keep a
// second visibility flag or send a copied layout with a visibility edit.
export function createVisibilityControls({getState,api,accept,document=globalThis.document,storage=globalThis.localStorage}) {
  const pending=new Set(),bindings=new Set();let message='';
  function render(){
    const state=getState();if(!state)return;
    for(const binding of bindings){
      const {node,layout,id}=binding;
      if(!node.isConnected){bindings.delete(binding);continue;}
      const busy=pending.has(`${layout}:${id}`),visible=widget(state,layout,id).visible;
      node.setAttribute('aria-disabled',String(busy));node.setAttribute('aria-busy',String(busy));
      if(node.type==='checkbox')node.checked=visible;
      else {node.setAttribute('aria-pressed',String(visible));node.textContent=`${layout==='portrait'?'Portrait':'Landscape'} ${busy?'Saving…':visible?'ON':'OFF'}`;}
    }
    for(const status of document.querySelectorAll('[data-visibility-status]'))status.textContent=message;
  }
  async function set(layout,id,visible){
    const key=`${layout}:${id}`;if(pending.has(key)){render();return false;}
    const current=getState(),expected=widget(current,layout,id).visible;
    if(expected===visible){render();return true;}
    const command={type:'widget-visibility',layout,id,visible,expected,expectedInstance:current.instance,expectedRevision:current.revision};
    pending.add(key);message='Saving visibility…';render();
    try {const result=await api('/api/action',command,{signal:AbortSignal.timeout(10000)});accept(result.state);message='Visibility saved.';return true;}
    catch(error){
      // A lost response may have committed. Read the current server state before
      // enabling retry; never restore a captured snapshot over a newer SSE event.
      let refreshed=false;try{accept(await api('/api/state',undefined,{signal:AbortSignal.timeout(10000)}));refreshed=true;}catch{}
      message=`Visibility could not be confirmed: ${error.message}. ${refreshed?'Current server values restored.':'Showing last confirmed values; reconnect to confirm.'} Retry the toggle.`;
      return false;
    } finally {pending.delete(key);render();}
  }
  function bind(node,layout,id){
    bindings.add({node,layout,id});
    const handler=()=>set(layout,id,node.type==='checkbox'?node.checked:!widget(getState(),layout,id).visible);
    if(node.type==='checkbox')node.onchange=handler;else node.onclick=handler;
    node.setAttribute('aria-label',`${WIDGET_LABELS[id]} — ${layout==='portrait'?'Portrait':'Landscape'} visibility`);render();return node;
  }
  function row(id){
    const root=document.createElement('div');root.className='visibility-row';
    const label=document.createElement('span');label.textContent=WIDGET_LABELS[id];root.append(label);
    for(const layout of ['landscape','portrait']){const node=document.createElement('button');node.type='button';node.className='secondary visibility-toggle';root.append(node);/* Bind after mounting below. */node.dataset.visibilityLayout=layout;node.dataset.visibilityId=id;}
    return root;
  }
  function mount(host,ids=WIDGET_IDS){
    host.replaceChildren(...ids.map(row));
    const status=document.createElement('p');status.className='small-note';status.dataset.visibilityStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.append(status);
    for(const node of host.querySelectorAll('[data-visibility-id]'))bind(node,node.dataset.visibilityLayout,node.dataset.visibilityId);
    render();
  }
  function dock(details){
    mount(details.querySelector('.visibility-controls'));
    try{details.open=storage.getItem('pawn-control-visibility-open')==='true';}catch{}
    details.addEventListener('toggle',()=>{try{storage.setItem('pawn-control-visibility-open',String(details.open));}catch{}});
  }
  return {set,bind,mount,dock,render};
}
