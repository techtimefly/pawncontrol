import {PLATFORMS,socialPlatforms,asSocialGroup,matchingSocialGroups,groupSocials,splitSocialPlatform} from './socials-model.mjs';
import {createMessageId} from './model.mjs';
import {createSocials,socialIconURL} from './socials-render.mjs';
export function createSocialsControls({getState,action,change,api,button,inputField,confirmChange}){
  const $=id=>document.getElementById(id),host=$('socials-editor'),status=$('socials-status'),preview=createSocials($('socials-preview'),{fit:false});
  let draft,baseline,dirty=false,busy=false,undo=null;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const message=text=>status.textContent=text;
  const refreshTools=()=>{const group=host.querySelector('[data-group]'),back=host.querySelector('[data-undo]');if(group)group.disabled=!matchingSocialGroups(draft.items).length;if(back)back.disabled=!undo||!same(draft,undo.after);};
  const mark=()=>{dirty=true;refreshTools();message('Draft not saved. Save socials to publish these edits.');};
  function field(label,type,value,set,options={}){const wrap=inputField(label,type,value,v=>{set(v);mark();},options);const input=wrap.querySelector('input,select');input.oninput=input.onchange;return wrap;}
  function load(){baseline=structuredClone(getState().socials);draft={...structuredClone(baseline),items:baseline.items.map(asSocialGroup)};dirty=false;draw();message('Current socials loaded.');}
  async function upload(entry,file){
    if(!file)return;busy=true;host.disabled=true;
    try{if(file.size>200*1024)throw Error('PNG must be at most 200 KiB');
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('Could not read file'));r.readAsDataURL(file);});
      const result=await api('/api/social-icons',{data});entry.icon=result.id;mark();draw();message('Icon uploaded. Save socials to publish this replacement.');
    }catch(e){message(`Upload failed: ${e.message}. Draft retained.`);}finally{busy=false;host.disabled=false;}
  }
  async function operation(description, transform){
    if(busy)return;const before=structuredClone(draft);busy=true;host.disabled=true;
    try{if(!await confirmChange(description))return;if(!same(before,draft)){message('Draft changed; review again.');return;}draft=transform(structuredClone(before));undo={before,after:structuredClone(draft)};mark();draw();}
    catch(e){message(e.message);}finally{busy=false;host.disabled=false;}
  }
  function draw(){
    host.replaceChildren();const options=document.createElement('div');options.className='form-grid';
    options.append(field('Display','select',draft.mode,v=>draft.mode=v,{items:[['rotate','Rotate one at a time'],['row','Static row (wraps)']]}),field('Interval (seconds)','number',draft.interval,v=>draft.interval=v,{min:5,max:300}),field('Text size','number',draft.font,v=>draft.font=v,{min:18,max:60}));host.append(options);
    draft.items.forEach((entry,i)=>{
      const card=document.createElement('section');card.className='bonus-editor-card';const controls=document.createElement('div');controls.className='button-row';
      controls.append(field('Enabled','checkbox',entry.enabled,v=>entry.enabled=v));
      for(const [label,offset] of [['Move up',-1],['Move down',1]]){const b=button(label,()=>{[draft.items[i],draft.items[i+offset]]=[draft.items[i+offset],draft.items[i]];mark();draw();});b.disabled=i+offset<0||i+offset>=draft.items.length;controls.append(b);}
      controls.append(button('Remove callout',()=>operation('Remove this callout and all its platforms from the draft? Undo is available until another edit.',s=>({...s,items:s.items.filter(e=>e.id!==entry.id)}))));card.append(controls);
      card.append(field('Handle, display text or short URL','text',entry.text,v=>entry.text=v,{maxlength:120}),field('Call to action (optional)','text',entry.cta,v=>entry.cta=v,{maxlength:80}));
      const platforms=document.createElement('div');platforms.className='social-platform-editor';
      entry.platforms.forEach((platform,j)=>{
        const row=document.createElement('section');row.className='social-platform';
        const image=document.createElement('img');image.className='social-icon';image.src=socialIconURL(platform);image.alt=PLATFORMS[platform.platform];row.append(image);
        row.append(field('Platform','select',platform.platform,v=>{platform.platform=v;image.src=socialIconURL(platform);image.alt=PLATFORMS[v];},{items:Object.entries(PLATFORMS)}),field('Show icon','checkbox',platform.enabled,v=>platform.enabled=v));
        const actions=document.createElement('div');actions.className='button-row';
        for(const [label,offset] of [['Icon left',-1],['Icon right',1]]){const b=button(label,()=>{[entry.platforms[j],entry.platforms[j+offset]]=[entry.platforms[j+offset],entry.platforms[j]];mark();draw();});b.disabled=j+offset<0||j+offset>=entry.platforms.length;actions.append(b);}
        const remove=button('Remove icon',()=>operation('Remove this platform from the draft? Its uploaded asset stays in the library. Undo is available until another edit.',s=>{s.items[i].platforms.splice(j,1);return s;}));remove.disabled=entry.platforms.length===1;actions.append(remove);
        const split=button('Split to callout',()=>operation('Create a separate callout immediately after this group with the same handle, CTA and enabled settings? Save publishes the split; Undo can recover it.',s=>splitSocialPlatform(s,entry.id,platform.id,createMessageId())));split.disabled=entry.platforms.length===1||draft.items.length>=20;actions.append(split);
        row.append(actions);
        const label=document.createElement('label');label.textContent=platform.icon?'Replace custom PNG':'Upload custom PNG';const file=document.createElement('input');file.type='file';file.accept='image/png';file.onchange=()=>upload(platform,file.files[0]);label.append(file);row.append(label);
        if(platform.icon)row.append(button('Use platform icon',()=>{platform.icon=null;mark();draw();}));platforms.append(row);
      });card.append(platforms);
      const addPlatform=button('+ Add platform',()=>{entry.platforms.push({id:createMessageId(),platform:'website',icon:null,enabled:true});mark();draw();});addPlatform.disabled=entry.platforms.length>=20;card.append(addPlatform);host.append(card);
    });
    const add=button('+ Add social',()=>{draft.items.push({id:createMessageId(),text:'',cta:'',enabled:true,platforms:[{id:createMessageId(),platform:'website',icon:null,enabled:true}]});mark();draw();});add.disabled=draft.items.length>=20;host.append(add);
    const note=document.createElement('p');note.className='small-note';note.textContent='Matching uses exact handle text, CTA and callout enabled state, including case, spaces and @. Different URLs or CTAs remain separate. Groups over 20 icons are excluded. Nothing merges automatically.';host.append(note);
    const matches=matchingSocialGroups(draft.items);
    const group=button('Group matching handles',()=>{const matches=matchingSocialGroups(draft.items);return operation(matches.map(ids=>{const entries=ids.map(id=>draft.items.find(e=>e.id===id));return entries.length+' callouts for “'+entries[0].text+'” become one callout with '+entries.reduce((n,e)=>n+e.platforms.length,0)+' icons: '+entries.flatMap(e=>e.platforms.map(p=>PLATFORMS[p.platform]+(p.icon?' (custom)':'')+(p.enabled?'':' (hidden)'))).join(', ')+'. CTA: '+(entries[0].cta||'(none)')+'.';}).join('\n')+'\nThe first callout position is retained; icon order and enabled settings are preserved. Save publishes; Undo recovers the original entries.',s=>matches.reduce((current,ids)=>groupSocials(current,ids),s));});group.dataset.group='';group.disabled=!matches.length;host.append(group);
    const undoButton=button('Undo last group / split / removal',()=>{if(undo&&same(draft,undo.after)){draft=structuredClone(undo.before);undo=null;mark();draw();}});undoButton.dataset.undo='';undoButton.disabled=!undo||!same(draft,undo.after);host.append(undoButton);
  }
  $('socials-save').onclick=async()=>{
    if(busy)return;busy=true;host.disabled=true;$('socials-save').disabled=true;$('socials-reload').disabled=true;
    const proposed=structuredClone(draft),expected=structuredClone(baseline);
    try{if(await action({type:'socials-edit',socials:proposed,expected})){load();message('Socials saved.');}else message('Save failed. Draft retained. If another client edited socials, reload current socials before retrying.');}
    finally{busy=false;host.disabled=false;$('socials-save').disabled=false;$('socials-reload').disabled=false;}
  };
  $('socials-reload').onclick=()=>{if(!busy){undo=null;load();}};
  $('socials-visible').onchange=e=>change(s=>s.widgets.socials.visible=e.target.checked);
  for(const command of ['previous','next'])$(`socials-${command}`).onclick=()=>action({type:'socials-playback',command,currentId:$('socials-preview').dataset.socialId});
  $('socials-pause').onclick=()=>action({type:'socials-playback',command:getState().socialsPlayback.paused?'play':'pause'});
  $('socials-library').onclick=async()=>{
    const library=$('socials-library-items');library.replaceChildren();
    try{const result=await api('/api/social-icons');for(const icon of result.icons){const row=document.createElement('div');row.className='button-row';const img=document.createElement('img');img.className='social-icon';img.src=socialIconURL({icon:icon.id});img.alt='Custom icon';row.append(img,button(icon.referenced?'Used by entry / preset':'Delete unused icon',async()=>{try{if(busy||[draft,undo?.before].filter(Boolean).some(s=>s.items.some(e=>socialPlatforms(e).some(p=>p.icon===icon.id))))throw Error('Icon is used by your draft or undo history');await api('/api/social-icons/delete',{id:icon.id});row.remove();message('Unused icon deleted.');}catch(e){message(e.message);}}));row.lastChild.disabled=icon.referenced||draft?.items.some(e=>socialPlatforms(e).some(p=>p.icon===icon.id))||undo?.before.items.some(e=>socialPlatforms(e).some(p=>p.icon===icon.id));library.append(row);}if(!result.icons.length)library.textContent='No uploaded icons.';}catch(e){message(e.message);}
  };
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  return {render(){const state=getState();if(!draft||!dirty&&!busy&&!same(baseline,state.socials))load();if(dirty&&!same(baseline,state.socials)&&!busy)message('Socials changed elsewhere. Your draft is retained. Reload current socials discards this draft.');$('socials-visible').checked=state.widgets.socials.visible;$('socials-pause').textContent=state.socialsPlayback.paused?'Resume':'Pause';preview.update({...state.socials,font:24},state.socialsPlayback);}};
}
