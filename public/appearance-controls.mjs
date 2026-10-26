import {COLOR_ROLES,BUILTIN_SCHEMES,appearanceOf,paletteFor,appearanceSnapshot,contrastText} from './appearance.mjs';
import {createMessageId} from './model.mjs';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const labels={background:'Credits background',surface:'Card surface',text:'Primary text',muted:'Muted text',accent:'Accent',border:'Border',streak:'Streak badge'};
const validColor=value=>/^#[a-f\d]{6}$/i.test(value);

// Drafts and one-step undo are page-local; only explicit Apply writes colors.
export function createAppearanceControls({getState,action,askName,confirmDelete}) {
  const $=id=>document.getElementById(id);
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const host=$('appearance-colors'),fields=new Map();
  let target='landscape',draft=null,undo=null,busy=false,selection='',schemeKey='',activeRole='accent';
  const status=$('appearance-status');
  const source=()=>target==='portrait'?'portrait':'landscape';
  const targets=()=>target==='both'?['landscape','portrait']:[target];
  const revision=state=>({expectedInstance:state.instance,expectedRevision:state.revision});
  const selectedScheme=()=>[...BUILTIN_SCHEMES,...appearanceOf(getState()).schemes].find(s=>s.id===selection);
  const palette=()=>draft?.colors??paletteFor(getState(),source());
  function begin(colors) {
    if(busy)return;
    const state=getState();
    if(!draft)draft={expected:appearanceSnapshot(state,target),...revision(state),before:structuredClone(appearanceOf(state).palettes)};
    draft.colors=structuredClone(colors);
    status.textContent='Preview only. Apply colors to update the selected orientation(s), or Cancel preview.';
    render();
  }
  function edit(role,value) {
    if(!validColor(value))return;
    begin({...palette(),[role]:value.toLowerCase()});
  }
  function swatch(value,label,onClick) {
    const b=node('button','','color-chip');b.type='button';b.style.backgroundColor=value;b.title=label;b.setAttribute('aria-label',label);b.disabled=busy;b.onclick=onClick;return b;
  }
  for(const role of COLOR_ROLES) {
    const group=node('div',undefined,'color-field'),label=node('label',labels[role]);label.htmlFor=`appearance-${role}-hex`;
    const row=node('div',undefined,'color-entry'),picker=node('input'),hex=node('input'),chips=node('div',undefined,'color-swatches');
    picker.type='color';picker.setAttribute('aria-label',`${labels[role]} color picker`);picker.id=`appearance-${role}-picker`;
    hex.type='text';hex.id=`appearance-${role}-hex`;hex.maxLength=7;hex.pattern='#[a-fA-F0-9]{6}';hex.spellcheck=false;hex.setAttribute('aria-label',`${labels[role]} hex color`);
    picker.oninput=()=>{hex.value=picker.value;hex.dataset.invalid='false';hex.setCustomValidity('');edit(role,picker.value);};
    picker.onfocus=hex.onfocus=()=>{activeRole=role;$('appearance-recent-role').value=role;};
    hex.oninput=()=>{const valid=validColor(hex.value);hex.dataset.invalid=String(!valid);hex.setCustomValidity(valid?'':'Use a six-digit hex color, such as #27baf3.');hex.setAttribute('aria-invalid',String(!valid));if(valid){picker.value=hex.value;edit(role,hex.value);}else render();};
    hex.onchange=()=>{if(!validColor(hex.value))hex.reportValidity();};
    chips.setAttribute('aria-label',`${labels[role]} palette swatches`);row.append(picker,hex);group.append(label,row,chips);host.append(group);fields.set(role,{picker,hex,chips});
  }
  function renderSample(colors) {
    const preview=$('appearance-preview');preview.style.backgroundColor=colors.background;preview.style.color=colors.text;
    const card=$('appearance-preview-card');card.style.backgroundColor=colors.surface;card.style.borderColor=colors.border;
    $('appearance-preview-name').textContent=getState().channel||getState().username;
    for(const element of preview.querySelectorAll('[data-color-role]'))element.style.color=colors[element.dataset.colorRole];
    $('appearance-preview-streak').style.backgroundColor=colors.streak;
    $('appearance-preview-streak').style.color=contrastText(colors.streak);
    $('appearance-preview-label').textContent=draft?`Preview · ${target==='both'?'Landscape and Portrait':target}`:`Saved colors · ${source()}`;
  }
  function render() {
    if(!getState())return;
    const appearance=appearanceOf(getState());
    if(undo&&!same(appearanceSnapshot(getState(),undo.target),undo.after)){undo=null;status.textContent='Undo is unavailable because appearance changed elsewhere.';}
    const colors=palette();
    for(const [role,{picker,hex,chips}] of fields) {
      picker.disabled=hex.disabled=busy;
      if(document.activeElement!==hex&&hex.dataset.invalid!=='true'){hex.value=colors[role];hex.setCustomValidity('');hex.setAttribute('aria-invalid','false');}
      picker.value=colors[role];
      const key=JSON.stringify([colors,busy]);
      if(chips.dataset.key!==key){chips.dataset.key=key;chips.replaceChildren(...COLOR_ROLES.map(key=>swatch(colors[key],`Use ${labels[key]} ${colors[key]} for ${labels[role]}`,()=>{hex.dataset.invalid='false';edit(role,colors[key]);hex.focus();})) );}
    }
    const schemes=[...BUILTIN_SCHEMES,...appearance.schemes],key=JSON.stringify(schemes);
    if(key!==schemeKey){schemeKey=key;const options=[node('option','Choose a scheme')];options[0].value='';for(const scheme of schemes){const option=node('option',`${scheme.name}${BUILTIN_SCHEMES.some(s=>s.id===scheme.id)?' · built in':''}`);option.value=scheme.id;options.push(option);}$('appearance-scheme').replaceChildren(...options);if(!schemes.some(s=>s.id===selection))selection='';$('appearance-scheme').value=selection;}
    const custom=appearance.schemes.some(s=>s.id===selection);
    for(const id of ['appearance-target','appearance-scheme','appearance-save'])$(id).disabled=busy;
    $('appearance-preview-scheme').disabled=busy||!selection;
    $('appearance-duplicate').disabled=busy||!selection;
    $('appearance-rename').disabled=$('appearance-delete').disabled=busy||!custom;
    $('appearance-apply').disabled=busy||!draft;
    $('appearance-cancel').disabled=busy||(!draft&&![...fields.values()].some(({hex})=>hex.dataset.invalid==='true'));
    $('appearance-undo').disabled=busy||!undo;
    $('appearance-source-note').textContent=target==='both'?'Editing and Save current start from Landscape colors; Apply uses these colors for both orientations.':'Save current captures the saved colors of this orientation.';
    const recent=$('appearance-recent'),recentKey=JSON.stringify([appearance.recent,busy]);
    if(recent.dataset.key!==recentKey){recent.dataset.key=recentKey;recent.replaceChildren(...appearance.recent.map(color=>{const item=node('span',color,'recent-color');item.prepend(swatch(color,`Use recent color ${color} for the selected role`,()=>{fields.get(activeRole).hex.dataset.invalid='false';edit(activeRole,color);fields.get(activeRole).hex.focus();}));return item;}));}
    $('appearance-recent-role').disabled=busy;
    renderSample(colors);
  }
  async function run(work) {
    if(busy)return;busy=true;render();
    try{await work();}catch(e){status.textContent=`Not applied. ${e.message}`;}finally{busy=false;render();}
  }
  function discard(){draft=null;for(const {hex} of fields.values())hex.dataset.invalid='false';}
  $('appearance-target').onchange=e=>{target=e.target.value;discard();status.textContent='Target changed. Preview edits were discarded.';render();};
  for(const role of COLOR_ROLES){const option=node('option',labels[role]);option.value=role;$('appearance-recent-role').append(option);}
  $('appearance-recent-role').value=activeRole;
  $('appearance-recent-role').onchange=e=>{activeRole=e.target.value;};
  $('appearance-scheme').onchange=e=>{selection=e.target.value;render();};
  $('appearance-preview-scheme').onclick=()=>{const scheme=selectedScheme();if(scheme){discard();begin(scheme.colors);}};
  $('appearance-cancel').onclick=()=>{discard();status.textContent='Preview canceled. Saved colors are unchanged.';render();};
  $('appearance-apply').onclick=()=>run(async()=>{
    if(!draft)return;
    const pending=structuredClone(draft),applyTarget=target;
    if([...fields.values()].some(({hex})=>!validColor(hex.value))){status.textContent='Enter valid six-digit hex colors before applying.';return;}
    if(!same(appearanceSnapshot(getState(),target),pending.expected)){status.textContent='Colors changed elsewhere. Cancel and preview again before applying.';return;}
    const ok=await action({type:'appearance',operation:'apply',target,colors:pending.colors,expected:pending.expected,expectedInstance:pending.expectedInstance,expectedRevision:pending.expectedRevision});
    if(!ok){status.textContent='Not applied. Cancel and preview again using the latest state.';return;}
    const expectedAfter=structuredClone(pending.expected);for(const layout of targets())expectedAfter.palettes[layout]=structuredClone(pending.colors);
    undo={target:applyTarget,palettes:Object.fromEntries(targets().map(layout=>[layout,pending.before[layout]])),after:expectedAfter};draft=null;
    status.textContent='Colors applied. Undo is available until these colors change or this page closes.';
  });
  $('appearance-undo').onclick=()=>run(async()=>{
    if(!undo)return;
    const record=structuredClone(undo),state=getState();
    const ok=await action({type:'appearance',operation:'restore',target:record.target,palettes:record.palettes,expected:record.after,...revision(state)});
    if(ok){undo=null;draft=null;status.textContent='Previous colors restored.';}else status.textContent='Undo was not applied. Newer colors are never overwritten.';
  });
  async function manage(operation) {
    return run(async()=>{
      const state=getState(),scheme=selectedScheme(),expectedSchemes=structuredClone(appearanceOf(state).schemes),guard=revision(state);
      let name;
      if(operation==='delete'){if(!scheme||!await confirmDelete(scheme.name))return;}
      else {name=await askName(operation,operation==='rename'?scheme?.name:operation==='duplicate'?`${scheme?.name} copy`:'');if(name===null)return;}
      const command={type:'appearance',operation,expectedSchemes,...guard};
      if(operation==='save')Object.assign(command,{id:createMessageId(),name,colors:paletteFor(state,source())});
      else if(operation==='duplicate')Object.assign(command,{id:createMessageId(),sourceId:scheme.id,name});
      else Object.assign(command,{id:scheme.id,...(operation==='rename'?{name}:{})});
      const ok=await action(command);
      if(ok){if(operation==='save'||operation==='duplicate')selection=command.id;if(operation==='delete')selection='';schemeKey='';status.textContent=operation==='delete'?'Saved scheme deleted. Applied colors stay unchanged.':'Scheme saved. Use Preview scheme, then Apply colors to use it.';}
      else status.textContent='Scheme was not saved. Review the current schemes and try again.';
    });
  }
  for(const operation of ['save','duplicate','rename','delete'])$(`appearance-${operation}`).onclick=()=>manage(operation);
  return {render,get busy(){return busy;},leave(){discard();status.textContent='';},clear(){discard();undo=null;selection='';}};
}
