// Optional color-only layer. A null palette leaves all legacy colors untouched.
export const COLOR_ROLES = ['background','surface','text','muted','accent','border','streak'];
export const BUILTIN_SCHEMES = [
  {id:'classic-chess',name:'Classic Chess',colors:{background:'#181914',surface:'#303429',text:'#faf5e8',muted:'#c9c4b5',accent:'#d9bb73',border:'#777d66',streak:'#f0a854'}},
  {id:'midnight',name:'Midnight',colors:{background:'#080e1b',surface:'#172239',text:'#eff6ff',muted:'#a7b9d3',accent:'#65d4ff',border:'#405878',streak:'#ffad66'}},
  {id:'high-contrast',name:'High Contrast',colors:{background:'#000000',surface:'#101010',text:'#ffffff',muted:'#dddddd',accent:'#ffff00',border:'#ffffff',streak:'#00ffff'}}
];
const layouts=['landscape','portrait'];
const clockColors={color:'#f2f4fa',background:'#272f40'};
const creditColors={background:'#000000',accent:'#00e5ff',headingColor:'#ffd700',detailColor:'#70a1ff'};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw Error(message);};
export function validColor(value){return typeof value==='string'&&/^#[a-fA-F0-9]{6}$/.test(value);}
// Choose the higher WCAG contrast ratio for an opaque six-digit sRGB color.
export function contrastText(color){
  if(!validColor(color))throw Error('Invalid contrast color');
  const linear=[1,3,5].map(i=>{const channel=parseInt(color.slice(i,i+2),16)/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;});
  const luminance=linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
  return (luminance+0.05)/0.05>=1.05/(luminance+0.05)?'#000000':'#ffffff';
}
export function validatePalette(colors){if(!exact(colors,COLOR_ROLES)||COLOR_ROLES.some(k=>!validColor(colors[k])))fail('Invalid color palette');return colors;}
export function appearanceDefaults(){return {version:1,palettes:{landscape:null,portrait:null},schemes:[],recent:[],overrides:{clock:{landscape:[],portrait:[]},credits:[]}};}
export function appearanceOf(state){return state.appearance??appearanceDefaults();}
export function validateAppearance(value){
  if(!exact(value,['version','palettes','schemes','recent','overrides'])||value.version!==1||!exact(value.palettes,layouts))fail('Invalid appearance settings');
  for(const layout of layouts)if(value.palettes[layout]!==null)validatePalette(value.palettes[layout]);
  if(!Array.isArray(value.schemes)||value.schemes.length>30||new Set(value.schemes.map(s=>s?.id)).size!==value.schemes.length)fail('Invalid saved schemes');
  for(const scheme of value.schemes){if(!exact(scheme,['id','name','colors'])||!validId(scheme.id)||BUILTIN_SCHEMES.some(s=>s.id===scheme.id)||!validName(scheme.name))fail('Invalid saved scheme');validatePalette(scheme.colors);}
  if(!Array.isArray(value.recent)||value.recent.length>12||value.recent.some(c=>!validColor(c))||new Set(value.recent).size!==value.recent.length)fail('Invalid recent colors');
  if(!exact(value.overrides,['clock','credits'])||!exact(value.overrides.clock,layouts))fail('Invalid color overrides');
  for(const [list,allowed] of [[value.overrides.credits,Object.keys(creditColors)],...layouts.map(l=>[value.overrides.clock[l],Object.keys(clockColors)])])if(!Array.isArray(list)||new Set(list).size!==list.length||list.some(k=>!allowed.includes(k)))fail('Invalid color overrides');
  return value;
}
function validId(id){return typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id)&&!['__proto__','prototype','constructor'].includes(id);}
function validName(name){return typeof name==='string'&&name.trim()===name&&name.length>0&&name.length<=40&&!/[\u0000-\u001f\u007f]/.test(name);}
function targets(target){if(![...layouts,'both'].includes(target))fail('Choose Landscape, Portrait, or Both');return target==='both'?layouts:[target];}
function pick(value,keys){return Object.fromEntries(keys.map(k=>[k,value?.[k]]));}
export function paletteFor(state,layout='landscape'){
  if(!layouts.includes(layout))fail('Invalid appearance orientation');
  return structuredClone(appearanceOf(state).palettes[layout]??{background:state.credits.background,surface:state.theme.background,text:state.theme.foreground,muted:state.theme.muted,accent:state.theme.accent,border:state.theme.border??'#344258',streak:state.theme.streak});
}
export function appearanceSnapshot(state,target){
  const a=appearanceOf(state),selected=targets(target);
  return structuredClone({palettes:pick(a.palettes,selected),theme:pick(state.theme,['background','foreground','muted','accent','streak','border']),credits:pick(state.credits,Object.keys(creditColors)),clock:Object.fromEntries(selected.map(l=>[l,pick(state.sessionClock[l],Object.keys(clockColors))])),overrides:{credits:a.overrides.credits,clock:pick(a.overrides.clock,selected)}});
}
export function previewAppearance(state,target,colors){
  validatePalette(colors);const copy=structuredClone(state);copy.appearance=structuredClone(appearanceOf(state));
  for(const layout of targets(target))copy.appearance.palettes[layout]=structuredClone(colors);
  return copy;
}
// Resolve only colors; typography, timing and composition remain owned by their existing settings.
export function resolveAppearance(state,layout='landscape'){
  const a=appearanceOf(state),p=a.palettes[layout];if(!p)return state;
  const theme={...state.theme,background:p.surface,foreground:p.text,muted:p.muted,accent:p.accent,streak:p.streak,border:p.border};
  const credits={...state.credits},clock={...state.sessionClock[layout]};
  for(const [key,role] of [['background','background'],['accent','accent'],['headingColor','text'],['detailColor','muted']])if(!a.overrides.credits.includes(key)&&credits[key].toLowerCase()===creditColors[key])credits[key]=p[role];
  for(const [key,role] of [['background','surface'],['color','text']])if(!a.overrides.clock[layout].includes(key)&&clock[key].toLowerCase()===clockColors[key])clock[key]=p[role];
  return {...state,theme,credits,sessionClock:{...state.sessionClock,[layout]:clock}};
}
export function markColorOverrides(state,kind,keys,layout){
  const relevant=keys.filter(k=>Object.hasOwn(kind==='clock'?clockColors:creditColors,k));if(!relevant.length)return;
  state.appearance=structuredClone(appearanceOf(state));
  const list=kind==='clock'?state.appearance.overrides.clock[layout]:state.appearance.overrides.credits;
  for(const key of relevant)if(!list.includes(key))list.push(key);
}
export function applyAppearance(state,action){
  const current=appearanceOf(state),a=structuredClone(current),op=action.operation;
  if(op==='apply'||op==='restore'){
    const selected=targets(action.target);
    if(!same(action.expected,appearanceSnapshot(state,action.target)))fail('Appearance changed elsewhere. Reload the preview before applying.');
    if(op==='apply'){
      validatePalette(action.colors);
      for(const layout of selected)a.palettes[layout]=structuredClone(action.colors);
      a.recent=[...new Set([...COLOR_ROLES.map(k=>action.colors[k].toLowerCase()),...a.recent])].slice(0,12);
    }else{
      if(!exact(action.palettes,selected))fail('Invalid color undo');
      for(const layout of selected){if(action.palettes[layout]!==null)validatePalette(action.palettes[layout]);a.palettes[layout]=structuredClone(action.palettes[layout]);}
    }
  }else{
    if(!same(action.expectedSchemes,current.schemes))fail('Saved schemes changed elsewhere. Reload before saving.');
    const found=a.schemes.find(s=>s.id===action.id);
    if(op==='save'||op==='duplicate'){
      if(!validId(action.id)||found||BUILTIN_SCHEMES.some(s=>s.id===action.id))fail('Choose a unique scheme identifier');
      if(!validName(action.name))fail('Scheme name must contain 1–40 characters');
      const colors=op==='save'?action.colors:[...BUILTIN_SCHEMES,...a.schemes].find(s=>s.id===action.sourceId)?.colors;
      validatePalette(colors);a.schemes.push({id:action.id,name:action.name,colors:structuredClone(colors)});
    }else if(op==='rename'){
      if(!found)fail('Saved scheme not found');if(!validName(action.name))fail('Scheme name must contain 1–40 characters');found.name=action.name;
    }else if(op==='delete'){
      if(!found)fail('Saved scheme not found');a.schemes=a.schemes.filter(s=>s.id!==action.id);
    }else fail('Invalid appearance operation');
  }
  state.appearance=validateAppearance(a);
}
