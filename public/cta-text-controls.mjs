import {parseMessages,serializeMessages,sameMessages} from './cta-text.mjs';

// Page-local drafts and one-step undo; the server compares the exact saved list.
export function createCtaTextControls({getState,action,confirmChange}) {
  const $=suffix=>document.getElementById(`cta-text-${suffix}`),host=$('editor');
  let baseline=[],preview=null,undo=null,busy=false,dirty=false,format='structured';
  const current=()=>getState().ticker.messages;
  const message=text=>{$('status').textContent=text;};
  const invalidate=()=>{preview=null;$('apply').disabled=true;$('results').replaceChildren();};
  function buttons(){
    for(const id of ['toggle','source','format','operation','reload','preview'])$(id).disabled=busy;
    $('apply').disabled=busy||!preview;$('undo').disabled=busy||!undo;
  }
  function load(){baseline=structuredClone(current());$('source').value=format==='structured'?serializeMessages(baseline):'';dirty=false;invalidate();message('Draft loaded. Preview before applying.');}
  // Lock before opening confirmation as well as during the request (double-click safe).
  async function locked(fn){if(busy)return;busy=true;buttons();try{await fn();}catch{message('Save interrupted. Draft retained. Preview and retry; reload if saved messages changed.');}finally{busy=false;buttons();}}
  $('toggle').onclick=()=>locked(async()=>{
    if(!host.hidden&&dirty&&!await confirmChange('Discard unapplied text edits and return to the visual editor?'))return;
    host.hidden=!host.hidden;document.getElementById('message-list').hidden=!host.hidden;document.getElementById('add-message').hidden=!host.hidden;
    $('toggle').textContent=host.hidden?'Advanced text mode':'Visual editor';
    if(!host.hidden)load();else dirty=false;
  });
  $('format').onchange=()=>locked(async()=>{
    const next=$('format').value;
    if(!await confirmChange('Changing format discards this draft and starts a fresh draft. Simple list starts empty: it cannot preserve IDs, enabled flags, metadata or multiline text. Continue?')){$('format').value=format;return;}
    format=next;load();
  });
  $('source').oninput=()=>{dirty=true;invalidate();};
  $('operation').onchange=invalidate;
  $('reload').onclick=()=>locked(async()=>{if(!dirty||await confirmChange('Discard this draft and reload current messages?'))load();});
  $('preview').onclick=()=>{
    if(busy)return;invalidate();
    if(!sameMessages(current(),baseline)){message('Messages changed elsewhere. Draft retained. Copy it if needed, then reload before applying.');return;}
    const operation=$('operation').value,result=parseMessages($('source').value,format,baseline,operation),output=$('results');
    if(result.errors.length){message('Fix the following errors:');for(const error of result.errors){const p=document.createElement('p');p.textContent=`Line ${error.line}: ${error.message}`;output.append(p);}return;}
    const items=operation==='append'?[...baseline,...result.items]:result.items;
    preview={items,operation};message(`${operation==='append'?'Append':'Replace all'}: ${result.items.length} draft messages; ${items.length} total after applying. Tokens are shown literally.`);
    for(const item of items){const p=document.createElement('p');p.className='cta-text-preview-item';p.textContent=`${item.enabled?'Enabled':'Disabled'}\n${item.text}`;output.append(p);}buttons();
  };
  $('apply').onclick=()=>locked(async()=>{
    if(!preview)return;
    const proposed=preview,before=structuredClone(baseline);
    if(proposed.operation==='replace'&&!await confirmChange(`Replace all ${before.length} saved messages with ${proposed.items.length} messages? Simple-list replacements create new IDs and enabled messages. One-step undo lasts only on this page and requires no subsequent message changes.`))return;
    if(!sameMessages(current(),before)){invalidate();message('Messages changed elsewhere. Draft retained; reload before applying.');return;}
    if(sameMessages(proposed.items,before)){load();message('No message changes to apply.');return;}
    const ok=await action({type:'ticker-messages',messages:proposed.items,expectedMessages:before});
    if(ok){undo={before,after:structuredClone(proposed.items)};load();message('Applied. Undo is available below.');}
    else message('Not applied. Draft retained. Preview and retry; reload if saved messages changed.');
  });
  $('undo').onclick=()=>locked(async()=>{
    if(!undo)return;
    if(dirty&&!await confirmChange('Undo will discard your current draft. Continue?'))return;
    if(await action({type:'ticker-messages',messages:undo.before,expectedMessages:undo.after})){undo=null;load();message('Previous messages restored.');}
    else message('Undo could not apply. No newer messages were overwritten. Retry after a connection failure.');
  });
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  return {update(){
    if(busy)return;
    if(undo&&!sameMessages(current(),undo.after)){undo=null;buttons();}
    if(!host.hidden&&!sameMessages(current(),baseline)){invalidate();message('Messages changed elsewhere. Draft retained; reload before applying.');}
  },async canLeave(){return !busy&&(!dirty||await confirmChange('Leave this tab? Your text draft will remain here until you return; leaving the page discards it.'));}};
}
